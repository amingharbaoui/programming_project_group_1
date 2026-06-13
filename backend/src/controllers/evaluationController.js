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

async function loadEvaluationWithDossier(conn, evaluationId) {
  const [rows] = await conn.query(
    `
    SELECT e.id, e.type, e.status, e.stagedossier_id, e.eindcijfer,
           d.student_id, d.mentor_id, d.stagebegeleider_id
    FROM evaluaties e
    JOIN stagedossiers d ON d.id = e.stagedossier_id
    WHERE e.id = ?
    LIMIT 1
    `,
    [evaluationId]
  );
  return rows[0] || null;
}

function userMayEditAsRole(dossier, role, userId) {
  if (role === "student") return dossier.student_id === userId;
  if (role === "mentor") return dossier.mentor_id === userId;
  if (role === "docent") return dossier.stagebegeleider_id === userId;
  return false;
}

// Student/mentor/docent slaat zijn scores + motivatie per competentie op (alleen bij open evaluatie).
async function saveScores(req, res) {
  const evaluationId = Number(req.params.evaluationId);
  const role = req.user?.hoofdrol;
  const userId = getUserId(req);
  const ingediend = Boolean(req.body.ingediend);
  const scores = Array.isArray(req.body.scores) ? req.body.scores : [];

  if (!evaluationId) {
    return fail(res, 400, "Ongeldig evaluatie-id");
  }
  if (!["student", "mentor", "docent"].includes(role)) {
    return fail(res, 403, "Deze rol kan geen scores invullen");
  }
  if (scores.length === 0) {
    return fail(res, 400, "Geen scores meegegeven");
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const evaluatie = await loadEvaluationWithDossier(conn, evaluationId);
    if (!evaluatie) {
      await conn.rollback();
      return fail(res, 404, "Evaluatie niet gevonden");
    }
    if (evaluatie.status === "niet_open") {
      await conn.rollback();
      return fail(res, 409, "Deze evaluatie is nog niet geopend");
    }
    if (evaluatie.status === "vrijgegeven") {
      await conn.rollback();
      return fail(res, 409, "Deze evaluatie is al vrijgegeven en kan niet meer aangepast worden");
    }
    if (!userMayEditAsRole(evaluatie, role, userId)) {
      await conn.rollback();
      return fail(res, 403, "Je bent niet gekoppeld aan deze evaluatie");
    }

    // Bij indienen moeten alle actieve competenties een score hebben.
    if (ingediend) {
      const active = await getActiveCompetencies(conn);
      const ingevuld = scores
        .filter((s) => s.score !== null && s.score !== undefined && s.score !== "")
        .map((s) => Number(s.competentieId || s.competentie_id));
      const ontbreekt = active.filter((c) => !ingevuld.includes(c.id));
      if (ontbreekt.length > 0) {
        await conn.rollback();
        return fail(res, 400, `Nog niet alle competenties ingevuld (${ontbreekt.length} ontbreken)`);
      }
    }

    for (const s of scores) {
      const competentieId = Number(s.competentieId || s.competentie_id);
      if (!competentieId) continue;
      const scoreValue = s.score === "" || s.score === undefined ? null : s.score;

      await conn.query(
        `
        INSERT INTO competentie_scores
          (evaluatie_id, competentie_id, ingevuld_door_id, rol, score, motivering, feedback, ingediend, ingediend_op, aangemaakt_op, aangepast_op)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          score = VALUES(score),
          motivering = VALUES(motivering),
          feedback = VALUES(feedback),
          ingediend = VALUES(ingediend),
          ingediend_op = VALUES(ingediend_op),
          aangepast_op = NOW()
        `,
        [
          evaluationId,
          competentieId,
          userId,
          role,
          scoreValue,
          s.motivering || s.motivatie || null,
          s.feedback || null,
          ingediend ? 1 : 0,
          ingediend ? new Date() : null
        ]
      );
    }

    // Status van de evaluatie bijwerken wanneer een rol indient.
    if (ingediend) {
      if (role === "student") {
        await conn.query("UPDATE evaluaties SET status = 'student_ingediend', student_ingediend_op = NOW(), aangepast_op = NOW() WHERE id = ?", [evaluationId]);
      } else if (role === "mentor") {
        await conn.query("UPDATE evaluaties SET status = 'mentor_ingediend', mentor_ingediend_op = NOW(), aangepast_op = NOW() WHERE id = ?", [evaluationId]);
      }
    }

    await conn.commit();
    return ok(res, { evaluatieId: evaluationId, rol: role, ingediend }, ingediend ? "Scores ingediend" : "Scores opgeslagen");
  } catch (error) {
    await conn.rollback();
    return fail(res, 500, "Scores opslaan mislukt", error.message);
  } finally {
    conn.release();
  }
}

function mayActAsDocent(evaluatie, role, userId) {
  if (role === "administratie") return true;
  if (role === "docent") return evaluatie.stagebegeleider_id === userId;
  return false;
}

