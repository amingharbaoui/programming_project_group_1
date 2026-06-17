const fs = require("fs");
const path = require("path");
const db = require("../config/db");
const { ok, fail } = require("../utils/response");
const { meld, emailMelding } = require("../utils/notify");

function getUserId(req, fallbackId) {
  return Number(req.user?.id || fallbackId);
}

function calculateWeeks(startdatum, einddatum) {
  const start = new Date(startdatum);
  const end = new Date(einddatum);
  const diffMs = end - start;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, Math.ceil(diffDays / 7));
}

function pdfEscape(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r?\n/g, " ");
}

function buildSimplePdf(lines) {
  const text = lines
    .map((line, index) => `BT /F1 11 Tf 50 ${760 - index * 18} Td (${pdfEscape(line)}) Tj ET`)
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(text, "utf8")} >>\nstream\n${text}\nendstream`
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "utf8");
}

async function ensureDocumentType(connection, type, naam) {
  const [rows] = await connection.query(
    "SELECT id FROM document_soorten WHERE type = ? AND status = 'actief' ORDER BY id LIMIT 1",
    [type]
  );
  if (rows[0]?.id) return rows[0].id;

  const [result] = await connection.query(
    `INSERT INTO document_soorten (naam, type, is_verplicht, is_vast, status, aangemaakt_op, aangepast_op)
     VALUES (?, ?, 0, 1, 'actief', NOW(), NOW())`,
    [naam, type]
  );
  return result.insertId;
}

async function getStudentData(connection, studentId) {
  const [rows] = await connection.query(
    `
    SELECT 
      s.gebruiker_id,
      s.studentennummer,
      s.opleiding,
      s.academiejaar,
      g.voornaam,
      g.achternaam,
      g.email
    FROM studenten s
    JOIN gebruikers g ON g.id = s.gebruiker_id
    WHERE s.gebruiker_id = ?
    `,
    [studentId]
  );

  return rows[0];
}

async function getActiveStageRule(connection, opleiding, academiejaar) {
  const [rows] = await connection.query(
    `
    SELECT *
    FROM stage_regels
    WHERE opleiding = ?
      AND academiejaar = ?
      AND status = 'actief'
    LIMIT 1
    `,
    [opleiding, academiejaar]
  );

  if (rows.length > 0) return rows[0];

  const [fallback] = await connection.query(
    `
    SELECT *
    FROM stage_regels
    WHERE status = 'actief'
    LIMIT 1
    `
  );

  return fallback[0];
}

async function getDefaultDocentId(connection) {
  const [rows] = await connection.query(
    `
    SELECT m.gebruiker_id
    FROM medewerkers m
    JOIN gebruikers g ON g.id = m.gebruiker_id
    WHERE m.medewerker_type = 'docent'
      AND g.status = 'actief'
    ORDER BY m.gebruiker_id
    LIMIT 1
    `
  );

  return rows[0]?.gebruiker_id || null;
}

async function getMentorIdByEmail(connection, email) {
  if (!email) return null;

  const [rows] = await connection.query(
    `
    SELECT m.gebruiker_id
    FROM mentoren m
    JOIN gebruikers g ON g.id = m.gebruiker_id
    WHERE g.email = ?
    LIMIT 1
    `,
    [email]
  );

  return rows[0]?.gebruiker_id || null;
}

async function getDefaultMentorId(connection) {
  const [rows] = await connection.query(
    `
    SELECT m.gebruiker_id
    FROM mentoren m
    JOIN gebruikers g ON g.id = m.gebruiker_id
    WHERE g.status = 'actief'
    ORDER BY m.gebruiker_id
    LIMIT 1
    `
  );

  return rows[0]?.gebruiker_id || null;
}

async function createInternship(req, res) {
  const studentId = getUserId(req, 1);

  const {
    bedrijfNaam,
    bedrijfsnaam,
    bedrijfsafdeling,
    bedrijfsadres,
    mentorNaam,
    mentorEmail,
    mentorTelefoon,
    mentorFunctie,
    stagefunctie,
    opdrachtomschrijving,
    startdatum,
    einddatum,
    urenPerWeek
  } = req.body;

  const finalBedrijfNaam = bedrijfNaam || bedrijfsnaam;
  const finalUrenPerWeek = Number(urenPerWeek || 38);

  if (!finalBedrijfNaam || !mentorNaam || !mentorEmail || !stagefunctie || !opdrachtomschrijving || !startdatum || !einddatum) {
    return fail(res, 400, "Verplichte velden ontbreken");
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const student = await getStudentData(connection, studentId);
    if (!student) {
      await connection.rollback();
      return fail(res, 404, "Student niet gevonden");
    }

    const stageRegel = await getActiveStageRule(connection, student.opleiding, student.academiejaar);
    if (!stageRegel) {
      await connection.rollback();
      return fail(res, 400, "Geen actieve stage_regel gevonden");
    }

    const aantalWeken = calculateWeeks(startdatum, einddatum);
    const totaalUren = aantalWeken * finalUrenPerWeek;

    // Als er al een concept bestaat, upgrade dat naar 'ingediend' i.p.v. nieuw aanmaken
    const [conceptRows] = await connection.query(
      "SELECT id, bedrijf_id FROM stagevoorstellen WHERE student_id = ? AND status = 'concept' ORDER BY aangemaakt_op DESC LIMIT 1",
      [studentId]
    );

    let stagevoorstelId, versieId;

    if (conceptRows.length > 0) {
      stagevoorstelId = conceptRows[0].id;
      const bedrijfId = conceptRows[0].bedrijf_id;

      await connection.query(
        "UPDATE bedrijven SET naam = ?, afdeling = ?, adres = ?, aangepast_op = NOW() WHERE id = ?",
        [finalBedrijfNaam, bedrijfsafdeling || null, bedrijfsadres || null, bedrijfId]
      );

      await connection.query(
        `UPDATE stagevoorstel_versies SET
          bedrijf_naam = ?, bedrijfsafdeling = ?, bedrijfsadres = ?,
          mentor_naam = ?, mentor_email = ?, mentor_telefoon = ?, mentor_functie = ?,
          stagefunctie = ?, opdrachtomschrijving = ?,
          startdatum = ?, einddatum = ?, aantal_weken = ?, uren_per_week = ?, totaal_uren = ?,
          ingediend_door_id = ?, ingediend_op = NOW()
         WHERE stagevoorstel_id = ? AND versie_nummer = 1`,
        [
          finalBedrijfNaam, bedrijfsafdeling || null, bedrijfsadres || null,
          mentorNaam, mentorEmail, mentorTelefoon || null, mentorFunctie || null,
          stagefunctie, opdrachtomschrijving,
          startdatum, einddatum, aantalWeken, finalUrenPerWeek, totaalUren,
          studentId, stagevoorstelId
        ]
      );

      const [versieRows] = await connection.query(
        "SELECT id FROM stagevoorstel_versies WHERE stagevoorstel_id = ? AND versie_nummer = 1",
        [stagevoorstelId]
      );
      versieId = versieRows[0]?.id;

      await connection.query(
        "UPDATE stagevoorstellen SET status = 'ingediend', ingediend_op = NOW(), aangepast_op = NOW() WHERE id = ?",
        [stagevoorstelId]
      );
    } else {
      // Geen concept: maak alles nieuw aan
      const voorlopigeStagebegeleiderId = await getDefaultDocentId(connection);
      if (!voorlopigeStagebegeleiderId) {
        await connection.rollback();
        return fail(res, 400, "Geen docent gevonden om voorlopig te koppelen");
      }

      const [bedrijfResult] = await connection.query(
        "INSERT INTO bedrijven (naam, afdeling, adres, aangemaakt_op, aangepast_op) VALUES (?, ?, ?, NOW(), NOW())",
        [finalBedrijfNaam, bedrijfsafdeling || null, bedrijfsadres || null]
      );
      const bedrijfId = bedrijfResult.insertId;

      const [voorstelResult] = await connection.query(
        `INSERT INTO stagevoorstellen
          (student_id, bedrijf_id, stage_regel_id, voorlopige_stagebegeleider_id, status, huidige_versie_nummer, ingediend_op, aangemaakt_op, aangepast_op)
          VALUES (?, ?, ?, ?, 'ingediend', 1, NOW(), NOW(), NOW())`,
        [studentId, bedrijfId, stageRegel.id, voorlopigeStagebegeleiderId]
      );
      stagevoorstelId = voorstelResult.insertId;

      const [versieResult] = await connection.query(
        `INSERT INTO stagevoorstel_versies
          (stagevoorstel_id, versie_nummer, bedrijf_id, bedrijf_naam, bedrijfsafdeling, bedrijfsadres,
           mentor_naam, mentor_email, mentor_telefoon, mentor_functie, stagefunctie, opdrachtomschrijving,
           startdatum, einddatum, aantal_weken, uren_per_week, totaal_uren, ingediend_door_id, ingediend_op, aangemaakt_op)
          VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          stagevoorstelId, bedrijfId,
          finalBedrijfNaam, bedrijfsafdeling || null, bedrijfsadres || null,
          mentorNaam, mentorEmail, mentorTelefoon || null, mentorFunctie || null,
          stagefunctie, opdrachtomschrijving,
          startdatum, einddatum, aantalWeken, finalUrenPerWeek, totaalUren,
          studentId
        ]
      );
      versieId = versieResult.insertId;
    }

    await connection.commit();

    // Stagecommissie verwittigen
    try {
      const [commissie] = await db.query(
        "SELECT id FROM gebruikers WHERE hoofdrol = 'stagecommissie' AND status = 'actief'"
      );
      for (const lid of commissie) {
        await meld(lid.id, {
          titel: "Nieuw stagevoorstel",
          bericht: `${student.voornaam} ${student.achternaam} heeft een stagevoorstel ingediend.`,
          aangemaaktDoorId: studentId,
          stagevoorstelId
        });
      }
    } catch (notifyError) {
      console.error("Melding stagecommissie mislukt:", notifyError.message);
    }

    return ok(res, { stagevoorstelId, versieId, status: "ingediend" }, "Stagevoorstel ingediend");
  } catch (error) {
    await connection.rollback();
    return fail(res, 500, "Stagevoorstel indienen mislukt", error.message);
  } finally {
    connection.release();
  }
}

