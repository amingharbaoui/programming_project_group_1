const db = require("../config/db");
const { ok, fail } = require("../utils/response");
const { meld, emailMelding } = require("../utils/notify");

async function notifyStudentOfWeek(connection, weekId, opts) {
  try {
    const [rows] = await connection.query(
      "SELECT d.student_id FROM logboek_weken lw JOIN stagedossiers d ON d.id = lw.stagedossier_id WHERE lw.id = ? LIMIT 1",
      [weekId]
    );
    if (rows[0]?.student_id) {
      await meld(rows[0].student_id, { ...opts, logboekWeekId: weekId });
    }
  } catch (error) {
    console.error("Melding logboek mislukt:", error.message);
  }
}

function getUserId(req, fallbackId) {
  return Number(req.user?.id || fallbackId);
}

function normalizeDate(value) {
  if (!value) return null;
  return value;
}

function sumHours(days) {
  return days.reduce((total, day) => total + Number(day.aantalUren || day.aantal_uren || 0), 0);
}

// Tz-veilige kalenderdatum-helpers (geen lokale-tijd-drift).
function parseDatumUTC(value) {
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}
function formatDatumUTC(dt) {
  return dt.toISOString().slice(0, 10);
}

// Geeft de verplichte werkdagen (ma–vr) terug die ontbreken of nog niet bevestigd zijn (Story 8).
function ontbrekendeVerplichteDagen(weekStart, weekEinde, dagen) {
  const statusPerDatum = new Map();
  for (const d of dagen) {
    const key = String(d.datum || "").slice(0, 10);
    if (key) statusPerDatum.set(key, String(d.status || "").trim());
  }
  const ontbrekend = [];
  const start = parseDatumUTC(weekStart);
  const eind = parseDatumUTC(weekEinde);
  for (let dt = new Date(start); dt <= eind; dt.setUTCDate(dt.getUTCDate() + 1)) {
    const dow = dt.getUTCDay(); // 0 = zo, 6 = za
    if (dow === 0 || dow === 6) continue; // weekend is niet verplicht
    const key = formatDatumUTC(dt);
    const status = statusPerDatum.get(key);
    if (!status || status === "concept") ontbrekend.push(key);
  }
  return ontbrekend;
}

async function findLatestDossierForStudent(connection, studentId) {
  const [rows] = await connection.query(
    `
    SELECT id
    FROM stagedossiers
    WHERE student_id = ?
    ORDER BY aangemaakt_op DESC
    LIMIT 1
    `,
    [studentId]
  );

  return rows[0]?.id || null;
}

async function getDossierMeta(connection, dossierId) {
  const [rows] = await connection.query(
    `
    SELECT id, student_id, mentor_id, stagebegeleider_id, status, aantal_weken, startdatum, einddatum
    FROM stagedossiers
    WHERE id = ?
    LIMIT 1
    `,
    [dossierId]
  );

  return rows[0] || null;
}

// Eerste echte logboekactiviteit van de student is het bewijs dat de stage gestart is —
// er bestond geen ander codepad dat 'geregistreerd' ooit naar 'stage_loopt' omzette.
async function startStageIndienNodig(connection, dossierId, huidigeStatus) {
  if (huidigeStatus === "geregistreerd") {
    await connection.query(
      "UPDATE stagedossiers SET status = 'stage_loopt', aangepast_op = NOW() WHERE id = ? AND status = 'geregistreerd'",
      [dossierId]
    );
  }
}


async function getValidMentorIdForWeek(connection, weekId, requestedMentorId) {
  // Eerst de meegegeven mentor valideren — pas als dat geen geldige mentor is, de week ophalen.
  const req = Number(requestedMentorId);
  if (Number.isInteger(req) && req > 0) {
    const [v] = await connection.query("SELECT gebruiker_id FROM mentoren WHERE gebruiker_id = ? LIMIT 1", [req]);
    if (v.length > 0) return req;
  }

  const [rows] = await connection.query(
    `SELECT lw.mentor_id AS week_mentor_id, d.mentor_id AS dossier_mentor_id
     FROM logboek_weken lw JOIN stagedossiers d ON d.id = lw.stagedossier_id
     WHERE lw.id = ? LIMIT 1`,
    [weekId]
  );
  const data = rows[0] || {};
  const fallback = [data.week_mentor_id, data.dossier_mentor_id]
    .map(Number).filter((x) => Number.isInteger(x) && x > 0);
  if (fallback.length === 0) return null;

  // Eén query om alle kandidaten ineens te valideren (i.p.v. een query per kandidaat).
  const [geldig] = await connection.query("SELECT gebruiker_id FROM mentoren WHERE gebruiker_id IN (?)", [fallback]);
  const geldigeSet = new Set(geldig.map((r) => Number(r.gebruiker_id)));
  return fallback.find((id) => geldigeSet.has(id)) || null;
}

async function getValidDocentIdForWeek(connection, weekId, requestedDocentId) {
  // Eerst de meegegeven docent valideren — pas als dat geen geldige medewerker is, de week ophalen.
  const req = Number(requestedDocentId);
  if (Number.isInteger(req) && req > 0) {
    const [v] = await connection.query("SELECT gebruiker_id FROM medewerkers WHERE gebruiker_id = ? LIMIT 1", [req]);
    if (v.length > 0) return req;
  }

  const [rows] = await connection.query(
    `SELECT lw.docent_id AS week_docent_id, d.stagebegeleider_id AS dossier_docent_id
     FROM logboek_weken lw JOIN stagedossiers d ON d.id = lw.stagedossier_id
     WHERE lw.id = ? LIMIT 1`,
    [weekId]
  );
  const data = rows[0] || {};
  const fallback = [data.week_docent_id, data.dossier_docent_id]
    .map(Number).filter((x) => Number.isInteger(x) && x > 0);
  if (fallback.length === 0) return null;

  const [geldig] = await connection.query("SELECT gebruiker_id FROM medewerkers WHERE gebruiker_id IN (?)", [fallback]);
  const geldigeSet = new Set(geldig.map((r) => Number(r.gebruiker_id)));
  return fallback.find((id) => geldigeSet.has(id)) || null;
}

