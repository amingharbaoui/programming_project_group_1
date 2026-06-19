const db = require("../config/db");
const { ok, fail } = require("../utils/response");
const { meld } = require("../utils/notify");
const { buildSimplePdf } = require("../utils/pdf");

const GELDIGE_TYPES = ["tussentijds", "finaal"];

function getUserId(req, fallbackId) {
  return Number(req.user?.id || fallbackId);
}

async function getLatestDossierForStudent(conn, studentId) {
  const [rows] = await conn.query(
    `SELECT id, student_id, mentor_id, stagebegeleider_id, status
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

// Admin/docent opent een evaluatiemoment (tussentijds of finaal) voor een dossier.
async function openEvaluation(req, res) {
  const { stagedossierId, stagedossier_id, type } = req.body;
  const dossierId = Number(stagedossierId || stagedossier_id);
  const finalType = (type || "").trim();

  if (!dossierId) return fail(res, 400, "stagedossierId is verplicht");
  if (!GELDIGE_TYPES.includes(finalType)) return fail(res, 400, "type moet 'tussentijds' of 'finaal' zijn");

  try {
    const [dossier] = await db.query("SELECT id FROM stagedossiers WHERE id = ? LIMIT 1", [dossierId]);
    if (dossier.length === 0) return fail(res, 404, "Stagedossier niet gevonden");

    const [existing] = await db.query(
      "SELECT id, status FROM evaluaties WHERE stagedossier_id = ? AND type = ? LIMIT 1",
      [dossierId, finalType]
    );

    if (existing.length > 0) {
      if (existing[0].status === "niet_open") {
        await db.query("UPDATE evaluaties SET status = 'open', aangepast_op = NOW() WHERE id = ?", [existing[0].id]);
      }
      return ok(res, { id: existing[0].id, type: finalType, status: "open" }, "Evaluatie bestond al en staat open");
    }

    const [result] = await db.query(
      `INSERT INTO evaluaties (stagedossier_id, type, status, aangemaakt_op, aangepast_op)
       VALUES (?, ?, 'open', NOW(), NOW())`,
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

  if (!requestedStudentId) return fail(res, 400, "studentId is verplicht");

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
      `SELECT id, type, status, verslag, mentor_algemene_feedback, eindpresentatie_score, competentie_score, eindcijfer,
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

    // Student en mentor mogen het berekende resultaat pas zien nadat de docent het vrijgegeven heeft.
    const verbergResultaat = role === "student" || role === "mentor";
    const result = evaluaties.map((e) => {
      const basis = verbergResultaat && e.status !== "vrijgegeven"
        ? { ...e, eindcijfer: null, competentie_score: null, eindpresentatie_score: null }
        : e;
      return { ...basis, scores: scores.filter((s) => s.evaluatie_id === e.id) };
    });

    return ok(res, { stagedossierId: dossier.id, competenties, evaluaties: result }, "Evaluaties opgehaald");
  } catch (error) {
    return fail(res, 500, "Evaluaties ophalen mislukt", error.message);
  }
}

async function loadEvaluationWithDossier(conn, evaluationId) {
  const [rows] = await conn.query(
    `SELECT e.id, e.type, e.status, e.stagedossier_id, e.eindcijfer,
            e.eindpresentatie_score, e.competentie_score, e.vrijgegeven_op,
            d.student_id, d.mentor_id, d.stagebegeleider_id
     FROM evaluaties e
     JOIN stagedossiers d ON d.id = e.stagedossier_id
     WHERE e.id = ? LIMIT 1`,
    [evaluationId]
  );
  return rows[0] || null;
}

function userMayEditAsRole(dossier, role, userId) {
  if (role === "student") return dossier.student_id === userId;
  if (role === "mentor")  return dossier.mentor_id  === userId;
  if (role === "docent")  return dossier.stagebegeleider_id === userId;
  return false;
}