async function saveDraft(req, res) {
  const studentId = getUserId(req);
  const {
    bedrijfNaam, bedrijfsnaam, bedrijfsafdeling, bedrijfsadres,
    mentorNaam, mentorEmail, mentorTelefoon, mentorFunctie,
    stagefunctie, opdrachtomschrijving, startdatum, einddatum, urenPerWeek
  } = req.body;

  const finalBedrijfNaam = bedrijfNaam || bedrijfsnaam || null;
  const finalUrenPerWeek = Number(urenPerWeek || 38);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const student = await getStudentData(conn, studentId);
    if (!student) { await conn.rollback(); return fail(res, 404, "Student niet gevonden"); }

    const stageRegel = await getActiveStageRule(conn, student.opleiding, student.academiejaar);
    if (!stageRegel) { await conn.rollback(); return fail(res, 400, "Geen actieve stage_regel gevonden"); }

    const aantalWeken = (startdatum && einddatum) ? calculateWeeks(startdatum, einddatum) : null;
    const totaalUren = aantalWeken ? aantalWeken * finalUrenPerWeek : null;

    const [existing] = await conn.query(
      "SELECT id, bedrijf_id FROM stagevoorstellen WHERE student_id = ? AND status = 'concept' ORDER BY aangemaakt_op DESC LIMIT 1",
      [studentId]
    );

    let stagevoorstelId;

    if (existing.length > 0) {
      stagevoorstelId = existing[0].id;
      const bedrijfId = existing[0].bedrijf_id;

      await conn.query(
        `UPDATE bedrijven SET
          naam = COALESCE(?, naam), afdeling = COALESCE(?, afdeling), adres = COALESCE(?, adres),
          aangepast_op = NOW()
         WHERE id = ?`,
        [finalBedrijfNaam, bedrijfsafdeling || null, bedrijfsadres || null, bedrijfId]
      );

      await conn.query(
        `UPDATE stagevoorstel_versies SET
          bedrijf_naam       = COALESCE(?, bedrijf_naam),
          bedrijfsafdeling   = COALESCE(?, bedrijfsafdeling),
          bedrijfsadres      = COALESCE(?, bedrijfsadres),
          mentor_naam        = COALESCE(?, mentor_naam),
          mentor_email       = COALESCE(?, mentor_email),
          mentor_telefoon    = COALESCE(?, mentor_telefoon),
          mentor_functie     = COALESCE(?, mentor_functie),
          stagefunctie       = COALESCE(?, stagefunctie),
          opdrachtomschrijving = COALESCE(?, opdrachtomschrijving),
          startdatum         = COALESCE(?, startdatum),
          einddatum          = COALESCE(?, einddatum),
          aantal_weken       = COALESCE(?, aantal_weken),
          uren_per_week      = ?,
          totaal_uren        = COALESCE(?, totaal_uren)
         WHERE stagevoorstel_id = ? AND versie_nummer = 1`,
        [
          finalBedrijfNaam, bedrijfsafdeling || null, bedrijfsadres || null,
          mentorNaam || null, mentorEmail || null, mentorTelefoon || null, mentorFunctie || null,
          stagefunctie || null, opdrachtomschrijving || null,
          startdatum || null, einddatum || null,
          aantalWeken, finalUrenPerWeek, totaalUren,
          stagevoorstelId
        ]
      );

      await conn.query("UPDATE stagevoorstellen SET aangepast_op = NOW() WHERE id = ?", [stagevoorstelId]);
    } else {
      const voorlopigeStagebegeleiderId = await getDefaultDocentId(conn);

      const [bedrijfResult] = await conn.query(
        "INSERT INTO bedrijven (naam, afdeling, adres, aangemaakt_op, aangepast_op) VALUES (?, ?, ?, NOW(), NOW())",
        [finalBedrijfNaam || "Concept", bedrijfsafdeling || null, bedrijfsadres || null]
      );
      const bedrijfId = bedrijfResult.insertId;

      const [voorstelResult] = await conn.query(
        `INSERT INTO stagevoorstellen
          (student_id, bedrijf_id, stage_regel_id, voorlopige_stagebegeleider_id, status, huidige_versie_nummer, aangemaakt_op, aangepast_op)
          VALUES (?, ?, ?, ?, 'concept', 1, NOW(), NOW())`,
        [studentId, bedrijfId, stageRegel.id, voorlopigeStagebegeleiderId || null]
      );
      stagevoorstelId = voorstelResult.insertId;

      await conn.query(
        `INSERT INTO stagevoorstel_versies
          (stagevoorstel_id, versie_nummer, bedrijf_id, bedrijf_naam, bedrijfsafdeling, bedrijfsadres,
           mentor_naam, mentor_email, mentor_telefoon, mentor_functie, stagefunctie, opdrachtomschrijving,
           startdatum, einddatum, aantal_weken, uren_per_week, totaal_uren, ingediend_door_id, aangemaakt_op)
          VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          stagevoorstelId, bedrijfId,
          finalBedrijfNaam || null, bedrijfsafdeling || null, bedrijfsadres || null,
          mentorNaam || "", mentorEmail || "", mentorTelefoon || null, mentorFunctie || null,
          stagefunctie || "", opdrachtomschrijving || "",
          startdatum || stageRegel.stagevenster_start, einddatum || stageRegel.stagevenster_einde,
          aantalWeken ?? 0, finalUrenPerWeek, totaalUren ?? 0,
          studentId
        ]
      );
    }

    await conn.commit();
    return ok(res, { stagevoorstelId, status: "concept" }, "Concept opgeslagen");
  } catch (err) {
    await conn.rollback();
    return fail(res, 500, "Concept opslaan mislukt", err.message);
  } finally {
    conn.release();
  }
}

async function resubmitInternship(req, res) {
  const studentId = getUserId(req);
  const {
    bedrijfNaam, bedrijfsnaam, bedrijfsafdeling, bedrijfsadres,
    mentorNaam, mentorEmail, mentorTelefoon, mentorFunctie,
    stagefunctie, opdrachtomschrijving, startdatum, einddatum, urenPerWeek
  } = req.body;

  const finalBedrijfNaam = bedrijfNaam || bedrijfsnaam;
  const finalUrenPerWeek = Number(urenPerWeek || 38);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Haal huidig voorstel op met status aanpassingen_gevraagd
    const [voorstellen] = await conn.query(
      `SELECT sp.*, v.id AS versie_id,
              v.bedrijf_naam, v.bedrijfsafdeling, v.bedrijfsadres,
              v.mentor_naam, v.mentor_email, v.mentor_telefoon, v.mentor_functie,
              v.stagefunctie, v.opdrachtomschrijving,
              v.startdatum, v.einddatum, v.aantal_weken, v.uren_per_week, v.totaal_uren
       FROM stagevoorstellen sp
       JOIN stagevoorstel_versies v
         ON v.stagevoorstel_id = sp.id AND v.versie_nummer = sp.huidige_versie_nummer
       WHERE sp.student_id = ? AND sp.status = 'aanpassingen_gevraagd'
       ORDER BY sp.aangemaakt_op DESC LIMIT 1`,
      [studentId]
    );

    if (voorstellen.length === 0) {
      await conn.rollback();
      return fail(res, 400, "Geen voorstel gevonden met status 'aanpassingen_gevraagd'");
    }

    const voorstel = voorstellen[0];
    const nieuweVersieNummer = voorstel.huidige_versie_nummer + 1;

    const nieuwStartdatum = startdatum || voorstel.startdatum;
    const nieuwEinddatum = einddatum || voorstel.einddatum;
    const aantalWeken = (nieuwStartdatum && nieuwEinddatum) ? calculateWeeks(nieuwStartdatum, nieuwEinddatum) : voorstel.aantal_weken;
    const totaalUren = aantalWeken * finalUrenPerWeek;

    // Nieuwe versie aanmaken
    await conn.query(
      `INSERT INTO stagevoorstel_versies
        (stagevoorstel_id, versie_nummer, bedrijf_id,
         bedrijf_naam, bedrijfsafdeling, bedrijfsadres,
         mentor_naam, mentor_email, mentor_telefoon, mentor_functie,
         stagefunctie, opdrachtomschrijving,
         startdatum, einddatum, aantal_weken, uren_per_week, totaal_uren,
         ingediend_door_id, ingediend_op, aangemaakt_op)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        voorstel.id, nieuweVersieNummer, voorstel.bedrijf_id,
        finalBedrijfNaam || voorstel.bedrijf_naam,
        bedrijfsafdeling ?? voorstel.bedrijfsafdeling,
        bedrijfsadres ?? voorstel.bedrijfsadres,
        mentorNaam || voorstel.mentor_naam,
        mentorEmail || voorstel.mentor_email,
        mentorTelefoon ?? voorstel.mentor_telefoon,
        mentorFunctie ?? voorstel.mentor_functie,
        stagefunctie || voorstel.stagefunctie,
        opdrachtomschrijving || voorstel.opdrachtomschrijving,
        nieuwStartdatum, nieuwEinddatum, aantalWeken, finalUrenPerWeek, totaalUren,
        studentId
      ]
    );

    // Voorstel updaten: versienummer ophogen + status heringediend
    await conn.query(
      `UPDATE stagevoorstellen
       SET huidige_versie_nummer = ?, status = 'heringediend', heringediend_op = NOW(), aangepast_op = NOW()
       WHERE id = ?`,
      [nieuweVersieNummer, voorstel.id]
    );

    await conn.commit();

    // Stagecommissie notificeren
    try {
      const student = await getStudentData(db, studentId);
      const [commissie] = await db.query(
        "SELECT id FROM gebruikers WHERE hoofdrol = 'stagecommissie' AND status = 'actief'"
      );
      for (const lid of commissie) {
        await meld(lid.id, {
          titel: "Heringediend stagevoorstel",
          bericht: `${student?.voornaam} ${student?.achternaam} heeft een aangepast stagevoorstel ingediend (versie ${nieuweVersieNummer}).`,
          aangemaaktDoorId: studentId,
          stagevoorstelId: voorstel.id
        });
      }
    } catch (notifyError) {
      console.error("Melding herindienen mislukt:", notifyError.message);
    }

    return ok(res, { stagevoorstelId: voorstel.id, versieNummer: nieuweVersieNummer, status: "heringediend" }, "Voorstel heringediend");
  } catch (err) {
    await conn.rollback();
    return fail(res, 500, "Herindienen mislukt", err.message);
  } finally {
    conn.release();
  }
}