async function createLogbook(req, res) {
  const studentId = getUserId(req, 1);

  const {
    stagedossierId,
    stagedossier_id,
    weekNummer,
    week_nummer,
    weekStart,
    week_start,
    weekEinde,
    week_einde,
    dagen,
    days
  } = req.body;

  const finalDays = dagen || days || [];
  const finalWeekNummer = Number(weekNummer || week_nummer);
  const finalWeekStart = normalizeDate(weekStart || week_start);
  const finalWeekEinde = normalizeDate(weekEinde || week_einde);

  if (!finalWeekNummer || !finalWeekStart || !finalWeekEinde) {
    return fail(res, 400, "weekNummer, weekStart en weekEinde zijn verplicht");
  }

  if (finalWeekNummer < 1) {
    return fail(res, 400, "Weeknummer moet minimaal 1 zijn");
  }

  if (finalWeekStart > finalWeekEinde) {
    return fail(res, 400, "Weekstart moet voor of op de einddatum liggen");
  }

  if (!Array.isArray(finalDays) || finalDays.length === 0) {
    return fail(res, 400, "Minstens één logboekdag is verplicht");
  }

  for (const day of finalDays) {
    const uren = Number(day.aantalUren || day.aantal_uren || 0);
    if (!Number.isFinite(uren) || uren < 0 || uren > 12) {
      return fail(res, 400, "Aantal uren per dag moet tussen 0 en 12 liggen");
    }
  }

  // Een week kan niet ingediend worden met ontbrekende/niet-bevestigde verplichte werkdagen (Story 8).
  const ontbrekend = ontbrekendeVerplichteDagen(finalWeekStart, finalWeekEinde, finalDays);
  if (ontbrekend.length > 0) {
    return fail(
      res,
      400,
      `Niet alle verplichte werkdagen zijn ingevuld of als geen-stagedag gemarkeerd: ${ontbrekend.join(", ")}`
    );
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    let dossierId = Number(stagedossierId || stagedossier_id);

    if (!dossierId) {
      dossierId = await findLatestDossierForStudent(connection, studentId);
    }

    if (!dossierId) {
      await connection.rollback();
      return fail(res, 404, "Geen stagedossier gevonden voor deze student");
    }

    const dossier = await getDossierMeta(connection, dossierId);

    if (!dossier) {
      await connection.rollback();
      return fail(res, 404, "Stagedossier niet gevonden");
    }

    if (dossier.student_id !== studentId) {
      await connection.rollback();
      return fail(res, 403, "Je mag alleen een logboek indienen voor je eigen stagedossier");
    }

    if (dossier.aantal_weken && finalWeekNummer > Number(dossier.aantal_weken)) {
      await connection.rollback();
      return fail(res, 400, `Weeknummer ${finalWeekNummer} valt buiten de stageperiode (max ${dossier.aantal_weken} weken)`);
    }
    if (dossier.startdatum && finalWeekEinde < normalizeDate(dossier.startdatum)) {
      await connection.rollback();
      return fail(res, 400, "De logboekweek valt voor de start van de stage");
    }
    if (dossier.einddatum && finalWeekStart > normalizeDate(dossier.einddatum)) {
      await connection.rollback();
      return fail(res, 400, "De logboekweek valt na het einde van de stage");
    }

    // Logboek pas invulbaar nadat de student de stageovereenkomst getekend heeft.
    const [ovk] = await connection.query(
      "SELECT student_getekend_op FROM stageovereenkomsten WHERE stagedossier_id = ? ORDER BY aangemaakt_op DESC LIMIT 1",
      [dossierId]
    );
    if (!ovk[0] || !ovk[0].student_getekend_op) {
      await connection.rollback();
      return fail(res, 409, "Je kan pas een logboek indienen nadat je de stageovereenkomst getekend hebt");
    }

    // Logboek opent pas zodra het dossier startklaar/geregistreerd is — niet tijdens de contract-/controlefase (Story 7 gate).
    const teVroeg = ["wacht_op_student", "wacht_op_bedrijf", "in_controle_bij_administratie", "document_afgekeurd"];
    if (teVroeg.includes(dossier.status)) {
      await connection.rollback();
      return fail(res, 409, "Je kan pas een logboek indienen zodra je stagedossier startklaar geregistreerd is");
    }
    // En niet meer nadat het resultaat vrijgegeven of het dossier afgerond is.
    if (["resultaat_vrijgegeven", "afgerond"].includes(dossier.status)) {
      await connection.rollback();
      return fail(res, 409, "Je stage is afgerond; je kan geen logboek meer indienen");
    }

    // En pas vanaf de effectieve startdatum van de stage — zo blijft de backend gelijk met wat de student in de app ziet.
    if (dossier.startdatum) {
      const start = new Date(dossier.startdatum);
      const vandaag = new Date();
      vandaag.setHours(0, 0, 0, 0);
      start.setHours(0, 0, 0, 0);
      if (!Number.isNaN(start.getTime()) && vandaag < start) {
        await connection.rollback();
        return fail(res, 409, "Je logboek opent pas vanaf de startdatum van je stage");
      }
    }

    await startStageIndienNodig(connection, dossierId, dossier.status);

    const totaalUren = sumHours(finalDays);

    const [existingWeeks] = await connection.query(
      `
      SELECT id
      FROM logboek_weken
      WHERE stagedossier_id = ?
        AND week_nummer = ?
      LIMIT 1
      `,
      [dossierId, finalWeekNummer]
    );

    let weekId;
    // Bewaar bestaande mentor-bevestigingen per datum: een weekindiening (DELETE+INSERT) mag een eerder
    // door de mentor afgevinkte dag niet stilzwijgend onbevestigd maken (auditpunt 336).
    const bevestigdPerDatum = {};

    if (existingWeeks.length > 0) {
      weekId = existingWeeks[0].id;

      const [weekStatus] = await connection.query(
        "SELECT status FROM logboek_weken WHERE id = ? LIMIT 1",
        [weekId]
      );

      // Alleen nog-bewerkbare weken mogen opnieuw ingediend worden — al nagekeken/ingediende weken niet overschrijven.
      const herindienbaar = ["niet_gestart", "in_opbouw", "teruggestuurd_door_mentor", "teruggestuurd_door_docent"];
      if (weekStatus.length > 0 && !herindienbaar.includes(weekStatus[0].status)) {
        await connection.rollback();
        return fail(res, 409, "Deze week is al ingediend of nagekeken en kan niet opnieuw worden ingediend");
      }

      await connection.query(
        `
        UPDATE logboek_weken
        SET week_start = ?,
            week_einde = ?,
            status = 'ingediend',
            totaal_uren = ?,
            ingediend_op = NOW(),
            mentor_id = ?,
            docent_id = ?,
            herindiening_nodig = 0,
            aangepast_op = NOW()
        WHERE id = ?
        `,
        [
          finalWeekStart,
          finalWeekEinde,
          totaalUren,
          dossier.mentor_id || null,
          dossier.stagebegeleider_id || null,
          weekId
        ]
      );

      const [oudeDagen] = await connection.query(
        "SELECT DATE_FORMAT(datum, '%Y-%m-%d') AS datum_key, mentor_bevestigd_op FROM logboek_dagen WHERE logboek_week_id = ? AND mentor_bevestigd_op IS NOT NULL",
        [weekId]
      );
      for (const d of oudeDagen) bevestigdPerDatum[d.datum_key] = d.mentor_bevestigd_op;

      await connection.query(
        "DELETE FROM logboek_dagen WHERE logboek_week_id = ?",
        [weekId]
      );
    } else {
      const [weekResult] = await connection.query(
        `
        INSERT INTO logboek_weken
        (
          stagedossier_id,
          week_nummer,
          week_start,
          week_einde,
          status,
          totaal_uren,
          ingediend_op,
          mentor_id,
          docent_id,
          herindiening_nodig,
          aangemaakt_op,
          aangepast_op
        )
        VALUES (?, ?, ?, ?, 'ingediend', ?, NOW(), ?, ?, 0, NOW(), NOW())
        `,
        [
          dossierId,
          finalWeekNummer,
          finalWeekStart,
          finalWeekEinde,
          totaalUren,
          dossier.mentor_id || null,
          dossier.stagebegeleider_id || null
        ]
      );

      weekId = weekResult.insertId;
    }

    for (const day of finalDays) {
      const competenties = Array.isArray(day.competenties) ? day.competenties : [];
      // Een al bevestigde dag behoudt zijn mentor_bevestigd_op over de heropbouw heen.
      const datumKey = day.datum ? String(day.datum).slice(0, 10) : null;
      const mentorBevestigd = datumKey ? (bevestigdPerDatum[datumKey] || null) : null;
      await connection.query(
        `
        INSERT INTO logboek_dagen
        (
          logboek_week_id,
          datum,
          status,
          titel,
          uitgevoerde_taken,
          reflectie,
          problemen,
          leerpunten,
          competenties,
          aantal_uren,
          mentor_bevestigd_op,
          aangemaakt_op,
          aangepast_op
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `,
        [
          weekId,
          day.datum || null,
          day.status || "ingediend",
          day.titel || null,
          day.uitgevoerdeTaken || day.uitgevoerde_taken || null,
          day.reflectie || null,
          day.problemen || null,
          day.leerpunten || null,
          competenties.length > 0 ? JSON.stringify(competenties) : null,
          Number(day.aantalUren || day.aantal_uren || 0),
          mentorBevestigd
        ]
      );
    }

    await connection.commit();

    // Mentor verwittigen van de ingediende logboekweek (Story 8).
    try {
      if (dossier.mentor_id) {
        await meld(dossier.mentor_id, {
          titel: "Logboekweek ingediend",
          bericht: `Een stagiair heeft logboekweek ${finalWeekNummer} ingediend.`,
          aangemaaktDoorId: studentId,
          stagedossierId: dossierId,
          logboekWeekId: weekId
        });
      }
    } catch (notifyError) {
      console.error("Melding logboek-indiening mislukt:", notifyError.message);
    }

    return ok(
      res,
      {
        weekId,
        stagedossierId: dossierId,
        weekNummer: finalWeekNummer,
        status: "ingediend",
        totaalUren
      },
      "Logboekweek ingediend"
    );
  } catch (error) {
    await connection.rollback();
    return fail(res, 500, "Logboek indienen mislukt", error.message);
  } finally {
    connection.release();
  }
}