// Student/mentor/docent slaat scores + motivatie per competentie op.
async function saveScores(req, res) {
  const evaluationId = Number(req.params.id ?? req.params.evaluationId);
  const role = req.user?.hoofdrol;
  const userId = getUserId(req);
  const ingediend = Boolean(req.body?.ingediend);
  const scores = Array.isArray(req.body?.scores) ? req.body.scores : [];

  if (!evaluationId) return fail(res, 400, "Ongeldig evaluatie-id");
  if (!["student", "mentor", "docent"].includes(role)) return fail(res, 403, "Deze rol kan geen scores invullen");
  if (scores.length === 0) return fail(res, 400, "Geen scores meegegeven");

  // Een ingevulde score moet op de schaal 1-5 liggen.
  for (const s of scores) {
    if (s.score === null || s.score === undefined || s.score === "") continue;
    const waarde = Number(s.score);
    if (!Number.isFinite(waarde) || waarde < 1 || waarde > 5) {
      return fail(res, 400, "Score moet tussen 1 en 5 liggen");
    }
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const evaluatie = await loadEvaluationWithDossier(conn, evaluationId);
    if (!evaluatie) { await conn.rollback(); return fail(res, 404, "Evaluatie niet gevonden"); }
    if (evaluatie.status === "niet_open") { await conn.rollback(); return fail(res, 409, "Deze evaluatie is nog niet geopend"); }
    if (evaluatie.status === "vrijgegeven") { await conn.rollback(); return fail(res, 409, "Deze evaluatie is al vrijgegeven"); }
    if (!userMayEditAsRole(evaluatie, role, userId)) { await conn.rollback(); return fail(res, 403, "Je bent niet gekoppeld aan deze evaluatie"); }

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
           (evaluatie_id, competentie_id, ingevuld_door_id, rol, score, motivering, feedback, ingediend, ingediend_op, aangemaakt_op, aangepast_op)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           score = VALUES(score), motivering = VALUES(motivering), feedback = VALUES(feedback),
           ingediend = VALUES(ingediend), ingediend_op = VALUES(ingediend_op), aangepast_op = NOW()`,
        [evaluationId, competentieId, userId, role, scoreValue, s.motivering || s.motivatie || null, s.feedback || null, ingediend ? 1 : 0, ingediend ? new Date() : null]
      );
    }

    // Algemene praktijkfeedback van de mentor (story 33) — los van de per-competentie velden.
    if (role === "mentor") {
      const algemeneFeedback = req.body.algemeneFeedback ?? req.body.algemene_feedback;
      if (algemeneFeedback !== undefined) {
        await conn.query(
          "UPDATE evaluaties SET mentor_algemene_feedback = ?, aangepast_op = NOW() WHERE id = ?",
          [algemeneFeedback || null, evaluationId]
        );
      }
    }

    let nieuweStatus = evaluatie.status;
    if (ingediend) {
      const andereRol = role === "student" ? "mentor" : role === "mentor" ? "student" : null;
      const andereRolIngediend = andereRol
        ? await conn.query(
            `SELECT COUNT(*) AS aantal
             FROM competentie_scores
             WHERE evaluatie_id = ? AND rol = ? AND ingediend = 1`,
            [evaluationId, andereRol]
          )
        : [[{ aantal: 0 }]];

      if (role === "student") {
        nieuweStatus = Number(andereRolIngediend[0][0].aantal) > 0 ? "klaar_voor_docent" : "student_ingediend";
        await conn.query("UPDATE evaluaties SET status = ?, student_ingediend_op = NOW(), aangepast_op = NOW() WHERE id = ?", [nieuweStatus, evaluationId]);
      } else if (role === "mentor") {
        nieuweStatus = Number(andereRolIngediend[0][0].aantal) > 0 ? "klaar_voor_docent" : "mentor_ingediend";
        await conn.query("UPDATE evaluaties SET status = ?, mentor_ingediend_op = NOW(), aangepast_op = NOW() WHERE id = ?", [nieuweStatus, evaluationId]);
      }
    }

    await conn.commit();

    if (ingediend) {
      try {
        if (role === "student" && evaluatie.mentor_id) {
          await meld(evaluatie.mentor_id, {
            titel: "Evaluatie ingevuld door student",
            bericht: "De student heeft de evaluatie ingevuld.",
            aangemaaktDoorId: userId,
            stagedossierId: evaluatie.stagedossier_id
          });
        }
        // Als de student als laatste indient en de evaluatie daardoor klaar staat voor de docent,
        // moet ook de docent verwittigd worden (anders mist die de melding).
        if (role === "student" && nieuweStatus === "klaar_voor_docent" && evaluatie.stagebegeleider_id) {
          await meld(evaluatie.stagebegeleider_id, {
            titel: "Evaluatie klaar voor docent",
            bericht: "Student en mentor hebben de evaluatie ingevuld.",
            aangemaaktDoorId: userId,
            stagedossierId: evaluatie.stagedossier_id
          });
        }
        if (role === "mentor" && evaluatie.stagebegeleider_id) {
          await meld(evaluatie.stagebegeleider_id, {
            titel: "Evaluatie klaar voor docent",
            bericht: nieuweStatus === "klaar_voor_docent"
              ? "Student en mentor hebben de evaluatie ingevuld."
              : "De mentor heeft de evaluatie ingevuld.",
            aangemaaktDoorId: userId,
            stagedossierId: evaluatie.stagedossier_id
          });
        }
      } catch (notifyError) {
        console.error("Melding evaluatie mislukt:", notifyError.message);
      }
    }

    return ok(res, { evaluatieId: evaluationId, rol: role, ingediend, status: nieuweStatus }, ingediend ? "Scores ingediend" : "Scores opgeslagen");
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

// Docent berekent het eindresultaat uit de docentscores.
async function calculateResult(req, res) {
  const evaluationId = Number(req.params.id ?? req.params.evaluationId);
  const role = req.user?.hoofdrol;
  const userId = getUserId(req);
  const eindpresentatieScore = req.body?.eindpresentatieScore ?? req.body?.eindpresentatie_score ?? null;
  const verslag = req.body?.verslag ?? null;

  if (!evaluationId) return fail(res, 400, "Ongeldig evaluatie-id");
  if (eindpresentatieScore !== null) {
    const score = Number(eindpresentatieScore);
    if (!Number.isFinite(score) || score < 0 || score > 20) {
      return fail(res, 400, "eindpresentatieScore moet tussen 0 en 20 liggen");
    }
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const evaluatie = await loadEvaluationWithDossier(conn, evaluationId);
    if (!evaluatie) { await conn.rollback(); return fail(res, 404, "Evaluatie niet gevonden"); }
    if (!mayActAsDocent(evaluatie, role, userId)) { await conn.rollback(); return fail(res, 403, "Alleen de gekoppelde docent of administratie kan dit doen"); }
    if (evaluatie.status === "vrijgegeven") { await conn.rollback(); return fail(res, 409, "Resultaat is al vrijgegeven"); }
    // Berekenen kan pas nadat student en mentor hun evaluatie indienden (status klaar_voor_docent of later).
    if (!["klaar_voor_docent", "geregistreerd", "klaar_voor_vrijgave"].includes(evaluatie.status)) {
      await conn.rollback();
      return fail(res, 409, "De student en de mentor moeten eerst hun evaluatie indienen");
    }

    const [rows] = await conn.query(
      `SELECT cs.competentie_id, cs.score, c.gewicht_percentage
       FROM competentie_scores cs
       JOIN competenties c ON c.id = cs.competentie_id
       WHERE cs.evaluatie_id = ? AND cs.rol = 'docent'`,
      [evaluationId]
    );

    const active = await getActiveCompetencies(conn);
    const gescoord = rows.filter((r) => r.score !== null && r.score !== undefined);
    if (gescoord.length < active.length) {
      await conn.rollback();
      return fail(res, 400, "Docent heeft nog niet alle competenties gescoord");
    }

    // Story 43: de finale beoordeling vereist finale mentorinput en een gegeven eindpresentatie.
    if (evaluatie.type === "finaal") {
      const ontbreekt = [];

      const [mentorScores] = await conn.query(
        "SELECT COUNT(*) AS aantal FROM competentie_scores WHERE evaluatie_id = ? AND rol = 'mentor' AND ingediend = 1",
        [evaluationId]
      );
      if (Number(mentorScores[0].aantal) === 0) ontbreekt.push("de finale mentorinput");

      const [pres] = await conn.query(
        "SELECT status FROM planning_momenten WHERE stagedossier_id = ? AND type = 'eindpresentatie' ORDER BY id DESC LIMIT 1",
        [evaluatie.stagedossier_id]
      );
      if (pres.length === 0 || !["gegeven", "geweest"].includes(pres[0].status)) ontbreekt.push("een gegeven eindpresentatie");

      if (ontbreekt.length > 0) {
        await conn.rollback();
        return fail(res, 409, `Het eindresultaat kan nog niet berekend worden — ontbrekend: ${ontbreekt.join(" en ")}.`);
      }
    }

    const totaalGewicht = gescoord.reduce((s, r) => s + Number(r.gewicht_percentage || 0), 0);
    if (totaalGewicht <= 0) { await conn.rollback(); return fail(res, 400, "Gewichten ontbreken op de competenties"); }

    const gewogen = gescoord.reduce((s, r) => s + Number(r.score) * Number(r.gewicht_percentage || 0), 0) / totaalGewicht;
    const competentieScore = Math.round(gewogen * 100) / 100;

    const isFinaal = evaluatie.type === "finaal";
    // Competentiescore (1-5) omgezet naar /20.
    const competentie20 = Math.round(competentieScore * 4 * 100) / 100;
    // Finaal eindcijfer = 80% competenties + 20% eindpresentatie (als die gescoord is), anders enkel competenties.
    let eindcijfer = null;
    if (isFinaal) {
      const presentatie = eindpresentatieScore != null
        ? Number(eindpresentatieScore)
        : (evaluatie.eindpresentatie_score != null ? Number(evaluatie.eindpresentatie_score) : null);
      eindcijfer = presentatie != null
        ? Math.round((competentie20 * 0.8 + presentatie * 0.2) * 100) / 100
        : competentie20;
    }
    const nieuweStatus = isFinaal ? "klaar_voor_vrijgave" : "geregistreerd";

    await conn.query(
      `UPDATE evaluaties
       SET competentie_score = ?, eindcijfer = ?, eindpresentatie_score = COALESCE(?, eindpresentatie_score),
           verslag = COALESCE(?, verslag),
           status = ?, docent_geregistreerd_op = NOW(), aangepast_op = NOW()
       WHERE id = ?`,
      [competentieScore, eindcijfer, eindpresentatieScore, verslag, nieuweStatus, evaluationId]
    );

    await conn.commit();

    // Tussentijds geregistreerd → student en mentor kunnen het verslag bekijken (mockup-belofte).
    if (!isFinaal) {
      await meld(evaluatie.student_id, {
        titel: "Tussentijdse evaluatie geregistreerd",
        bericht: "De docent registreerde de tussentijdse bespreking. Je kan het verslag en de feedback bekijken.",
        aangemaaktDoorId: userId,
        stagedossierId: evaluatie.stagedossier_id,
      });
      await meld(evaluatie.mentor_id, {
        titel: "Tussentijdse evaluatie geregistreerd",
        bericht: "De docent registreerde de tussentijdse bespreking van je stagiair.",
        aangemaaktDoorId: userId,
        stagedossierId: evaluatie.stagedossier_id,
      });
    }

    return ok(res, { evaluatieId: evaluationId, competentieScore, eindcijfer, status: nieuweStatus }, isFinaal ? "Eindresultaat berekend" : "Tussentijdse evaluatie geregistreerd");
  } catch (error) {
    await conn.rollback();
    return fail(res, 500, "Resultaat berekenen mislukt", error.message);
  } finally {
    conn.release();
  }
}

// Docent geeft het eindresultaat vrij.
async function releaseResult(req, res) {
  const evaluationId = Number(req.params.id ?? req.params.evaluationId);
  const role = req.user?.hoofdrol;
  const userId = getUserId(req);

  if (!evaluationId) return fail(res, 400, "Ongeldig evaluatie-id");

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const evaluatie = await loadEvaluationWithDossier(conn, evaluationId);
    if (!evaluatie) { await conn.rollback(); return fail(res, 404, "Evaluatie niet gevonden"); }
    if (!mayActAsDocent(evaluatie, role, userId)) { await conn.rollback(); return fail(res, 403, "Alleen de gekoppelde docent of administratie kan vrijgeven"); }
    if (evaluatie.status !== "klaar_voor_vrijgave") { await conn.rollback(); return fail(res, 409, "Resultaat moet eerst berekend worden voor het vrijgegeven kan worden"); }

    // Finale-gating: logboek moet afgewerkt zijn en de eindpresentatie moet gegeven zijn.
    const [openWeken] = await conn.query(
      `SELECT COUNT(*) AS aantal FROM logboek_weken
       WHERE stagedossier_id = ?
         AND status IN ('ingediend', 'afgecheckt_door_mentor', 'teruggestuurd_door_mentor', 'teruggestuurd_door_docent')`,
      [evaluatie.stagedossier_id]
    );
    if (openWeken[0].aantal > 0) {
      await conn.rollback();
      return fail(res, 409, "Er zijn nog logboekweken die niet volledig nagekeken zijn — die moeten eerst afgehandeld zijn voor je het resultaat vrijgeeft.");
    }
    const [pres] = await conn.query(
      "SELECT status FROM planning_momenten WHERE stagedossier_id = ? AND type = 'eindpresentatie' ORDER BY id DESC LIMIT 1",
      [evaluatie.stagedossier_id]
    );
    if (pres.length === 0 || !["gegeven", "geweest"].includes(pres[0].status)) {
      await conn.rollback();
      return fail(res, 409, "De eindpresentatie moet eerst gepland en gegeven zijn voor je het resultaat vrijgeeft.");
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

    // Student (en administratie) verwittigen dat het resultaat vrijgegeven is.
    try {
      await meld(evaluatie.student_id, {
        titel: "Eindresultaat vrijgegeven",
        bericht: `Je eindresultaat (${evaluatie.eindcijfer}) is vrijgegeven.`,
        aangemaaktDoorId: userId,
        stagedossierId: evaluatie.stagedossier_id
      });
      if (evaluatie.mentor_id) {
        await meld(evaluatie.mentor_id, {
          titel: "Eindresultaat vrijgegeven",
          bericht: "Het eindresultaat van je stagiair is vrijgegeven.",
          aangemaaktDoorId: userId,
          stagedossierId: evaluatie.stagedossier_id
        });
      }
      const [admins] = await db.query(
        "SELECT id FROM gebruikers WHERE hoofdrol = 'administratie' AND status = 'actief'"
      );
      for (const a of admins) {
        await meld(a.id, {
          titel: "Resultaat vrijgegeven",
          bericht: "Een eindresultaat is vrijgegeven; het eindoverzicht kan opgemaakt worden.",
          aangemaaktDoorId: userId,
          stagedossierId: evaluatie.stagedossier_id
        });
      }
    } catch (notifyError) {
      console.error("Melding vrijgave mislukt:", notifyError.message);
    }

    return ok(res, { evaluatieId: evaluationId, eindcijfer: evaluatie.eindcijfer, status: "vrijgegeven" }, "Eindresultaat vrijgegeven");
  } catch (error) {
    await conn.rollback();
    return fail(res, 500, "Vrijgeven mislukt", error.message);
  } finally {
    conn.release();
  }
}

// Lijst van studenten gekoppeld aan de huidige docent/mentor (voor de evaluatie-selector).
async function getMyStudents(req, res) {
  const role = req.user?.hoofdrol;
  const userId = getUserId(req);

  let where;
  let params;
  if (role === "docent") { where = "d.stagebegeleider_id = ?"; params = [userId]; }
  else if (role === "mentor") { where = "d.mentor_id = ?"; params = [userId]; }
  else if (role === "administratie") { where = "1 = 1"; params = []; }
  else return fail(res, 403, "Geen toegang voor deze rol");

  try {
    const [rows] = await db.query(
      `SELECT d.id AS dossier_id, d.status AS dossier_status,
              s.gebruiker_id AS student_id, s.studentennummer,
              g.voornaam, g.achternaam,
              b.naam AS bedrijf_naam
       FROM stagedossiers d
       JOIN studenten s ON s.gebruiker_id = d.student_id
       JOIN gebruikers g ON g.id = s.gebruiker_id
       JOIN bedrijven b ON b.id = d.bedrijf_id
       WHERE ${where}
       ORDER BY g.achternaam, g.voornaam`,
      params
    );
    return ok(res, rows, "Studenten opgehaald");
  } catch (error) {
    return fail(res, 500, "Studenten ophalen mislukt", error.message);
  }
}

// GET /api/students/me/final-result — vrijgegeven eindresultaat van de ingelogde student.
// Toont niets zolang het resultaat niet vrijgegeven is (Story 10).
async function getMyFinalResult(req, res) {
  const studentId = getUserId(req);
  try {
    const dossier = await getLatestDossierForStudent(db, studentId);
    if (!dossier) return ok(res, { vrijgegeven: false }, "Geen stagedossier gevonden");

    const [drows] = await db.query(
      `SELECT id, status, eindresultaat, eindresultaat_vrijgegeven_op, eindoverzicht_gegenereerd_op
       FROM stagedossiers WHERE id = ? LIMIT 1`,
      [dossier.id]
    );
    const d = drows[0];

    if (!d || d.eindresultaat_vrijgegeven_op == null) {
      return ok(res, { vrijgegeven: false }, "Eindresultaat is nog niet vrijgegeven");
    }

    const [erows] = await db.query(
      `SELECT verslag, eindcijfer FROM evaluaties
       WHERE stagedossier_id = ? AND type = 'finaal' ORDER BY id DESC LIMIT 1`,
      [dossier.id]
    );
    const eind = erows[0] || {};

    const [orows] = await db.query(
      `SELECT doc.bestand_url, doc.bestand_naam
       FROM documenten doc
       JOIN document_soorten ds ON ds.id = doc.document_soort_id
       WHERE doc.stagedossier_id = ? AND ds.type = 'eindoverzicht'
       ORDER BY doc.versie_nummer DESC LIMIT 1`,
      [dossier.id]
    );

    return ok(
      res,
      {
        vrijgegeven: true,
        eindresultaat: d.eindresultaat,
        eindcijfer: eind.eindcijfer ?? d.eindresultaat,
        eindfeedback: eind.verslag || null,
        vrijgegevenOp: d.eindresultaat_vrijgegeven_op,
        status: d.status,
        eindoverzichtUrl: orows[0]?.bestand_url || null,
        eindoverzichtNaam: orows[0]?.bestand_naam || null
      },
      "Eindresultaat opgehaald"
    );
  } catch (error) {
    return fail(res, 500, "Eindresultaat ophalen mislukt", error.message);
  }
}

// GET /api/students/me/eindoverzicht.pdf — eindoverzicht als PDF, enkel na vrijgave (Story 10).
async function downloadMyEindoverzicht(req, res) {
  const studentId = getUserId(req);
  try {
    const [rows] = await db.query(
      `SELECT d.id, d.dossiernummer, d.status, d.startdatum, d.einddatum, d.totaal_uren,
              d.eindresultaat, d.eindresultaat_vrijgegeven_op, d.opleiding, d.academiejaar,
              CONCAT(gs.voornaam, ' ', gs.achternaam) AS student_naam, s.studentennummer,
              b.naam AS bedrijf_naam,
              CONCAT(gm.voornaam, ' ', gm.achternaam) AS mentor_naam,
              CONCAT(gd.voornaam, ' ', gd.achternaam) AS docent_naam
       FROM stagedossiers d
       JOIN gebruikers gs ON gs.id = d.student_id
       JOIN studenten s ON s.gebruiker_id = d.student_id
       JOIN bedrijven b ON b.id = d.bedrijf_id
       LEFT JOIN gebruikers gm ON gm.id = d.mentor_id
       LEFT JOIN gebruikers gd ON gd.id = d.stagebegeleider_id
       WHERE d.student_id = ?
       ORDER BY d.aangemaakt_op DESC LIMIT 1`,
      [studentId]
    );
    const d = rows[0];
    if (!d) return fail(res, 404, "Geen stagedossier gevonden");
    if (d.eindresultaat_vrijgegeven_op == null) {
      return fail(res, 403, "Eindresultaat is nog niet vrijgegeven");
    }

    const [er] = await db.query(
      `SELECT verslag, eindcijfer FROM evaluaties WHERE stagedossier_id = ? AND type = 'finaal' ORDER BY id DESC LIMIT 1`,
      [d.id]
    );
    const eind = er[0] || {};
    const cijfer = eind.eindcijfer ?? d.eindresultaat;
    const feedbackRegels = eind.verslag ? String(eind.verslag).match(/.{1,80}(\s|$)/g) || [String(eind.verslag)] : ["-"];

    const lines = [
      "Eindoverzicht stage",
      `Dossier: ${d.dossiernummer || "-"}`,
      `Student: ${d.student_naam} (${d.studentennummer || "-"})`,
      `Opleiding: ${d.opleiding || "-"} | ${d.academiejaar || "-"}`,
      `Bedrijf: ${d.bedrijf_naam || "-"}`,
      `Mentor: ${d.mentor_naam || "-"}`,
      `Stagebegeleider: ${d.docent_naam || "-"}`,
      `Periode: ${d.startdatum ? String(d.startdatum).slice(0, 10) : "-"} tot ${d.einddatum ? String(d.einddatum).slice(0, 10) : "-"}`,
      `Totaal uren: ${d.totaal_uren ?? "-"}`,
      `Eindresultaat: ${cijfer ?? "-"}`,
      `Vrijgegeven op: ${String(d.eindresultaat_vrijgegeven_op).slice(0, 10)}`,
      "",
      "Eindfeedback:",
      ...feedbackRegels.map((r) => `  ${r.trim()}`)
    ];

    const pdf = buildSimplePdf(lines);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="eindoverzicht-${d.dossiernummer || d.id}.pdf"`);
    return res.send(pdf);
  } catch (error) {
    return fail(res, 500, "Eindoverzicht downloaden mislukt", error.message);
  }
}

module.exports = { openEvaluation, getEvaluationsForStudent, saveScores, calculateResult, releaseResult, getMyStudents, getMyFinalResult, downloadMyEindoverzicht };
