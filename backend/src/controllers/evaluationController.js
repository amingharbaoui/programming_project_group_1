const db = require("../config/db");
const { ok, fail } = require("../utils/response");

const GELDIGE_TYPES = ["tussentijds", "finaal"];

function getUserId(req, fallbackId) {
  return Number(req.user?.id || fallbackId);
}

async function getLatestDossierForStudent(conn, studentId) {
  const [rows] = await conn.query(
    `
    SELECT id, student_id, mentor_id, stagebegeleider_id, status
    FROM stagedossiers
    WHERE student_id = ?
    ORDER BY aangemaakt_op DESC
    LIMIT 1
    `,
    [studentId]
  );
  return rows[0] || null;
}

async function getActiveCompetencies(conn) {
  const [rows] = await conn.query(
    `
    SELECT c.id, c.code, c.naam, c.beschrijving, c.gewicht_percentage, c.volgorde
    FROM competenties c
    JOIN competentie_profielen p ON p.id = c.competentie_profiel_id
    WHERE c.is_actief = 1
    ORDER BY (p.status = 'actief') DESC, c.volgorde ASC, c.id ASC
    `
  );
  return rows;
}

// Admin/docent opent een evaluatiemoment (tussentijds of finaal) voor een dossier.
async function openEvaluation(req, res) {
  const { stagedossierId, stagedossier_id, type } = req.body;
  const dossierId = Number(stagedossierId || stagedossier_id);
  const finalType = (type || "").trim();

  if (!dossierId) {
    return fail(res, 400, "stagedossierId is verplicht");
  }
  if (!GELDIGE_TYPES.includes(finalType)) {
    return fail(res, 400, "type moet 'tussentijds' of 'finaal' zijn");
  }

  try {
    const [dossier] = await db.query("SELECT id FROM stagedossiers WHERE id = ? LIMIT 1", [dossierId]);
    if (dossier.length === 0) {
      return fail(res, 404, "Stagedossier niet gevonden");
    }

    const [existing] = await db.query(
      "SELECT id, status FROM evaluaties WHERE stagedossier_id = ? AND type = ? LIMIT 1",
      [dossierId, finalType]
    );

    if (existing.length > 0) {
      // Bestaat al: enkel heropenen als ze nog niet open stond.
      if (existing[0].status === "niet_open") {
        await db.query("UPDATE evaluaties SET status = 'open', aangepast_op = NOW() WHERE id = ?", [existing[0].id]);
      }
      return ok(res, { id: existing[0].id, type: finalType, status: "open" }, "Evaluatie bestond al en staat open");
    }

    const [result] = await db.query(
      `
      INSERT INTO evaluaties (stagedossier_id, type, status, aangemaakt_op, aangepast_op)
      VALUES (?, ?, 'open', NOW(), NOW())
      `,
      [dossierId, finalType]
    );

    return ok(res, { id: result.insertId, type: finalType, status: "open" }, "Evaluatie geopend");
  } catch (error) {
    return fail(res, 500, "Evaluatie openen mislukt", error.message);
  }
}

// Haalt de evaluaties van de (laatste) dossier van een student op, met matrix + bestaande scores.
async function getEvaluationsForStudent(req, res) {
  const requestedStudentId = Number(req.params.studentId || req.query.studentId || req.user?.id);
  const currentUserId = getUserId(req);
  const role = req.user?.hoofdrol;

  if (!requestedStudentId) {
    return fail(res, 400, "studentId is verplicht");
  }

  try {
    if (role === "student" && requestedStudentId !== currentUserId) {
      return fail(res, 403, "Studenten mogen alleen hun eigen evaluatie bekijken");
    }

    const dossier = await getLatestDossierForStudent(db, requestedStudentId);
    if (!dossier) {
      return ok(res, { stagedossierId: null, competenties: [], evaluaties: [] }, "Geen stagedossier gevonden");
    }

    if (role === "mentor" && dossier.mentor_id !== currentUserId) {
      return fail(res, 403, "Mentor is niet gekoppeld aan deze student");
    }
    if (role === "docent" && dossier.stagebegeleider_id !== currentUserId) {
      return fail(res, 403, "Docent is niet gekoppeld aan deze student");
    }

    const competenties = await getActiveCompetencies(db);

    const [evaluaties] = await db.query(
      `
      SELECT id, type, status, verslag, eindpresentatie_score, competentie_score, eindcijfer,
             student_ingediend_op, mentor_ingediend_op, docent_geregistreerd_op, vrijgegeven_op
      FROM evaluaties
      WHERE stagedossier_id = ?
      ORDER BY FIELD(type, 'tussentijds', 'finaal')
      `,
      [dossier.id]
    );

    const evaluatieIds = evaluaties.map((e) => e.id);
    let scores = [];
    if (evaluatieIds.length > 0) {
      const [scoreRows] = await db.query(
        `
        SELECT id, evaluatie_id, competentie_id, ingevuld_door_id, rol, score, motivering, feedback, ingediend
        FROM competentie_scores
        WHERE evaluatie_id IN (?)
        `,
        [evaluatieIds]
      );
      scores = scoreRows;
    }

    const result = evaluaties.map((e) => ({
      ...e,
      scores: scores.filter((s) => s.evaluatie_id === e.id)
    }));

    return ok(res, { stagedossierId: dossier.id, competenties, evaluaties: result }, "Evaluaties opgehaald");
  } catch (error) {
    return fail(res, 500, "Evaluaties ophalen mislukt", error.message);
  }
}

module.exports = {
  openEvaluation,
  getEvaluationsForStudent
};