async function withdrawInternship(req, res) {
  const studentId = getUserId(req);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      "SELECT id, status FROM stagevoorstellen WHERE student_id = ? ORDER BY aangemaakt_op DESC LIMIT 1",
      [studentId]
    );

    if (rows.length === 0) {
      await conn.rollback();
      return fail(res, 404, "Geen stagevoorstel gevonden");
    }

    const voorstel = rows[0];
    const intrekbaar = ["concept", "ingediend", "aanpassingen_gevraagd", "heringediend"];
    if (!intrekbaar.includes(voorstel.status)) {
      await conn.rollback();
      return fail(res, 409, `Voorstel met status '${voorstel.status}' kan niet ingetrokken worden`);
    }

    await conn.query(
      "UPDATE stagevoorstellen SET status = 'ingetrokken', ingetrokken_op = NOW(), aangepast_op = NOW() WHERE id = ?",
      [voorstel.id]
    );

    await conn.commit();
    return ok(res, { stagevoorstelId: voorstel.id, status: "ingetrokken" }, "Stagevoorstel ingetrokken");
  } catch (err) {
    await conn.rollback();
    return fail(res, 500, "Voorstel intrekken mislukt", err.message);
  } finally {
    conn.release();
  }
}

async function getMyInternship(req, res) {
  const studentId = getUserId(req);

  try {
    const [rows] = await db.query(
      `
      SELECT
        sp.id,
        sp.status,
        sp.huidige_versie_nummer,
        sp.ingediend_op,
        sp.heringediend_op,
        sp.goedgekeurd_op,
        sp.afgekeurd_op,

        v.id AS versie_id,
        v.bedrijf_naam,
        v.bedrijfsafdeling,
        v.bedrijfsadres,
        v.mentor_naam,
        v.mentor_email,
        v.mentor_telefoon,
        v.mentor_functie,
        v.stagefunctie,
        v.opdrachtomschrijving,
        v.startdatum,
        v.einddatum,
        v.aantal_weken,
        v.uren_per_week,
        v.totaal_uren,

        b.beslissing AS laatste_beslissing,
        b.feedback AS laatste_feedback,
        b.motivering AS laatste_motivering,
        b.beslist_op AS laatste_beslist_op
      FROM stagevoorstellen sp
      JOIN stagevoorstel_versies v
        ON v.stagevoorstel_id = sp.id
       AND v.versie_nummer = sp.huidige_versie_nummer
      LEFT JOIN voorstel_beslissingen b
        ON b.id = (
          SELECT vb.id
          FROM voorstel_beslissingen vb
          WHERE vb.stagevoorstel_id = sp.id
          ORDER BY vb.beslist_op DESC
          LIMIT 1
        )
      WHERE sp.student_id = ?
      ORDER BY sp.aangemaakt_op DESC
      LIMIT 1
      `,
      [studentId]
    );

    return ok(res, rows[0] || null, "Mijn stagevoorstel opgehaald");
  } catch (error) {
    return fail(res, 500, "Mijn stagevoorstel ophalen mislukt", error.message);
  }
}