async function getLogbooksByStudent(req, res) {
  const requestedStudentId = Number(req.params.studentId || req.query.studentId || req.user?.id);
  const currentUserId = getUserId(req);
  const currentRole = req.user?.hoofdrol;

  if (!requestedStudentId) {
    return fail(res, 400, "studentId is verplicht");
  }

  try {
    if (currentRole === "student" && requestedStudentId !== currentUserId) {
      return fail(res, 403, "Studenten mogen alleen hun eigen logboeken bekijken");
    }

    if (currentRole === "mentor") {
      const [linked] = await db.query(
        "SELECT id FROM stagedossiers WHERE student_id = ? AND mentor_id = ? LIMIT 1",
        [requestedStudentId, currentUserId]
      );

      if (linked.length === 0) {
        return fail(res, 403, "Mentor is niet gekoppeld aan deze student");
      }
    }

    if (currentRole === "docent") {
      const [linked] = await db.query(
        "SELECT id FROM stagedossiers WHERE student_id = ? AND stagebegeleider_id = ? LIMIT 1",
        [requestedStudentId, currentUserId]
      );

      if (linked.length === 0) {
        return fail(res, 403, "Docent is niet gekoppeld aan deze student");
      }
    }

    const [weeks] = await db.query(
      `
      SELECT
        lw.id,
        lw.stagedossier_id,
        lw.week_nummer,
        lw.week_start,
        lw.week_einde,
        lw.status,
        lw.totaal_uren,
        lw.ingediend_op,
        lw.mentor_id,
        lw.mentor_feedback,
        lw.mentor_nagekeken_op,
        lw.docent_id,
        lw.docent_feedback,
        lw.docent_nagekeken_op,
        lw.herindiening_nodig,
        lw.blokkade,
        lw.student_antwoord,

        d.dossiernummer,
        d.student_id,
        b.naam AS bedrijf_naam
      FROM logboek_weken lw
      JOIN stagedossiers d ON d.id = lw.stagedossier_id
      JOIN bedrijven b ON b.id = d.bedrijf_id
      WHERE d.student_id = ?
      ORDER BY lw.week_nummer DESC
      `,
      [requestedStudentId]
    );

    const weekIds = weeks.map((week) => week.id);

    if (weekIds.length === 0) {
      return ok(res, [], "Geen logboeken gevonden");
    }

    const [days] = await db.query(
      `
      SELECT
        id,
        logboek_week_id,
        datum,
        status,
        titel,
        uitgevoerde_taken,
        reflectie,
        problemen,
        leerpunten,
        competenties,
        aantal_uren,
        mentor_bevestigd_op
      FROM logboek_dagen
      WHERE logboek_week_id IN (?)
      ORDER BY datum ASC
      `,
      [weekIds]
    );

    const daysByWeek = {};

    for (const day of days) {
      if (!daysByWeek[day.logboek_week_id]) {
        daysByWeek[day.logboek_week_id] = [];
      }

      daysByWeek[day.logboek_week_id].push(day);
    }

    const result = weeks.map((week) => ({
      ...week,
      dagen: daysByWeek[week.id] || []
    }));

    return ok(res, result, "Logboeken opgehaald");
  } catch (error) {
    return fail(res, 500, "Logboeken ophalen mislukt", error.message);
  }
}


