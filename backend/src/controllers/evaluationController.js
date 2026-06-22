const db = require("../config/db");
const fs = require("fs");
const path = require("path");
const { ok, fail } = require("../utils/response");
const { meld } = require("../utils/notify");
const { buildSimplePdf } = require("../utils/pdf");

const GELDIGE_TYPES = ["tussentijds", "finaal"];

// Document-soort opzoeken of aanmaken (zelfde patroon als internshipController.ensureDocumentType).
async function ensureDocumentSoort(conn, type, naam) {
  const [bestaand] = await conn.query(
    "SELECT id FROM document_soorten WHERE type = ? AND status = 'actief' ORDER BY id LIMIT 1",
    [type]
  );
  if (bestaand.length > 0) return bestaand[0].id;
  const [r] = await conn.query(
    `INSERT INTO document_soorten (naam, type, is_verplicht, is_vast, status, aangemaakt_op, aangepast_op)
     VALUES (?, ?, 0, 0, 'actief', NOW(), NOW())`,
    [naam, type]
  );
  return r.insertId;
}

// Genereert een PDF-overzicht van een (tussentijdse of finale) evaluatie en hangt het als document aan het
// dossier, zichtbaar voor student/mentor/docent. Faalt zacht: een mislukking blokkeert de registratie niet.
async function genereerEvaluatieDocument(evaluatie) {
  const conn = await db.getConnection();
  try {
    const [scoreRows] = await conn.query(
      `SELECT c.naam AS competentie, es.rol, es.score, es.motivering
       FROM competentie_scores es
       JOIN competenties c ON c.id = es.competentie_id
       WHERE es.evaluatie_id = ?
       ORDER BY c.naam, FIELD(es.rol, 'student','mentor','docent')`,
      [evaluatie.id]
    );
    const [info] = await conn.query(
      `SELECT d.dossiernummer, d.id AS dossier_id,
              gs.voornaam AS s_v, gs.achternaam AS s_a
       FROM stagedossiers d
       LEFT JOIN gebruikers gs ON gs.id = d.student_id
       WHERE d.id = ? LIMIT 1`,
      [evaluatie.stagedossier_id]
    );
    const d = info[0] || {};
    const typeLabel = evaluatie.type === "finaal" ? "Finale evaluatie" : "Tussentijdse evaluatie";
    const rolLabel = { student: "Zelf", mentor: "Mentor", docent: "Docent" };
    const lines = [
      `${typeLabel} — stage`,
      `Dossier: ${d.dossiernummer || evaluatie.stagedossier_id}`,
      `Student: ${[d.s_v, d.s_a].filter(Boolean).join(" ") || "-"}`,
      `Geregistreerd op: ${new Date().toISOString().slice(0, 10)}`,
      "",
      "Scores per competentie:",
    ];
    for (const r of scoreRows) {
      lines.push(`  ${r.competentie} — ${rolLabel[r.rol] || r.rol}: ${r.score ?? "-"}/5${r.motivering ? ` (${String(r.motivering).slice(0, 120)})` : ""}`);
    }
    if (evaluatie.verslag) { lines.push("", "Eindfeedback:", `  ${String(evaluatie.verslag).slice(0, 500)}`); }

    const uploadsDir = path.join(__dirname, "../../uploads/evaluaties");
    fs.mkdirSync(uploadsDir, { recursive: true });
    const safe = String(d.dossiernummer || evaluatie.stagedossier_id).replace(/[^a-zA-Z0-9_-]/g, "-");
    const bestandsnaam = `evaluatie-${evaluatie.type}-${safe}-${evaluatie.id}.pdf`;
    fs.writeFileSync(path.join(uploadsDir, bestandsnaam), buildSimplePdf(lines));
    const bestandUrl = `/uploads/evaluaties/${bestandsnaam}`;

    const soortId = await ensureDocumentSoort(conn, `evaluatie_${evaluatie.type}`, `${typeLabel}`);
    await conn.query(
      `INSERT INTO documenten
        (stagedossier_id, document_soort_id, status, versie_nummer, bestand_url, bestand_naam,
         opgeladen_op, gecontroleerd_op, zichtbaar_voor_student, zichtbaar_voor_docent, zichtbaar_voor_mentor,
         aangemaakt_op, aangepast_op)
       VALUES (?, ?, 'geregistreerd', 1, ?, ?, NOW(), NOW(), 1, 1, 1, NOW(), NOW())`,
      [evaluatie.stagedossier_id, soortId, bestandUrl, bestandsnaam]
    );
  } catch (e) {
    console.error("genereerEvaluatieDocument:", e.message);
  } finally {
    conn.release();
  }
}