async function getCommitteeApplications(req, res) {
  try {
    const [rows] = await db.query(
      `
      SELECT
        sp.id,
        sp.status,
        sp.huidige_versie_nummer,
        sp.ingediend_op,
        sp.goedgekeurd_op,
        sp.afgekeurd_op,

        g.voornaam AS student_voornaam,
        g.achternaam AS student_achternaam,
        g.email AS student_email,
        s.studentennummer,
        s.opleiding,
        s.academiejaar,

        v.id AS versie_id,
        v.bedrijf_naam,
        v.mentor_naam,
        v.mentor_email,
        v.stagefunctie,
        v.opdrachtomschrijving,
        v.startdatum,
        v.einddatum,
        v.aantal_weken,
        v.uren_per_week,
        v.totaal_uren,

        b.beslissing AS laatste_beslissing,
        b.feedback AS laatste_feedback,
        b.beslist_op AS laatste_beslist_op
      FROM stagevoorstellen sp
      JOIN studenten s ON s.gebruiker_id = sp.student_id
      JOIN gebruikers g ON g.id = s.gebruiker_id
      JOIN stagevoorstel_versies v
        ON v.stagevoorstel_id = sp.id
       AND v.versie_nummer = sp.huidige_versie_nummer
      LEFT JOIN voorstel_beslissingen b
        ON b.id = (
          SELECT vb.id
          FROM voorstel_beslissingen vb
          WHERE vb.stagevoorstel_id = sp.id
          ORDER BY vb.beslist_op DESC
          LIMIT 1
        )
      ORDER BY sp.aangemaakt_op DESC
      `
    );

    return ok(res, rows, "Stagecommissie aanvragen opgehaald");
  } catch (error) {
    return fail(res, 500, "Aanvragen ophalen mislukt", error.message);
  }
}

async function decideApplication(req, res) {
  const stagevoorstelId = Number(req.params.id);
  const beslistDoorId = getUserId(req, 2);

  const rawDecision = req.body.beslissing || req.body.decision;
  const feedback = req.body.feedback || null;
  const motivering = req.body.motivering || null;
  const uitzonderingMotivering = req.body.uitzonderingMotivering || req.body.uitzondering_motivering || null;

  const decisionMap = {
    approve: "goedgekeurd",
    approved: "goedgekeurd",
    goedgekeurd: "goedgekeurd",

    reject: "afgekeurd",
    rejected: "afgekeurd",
    afgekeurd: "afgekeurd",

    changes_requested: "aanpassingen_gevraagd",
    aanpassingen_gevraagd: "aanpassingen_gevraagd",
    aanpassing_gevraagd: "aanpassingen_gevraagd"
  };

  const beslissing = decisionMap[rawDecision];

  if (!beslissing) {
    return fail(res, 400, "Ongeldige beslissing. Gebruik goedgekeurd, afgekeurd of aanpassingen_gevraagd");
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [voorstellen] = await connection.query(
      `
      SELECT sp.*, v.id AS versie_id
      FROM stagevoorstellen sp
      JOIN stagevoorstel_versies v
        ON v.stagevoorstel_id = sp.id
       AND v.versie_nummer = sp.huidige_versie_nummer
      WHERE sp.id = ?
      LIMIT 1
      `,
      [stagevoorstelId]
    );

    const voorstel = voorstellen[0];

    if (!voorstel) {
      await connection.rollback();
      return fail(res, 404, "Stagevoorstel niet gevonden");
    }

    await connection.query(
      `
      INSERT INTO voorstel_beslissingen
      (
        stagevoorstel_id,
        stagevoorstel_versie_id,
        beslist_door_id,
        beslissing,
        feedback,
        motivering,
        uitzondering_motivering,
        beslist_op
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      `,
      [
        stagevoorstelId,
        voorstel.versie_id,
        beslistDoorId,
        beslissing,
        feedback,
        motivering,
        uitzonderingMotivering
      ]
    );

    let updateSql = `
      UPDATE stagevoorstellen
      SET status = ?,
          aangepast_op = NOW()
    `;

    const updateParams = [beslissing];

    if (beslissing === "goedgekeurd") {
      updateSql += ", goedgekeurd_op = NOW()";
    }

    if (beslissing === "afgekeurd") {
      updateSql += ", afgekeurd_op = NOW()";
    }

    updateSql += " WHERE id = ?";
    updateParams.push(stagevoorstelId);

    await connection.query(updateSql, updateParams);

    if (beslissing === "goedgekeurd") {
      await createDossierAfterApproval(connection, stagevoorstelId);
    }

    await connection.commit();

    // Student verwittigen van de beslissing.
    try {
      const berichtMap = {
        goedgekeurd: "Je stagevoorstel is goedgekeurd.",
        afgekeurd: "Je stagevoorstel is afgekeurd.",
        aanpassingen_gevraagd: "De stagecommissie vraagt aanpassingen aan je stagevoorstel."
      };
      await meld(voorstel.student_id, {
        titel: "Beslissing stagevoorstel",
        bericht: berichtMap[beslissing] || "Je stagevoorstel is beoordeeld.",
        ernst: beslissing === "afgekeurd" ? "medium" : "laag",
        aangemaaktDoorId: beslistDoorId,
        stagevoorstelId
      });
    } catch (notifyError) {
      console.error("Melding student mislukt:", notifyError.message);
    }

    return ok(
      res,
      {
        stagevoorstelId,
        status: beslissing
      },
      "Beslissing opgeslagen"
    );
  } catch (error) {
    await connection.rollback();
    return fail(res, 500, "Beslissing opslaan mislukt", error.message);
  } finally {
    connection.release();
  }
}