async function mentorCheckLogbookWeek(req, res) {
  const weekId = Number(req.params.weekId);
  if (!Number.isInteger(weekId)) return fail(res, 404, "Logboekweek niet gevonden");
  const requestedMentorId = getUserId(req, 4);

  const {
    feedback,
    mentorFeedback,
    herindieningNodig,
    blokkade
  } = req.body || {};

  if (req.body?.status !== undefined || req.body?.action !== undefined) {
    return fail(res, 400, "Ongeldige invoer: gebruik herindieningNodig (true of false), geen status of action");
  }
  if (herindieningNodig !== undefined && typeof herindieningNodig !== "boolean") {
    return fail(res, 400, "Ongeldige waarde voor herindieningNodig: true of false verwacht");
  }
  if (blokkade !== undefined && typeof blokkade !== "boolean") {
    return fail(res, 400, "Ongeldige waarde voor blokkade: true of false verwacht");
  }

  const needsResubmission = Boolean(herindieningNodig);
  if (needsResubmission && !((feedback || mentorFeedback) && String(feedback || mentorFeedback).trim())) {
    return fail(res, 400, "Feedback is verplicht wanneer je de week terugstuurt voor aanpassing");
  }
  const connection = await db.getConnection();

  try {
    const [existing] = await connection.query(
      "SELECT id, status FROM logboek_weken WHERE id = ? LIMIT 1",
      [weekId]
    );

    if (existing.length === 0) {
      return fail(res, 404, "Logboekweek niet gevonden");
    }

    // Een mentor mag enkel de weken van zijn eigen stagiair nakijken.
    const [mentorKoppeling] = await connection.query(
      `SELECT d.mentor_id
       FROM logboek_weken lw
       JOIN stagedossiers d ON d.id = lw.stagedossier_id
       WHERE lw.id = ? LIMIT 1`,
      [weekId]
    );
    if (Number(mentorKoppeling[0]?.mentor_id) !== requestedMentorId) {
      return fail(res, 403, "Je bent niet de mentor van deze stagiair");
    }

    // Alleen een ingediende week kan nagekeken worden — een ontbrekende of al afgesloten week niet.
    if (existing[0].status !== "ingediend") {
      return fail(res, 409, `Een week met status '${existing[0].status}' kan niet nagekeken worden; enkel ingediende weken.`);
    }

    const validMentorId = await getValidMentorIdForWeek(connection, weekId, requestedMentorId);

    await connection.query(
      `
      UPDATE logboek_weken
      SET status = ?,
          mentor_id = COALESCE(?, mentor_id),
          mentor_feedback = ?,
          mentor_nagekeken_op = NOW(),
          herindiening_nodig = ?,
          blokkade = COALESCE(?, blokkade),
          aangepast_op = NOW()
      WHERE id = ?
      `,
      [
        needsResubmission ? "teruggestuurd_door_mentor" : "afgecheckt_door_mentor",
        validMentorId,
        mentorFeedback || feedback || null,
        needsResubmission ? 1 : 0,
        blokkade || null,
        weekId
      ]
    );

    const [rows] = await connection.query(
      "SELECT * FROM logboek_weken WHERE id = ?",
      [weekId]
    );

    await notifyStudentOfWeek(connection, weekId, {
      titel: needsResubmission ? "Logboek: aanpassing gevraagd" : "Logboek afgecheckt door mentor",
      bericht: needsResubmission
        ? "Je mentor vraagt een aanpassing aan je logboekweek."
        : "Je mentor heeft je logboekweek afgecheckt.",
      aangemaaktDoorId: validMentorId || null
    });

    return ok(res, rows[0], "Mentorcontrole opgeslagen");
  } catch (error) {
    return fail(res, 500, "Mentorcontrole mislukt", error.message);
  } finally {
    connection.release();
  }
}



async function docentReviewLogbookWeek(req, res) {
  const weekId = Number(req.params.weekId);
  if (!Number.isInteger(weekId)) return fail(res, 404, "Logboekweek niet gevonden");
  const requestedDocentId = getUserId(req, 5);

  const {
    feedback,
    docentFeedback,
    herindieningNodig,
    blokkade
  } = req.body || {};

  if (req.body?.status !== undefined || req.body?.action !== undefined) {
    return fail(res, 400, "Ongeldige invoer: gebruik herindieningNodig (true of false), geen status of action");
  }
  if (herindieningNodig !== undefined && typeof herindieningNodig !== "boolean") {
    return fail(res, 400, "Ongeldige waarde voor herindieningNodig: true of false verwacht");
  }
  if (blokkade !== undefined && typeof blokkade !== "boolean") {
    return fail(res, 400, "Ongeldige waarde voor blokkade: true of false verwacht");
  }

  const needsResubmission = Boolean(herindieningNodig);
  if (needsResubmission && !((feedback || docentFeedback) && String(feedback || docentFeedback).trim())) {
    return fail(res, 400, "Feedback is verplicht wanneer je de week terugstuurt voor aanpassing");
  }
  const connection = await db.getConnection();

  try {
    const [existing] = await connection.query(
      "SELECT id, status FROM logboek_weken WHERE id = ? LIMIT 1",
      [weekId]
    );

    if (existing.length === 0) {
      return fail(res, 404, "Logboekweek niet gevonden");
    }

    // Een docent mag enkel de weken van zijn eigen student nakijken.
    const [docentKoppeling] = await connection.query(
      `SELECT d.stagebegeleider_id
       FROM logboek_weken lw
       JOIN stagedossiers d ON d.id = lw.stagedossier_id
       WHERE lw.id = ? LIMIT 1`,
      [weekId]
    );
    if (Number(docentKoppeling[0]?.stagebegeleider_id) !== requestedDocentId) {
      return fail(res, 403, "Je bent niet de stagebegeleider van deze student");
    }

    // De docent kijkt pas na nadat de mentor de week heeft afgecheckt.
    if (!["afgecheckt_door_mentor"].includes(existing[0].status)) {
      return fail(res, 409, "De mentor moet de week eerst afchecken voor de docent ze nakijkt");
    }

    const validDocentId = await getValidDocentIdForWeek(connection, weekId, requestedDocentId);

    await connection.query(
      `
      UPDATE logboek_weken
      SET status = ?,
          docent_id = COALESCE(?, docent_id),
          docent_feedback = ?,
          docent_nagekeken_op = NOW(),
          herindiening_nodig = ?,
          blokkade = COALESCE(?, blokkade),
          aangepast_op = NOW()
      WHERE id = ?
      `,
      [
        needsResubmission ? "teruggestuurd_door_docent" : "goedgekeurd_door_docent",
        validDocentId,
        docentFeedback || feedback || null,
        needsResubmission ? 1 : 0,
        blokkade || null,
        weekId
      ]
    );

    const [rows] = await connection.query(
      "SELECT * FROM logboek_weken WHERE id = ?",
      [weekId]
    );

    await notifyStudentOfWeek(connection, weekId, {
      titel: needsResubmission ? "Logboek: aanpassing gevraagd" : "Logboek nagekeken door docent",
      bericht: needsResubmission
        ? "Je docent vraagt een aanpassing aan je logboekweek."
        : "Je docent heeft je logboekweek nagekeken.",
      aangemaaktDoorId: validDocentId || null
    });

    return ok(res, rows[0], "Docentcontrole opgeslagen");
  } catch (error) {
    return fail(res, 500, "Docentcontrole mislukt", error.message);
  } finally {
    connection.release();
  }
}