// Docent registreert (tussentijds) of berekent het eindresultaat (finaal) uit de docentscores.
async function calculateResult(req, res) {
  const evaluationId = Number(req.params.evaluationId);
  const role = req.user?.hoofdrol;
  const userId = getUserId(req);
  const eindpresentatieScore = req.body.eindpresentatieScore ?? req.body.eindpresentatie_score ?? null;

  if (!evaluationId) {
    return fail(res, 400, "Ongeldig evaluatie-id");
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const evaluatie = await loadEvaluationWithDossier(conn, evaluationId);
    if (!evaluatie) {
      await conn.rollback();
      return fail(res, 404, "Evaluatie niet gevonden");
    }
    if (!mayActAsDocent(evaluatie, role, userId)) {
      await conn.rollback();
      return fail(res, 403, "Alleen de gekoppelde docent of administratie kan dit doen");
    }
    if (evaluatie.status === "vrijgegeven") {
      await conn.rollback();
      return fail(res, 409, "Resultaat is al vrijgegeven");
    }

    // Gewogen gemiddelde van de docentscores per competentie.
    const [rows] = await conn.query(
      `
      SELECT cs.competentie_id, cs.score, c.gewicht_percentage
      FROM competentie_scores cs
      JOIN competenties c ON c.id = cs.competentie_id
      WHERE cs.evaluatie_id = ? AND cs.rol = 'docent'
      `,
      [evaluationId]
    );

    const active = await getActiveCompetencies(conn);
    const gescoord = rows.filter((r) => r.score !== null && r.score !== undefined);
    if (gescoord.length < active.length) {
      await conn.rollback();
      return fail(res, 400, "Docent heeft nog niet alle competenties gescoord");
    }

    const totaalGewicht = gescoord.reduce((s, r) => s + Number(r.gewicht_percentage || 0), 0);
    if (totaalGewicht <= 0) {
      await conn.rollback();
      return fail(res, 400, "Gewichten ontbreken op de competenties");
    }
    const gewogen = gescoord.reduce((s, r) => s + Number(r.score) * Number(r.gewicht_percentage || 0), 0) / totaalGewicht;
    const competentieScore = Math.round(gewogen * 100) / 100;

    const isFinaal = evaluatie.type === "finaal";
    const eindcijfer = isFinaal ? competentieScore : null;
    const nieuweStatus = isFinaal ? "klaar_voor_vrijgave" : "geregistreerd";

    await conn.query(
      `
      UPDATE evaluaties
      SET competentie_score = ?, eindcijfer = ?, eindpresentatie_score = COALESCE(?, eindpresentatie_score),
          status = ?, docent_geregistreerd_op = NOW(), aangepast_op = NOW()
      WHERE id = ?
      `,
      [competentieScore, eindcijfer, eindpresentatieScore, nieuweStatus, evaluationId]
    );

    await conn.commit();
    return ok(res, { evaluatieId: evaluationId, competentieScore, eindcijfer, status: nieuweStatus }, isFinaal ? "Eindresultaat berekend" : "Tussentijdse evaluatie geregistreerd");
  } catch (error) {
    await conn.rollback();
    return fail(res, 500, "Resultaat berekenen mislukt", error.message);
  } finally {
    conn.release();
  }
}

// Docent geeft het berekende eindresultaat vrij; dan pas zichtbaar voor de student.
async function releaseResult(req, res) {
  const evaluationId = Number(req.params.evaluationId);
  const role = req.user?.hoofdrol;
  const userId = getUserId(req);

  if (!evaluationId) {
    return fail(res, 400, "Ongeldig evaluatie-id");
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const evaluatie = await loadEvaluationWithDossier(conn, evaluationId);
    if (!evaluatie) {
      await conn.rollback();
      return fail(res, 404, "Evaluatie niet gevonden");
    }
    if (!mayActAsDocent(evaluatie, role, userId)) {
      await conn.rollback();
      return fail(res, 403, "Alleen de gekoppelde docent of administratie kan vrijgeven");
    }
    if (evaluatie.status !== "klaar_voor_vrijgave") {
      await conn.rollback();
      return fail(res, 409, "Resultaat moet eerst berekend worden voor het vrijgegeven kan worden");
    }

    await conn.query(
      "UPDATE evaluaties SET status = 'vrijgegeven', vrijgegeven_door_id = ?, vrijgegeven_op = NOW(), aangepast_op = NOW() WHERE id = ?",
      [userId, evaluationId]
    );

    await conn.query(
      "UPDATE stagedossiers SET eindresultaat = ?, eindresultaat_vrijgegeven_op = NOW(), status = 'resultaat_vrijgegeven', aangepast_op = NOW() WHERE id = ?",
      [evaluatie.eindcijfer, evaluatie.stagedossier_id]
    );

    await conn.commit();
    return ok(res, { evaluatieId: evaluationId, eindcijfer: evaluatie.eindcijfer, status: "vrijgegeven" }, "Eindresultaat vrijgegeven");
  } catch (error) {
    await conn.rollback();
    return fail(res, 500, "Vrijgeven mislukt", error.message);
  } finally {
    conn.release();
  }
}

module.exports = {
  openEvaluation,
  getEvaluationsForStudent,
  saveScores,
  calculateResult,
  releaseResult
};