async function createDossierAfterApproval(connection, stagevoorstelId) {
  const [existing] = await connection.query(
    "SELECT id FROM stagedossiers WHERE stagevoorstel_id = ? LIMIT 1",
    [stagevoorstelId]
  );

  if (existing.length > 0) {
    await ensureDossierAdminRecords(connection, existing[0].id);
    return existing[0].id;
  }

  const [rows] = await connection.query(
    `
    SELECT
      sp.id AS stagevoorstel_id,
      sp.student_id,
      sp.bedrijf_id,
      sp.voorlopige_stagebegeleider_id,

      s.opleiding,
      s.academiejaar,

      v.mentor_email,
      v.startdatum,
      v.einddatum,
      v.aantal_weken,
      v.uren_per_week,
      v.totaal_uren
    FROM stagevoorstellen sp
    JOIN studenten s ON s.gebruiker_id = sp.student_id
    JOIN stagevoorstel_versies v
      ON v.stagevoorstel_id = sp.id
     AND v.versie_nummer = sp.huidige_versie_nummer
    WHERE sp.id = ?
    LIMIT 1
    `,
    [stagevoorstelId]
  );

  const data = rows[0];

  if (!data) {
    throw new Error("Geen data gevonden voor stagedossier");
  }

  const stagebegeleiderId = data.voorlopige_stagebegeleider_id || await getDefaultDocentId(connection);

  if (!stagebegeleiderId) {
    throw new Error("Geen stagebegeleider gevonden voor stagedossier");
  }

  const mentorId = await getMentorIdByEmail(connection, data.mentor_email) || await getDefaultMentorId(connection);

  const dossiernummer = `DOS-${new Date().getFullYear()}-${String(stagevoorstelId).padStart(4, "0")}`;

  const [result] = await connection.query(
    `
    INSERT INTO stagedossiers
    (
      dossiernummer,
      stagevoorstel_id,
      student_id,
      bedrijf_id,
      stagebegeleider_id,
      mentor_id,
      status,
      opleiding,
      academiejaar,
      startdatum,
      einddatum,
      aantal_weken,
      uren_per_week,
      totaal_uren,
      verzekering_in_orde,
      aangemaakt_op,
      aangepast_op
    )
    VALUES (?, ?, ?, ?, ?, ?, 'contract_pending', ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())
    `,
    [
      dossiernummer,
      data.stagevoorstel_id,
      data.student_id,
      data.bedrijf_id,
      stagebegeleiderId,
      mentorId,
      data.opleiding,
      data.academiejaar,
      data.startdatum,
      data.einddatum,
      data.aantal_weken,
      data.uren_per_week,
      data.totaal_uren
    ]
  );

  await ensureDossierAdminRecords(connection, result.insertId);

  return result.insertId;
}

async function ensureDossierAdminRecords(connection, dossierId) {
  await connection.query(
    `
    INSERT INTO stageovereenkomsten
      (stagedossier_id, status, versie_nummer, aangemaakt_op, aangepast_op)
    VALUES (?, 'klaar_voor_student', 1, NOW(), NOW())
    ON DUPLICATE KEY UPDATE
      aangepast_op = VALUES(aangepast_op)
    `,
    [dossierId]
  );

  await connection.query(
    `
    INSERT INTO documenten
      (
        stagedossier_id,
        document_soort_id,
        status,
        versie_nummer,
        zichtbaar_voor_student,
        zichtbaar_voor_docent,
        zichtbaar_voor_mentor,
        aangemaakt_op,
        aangepast_op
      )
    SELECT
      ?,
      ds.id,
      'ontbreekt',
      1,
      1,
      1,
      CASE WHEN ds.type = 'stageovereenkomst' THEN 1 ELSE 0 END,
      NOW(),
      NOW()
    FROM document_soorten ds
    WHERE ds.status = 'actief'
      AND ds.is_verplicht = 1
    ON DUPLICATE KEY UPDATE
      aangepast_op = VALUES(aangepast_op)
    `,
    [dossierId]
  );
}

async function getAdminDossiers(req, res) {
  try {
    const [rows] = await db.query(
      `
      SELECT
        d.id,
        d.dossiernummer,
        d.status,
        d.opleiding,
        d.academiejaar,
        d.startdatum,
        d.einddatum,
        d.aantal_weken,
        d.uren_per_week,
        d.totaal_uren,
        d.verzekering_in_orde,
        d.praktische_afspraken,
        d.eindresultaat,

        so.status AS overeenkomst_status,

        (
          SELECT COUNT(*)
          FROM documenten doc
          JOIN document_soorten ds ON ds.id = doc.document_soort_id
          WHERE doc.stagedossier_id = d.id
            AND ds.is_verplicht = 1
        ) AS verplichte_documenten,

        (
          SELECT COUNT(*)
          FROM documenten doc
          JOIN document_soorten ds ON ds.id = doc.document_soort_id
          WHERE doc.stagedossier_id = d.id
            AND ds.is_verplicht = 1
            AND doc.status IN ('goedgekeurd', 'geregistreerd')
        ) AS documenten_in_orde,

        (
          SELECT COUNT(*)
          FROM documenten doc
          JOIN document_soorten ds ON ds.id = doc.document_soort_id
          WHERE doc.stagedossier_id = d.id
            AND ds.is_verplicht = 1
            AND doc.status IN ('ontbreekt', 'afgekeurd')
        ) AS documenten_te_controleren,

        sg.voornaam AS student_voornaam,
        sg.achternaam AS student_achternaam,
        sg.email AS student_email,
        s.studentennummer,

        b.naam AS bedrijf_naam,
        b.afdeling AS bedrijf_afdeling,
        b.stad AS bedrijf_stad,

        mg.voornaam AS mentor_voornaam,
        mg.achternaam AS mentor_achternaam,
        mg.email AS mentor_email,

        dg.voornaam AS docent_voornaam,
        dg.achternaam AS docent_achternaam,
        dg.email AS docent_email
      FROM stagedossiers d
      JOIN studenten s ON s.gebruiker_id = d.student_id
      JOIN gebruikers sg ON sg.id = s.gebruiker_id
      JOIN bedrijven b ON b.id = d.bedrijf_id
      LEFT JOIN gebruikers mg ON mg.id = d.mentor_id
      JOIN gebruikers dg ON dg.id = d.stagebegeleider_id
      LEFT JOIN stageovereenkomsten so ON so.stagedossier_id = d.id
      ORDER BY d.aangemaakt_op DESC
      `
    );

    return ok(res, rows, "Admin dossiers opgehaald");
  } catch (error) {
    return fail(res, 500, "Dossiers ophalen mislukt", error.message);
  }
}