async function studentAntwoordFeedback(req, res) {
  const weekId   = Number(req.params.weekId);
  const studentId = getUserId(req, 1);
  const { antwoord } = req.body;

  if (!antwoord || !antwoord.trim()) {
    return fail(res, 400, "Antwoord mag niet leeg zijn");
  }

  try {
    // Controleer of deze week bij de student hoort + haal mentor/docent op voor de melding.
    const [rows] = await db.query(
      `SELECT lw.id, lw.week_nummer, lw.status, d.mentor_id, d.stagebegeleider_id
       FROM logboek_weken lw
       JOIN stagedossiers d ON d.id = lw.stagedossier_id
       WHERE lw.id = ? AND d.student_id = ? LIMIT 1`,
      [weekId, studentId]
    );
    if (rows.length === 0) return fail(res, 403, "Geen toegang tot deze week");
    if (!["teruggestuurd_door_mentor", "teruggestuurd_door_docent"].includes(rows[0].status)) {
      return fail(res, 409, "Je kan alleen antwoorden wanneer de week is teruggestuurd voor aanpassing");
    }

    await db.query(
      "UPDATE logboek_weken SET student_antwoord = ?, aangepast_op = NOW() WHERE id = ?",
      [antwoord.trim(), weekId]
    );

    // Mentor (en docent) verwittigen dat de student gereageerd heeft op de feedback.
    try {
      const bericht = `De student heeft gereageerd op de feedback van logboekweek ${rows[0].week_nummer}.`;
      if (rows[0].mentor_id) {
        await meld(rows[0].mentor_id, { titel: "Antwoord op logboekfeedback", bericht, aangemaaktDoorId: studentId, logboekWeekId: weekId });
      }
      if (rows[0].stagebegeleider_id) {
        await meld(rows[0].stagebegeleider_id, { titel: "Antwoord op logboekfeedback", bericht, aangemaaktDoorId: studentId, logboekWeekId: weekId });
      }
    } catch (notifyError) {
      console.error("Melding studentantwoord mislukt:", notifyError.message);
    }

    return ok(res, { weekId }, "Antwoord opgeslagen");
  } catch (err) {
    return fail(res, 500, "Antwoord opslaan mislukt", err.message);
  }
}

async function getMissingLogbooksForDocent(req, res) {
  const docentId = getUserId(req);

  try {
    const [dossiers] = await db.query(
      `
      SELECT
        d.id AS stagedossier_id,
        d.dossiernummer,
        d.student_id,
        d.aantal_weken,
        d.startdatum,
        d.einddatum,
        g.voornaam,
        g.achternaam,
        g.email,
        s.studentennummer,
        b.naam AS bedrijf_naam
      FROM stagedossiers d
      JOIN gebruikers g ON g.id = d.student_id
      JOIN studenten s ON s.gebruiker_id = d.student_id
      JOIN bedrijven b ON b.id = d.bedrijf_id
      WHERE d.stagebegeleider_id = ?
      ORDER BY g.achternaam, g.voornaam
      `,
      [docentId]
    );

    if (dossiers.length === 0) {
      return ok(res, [], "Geen gekoppelde dossiers gevonden");
    }

    const dossierIds = dossiers.map((d) => d.stagedossier_id);
    const [weeks] = await db.query(
      `
      SELECT id, stagedossier_id, week_nummer, status, week_start, week_einde, ingediend_op
      FROM logboek_weken
      WHERE stagedossier_id IN (?)
      `,
      [dossierIds]
    );

    const weeksByDossier = new Map();
    for (const week of weeks) {
      if (!weeksByDossier.has(week.stagedossier_id)) weeksByDossier.set(week.stagedossier_id, new Map());
      weeksByDossier.get(week.stagedossier_id).set(Number(week.week_nummer), week);
    }

    const vandaag = new Date(); vandaag.setHours(0, 0, 0, 0);
    const result = dossiers.map((dossier) => {
      const totalWeeks = Math.max(0, Number(dossier.aantal_weken || 0));
      const existing = weeksByDossier.get(dossier.stagedossier_id) || new Map();
      const startD = dossier.startdatum ? new Date(dossier.startdatum) : null;
      // Een week telt pas als 'ontbrekend' wanneer ze al voorbij is — geen toekomstige weken markeren.
      const weekVoorbij = (n) => {
        if (!startD || Number.isNaN(startD.getTime())) return true;
        const einde = new Date(startD); einde.setDate(einde.getDate() + n * 7);
        return einde <= vandaag;
      };
      const ontbrekendeWeken = [];

      for (let weekNummer = 1; weekNummer <= totalWeeks; weekNummer += 1) {
        const week = existing.get(weekNummer);
        if ((!week || week.status === "ontbreekt") && weekVoorbij(weekNummer)) {
          ontbrekendeWeken.push({
            weekNummer,
            status: week?.status || "ontbreekt",
            logboekWeekId: week?.id || null
          });
        }
      }

      return {
        ...dossier,
        totaalWeken: totalWeeks,
        ingediendeWeken: totalWeeks - ontbrekendeWeken.length,
        ontbrekendeWeken,
        ontbrekendeAantal: ontbrekendeWeken.length
      };
    });

    return ok(res, result, "Ontbrekende logboeken berekend");
  } catch (error) {
    return fail(res, 500, "Ontbrekende logboeken ophalen mislukt", error.message);
  }
}

