const db = require("../config/db");
const { ok, fail } = require("../utils/response");

function getUserId(req) {
  return Number(req.user?.id || 1);
}

async function getLatestDossier(conn, studentId) {
  const [rows] = await conn.query(
    `SELECT id, student_id, mentor_id, stagebegeleider_id
     FROM stagedossiers
     WHERE student_id = ?
     ORDER BY aangemaakt_op DESC
     LIMIT 1`,
    [studentId]
  );
  return rows[0] || null;
}

async function getActiveCompetencies(conn) {
  const [rows] = await conn.query(
    `SELECT c.id, c.code, c.naam, c.beschrijving, c.gewicht_percentage, c.volgorde
     FROM competenties c
     JOIN competentie_profielen p ON p.id = c.competentie_profiel_id
     WHERE c.is_actief = 1
     ORDER BY (p.status = 'actief') DESC, c.volgorde ASC, c.id ASC`
  );
  return rows;
}

/* GET /api/evaluations/:studentId
   Haalt evaluaties + competenties + scores op voor de student */
async function getEvaluationsForStudent(req, res) {
  const studentId = Number(req.params.studentId || req.user?.id);
  const currentUserId = getUserId(req);
  const role = req.user?.hoofdrol;

  if (!studentId) return fail(res, 400, "studentId is verplicht");
  if (role === "student" && studentId !== currentUserId) {
    return fail(res, 403, "Studenten mogen alleen hun eigen evaluatie bekijken");
  }

  try {
    const dossier = await getLatestDossier(db, studentId);
    if (!dossier) {
      return ok(res, { stagedossierId: null, competenties: [], evaluaties: [] }, "Geen stagedossier gevonden");
    }

    const competenties = await getActiveCompetencies(db);

    const [evaluaties] = await db.query(
      `SELECT id, type, status, verslag, eindpresentatie_score, competentie_score, eindcijfer,
              student_ingediend_op, mentor_ingediend_op, docent_geregistreerd_op, vrijgegeven_op
       FROM evaluaties
       WHERE stagedossier_id = ?
       ORDER BY FIELD(type, 'tussentijds', 'finaal')`,
      [dossier.id]
    );

    const evaluatieIds = evaluaties.map((e) => e.id);
    let scores = [];
    if (evaluatieIds.length > 0) {
      const [scoreRows] = await db.query(
        `SELECT id, evaluatie_id, competentie_id, ingevuld_door_id, rol, score, motivering, feedback, ingediend
         FROM competentie_scores
         WHERE evaluatie_id IN (?)`,
        [evaluatieIds]
      );
      scores = scoreRows;
    }

    const result = evaluaties.map((e) => ({
      ...e,
      scores: scores.filter((s) => s.evaluatie_id === e.id),
    }));

    return ok(res, { stagedossierId: dossier.id, competenties, evaluaties: result }, "Evaluaties opgehaald");
  } catch (error) {
    return fail(res, 500, "Evaluaties ophalen mislukt", error.message);
  }
}

/* POST /api/evaluations/:evaluationId/scores
   Student slaat scores + motivering op of dient in */
async function saveScores(req, res) {
  const evaluationId = Number(req.params.evaluationId);
  const role = req.user?.hoofdrol;
  const userId = getUserId(req);
  const ingediend = Boolean(req.body.ingediend);
  const scores = Array.isArray(req.body.scores) ? req.body.scores : [];

  if (!evaluationId) return fail(res, 400, "Ongeldig evaluatie-id");
  if (!["student", "mentor", "docent"].includes(role)) {
    return fail(res, 403, "Deze rol kan geen scores invullen");
  }
  if (scores.length === 0) return fail(res, 400, "Geen scores meegegeven");

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [evRows] = await conn.query(
      `SELECT e.id, e.type, e.status, d.student_id, d.mentor_id, d.stagebegeleider_id
       FROM evaluaties e
       JOIN stagedossiers d ON d.id = e.stagedossier_id
       WHERE e.id = ? LIMIT 1`,
      [evaluationId]
    );
    if (evRows.length === 0) {
      await conn.rollback();
      return fail(res, 404, "Evaluatie niet gevonden");
    }

    const ev = evRows[0];
    if (ev.status === "niet_open") {
      await conn.rollback();
      return fail(res, 409, "Deze evaluatie is nog niet geopend");
    }
    if (ev.status === "vrijgegeven") {
      await conn.rollback();
      return fail(res, 409, "Deze evaluatie is al vrijgegeven");
    }

    /* Controleer of de gebruiker bij deze evaluatie hoort */
    const toegestaan =
      (role === "student" && ev.student_id === userId) ||
      (role === "mentor"  && ev.mentor_id  === userId) ||
      (role === "docent"  && ev.stagebegeleider_id === userId);
    if (!toegestaan) {
      await conn.rollback();
      return fail(res, 403, "Je bent niet gekoppeld aan deze evaluatie");
    }

    /* Bij indienen: alle competenties moeten een score hebben */
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
        `INSERT INTO competentie_scores
           (evaluatie_id, competentie_id, ingevuld_door_id, rol, score, motivering, ingediend, ingediend_op, aangemaakt_op, aangepast_op)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           score = VALUES(score),
           motivering = VALUES(motivering),
           ingediend = VALUES(ingediend),
           ingediend_op = VALUES(ingediend_op),
           aangepast_op = NOW()`,
        [evaluationId, competentieId, userId, role, scoreValue, s.motivering || null, ingediend ? 1 : 0, ingediend ? new Date() : null]
      );
    }

    if (ingediend && role === "student") {
      await conn.query(
        `UPDATE evaluaties SET status = 'student_ingediend', student_ingediend_op = NOW(), aangepast_op = NOW() WHERE id = ?`,
        [evaluationId]
      );
    }

    await conn.commit();
    return ok(res, { evaluatieId: evaluationId, ingediend }, ingediend ? "Zelfevaluatie ingediend" : "Scores opgeslagen");
  } catch (error) {
    await conn.rollback();
    return fail(res, 500, "Scores opslaan mislukt", error.message);
  } finally {
    conn.release();
  }
}

module.exports = { getEvaluationsForStudent, saveScores };
