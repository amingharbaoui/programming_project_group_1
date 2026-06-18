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

// Tz-veilige parsing/formatting op kalenderdatum (geen lokale-tijd-drift).
function parseDatumUTC(value) {
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}
function formatDatumUTC(dt) {
  return dt.toISOString().slice(0, 10);
}

// Geeft de verplichte werkdagen (ma–vr) terug die ontbreken of nog niet bevestigd zijn.
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
    SELECT id, student_id, mentor_id, stagebegeleider_id
    FROM stagedossiers
    WHERE id = ?
    LIMIT 1
    `,
    [dossierId]
  );

  return rows[0] || null;
}


async function getValidMentorIdForWeek(connection, weekId, requestedMentorId) {
  const [rows] = await connection.query(
    `
    SELECT 
      lw.mentor_id AS week_mentor_id,
      d.mentor_id AS dossier_mentor_id
    FROM logboek_weken lw
    JOIN stagedossiers d ON d.id = lw.stagedossier_id
    WHERE lw.id = ?
    LIMIT 1
    `,
    [weekId]
  );

  const data = rows[0];
  const candidates = [
    requestedMentorId,
    data?.week_mentor_id,
    data?.dossier_mentor_id
  ].filter(Boolean);

  for (const id of candidates) {
    const [valid] = await connection.query(
      "SELECT gebruiker_id FROM mentoren WHERE gebruiker_id = ? LIMIT 1",
      [id]
    );

    if (valid.length > 0) return id;
  }

  return null;
}

async function getValidDocentIdForWeek(connection, weekId, requestedDocentId) {
  const [rows] = await connection.query(
    `
    SELECT 
      lw.docent_id AS week_docent_id,
      d.stagebegeleider_id AS dossier_docent_id
    FROM logboek_weken lw
    JOIN stagedossiers d ON d.id = lw.stagedossier_id
    WHERE lw.id = ?
    LIMIT 1
    `,
    [weekId]
  );

  const data = rows[0];
  const candidates = [
    requestedDocentId,
    data?.week_docent_id,
    data?.dossier_docent_id
  ].filter(Boolean);

  for (const id of candidates) {
    const [valid] = await connection.query(
      "SELECT gebruiker_id FROM medewerkers WHERE gebruiker_id = ? LIMIT 1",
      [id]
    );

    if (valid.length > 0) return id;
  }

  return null;
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
    if (uren < 0) {
      return fail(res, 400, "Aantal uren per dag kan niet negatief zijn");
    }
  }

  // Een week kan niet ingediend worden met ontbrekende verplichte werkdagen (Story 8).
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

    if (existingWeeks.length > 0) {
      weekId = existingWeeks[0].id;

      const [weekStatus] = await connection.query(
        "SELECT status FROM logboek_weken WHERE id = ? LIMIT 1",
        [weekId]
      );

      if (weekStatus[0]?.status === "afgesloten") {
        await connection.rollback();
        return fail(res, 409, "Deze week is afgesloten en kan niet meer aangepast worden");
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
          aangemaakt_op,
          aangepast_op
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
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
          Number(day.aantalUren || day.aantal_uren || 0)
        ]
      );
    }

    await connection.commit();

    // Mentor verwittigen van de ingediende logboekweek
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
        aantal_uren
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
  const requestedMentorId = getUserId(req, 4);

  const {
    feedback,
    mentorFeedback,
    herindieningNodig,
    blokkade
  } = req.body;

  const needsResubmission = Boolean(herindieningNodig);
  const connection = await db.getConnection();

  try {
    const [existing] = await connection.query(
      "SELECT id FROM logboek_weken WHERE id = ? LIMIT 1",
      [weekId]
    );

    if (existing.length === 0) {
      return fail(res, 404, "Logboekweek niet gevonden");
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
  const requestedDocentId = getUserId(req, 5);

  const {
    feedback,
    docentFeedback,
    herindieningNodig,
    blokkade
  } = req.body;

  const needsResubmission = Boolean(herindieningNodig);
  const connection = await db.getConnection();

  try {
    const [existing] = await connection.query(
      "SELECT id FROM logboek_weken WHERE id = ? LIMIT 1",
      [weekId]
    );

    if (existing.length === 0) {
      return fail(res, 404, "Logboekweek niet gevonden");
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
    // Controleer of deze week bij de student hoort
    const [rows] = await db.query(
      `SELECT lw.id FROM logboek_weken lw
       JOIN stagedossiers d ON d.id = lw.stagedossier_id
       WHERE lw.id = ? AND d.student_id = ? LIMIT 1`,
      [weekId, studentId]
    );
    if (rows.length === 0) return fail(res, 403, "Geen toegang tot deze week");

    await db.query(
      "UPDATE logboek_weken SET student_antwoord = ?, aangepast_op = NOW() WHERE id = ?",
      [antwoord.trim(), weekId]
    );

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

    const result = dossiers.map((dossier) => {
      const totalWeeks = Math.max(0, Number(dossier.aantal_weken || 0));
      const existing = weeksByDossier.get(dossier.stagedossier_id) || new Map();
      const ontbrekendeWeken = [];

      for (let weekNummer = 1; weekNummer <= totalWeeks; weekNummer += 1) {
        const week = existing.get(weekNummer);
        if (!week || week.status === "ontbreekt") {
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
  const weken = Array.isArray(req.body.weken) ? req.body.weken.map(Number).filter(Boolean) : [];

  if (!studentId) return fail(res, 400, "studentId is verplicht");

  try {
    const [rows] = await db.query(
      `
      SELECT d.id AS stagedossier_id, d.student_id, g.voornaam, g.achternaam
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

    const weekTekst = weken.length > 0 ? ` voor week ${weken.join(", ")}` : "";
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

// PATCH /api/logbooks/entries/:id — één logboekdag van de ingelogde student bijwerken.
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
    if (entry.week_status === "afgesloten") {
      await connection.rollback();
      return fail(res, 409, "Deze week is afgesloten en kan niet meer aangepast worden");
    }

    const b = req.body || {};
    const velden = [];
    const params = [];
    const setVeld = (kolom, waarde) => { velden.push(`${kolom} = ?`); params.push(waarde); };

    if (b.status !== undefined) setVeld("status", b.status);
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
      if (uren < 0) {
        await connection.rollback();
        return fail(res, 400, "Aantal uren kan niet negatief zijn");
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

    // Weektotaal opnieuw berekenen.
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
  updateLogbookEntry,
  getLogbooksByStudent,
  mentorCheckLogbookWeek,
  docentReviewLogbookWeek,
  studentAntwoordFeedback,
  getMissingLogbooksForDocent,
  sendMissingLogbookReminder
};