// Mentor-variant: ontbrekende logboekweken van de EIGEN stagiairs (Story 31 — detectie/aanduiding voor mentor).
async function getMissingLogbooksForMentor(req, res) {
  const mentorId = getUserId(req);

  try {
    const [dossiers] = await db.query(
      `
      SELECT
        d.id AS stagedossier_id,
        d.dossiernummer,
        d.student_id,
        d.aantal_weken,
        d.startdatum,
        d.einddatum,
        g.voornaam,
        g.achternaam,
        g.email,
        s.studentennummer,
        b.naam AS bedrijf_naam
      FROM stagedossiers d
      JOIN gebruikers g ON g.id = d.student_id
      JOIN studenten s ON s.gebruiker_id = d.student_id
      JOIN bedrijven b ON b.id = d.bedrijf_id
      WHERE d.mentor_id = ?
      ORDER BY g.achternaam, g.voornaam
      `,
      [mentorId]
    );

    if (dossiers.length === 0) {
      return ok(res, [], "Geen gekoppelde dossiers gevonden");
    }

    const dossierIds = dossiers.map((d) => d.stagedossier_id);
    const [weeks] = await db.query(
      `
      SELECT id, stagedossier_id, week_nummer, status, week_start, week_einde, ingediend_op
      FROM logboek_weken
      WHERE stagedossier_id IN (?)
      `,
      [dossierIds]
    );

    const weeksByDossier = new Map();
    for (const week of weeks) {
      if (!weeksByDossier.has(week.stagedossier_id)) weeksByDossier.set(week.stagedossier_id, new Map());
      weeksByDossier.get(week.stagedossier_id).set(Number(week.week_nummer), week);
    }

    const vandaag = new Date(); vandaag.setHours(0, 0, 0, 0);
    const result = dossiers.map((dossier) => {
      const totalWeeks = Math.max(0, Number(dossier.aantal_weken || 0));
      const existing = weeksByDossier.get(dossier.stagedossier_id) || new Map();
      const startD = dossier.startdatum ? new Date(dossier.startdatum) : null;
      // Een week telt pas als 'ontbrekend' wanneer ze al voorbij is — geen toekomstige weken markeren.
      const weekVoorbij = (n) => {
        if (!startD || Number.isNaN(startD.getTime())) return true;
        const einde = new Date(startD); einde.setDate(einde.getDate() + n * 7);
        return einde <= vandaag;
      };
      const ontbrekendeWeken = [];

      for (let weekNummer = 1; weekNummer <= totalWeeks; weekNummer += 1) {
        const week = existing.get(weekNummer);
        if ((!week || week.status === "ontbreekt") && weekVoorbij(weekNummer)) {
          ontbrekendeWeken.push({
            weekNummer,
            status: week?.status || "ontbreekt",
            logboekWeekId: week?.id || null
          });
        }
      }

      return {
        ...dossier,
        totaalWeken: totalWeeks,
        ingediendeWeken: totalWeeks - ontbrekendeWeken.length,
        ontbrekendeWeken,
        ontbrekendeAantal: ontbrekendeWeken.length
      };
    });

    return ok(res, result, "Ontbrekende logboeken berekend");
  } catch (error) {
    return fail(res, 500, "Ontbrekende logboeken ophalen mislukt", error.message);
  }
}

async function sendMissingLogbookReminder(req, res) {
  const docentId = getUserId(req);
  const studentId = Number(req.params.studentId || req.body.studentId || req.body.student_id);
  const gevraagdeWeken = Array.isArray(req.body.weken) ? req.body.weken.map(Number).filter(Boolean) : [];

  if (!studentId) return fail(res, 400, "studentId is verplicht");

  try {
    const [rows] = await db.query(
      `
      SELECT d.id AS stagedossier_id, d.student_id, d.status, d.aantal_weken, d.startdatum, g.voornaam, g.achternaam
      FROM stagedossiers d
      JOIN gebruikers g ON g.id = d.student_id
      WHERE d.student_id = ? AND d.stagebegeleider_id = ?
      ORDER BY d.aangemaakt_op DESC
      LIMIT 1
      `,
      [studentId, docentId]
    );

    if (rows.length === 0) {
      return fail(res, 403, "Docent is niet gekoppeld aan deze student");
    }
    const dossier = rows[0];

    // Geen herinnering meer voor een vrijgegeven/afgerond dossier (eindfase = read-only).
    if (["resultaat_vrijgegeven", "afgerond"].includes(dossier.status)) {
      return fail(res, 409, "Het dossier is afgerond; er kan geen logboekherinnering meer verstuurd worden");
    }

    // Werkelijk ontbrekende, reeds voorbije weken berekenen (zelfde logica als het ontbrekende-logboekenoverzicht),
    // zodat er geen herinnering uitgaat voor toekomstige of al ingediende weken.
    const [bestaande] = await db.query(
      "SELECT week_nummer, status FROM logboek_weken WHERE stagedossier_id = ?",
      [dossier.stagedossier_id]
    );
    const perWeek = new Map(bestaande.map((w) => [Number(w.week_nummer), w.status]));
    const totaalWeken = Math.max(0, Number(dossier.aantal_weken || 0));
    const startD = dossier.startdatum ? new Date(dossier.startdatum) : null;
    const vandaag = new Date(); vandaag.setHours(0, 0, 0, 0);
    const weekVoorbij = (n) => {
      if (!startD || Number.isNaN(startD.getTime())) return true;
      const einde = new Date(startD); einde.setDate(einde.getDate() + n * 7);
      return einde <= vandaag;
    };
    const ontbrekend = [];
    for (let n = 1; n <= totaalWeken; n += 1) {
      const st = perWeek.get(n);
      if ((st === undefined || st === "ontbreekt") && weekVoorbij(n)) ontbrekend.push(n);
    }

    // Specifiek gevraagde weken filteren op echt-ontbrekend; anders alle ontbrekende weken.
    const weken = gevraagdeWeken.length > 0
      ? gevraagdeWeken.filter((w) => ontbrekend.includes(w))
      : ontbrekend;

    if (weken.length === 0) {
      return fail(res, 409, "Er zijn geen ontbrekende (reeds voorbije) logboekweken om aan te herinneren");
    }

    const weekTekst = ` voor week ${weken.join(", ")}`;
    const bericht = `Gelieve je ontbrekende logboek${weekTekst} in te dienen.`;

    await meld(studentId, {
      titel: "Ontbrekend logboek",
      bericht,
      type: "herinnering",
      ernst: "medium",
      aangemaaktDoorId: docentId,
      stagedossierId: rows[0].stagedossier_id
    });
    await emailMelding(studentId, {
      titel: "Ontbrekend logboek",
      bericht,
      type: "herinnering",
      ernst: "medium",
      aangemaaktDoorId: docentId,
      stagedossierId: rows[0].stagedossier_id
    });

    return ok(
      res,
      { studentId, stagedossierId: rows[0].stagedossier_id, weken, emailStatus: "geregistreerd" },
      "Logboekherinnering verstuurd"
    );
  } catch (error) {
    return fail(res, 500, "Logboekherinnering sturen mislukt", error.message);
  }
}