async function getAdminDossierById(req, res) {
  const dossierId = Number(req.params.id);

  try {
    const [rows] = await db.query(
      `
      SELECT
        d.id,
        d.dossiernummer,
        d.status,
        d.opleiding,
        d.academiejaar,
        d.startdatum,
        d.einddatum,
        d.aantal_weken,
        d.uren_per_week,
        d.totaal_uren,
        d.verzekering_in_orde,
        d.praktische_afspraken,
        d.praktische_afspraken_gedeeld_op,
        d.eindresultaat,

        sp.id AS stagevoorstel_id,
        sp.status AS stagevoorstel_status,

        sg.voornaam AS student_voornaam,
        sg.achternaam AS student_achternaam,
        sg.email AS student_email,
        s.studentennummer,

        b.naam AS bedrijf_naam,
        b.afdeling AS bedrijf_afdeling,
        b.adres AS bedrijf_adres,
        b.postcode AS bedrijf_postcode,
        b.stad AS bedrijf_stad,
        b.email AS bedrijf_email,
        b.telefoon AS bedrijf_telefoon,

        mg.voornaam AS mentor_voornaam,
        mg.achternaam AS mentor_achternaam,
        mg.email AS mentor_email,

        dg.voornaam AS docent_voornaam,
        dg.achternaam AS docent_achternaam,
        dg.email AS docent_email
      FROM stagedossiers d
      JOIN stagevoorstellen sp ON sp.id = d.stagevoorstel_id
      JOIN studenten s ON s.gebruiker_id = d.student_id
      JOIN gebruikers sg ON sg.id = s.gebruiker_id
      JOIN bedrijven b ON b.id = d.bedrijf_id
      LEFT JOIN gebruikers mg ON mg.id = d.mentor_id
      JOIN gebruikers dg ON dg.id = d.stagebegeleider_id
      WHERE d.id = ?
      LIMIT 1
      `,
      [dossierId]
    );

    if (rows.length === 0) {
      return fail(res, 404, "Dossier niet gevonden");
    }

    const [documents] = await db.query(
      `
      SELECT
        doc.id,
        doc.status,
        doc.versie_nummer,
        doc.bestand_url,
        doc.bestand_naam,
        doc.opgeladen_op,
        doc.gecontroleerd_op,
        doc.afkeurreden,
        ds.naam,
        ds.type,
        ds.is_verplicht
      FROM documenten doc
      LEFT JOIN document_soorten ds ON ds.id = doc.document_soort_id
      WHERE doc.stagedossier_id = ?
      ORDER BY ds.is_verplicht DESC, ds.id ASC
      `,
      [dossierId]
    );

    const [agreements] = await db.query(
      `
      SELECT
        id,
        status,
        versie_nummer,
        student_getekend_op,
        bedrijf_getekend_op,
        opleiding_getekend_op,
        gecontroleerd_op,
        geregistreerd_op,
        afkeurreden
      FROM stageovereenkomsten
      WHERE stagedossier_id = ?
      LIMIT 1
      `,
      [dossierId]
    );

    return ok(
      res,
      {
        ...rows[0],
        stageovereenkomst: agreements[0] || null,
        documenten: documents
      },
      "Admin dossier detail opgehaald"
    );
  } catch (error) {
    return fail(res, 500, "Dossier detail ophalen mislukt", error.message);
  }
}

async function updateAdminDossierStatus(req, res) {
  const dossierId = Number(req.params.id);
  const { status, verzekeringInOrde, praktischeAfspraken } = req.body;

  const allowedStatuses = [
    "contract_pending",
    "documents_pending",
    "active",
    "completed"
  ];

  if (!allowedStatuses.includes(status)) {
    return fail(res, 400, "Ongeldige dossierstatus");
  }

  try {
    const [existing] = await db.query(
      "SELECT id FROM stagedossiers WHERE id = ? LIMIT 1",
      [dossierId]
    );

    if (existing.length === 0) {
      return fail(res, 404, "Dossier niet gevonden");
    }

    await db.query(
      `
      UPDATE stagedossiers
      SET status = ?,
          verzekering_in_orde = COALESCE(?, verzekering_in_orde),
          praktische_afspraken = COALESCE(?, praktische_afspraken),
          praktische_afspraken_gedeeld_op =
            CASE 
              WHEN ? IS NOT NULL THEN NOW()
              ELSE praktische_afspraken_gedeeld_op
            END,
          aangepast_op = NOW()
      WHERE id = ?
      `,
      [
        status,
        typeof verzekeringInOrde === "boolean" ? verzekeringInOrde : null,
        praktischeAfspraken || null,
        praktischeAfspraken || null,
        dossierId
      ]
    );

    const [rows] = await db.query(
      "SELECT id, dossiernummer, status, verzekering_in_orde, praktische_afspraken FROM stagedossiers WHERE id = ?",
      [dossierId]
    );

    return ok(res, rows[0], "Dossierstatus aangepast");
  } catch (error) {
    return fail(res, 500, "Dossierstatus aanpassen mislukt", error.message);
  }
}

// Stagebegeleider (docent) en/of mentor koppelen of wijzigen op een dossier.
async function assignDossier(req, res) {
  const dossierId = Number(req.params.id);
  const docentId = req.body.stagebegeleiderId ?? req.body.stagebegeleider_id;
  const mentorId = req.body.mentorId ?? req.body.mentor_id;

  if (!dossierId) return fail(res, 400, "Ongeldig dossier-id");
  if (docentId == null && mentorId == null) return fail(res, 400, "Geef minstens een docent of mentor op");

  try {
    const [d] = await db.query("SELECT id, student_id FROM stagedossiers WHERE id = ? LIMIT 1", [dossierId]);
    if (d.length === 0) return fail(res, 404, "Dossier niet gevonden");

    const fields = [];
    const vals = [];
    if (docentId != null) { fields.push("stagebegeleider_id = ?"); vals.push(Number(docentId)); }
    if (mentorId != null) { fields.push("mentor_id = ?"); vals.push(Number(mentorId)); }

    await db.query(`UPDATE stagedossiers SET ${fields.join(", ")}, aangepast_op = NOW() WHERE id = ?`, [...vals, dossierId]);

    try {
      const door = Number(req.user?.id);
      if (docentId != null) await meld(Number(docentId), { titel: "Nieuwe student toegewezen", bericht: "Je bent gekoppeld als stagebegeleider aan een student.", aangemaaktDoorId: door, stagedossierId: dossierId });
      if (mentorId != null) await meld(Number(mentorId), { titel: "Nieuwe stagiair toegewezen", bericht: "Je bent gekoppeld als mentor aan een student.", aangemaaktDoorId: door, stagedossierId: dossierId });
      if (d[0].student_id) await meld(d[0].student_id, { titel: "Begeleiding bijgewerkt", bericht: "Je stagebegeleider of mentor is bijgewerkt.", aangemaaktDoorId: door, stagedossierId: dossierId });
    } catch (notifyError) {
      console.error("Melding toewijzing mislukt:", notifyError.message);
    }

    return ok(res, { id: dossierId }, "Toewijzing bijgewerkt");
  } catch (error) {
    if (error.code === "ER_NO_REFERENCED_ROW_2" || error.code === "ER_NO_REFERENCED_ROW") {
      return fail(res, 400, "Ongeldige docent of mentor (niet gevonden)");
    }
    return fail(res, 500, "Toewijzing mislukt", error.message);
  }
}