function getUserId(req) {
  // Geen demo-fallback meer (auditpunt 312): zonder ingelogde gebruiker liever null dan stil user 1.
  return Number(req.user?.id) || null;
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
     WHERE c.is_actief = 1 AND p.status = 'actief'
     ORDER BY c.volgorde ASC, c.id ASC`
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
    const [dossier] = await db.query("SELECT id, status, stagebegeleider_id FROM stagedossiers WHERE id = ? LIMIT 1", [dossierId]);
    if (dossier.length === 0) return fail(res, 404, "Stagedossier niet gevonden");
    // Docent mag enkel een evaluatie openen voor een dossier waaraan hij/zij gekoppeld is (admin mag alles).
    if (req.user?.hoofdrol === "docent" && Number(dossier[0].stagebegeleider_id) !== Number(req.user?.id)) {
      return fail(res, 403, "Je bent niet de stagebegeleider van deze student");
    }
    // Evaluatie enkel openen wanneer de stage geregistreerd is of loopt — niet in de contract-/controlefase
    // en ook niet meer nadat het resultaat vrijgegeven of het dossier afgerond is (eindfase = read-only).
    if (!["geregistreerd", "actief", "stage_loopt"].includes(dossier[0].status)) {
      return fail(res, 409, "Een evaluatie kan enkel geopend worden zolang het stagedossier geregistreerd is of loopt");
    }
    // 500: een finale evaluatie kan pas geopend worden nadat de tussentijdse evaluatie geregistreerd is én er
    // een (minstens bevestigde) eindpresentatie ingepland is — finaal volgt op de tussentijdse fase.
    if (finalType === "finaal") {
      const [[tussentijds]] = await db.query(
        "SELECT COUNT(*) AS aantal FROM evaluaties WHERE stagedossier_id = ? AND type = 'tussentijds' AND status IN ('geregistreerd', 'vrijgegeven')",
        [dossierId]
      );
      if (tussentijds.aantal === 0) {
        return fail(res, 409, "Registreer eerst de tussentijdse evaluatie voor je de finale evaluatie opent");
      }
      const [[presentatie]] = await db.query(
        "SELECT COUNT(*) AS aantal FROM planning_momenten WHERE stagedossier_id = ? AND type = 'eindpresentatie' AND status IN ('gegeven', 'geweest')",
        [dossierId]
      );
      if (presentatie.aantal === 0) {
        return fail(res, 409, "Markeer eerst de eindpresentatie als gegeven voor je de finale evaluatie opent");
      }
    }

    // 448: de zelfevaluatie-deadline = 1 week vóór het relevante bevestigde moment (bezoek/presentatie).
    // Zo is de "tot 1 week ervoor"-regel echte data in de DB en niet enkel een UI-tekst.
    const planningType = finalType === "finaal" ? "eindpresentatie" : "bedrijfsbezoek";
    const [planRows] = await db.query(
      `SELECT DATE_SUB(gepland_op, INTERVAL 7 DAY) AS deadline
       FROM planning_momenten
       WHERE stagedossier_id = ? AND type = ? AND gepland_op IS NOT NULL
         AND status IN ('bevestigd', 'gepland', 'gegeven', 'geweest')
       ORDER BY id DESC LIMIT 1`,
      [dossierId, planningType]
    );
    const deadlineStudent = planRows[0]?.deadline || null;

    const [existing] = await db.query(
      "SELECT id, status FROM evaluaties WHERE stagedossier_id = ? AND type = ? LIMIT 1",
      [dossierId, finalType]
    );

    if (existing.length > 0) {
      // Enkel een nog-niet-geopende evaluatie effectief openen; voor een evaluatie die al verder staat
      // (ingediend/geregistreerd/vrijgegeven) de ECHTE status teruggeven i.p.v. altijd "open" te beweren.
      let huidigeStatus = existing[0].status;
      if (huidigeStatus === "niet_open") {
        await db.query("UPDATE evaluaties SET status = 'open', aangepast_op = NOW() WHERE id = ?", [existing[0].id]);
        huidigeStatus = "open";
      }
      if (deadlineStudent) {
        await db.query("UPDATE evaluaties SET deadline_student = COALESCE(deadline_student, ?), aangepast_op = NOW() WHERE id = ?", [deadlineStudent, existing[0].id]);
      }
      return ok(res, { id: existing[0].id, type: finalType, status: huidigeStatus },
        huidigeStatus === "open" ? "Evaluatie staat open" : "Evaluatie bestaat al en is al in behandeling");
    }

    const [result] = await db.query(
      `INSERT INTO evaluaties (stagedossier_id, type, status, deadline_student, aangemaakt_op, aangepast_op)
       VALUES (?, ?, 'open', ?, NOW(), NOW())`,
      [dossierId, finalType, deadlineStudent]
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
              student_ingediend_op, mentor_ingediend_op, docent_geregistreerd_op, vrijgegeven_op,
              DATE_FORMAT(deadline_student, '%Y-%m-%d') AS deadline_student
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
      const nogNietVrijgegeven = e.status !== "vrijgegeven";
      const basis = verbergResultaat && nogNietVrijgegeven
        ? { ...e, eindcijfer: null, competentie_score: null, eindpresentatie_score: null }
        : e;
      let eigenScores = scores.filter((s) => s.evaluatie_id === e.id);
      // Vóór vrijgave: de student ziet enkel de eigen scores. De mentor mag óók de studentscores zien
      // (die moet hij kunnen beoordelen om advies te geven), maar nog niet de docentscores/het eindcijfer.
      if (verbergResultaat && nogNietVrijgegeven) {
        const zichtbareRollen = role === "mentor" ? ["mentor", "student"] : [role];
        eigenScores = eigenScores.filter((s) => zichtbareRollen.includes(s.rol));
      }
      return { ...basis, scores: eigenScores };
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
            e.student_ingediend_op, e.mentor_ingediend_op,
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

  // Bij définitief indienen (student/mentor) hoort elke gescoorde competentie een motivering te hebben —
  // de frontend dwingt dit al af, de backend is de echte bron van waarheid (461). Concept opslaan mag wel leeg.
  if (ingediend && ["student", "mentor"].includes(role)) {
    const zonderMotivering = scores.some((s) => {
      const heeftScore = !(s.score === null || s.score === undefined || s.score === "");
      const motivering = String(s.motivering ?? "").trim();
      return heeftScore && motivering === "";
    });
    if (zonderMotivering) {
      return fail(res, 400, "Geef bij elke score ook een motivering voor je indient");
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

    // Rolspecifieke fase-gate: elke partij vult enkel in tijdens haar eigen venster en niet meer na indienen.
    const evStatus = evaluatie.status;
    if (role === "student") {
      if (evaluatie.student_ingediend_op || !["open", "mentor_ingediend"].includes(evStatus)) {
        await conn.rollback();
        return fail(res, 409, "Je zelfevaluatie is al ingediend en kan niet meer gewijzigd worden");
      }
    } else if (role === "mentor") {
      if (evaluatie.mentor_ingediend_op || !["open", "student_ingediend"].includes(evStatus)) {
        await conn.rollback();
        return fail(res, 409, "Je mentorinput is al ingediend en kan niet meer gewijzigd worden");
      }
    } else if (role === "docent") {
      // Docent scoort enkel in het eigen venster; na registratie/berekening is de evaluatie afgesloten
      // (gelijk aan de read-only UI). Correcties daarna vereisen een bewuste heropening, geen stille update.
      if (evStatus !== "klaar_voor_docent") {
        await conn.rollback();
        const reden = ["geregistreerd", "klaar_voor_vrijgave", "vrijgegeven"].includes(evStatus)
          ? "Deze evaluatie is al geregistreerd en kan niet meer gewijzigd worden"
          : "De docent kan pas scoren wanneer student en mentor hebben ingediend";
        return fail(res, 409, reden);
      }
    }

    const active = await getActiveCompetencies(conn);
    const activeIds = new Set(active.map((c) => c.id));
    // Geen scores voor competenties die niet bij het actieve profiel horen.
    for (const s of scores) {
      const cid = Number(s.competentieId || s.competentie_id);
      if (cid && !activeIds.has(cid)) {
        await conn.rollback();
        return fail(res, 400, "Score voor een competentie die niet bij het actieve profiel hoort");
      }
    }

    // 494: student/mentor mogen gedeeltelijk indienen — niet-ingevulde competenties tellen als niet
    // ingevuld/0 (zoals het prototype belooft: "niet ingevuld telt als 0"). Enkel de docent moet alles
    // gescoord hebben voor hij registreert (dat wordt bovendien in calculateResult nogmaals afgedwongen).
    if (ingediend && role === "docent") {
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
        // Conditioneel zodat een tweede indien-klik niet opnieuw verwerkt (auditpunt 388).
        const [r] = await conn.query("UPDATE evaluaties SET status = ?, student_ingediend_op = NOW(), aangepast_op = NOW() WHERE id = ? AND student_ingediend_op IS NULL", [nieuweStatus, evaluationId]);
        if (r.affectedRows === 0) { await conn.rollback(); return fail(res, 409, "Je hebt deze evaluatie al ingediend; vernieuw de pagina"); }
      } else if (role === "mentor") {
        nieuweStatus = Number(andereRolIngediend[0][0].aantal) > 0 ? "klaar_voor_docent" : "mentor_ingediend";
        const [r] = await conn.query("UPDATE evaluaties SET status = ?, mentor_ingediend_op = NOW(), aangepast_op = NOW() WHERE id = ? AND mentor_ingediend_op IS NULL", [nieuweStatus, evaluationId]);
        if (r.affectedRows === 0) { await conn.rollback(); return fail(res, 409, "Deze evaluatie is al ingediend; vernieuw de pagina"); }
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
    // Berekenen kan enkel vanuit klaar_voor_docent. Daarna is het resultaat geregistreerd/klaar voor vrijgave
    // en mag het niet stil herberekend worden (anders wijzigt een geregistreerd resultaat ongemerkt).
    if (evaluatie.status !== "klaar_voor_docent") {
      await conn.rollback();
      const reden = ["geregistreerd", "klaar_voor_vrijgave"].includes(evaluatie.status)
        ? "Het resultaat is al berekend en geregistreerd; het kan niet opnieuw berekend worden"
        : "De student en de mentor moeten eerst hun evaluatie indienen";
      return fail(res, 409, reden);
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

      // 526: de presentatiescore (20%) komt uit de rubriek wanneer er actieve criteria zijn. Bestaan die,
      // dan is de losse eindpresentatiescore NIET meer vereist — vraag dan dat alle criteria gescoord zijn.
      let heeftActieveRubriek = false;
      try {
        const [rubriek] = await conn.query(
          `SELECT rc.id, rs.score
           FROM rubriek_criteria rc
           LEFT JOIN rubriek_scores rs ON rs.rubriek_criterium_id = rc.id AND rs.evaluatie_id = ?
           WHERE rc.actief = 1`,
          [evaluationId]
        );
        heeftActieveRubriek = rubriek.length > 0;
        if (heeftActieveRubriek) {
          const ongescoord = rubriek.filter((r) => r.score === null || r.score === undefined);
          if (ongescoord.length > 0) ontbreekt.push("een score voor elk rubriekcriterium van de eindpresentatie");
        }
      } catch (_) {
        // rubriek-tabellen nog niet gemigreerd → val terug op de losse eindpresentatiescore.
      }
      if (!heeftActieveRubriek && eindpresentatieScore == null && evaluatie.eindpresentatie_score == null) {
        ontbreekt.push("de eindpresentatiescore");
      }

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
    // Finaal eindcijfer = 80% competenties + 20% eindpresentatie, anders enkel competenties.
    let eindcijfer = null;
    let presentatieScoreOpslaan = eindpresentatieScore;
    if (isFinaal) {
      // De presentatiescore (20%) komt uit de flexibele rubriek: gemiddelde van score/max_score over de
      // actieve criteria, geschaald naar /20. Ontbrekende criteria tellen als 0 (deadline-/0-logica).
      let presentatie = null;
      try {
        const [rubriek] = await conn.query(
          `SELECT rc.max_score, rs.score
           FROM rubriek_criteria rc
           LEFT JOIN rubriek_scores rs ON rs.rubriek_criterium_id = rc.id AND rs.evaluatie_id = ?
           WHERE rc.actief = 1`,
          [evaluationId]
        );
        if (rubriek.length > 0) {
          const fractie = rubriek.reduce((s, r) => {
            const max = Number(r.max_score) || 5;
            const sc = r.score != null ? Number(r.score) : 0; // niet gescoord = 0
            return s + Math.max(0, Math.min(sc, max)) / max;
          }, 0) / rubriek.length;
          presentatie = Math.round(fractie * 20 * 100) / 100;
        }
      } catch (_) {
        // rubriek-tabellen nog niet gemigreerd → val terug op een los meegegeven/opgeslagen getal.
      }
      if (presentatie == null) {
        presentatie = eindpresentatieScore != null
          ? Number(eindpresentatieScore)
          : (evaluatie.eindpresentatie_score != null ? Number(evaluatie.eindpresentatie_score) : null);
      }
      if (presentatie != null) presentatieScoreOpslaan = presentatie;
      // Eindcijfer = 80% competenties + 20% presentatie, op /20 en netjes op 1 decimaal afgerond.
      const ruw = presentatie != null ? (competentie20 * 0.8 + presentatie * 0.2) : competentie20;
      eindcijfer = Math.round(Math.max(0, Math.min(20, ruw)) * 10) / 10;
    }
    const nieuweStatus = isFinaal ? "klaar_voor_vrijgave" : "geregistreerd";

    // Conditioneel op klaar_voor_docent zodat een dubbelklik niet herberekent (auditpunt 388).
    const [berekenResult] = await conn.query(
      `UPDATE evaluaties
       SET competentie_score = ?, eindcijfer = ?, eindpresentatie_score = COALESCE(?, eindpresentatie_score),
           verslag = COALESCE(?, verslag),
           status = ?, docent_geregistreerd_op = NOW(), aangepast_op = NOW()
       WHERE id = ? AND status = 'klaar_voor_docent'`,
      [competentieScore, eindcijfer, presentatieScoreOpslaan, verslag, nieuweStatus, evaluationId]
    );
    if (berekenResult.affectedRows === 0) { await conn.rollback(); return fail(res, 409, "Deze evaluatie is ondertussen al verwerkt; vernieuw de pagina"); }

    await conn.commit();

    // Tussentijds geregistreerd → bewaar als document bij het dossier en verwittig student + mentor.
    if (!isFinaal) {
      await genereerEvaluatieDocument({ id: evaluationId, type: evaluatie.type, stagedossier_id: evaluatie.stagedossier_id, verslag });
      await meld(evaluatie.student_id, {
        titel: "Tussentijdse evaluatie geregistreerd",
        bericht: "De docent registreerde de tussentijdse bespreking. Je vindt de evaluatie als document bij Documenten — daar zie je de scores en feedback van iedereen.",
        aangemaaktDoorId: userId,
        stagedossierId: evaluatie.stagedossier_id,
      });
      await meld(evaluatie.mentor_id, {
        titel: "Tussentijdse evaluatie geregistreerd",
        bericht: "De docent registreerde de tussentijdse bespreking van je stagiair. De evaluatie staat als document bij het dossier.",
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
    if (evaluatie.type === "tussentijds") { await conn.rollback(); return fail(res, 409, "Een tussentijdse evaluatie wordt niet vrijgegeven — enkel de finale evaluatie levert een vrij te geven eindresultaat."); }
    if (evaluatie.status === "vrijgegeven") { await conn.rollback(); return fail(res, 409, "Het resultaat is al vrijgegeven"); }
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
    const [dossierRij] = await conn.query("SELECT aantal_weken FROM stagedossiers WHERE id = ? LIMIT 1", [evaluatie.stagedossier_id]);
    const aantalWeken = Number(dossierRij[0]?.aantal_weken || 0);
    if (aantalWeken > 0) {
      const [goedWeken] = await conn.query(
        "SELECT COUNT(*) AS aantal FROM logboek_weken WHERE stagedossier_id = ? AND status = 'goedgekeurd_door_docent'",
        [evaluatie.stagedossier_id]
      );
      if (goedWeken[0].aantal < aantalWeken) {
        await conn.rollback();
        return fail(res, 409, `Niet alle logboekweken zijn nagekeken: ${goedWeken[0].aantal} van ${aantalWeken} goedgekeurd.`);
      }
    }
    const [pres] = await conn.query(
      "SELECT status FROM planning_momenten WHERE stagedossier_id = ? AND type = 'eindpresentatie' ORDER BY id DESC LIMIT 1",
      [evaluatie.stagedossier_id]
    );
    if (pres.length === 0 || !["gegeven", "geweest"].includes(pres[0].status)) {
      await conn.rollback();
      return fail(res, 409, "De eindpresentatie moet eerst gepland en gegeven zijn voor je het resultaat vrijgeeft.");
    }

    // Conditioneel zodat een dubbele vrijgave het eindresultaat niet twee keer (en mogelijk inconsistent) zet (388).
    const [vrijgaveResult] = await conn.query(
      "UPDATE evaluaties SET status = 'vrijgegeven', vrijgegeven_door_id = ?, vrijgegeven_op = NOW(), aangepast_op = NOW() WHERE id = ? AND status = 'klaar_voor_vrijgave'",
      [userId, evaluationId]
    );
    if (vrijgaveResult.affectedRows === 0) { await conn.rollback(); return fail(res, 409, "Dit resultaat is ondertussen al vrijgegeven; vernieuw de pagina"); }

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

// ── Rubriek eindpresentatie: lezen + scoren door de docent ──

// Actieve rubriek-criteria + de (eventuele) scores van deze evaluatie. Leesbaar voor alle betrokkenen.
async function getRubriek(req, res) {
  const evaluationId = Number(req.params.evaluationId);
  if (!evaluationId) return fail(res, 400, "Ongeldig evaluatie-id");
  const role = req.user?.hoofdrol;
  const userId = getUserId(req);
  try {
    // Toegangscontrole: enkel admin of de aan dit dossier gekoppelde student/mentor/docent mag de rubriek lezen.
    const evaluatie = await loadEvaluationWithDossier(db, evaluationId);
    if (!evaluatie) return fail(res, 404, "Evaluatie niet gevonden");
    if (role !== "administratie" && !userMayEditAsRole(evaluatie, role, userId)) {
      return fail(res, 403, "Je bent niet gekoppeld aan deze evaluatie");
    }
    const [rows] = await db.query(
      `SELECT rc.id, rc.titel, rc.beschrijving, rc.max_score, rc.volgorde,
              rs.score, rs.feedback
       FROM rubriek_criteria rc
       LEFT JOIN rubriek_scores rs ON rs.rubriek_criterium_id = rc.id AND rs.evaluatie_id = ?
       WHERE rc.actief = 1
       ORDER BY rc.volgorde ASC, rc.id ASC`,
      [evaluationId]
    );
    return ok(res, { criteria: rows }, "Rubriek opgehaald");
  } catch (error) {
    return fail(res, 500, "Rubriek ophalen mislukt", error.message);
  }
}

// Docent slaat rubriekscores op (concept of definitief). De definitieve telt mee in calculateResult (20%).
async function saveRubriekScores(req, res) {
  const evaluationId = Number(req.params.evaluationId);
  const role = req.user?.hoofdrol;
  const userId = getUserId(req);
  const scores = Array.isArray(req.body?.scores) ? req.body.scores : [];

  if (!evaluationId) return fail(res, 400, "Ongeldig evaluatie-id");
  if (role !== "docent") return fail(res, 403, "Enkel de docent vult de presentatie-rubriek in");
  if (scores.length === 0) return fail(res, 400, "Geen rubriekscores meegegeven");

  for (const s of scores) {
    if (s.score === null || s.score === undefined || s.score === "") continue;
    const w = Number(s.score);
    if (!Number.isFinite(w) || w < 0) return fail(res, 400, "Rubriekscore is ongeldig");
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const evaluatie = await loadEvaluationWithDossier(conn, evaluationId);
    if (!evaluatie) { await conn.rollback(); return fail(res, 404, "Evaluatie niet gevonden"); }
    if (evaluatie.status === "vrijgegeven") { await conn.rollback(); return fail(res, 409, "Deze evaluatie is al vrijgegeven"); }
    if (!userMayEditAsRole(evaluatie, "docent", userId)) { await conn.rollback(); return fail(res, 403, "Je bent niet gekoppeld aan deze evaluatie"); }

    // Max-score per criterium ophalen zodat een score nooit boven het maximum kan (backend = bron van waarheid).
    const [criteria] = await conn.query("SELECT id, max_score FROM rubriek_criteria WHERE actief = 1");
    const maxPerCrit = new Map(criteria.map((c) => [Number(c.id), Number(c.max_score) || 5]));

    for (const s of scores) {
      const critId = Number(s.rubriekCriteriumId ?? s.rubriek_criterium_id ?? s.id);
      if (!critId) continue;
      const score = (s.score === null || s.score === undefined || s.score === "") ? null : Number(s.score);
      if (score !== null && maxPerCrit.has(critId) && score > maxPerCrit.get(critId)) {
        await conn.rollback();
        return fail(res, 400, `Rubriekscore mag niet boven het maximum (${maxPerCrit.get(critId)}) liggen`);
      }
      await conn.query(
        `INSERT INTO rubriek_scores (evaluatie_id, rubriek_criterium_id, score, feedback, beoordeeld_door_id, aangemaakt_op, aangepast_op)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE score = VALUES(score), feedback = VALUES(feedback), beoordeeld_door_id = VALUES(beoordeeld_door_id), aangepast_op = NOW()`,
        [evaluationId, critId, score, s.feedback || null, userId]
      );
    }

    await conn.commit();
    return ok(res, { evaluationId }, "Rubriekscores opgeslagen");
  } catch (error) {
    await conn.rollback();
    return fail(res, 500, "Rubriekscores opslaan mislukt", error.message);
  } finally {
    conn.release();
  }
}

module.exports = { openEvaluation, getEvaluationsForStudent, saveScores, calculateResult, releaseResult, getMyStudents, getMyFinalResult, downloadMyEindoverzicht, getRubriek, saveRubriekScores };