// POST /api/logbooks/day — student slaat één logboekdag op (de week wordt aangemaakt indien nodig).
async function saveLogbookDay(req, res) {
  const studentId = Number(req.user?.id);
  const weekNummer = Number(req.body.weekNummer ?? req.body.week_nummer);
  const datum = req.body.datum;
  const status = req.body.status === "geen_stagedag" ? "geen_stagedag" : "ingevuld";
  const { titel, uitgevoerdeTaken, reflectie, problemen, leerpunten } = req.body;
  const aantalUren = status === "geen_stagedag" ? 0 : Number(req.body.aantalUren ?? req.body.aantal_uren ?? 0);
  // Optioneel: competenties die de student aan deze dag koppelt. Zelfde formaat als bij de volledige
  // weekindiening (codes zoals 'LO1'); niet naar getallen filteren, anders verdwijnen ze (auditpunt 329).
  const competenties = Array.isArray(req.body.competenties)
    ? req.body.competenties.filter((c) => c !== null && c !== undefined && c !== "")
    : null;

  if (!weekNummer || !datum) return fail(res, 400, "weekNummer en datum zijn verplicht");

  if (!Number.isFinite(aantalUren) || aantalUren < 0 || aantalUren > 12) {
    return fail(res, 400, "Aantal uren per dag moet tussen 0 en 12 liggen");
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [dossiers] = await conn.query(
      "SELECT id, status, startdatum, einddatum, aantal_weken, mentor_id FROM stagedossiers WHERE student_id = ? ORDER BY aangemaakt_op DESC LIMIT 1",
      [studentId]
    );
    if (dossiers.length === 0) { await conn.rollback(); return fail(res, 404, "Geen stagedossier gevonden"); }
    const dossierId = dossiers[0].id;

    // Datum/week binnen de stageperiode — dezelfde grenzen als bij de week-indiening.
    const dDatum = new Date(datum);
    if (dossiers[0].aantal_weken && weekNummer > Number(dossiers[0].aantal_weken)) {
      await conn.rollback();
      return fail(res, 400, `Weeknummer ${weekNummer} valt buiten de stageperiode (max ${dossiers[0].aantal_weken} weken)`);
    }
    if (dossiers[0].startdatum && !Number.isNaN(dDatum.getTime()) && dDatum < new Date(dossiers[0].startdatum)) {
      await conn.rollback();
      return fail(res, 400, "De datum valt voor de start van de stage");
    }
    if (dossiers[0].einddatum && !Number.isNaN(dDatum.getTime()) && dDatum > new Date(dossiers[0].einddatum)) {
      await conn.rollback();
      return fail(res, 400, "De datum valt na het einde van de stage");
    }

    // Logboek pas invulbaar nadat de student de stageovereenkomst getekend heeft.
    const [ovk] = await conn.query(
      "SELECT student_getekend_op FROM stageovereenkomsten WHERE stagedossier_id = ? ORDER BY aangemaakt_op DESC LIMIT 1",
      [dossierId]
    );
    if (!ovk[0] || !ovk[0].student_getekend_op) {
      await conn.rollback();
      return fail(res, 409, "Je kan pas een logboek invullen nadat je de stageovereenkomst getekend hebt");
    }

    const teVroeg = ["wacht_op_student", "wacht_op_bedrijf", "in_controle_bij_administratie", "document_afgekeurd"];
    if (teVroeg.includes(dossiers[0].status)) {
      await conn.rollback();
      return fail(res, 409, "Je kan pas een logboek invullen zodra je stagedossier startklaar geregistreerd is");
    }
    if (["resultaat_vrijgegeven", "afgerond"].includes(dossiers[0].status)) {
      await conn.rollback();
      return fail(res, 409, "Je stage is afgerond; je kan geen logboek meer invullen");
    }

    // En pas vanaf de effectieve startdatum — gelijk met wat de student in de app ziet (logboek opent op de startdatum).
    if (dossiers[0].startdatum) {
      const start = new Date(dossiers[0].startdatum);
      const vandaag = new Date();
      vandaag.setHours(0, 0, 0, 0);
      start.setHours(0, 0, 0, 0);
      if (!Number.isNaN(start.getTime()) && vandaag < start) {
        await conn.rollback();
        return fail(res, 409, "Je logboek opent pas vanaf de startdatum van je stage");
      }
    }

    await startStageIndienNodig(conn, dossierId, dossiers[0].status);

    // Week zoeken of aanmaken (week_start = maandag van de datum, week_einde = vrijdag).
    const [weken] = await conn.query(
      "SELECT id, status FROM logboek_weken WHERE stagedossier_id = ? AND week_nummer = ? LIMIT 1",
      [dossierId, weekNummer]
    );
    let weekId, weekStatus;
    if (weken.length === 0) {
      const [w] = await conn.query(
        `INSERT INTO logboek_weken (stagedossier_id, week_nummer, week_start, week_einde, status, aangemaakt_op, aangepast_op)
         VALUES (?, ?, DATE_SUB(?, INTERVAL WEEKDAY(?) DAY), DATE_ADD(DATE_SUB(?, INTERVAL WEEKDAY(?) DAY), INTERVAL 4 DAY), 'in_opbouw', NOW(), NOW())`,
        [dossierId, weekNummer, datum, datum, datum, datum]
      );
      weekId = w.insertId; weekStatus = "in_opbouw";
    } else {
      weekId = weken[0].id; weekStatus = weken[0].status;
    }

    const bewerkbaar = ["niet_gestart", "in_opbouw", "teruggestuurd_door_mentor", "teruggestuurd_door_docent"];
    if (!bewerkbaar.includes(weekStatus)) {
      await conn.rollback();
      return fail(res, 409, "Deze week is al ingediend en kan niet meer aangepast worden");
    }

    // Dag upserten op (week, datum).
    const [bestaand] = await conn.query(
      "SELECT id FROM logboek_dagen WHERE logboek_week_id = ? AND datum = ? LIMIT 1",
      [weekId, datum]
    );
    const competentiesJson = competenties && competenties.length > 0 ? JSON.stringify(competenties) : null;
    if (bestaand.length > 0) {
      await conn.query(
        `UPDATE logboek_dagen SET status = ?, titel = ?, uitgevoerde_taken = ?, reflectie = ?, problemen = ?, leerpunten = ?, competenties = ?, aantal_uren = ?, aangepast_op = NOW() WHERE id = ?`,
        [status, titel || null, uitgevoerdeTaken || null, reflectie || null, problemen || null, leerpunten || null, competentiesJson, aantalUren, bestaand[0].id]
      );
    } else {
      await conn.query(
        `INSERT INTO logboek_dagen (logboek_week_id, datum, status, titel, uitgevoerde_taken, reflectie, problemen, leerpunten, competenties, aantal_uren, aangemaakt_op, aangepast_op)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [weekId, datum, status, titel || null, uitgevoerdeTaken || null, reflectie || null, problemen || null, leerpunten || null, competentiesJson, aantalUren]
      );
    }

    // Weektotaal herberekenen.
    await conn.query(
      "UPDATE logboek_weken SET totaal_uren = (SELECT COALESCE(SUM(aantal_uren),0) FROM logboek_dagen WHERE logboek_week_id = ?), aangepast_op = NOW() WHERE id = ?",
      [weekId, weekId]
    );

    await conn.commit();

    // Mentor verwittigen dat de student een dag heeft opgeslagen (story 31).
    if (dossiers[0].mentor_id && status !== "geen_stagedag") {
      try {
        await meld(dossiers[0].mentor_id, {
          titel: "Logboekdag ingevuld",
          bericht: `Je stagiair heeft week ${weekNummer} (${datum}) ingevuld en is klaar voor nakijken.`,
          aangemaaktDoorId: studentId,
          logboekWeekId: weekId,
        });
      } catch (notifyErr) {
        console.error("Melding dag-opslaan mislukt:", notifyErr.message);
      }
    }

    return ok(res, { weekId, weekNummer, datum, status }, "Logboekdag opgeslagen");
  } catch (error) {
    await conn.rollback();
    return fail(res, 500, "Logboekdag opslaan mislukt", error.message);
  } finally {
    conn.release();
  }
}

// PATCH /api/mentor/logbooks/days/:dayId/confirm — mentor bevestigt één logboekdag (story 31).
async function mentorConfirmLogbookDay(req, res) {
  const dayId = Number(req.params.dayId);
  const mentorId = Number(req.user?.id);
  if (!dayId) return fail(res, 400, "Ongeldig dag-id");

  try {
    const [rows] = await db.query(
      `SELECT ld.id, ld.status, d.mentor_id, lw.status AS week_status
       FROM logboek_dagen ld
       JOIN logboek_weken lw ON lw.id = ld.logboek_week_id
       JOIN stagedossiers d ON d.id = lw.stagedossier_id
       WHERE ld.id = ? LIMIT 1`,
      [dayId]
    );
    if (rows.length === 0) return fail(res, 404, "Logboekdag niet gevonden");
    if (Number(rows[0].mentor_id) !== mentorId) return fail(res, 403, "Je bent niet de mentor van deze stagiair");
    if (rows[0].status === "geen_stagedag") return fail(res, 400, "Een dag zonder stage kan niet bevestigd worden");
    // Bevestigen mag zodra de student de dag opgeslagen heeft (in_opbouw) of de volledige week ingediend heeft.
    if (!["ingediend", "in_opbouw"].includes(rows[0].week_status)) {
      return fail(res, 409, "Je kan dagen alleen bevestigen wanneer de student ze heeft opgeslagen of ingediend");
    }

    await db.query(
      "UPDATE logboek_dagen SET mentor_bevestigd_op = NOW(), aangepast_op = NOW() WHERE id = ?",
      [dayId]
    );
    return ok(res, { id: dayId }, "Logboekdag bevestigd");
  } catch (error) {
    return fail(res, 500, "Logboekdag bevestigen mislukt", error.message);
  }
}

// PATCH /api/logbooks/entries/:id — één logboekdag van de ingelogde student bijwerken (Story 7).
async function updateLogbookEntry(req, res) {
  const studentId = getUserId(req, 1);
  const entryId = Number(req.params.id);

  if (!entryId) return fail(res, 400, "Ongeldige logboekdag-id");

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `
      SELECT ld.id, ld.logboek_week_id, lw.status AS week_status, d.student_id
      FROM logboek_dagen ld
      JOIN logboek_weken lw ON lw.id = ld.logboek_week_id
      JOIN stagedossiers d ON d.id = lw.stagedossier_id
      WHERE ld.id = ?
      LIMIT 1
      `,
      [entryId]
    );

    const entry = rows[0];
    if (!entry) {
      await connection.rollback();
      return fail(res, 404, "Logboekdag niet gevonden");
    }
    if (entry.student_id !== studentId) {
      await connection.rollback();
      return fail(res, 403, "Je mag alleen je eigen logboekdagen aanpassen");
    }
    const bewerkbaar = ["niet_gestart", "in_opbouw", "teruggestuurd_door_mentor", "teruggestuurd_door_docent"];
    if (!bewerkbaar.includes(entry.week_status)) {
      await connection.rollback();
      return fail(res, 409, "Deze week is al ingediend of nagekeken en kan niet meer aangepast worden");
    }

    const b = req.body || {};
    const velden = [];
    const params = [];
    const setVeld = (kolom, waarde) => { velden.push(`${kolom} = ?`); params.push(waarde); };

    if (b.status !== undefined) {
      const dagStatus = b.status === "geen_stagedag" ? "geen_stagedag" : "ingevuld";
      setVeld("status", dagStatus);
      if (dagStatus === "geen_stagedag") setVeld("aantal_uren", 0);
    }
    if (b.titel !== undefined) setVeld("titel", b.titel || null);
    if (b.uitgevoerdeTaken !== undefined || b.uitgevoerde_taken !== undefined)
      setVeld("uitgevoerde_taken", b.uitgevoerdeTaken ?? b.uitgevoerde_taken ?? null);
    if (b.reflectie !== undefined) setVeld("reflectie", b.reflectie || null);
    if (b.problemen !== undefined) setVeld("problemen", b.problemen || null);
    if (b.leerpunten !== undefined) setVeld("leerpunten", b.leerpunten || null);
    if (b.competenties !== undefined) {
      const comp = Array.isArray(b.competenties) ? b.competenties : [];
      setVeld("competenties", comp.length > 0 ? JSON.stringify(comp) : null);
    }
    if (b.aantalUren !== undefined || b.aantal_uren !== undefined) {
      const uren = Number(b.aantalUren ?? b.aantal_uren ?? 0);
      if (!Number.isFinite(uren) || uren < 0 || uren > 12) {
        await connection.rollback();
        return fail(res, 400, "Aantal uren per dag moet tussen 0 en 12 liggen");
      }
      setVeld("aantal_uren", uren);
    }

    if (velden.length === 0) {
      await connection.rollback();
      return fail(res, 400, "Geen velden om bij te werken");
    }

    params.push(entryId);
    await connection.query(
      `UPDATE logboek_dagen SET ${velden.join(", ")}, aangepast_op = NOW() WHERE id = ?`,
      params
    );

    await connection.query(
      `
      UPDATE logboek_weken
      SET totaal_uren = (
        SELECT COALESCE(SUM(aantal_uren), 0) FROM logboek_dagen WHERE logboek_week_id = ?
      ), aangepast_op = NOW()
      WHERE id = ?
      `,
      [entry.logboek_week_id, entry.logboek_week_id]
    );

    await connection.commit();
    return ok(res, { id: entryId, logboekWeekId: entry.logboek_week_id }, "Logboekdag bijgewerkt");
  } catch (error) {
    await connection.rollback();
    return fail(res, 500, "Logboekdag bijwerken mislukt", error.message);
  } finally {
    connection.release();
  }
}

module.exports = {
  createLogbook,
  saveLogbookDay,
  updateLogbookEntry,
  getLogbooksByStudent,
  mentorConfirmLogbookDay,
  mentorCheckLogbookWeek,
  docentReviewLogbookWeek,
  studentAntwoordFeedback,
  getMissingLogbooksForDocent,
  getMissingLogbooksForMentor,
  sendMissingLogbookReminder
};