// Dossier registreren als startklaar: contract volledig ondertekend + verplichte docs goedgekeurd.
async function registerDossierStartklaar(req, res) {
  const dossierId = Number(req.params.id);
  if (!dossierId) return fail(res, 400, "Ongeldig dossier-id");

  try {
    const [d] = await db.query(
      "SELECT id, student_id, mentor_id, stagebegeleider_id, status FROM stagedossiers WHERE id = ? LIMIT 1",
      [dossierId]
    );
    if (d.length === 0) return fail(res, 404, "Dossier niet gevonden");

    const [ov] = await db.query("SELECT status FROM stageovereenkomsten WHERE stagedossier_id = ? LIMIT 1", [dossierId]);
    const contractOk = ov.length > 0 && ["volledig_ondertekend", "geregistreerd"].includes(ov[0].status);

    const [docs] = await db.query(
      `SELECT COUNT(*) AS openstaand
       FROM documenten doc
       JOIN document_soorten ds ON ds.id = doc.document_soort_id
       WHERE doc.stagedossier_id = ? AND ds.is_verplicht = 1 AND doc.status NOT IN ('goedgekeurd', 'geregistreerd')`,
      [dossierId]
    );
    const docsOk = docs[0].openstaand === 0;

    if (!contractOk || !docsOk) {
      const ontbrekend = [];
      if (!contractOk) ontbrekend.push("overeenkomst nog niet volledig ondertekend");
      if (!docsOk) ontbrekend.push(`${docs[0].openstaand} verplichte document(en) nog niet goedgekeurd`);
      return fail(res, 400, `Dossier nog niet startklaar: ${ontbrekend.join("; ")}`);
    }

    await db.query("UPDATE stagedossiers SET status = 'active', aangepast_op = NOW() WHERE id = ?", [dossierId]);

    try {
      const door = Number(req.user?.id);
      for (const uid of [d[0].student_id, d[0].mentor_id, d[0].stagebegeleider_id].filter(Boolean)) {
        await meld(uid, { titel: "Stage startklaar", bericht: "Het stagedossier is geregistreerd als startklaar; de stage kan starten.", aangemaaktDoorId: door, stagedossierId: dossierId });
      }
    } catch (notifyError) {
      console.error("Melding startklaar mislukt:", notifyError.message);
    }

    return ok(res, { id: dossierId, status: "active" }, "Dossier geregistreerd als startklaar");
  } catch (error) {
    return fail(res, 500, "Registreren mislukt", error.message);
  }
}

// Eindoverzicht genereren: enkel nadat het eindresultaat is vrijgegeven.
async function generateEindoverzicht(req, res) {
  const dossierId = Number(req.params.id);
  if (!dossierId) return fail(res, 400, "Ongeldig dossier-id");

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [d] = await conn.query(
      `SELECT d.id, d.dossiernummer, d.eindresultaat, d.eindresultaat_vrijgegeven_op,
              d.startdatum, d.einddatum, d.opleiding, d.academiejaar, d.totaal_uren,
              sg.voornaam AS student_voornaam, sg.achternaam AS student_achternaam, s.studentennummer,
              b.naam AS bedrijf_naam,
              mg.voornaam AS mentor_voornaam, mg.achternaam AS mentor_achternaam,
              dg.voornaam AS docent_voornaam, dg.achternaam AS docent_achternaam
       FROM stagedossiers d
       JOIN studenten s ON s.gebruiker_id = d.student_id
       JOIN gebruikers sg ON sg.id = s.gebruiker_id
       JOIN bedrijven b ON b.id = d.bedrijf_id
       LEFT JOIN gebruikers mg ON mg.id = d.mentor_id
       LEFT JOIN gebruikers dg ON dg.id = d.stagebegeleider_id
       WHERE d.id = ? LIMIT 1`,
      [dossierId]
    );
    if (d.length === 0) {
      await conn.rollback();
      return fail(res, 404, "Dossier niet gevonden");
    }
    if (d[0].eindresultaat_vrijgegeven_op == null) {
      await conn.rollback();
      return fail(res, 400, "Eindresultaat is nog niet vrijgegeven");
    }

    const dossier = d[0];
    const uploadsDir = path.join(__dirname, "../../uploads/eindoverzichten");
    fs.mkdirSync(uploadsDir, { recursive: true });

    const safeDossiernummer = String(dossier.dossiernummer || dossier.id).replace(/[^a-zA-Z0-9_-]/g, "-");
    const bestandsnaam = `eindoverzicht-${safeDossiernummer}.pdf`;
    const filePath = path.join(uploadsDir, bestandsnaam);
    const bestandUrl = `/uploads/eindoverzichten/${bestandsnaam}`;

    const mentorNaam = [dossier.mentor_voornaam, dossier.mentor_achternaam].filter(Boolean).join(" ") || "-";
    const docentNaam = [dossier.docent_voornaam, dossier.docent_achternaam].filter(Boolean).join(" ") || "-";
    const lines = [
      "Eindoverzicht stage",
      `Dossier: ${dossier.dossiernummer}`,
      `Student: ${dossier.student_voornaam} ${dossier.student_achternaam} (${dossier.studentennummer})`,
      `Opleiding: ${dossier.opleiding || "-"}`,
      `Academiejaar: ${dossier.academiejaar || "-"}`,
      `Bedrijf: ${dossier.bedrijf_naam || "-"}`,
      `Mentor: ${mentorNaam}`,
      `Stagebegeleider: ${docentNaam}`,
      `Periode: ${dossier.startdatum || "-"} tot ${dossier.einddatum || "-"}`,
      `Totaal uren: ${dossier.totaal_uren || "-"}`,
      `Eindresultaat: ${dossier.eindresultaat}`,
      `Vrijgegeven op: ${dossier.eindresultaat_vrijgegeven_op}`,
      `Gegenereerd op: ${new Date().toISOString().slice(0, 10)}`
    ];

    fs.writeFileSync(filePath, buildSimplePdf(lines));

    const documentSoortId = await ensureDocumentType(conn, "eindoverzicht", "Eindoverzicht");
    const [docResult] = await conn.query(
      `INSERT INTO documenten
        (stagedossier_id, document_soort_id, status, versie_nummer, bestand_url, bestand_naam,
         opgeladen_op, gecontroleerd_op, zichtbaar_voor_student, zichtbaar_voor_docent, zichtbaar_voor_mentor,
         aangemaakt_op, aangepast_op)
       VALUES (?, ?, 'geregistreerd', 1, ?, ?, NOW(), NOW(), 1, 1, 1, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         status = 'geregistreerd',
         versie_nummer = versie_nummer + 1,
         bestand_url = VALUES(bestand_url),
         bestand_naam = VALUES(bestand_naam),
         opgeladen_op = NOW(),
         gecontroleerd_op = NOW(),
         zichtbaar_voor_student = 1,
         zichtbaar_voor_docent = 1,
         zichtbaar_voor_mentor = 1,
         aangepast_op = NOW()`,
      [dossierId, documentSoortId, bestandUrl, bestandsnaam]
    );

    await conn.query(
      "UPDATE stagedossiers SET eindoverzicht_gegenereerd_op = NOW(), status = 'afgerond', aangepast_op = NOW() WHERE id = ?",
      [dossierId]
    );

    await conn.commit();

    return ok(
      res,
      {
        dossier,
        documentId: docResult.insertId || null,
        bestandUrl,
        bestandsnaam,
        gegenereerd: true
      },
      "Eindoverzicht gegenereerd"
    );
  } catch (error) {
    await conn.rollback();
    return fail(res, 500, "Eindoverzicht genereren mislukt", error.message);
  } finally {
    conn.release();
  }
}

// Alle versies van een stagevoorstel ophalen (voor de commissie om heringediend te vergelijken, story 14).
async function getApplicationVersions(req, res) {
  const id = Number(req.params.id);
  if (!id) return fail(res, 400, "Ongeldig stagevoorstel-id");

  try {
    const [rows] = await db.query(
      `SELECT id, versie_nummer, bedrijf_naam, bedrijfsafdeling, bedrijfsadres,
              mentor_naam, mentor_email, mentor_functie, stagefunctie, opdrachtomschrijving,
              startdatum, einddatum, aantal_weken, uren_per_week, totaal_uren, ingediend_op
       FROM stagevoorstel_versies
       WHERE stagevoorstel_id = ?
       ORDER BY versie_nummer ASC`,
      [id]
    );
    return ok(res, rows, "Versies opgehaald");
  } catch (error) {
    return fail(res, 500, "Versies ophalen mislukt", error.message);
  }
}

// Herinnering sturen naar de partij die de stageovereenkomst nog moet ondertekenen (story 20).
async function sendContractReminder(req, res) {
  const dossierId = Number(req.params.id);
  if (!dossierId) return fail(res, 400, "Ongeldig dossier-id");

  try {
    const [rows] = await db.query(
      `SELECT d.id, d.student_id, d.mentor_id,
              o.status AS ov_status, o.student_getekend_op, o.bedrijf_getekend_op, o.opleiding_getekend_op
       FROM stagedossiers d
       LEFT JOIN stageovereenkomsten o ON o.stagedossier_id = d.id
       WHERE d.id = ? LIMIT 1`,
      [dossierId]
    );
    if (rows.length === 0) return fail(res, 404, "Dossier niet gevonden");
    const d = rows[0];
    if (!d.ov_status) return fail(res, 400, "Er is nog geen overeenkomst voor dit dossier");
    if (["volledig_ondertekend", "geregistreerd"].includes(d.ov_status)) {
      return fail(res, 400, "De overeenkomst is al volledig ondertekend");
    }

    let ontvangerId = null;
    let wie = null;
    if (!d.student_getekend_op) { ontvangerId = d.student_id; wie = "student"; }
    else if (!d.bedrijf_getekend_op) { ontvangerId = d.mentor_id; wie = "mentor/bedrijf"; }
    else { wie = "opleiding"; }

    if (!ontvangerId) {
      return fail(res, 400, `Wacht op handtekening van: ${wie} (geen gekoppelde gebruiker om te herinneren)`);
    }

    await meld(ontvangerId, {
      titel: "Herinnering: handtekening stageovereenkomst",
      bericht: "Gelieve de stageovereenkomst te ondertekenen zodat de stage kan starten.",
      type: "herinnering",
      ernst: "medium",
      aangemaaktDoorId: Number(req.user?.id),
      stagedossierId: dossierId
    });
    await emailMelding(ontvangerId, {
      titel: "Herinnering: handtekening stageovereenkomst",
      bericht: "Gelieve de stageovereenkomst te ondertekenen zodat de stage kan starten.",
      type: "herinnering",
      ernst: "medium",
      aangemaaktDoorId: Number(req.user?.id),
      stagedossierId: dossierId
    });

    return ok(res, { dossierId, herinnerd: wie, emailStatus: "geregistreerd" }, `Herinnering verstuurd naar ${wie}`);
  } catch (error) {
    return fail(res, 500, "Herinnering sturen mislukt", error.message);
  }
}

// Zoekt de id van de huidige versie van een stagevoorstel.
async function resolveHuidigeVersieId(conn, stagevoorstelId) {
  const [rows] = await conn.query(
    `SELECT v.id
     FROM stagevoorstellen sv
     JOIN stagevoorstel_versies v
       ON v.stagevoorstel_id = sv.id AND v.versie_nummer = sv.huidige_versie_nummer
     WHERE sv.id = ? LIMIT 1`,
    [stagevoorstelId]
  );
  return rows[0]?.id || null;
}

// GET /api/committee/applications/:id/checklist — checklist van de huidige versie ophalen.
async function getApplicationChecklist(req, res) {
  const voorstelId = Number(req.params.id);
  if (!voorstelId) return fail(res, 400, "Ongeldig voorstel-id");

  try {
    const versieId = await resolveHuidigeVersieId(db, voorstelId);
    if (!versieId) return fail(res, 404, "Voorstel of versie niet gevonden");

    const [rows] = await db.query(
      `SELECT id, criterium, is_verplicht, is_in_orde, opmerking, gecontroleerd_op
       FROM voorstel_checklist WHERE stagevoorstel_versie_id = ? ORDER BY id ASC`,
      [versieId]
    );
    return ok(res, { stagevoorstelVersieId: versieId, items: rows }, "Checklist opgehaald");
  } catch (error) {
    return fail(res, 500, "Checklist ophalen mislukt", error.message);
  }
}

// PUT /api/committee/applications/:id/checklist — checklist van de huidige versie opslaan (vervangt de bestaande).
async function saveApplicationChecklist(req, res) {
  const voorstelId = Number(req.params.id);
  const userId = Number(req.user?.id);
  const items = Array.isArray(req.body?.items) ? req.body.items : [];

  if (!voorstelId) return fail(res, 400, "Ongeldig voorstel-id");
  if (items.length === 0) return fail(res, 400, "Geen checklist-items meegegeven");

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const versieId = await resolveHuidigeVersieId(conn, voorstelId);
    if (!versieId) { await conn.rollback(); return fail(res, 404, "Voorstel of versie niet gevonden"); }

    await conn.query("DELETE FROM voorstel_checklist WHERE stagevoorstel_versie_id = ?", [versieId]);
    for (const it of items) {
      const criterium = String(it.criterium || "").trim();
      if (!criterium) continue;
      await conn.query(
        `INSERT INTO voorstel_checklist
           (stagevoorstel_versie_id, criterium, is_verplicht, is_in_orde, opmerking, gecontroleerd_door_id, gecontroleerd_op)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [versieId, criterium, it.isVerplicht === false ? 0 : 1, it.isInOrde ? 1 : 0, it.opmerking || null, userId]
      );
    }

    const [rows] = await conn.query(
      `SELECT id, criterium, is_verplicht, is_in_orde, opmerking, gecontroleerd_op
       FROM voorstel_checklist WHERE stagevoorstel_versie_id = ? ORDER BY id ASC`,
      [versieId]
    );
    await conn.commit();

    return ok(res, { stagevoorstelVersieId: versieId, items: rows }, "Checklist opgeslagen");
  } catch (error) {
    await conn.rollback();
    return fail(res, 500, "Checklist opslaan mislukt", error.message);
  } finally {
    conn.release();
  }
}

module.exports = {
  getApplicationChecklist,
  saveApplicationChecklist,
  createInternship,
  saveDraft,
  withdrawInternship,
  resubmitInternship,
  getMyInternship,
  getCommitteeApplications,
  decideApplication,
  getApplicationVersions,
  getAdminDossiers,
  getAdminDossierById,
  updateAdminDossierStatus,
  assignDossier,
  registerDossierStartklaar,
  generateEindoverzicht,
  sendContractReminder
};
