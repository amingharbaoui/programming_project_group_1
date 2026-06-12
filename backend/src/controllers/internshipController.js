const db = require("../config/db");
const { ok, fail } = require("../utils/response");

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

    const voorlopigeStagebegeleiderId = await getDefaultDocentId(connection);

    if (!voorlopigeStagebegeleiderId) {
      await connection.rollback();
      return fail(res, 400, "Geen docent gevonden om voorlopig te koppelen");
    }

    const aantalWeken = calculateWeeks(startdatum, einddatum);
    const totaalUren = aantalWeken * finalUrenPerWeek;

    const [bedrijfResult] = await connection.query(
      `
      INSERT INTO bedrijven
      (naam, afdeling, adres, aangemaakt_op, aangepast_op)
      VALUES (?, ?, ?, NOW(), NOW())
      `,
      [
        finalBedrijfNaam,
        bedrijfsafdeling || null,
        bedrijfsadres || null
      ]
    );

    const bedrijfId = bedrijfResult.insertId;

    const [voorstelResult] = await connection.query(
      `
      INSERT INTO stagevoorstellen
      (
        student_id,
        bedrijf_id,
        stage_regel_id,
        voorlopige_stagebegeleider_id,
        status,
        huidige_versie_nummer,
        ingediend_op,
        aangemaakt_op,
        aangepast_op
      )
      VALUES (?, ?, ?, ?, 'ingediend', 1, NOW(), NOW(), NOW())
      `,
      [
        studentId,
        bedrijfId,
        stageRegel.id,
        voorlopigeStagebegeleiderId
      ]
    );

    const stagevoorstelId = voorstelResult.insertId;

    const [versieResult] = await connection.query(
      `
      INSERT INTO stagevoorstel_versies
      (
        stagevoorstel_id,
        versie_nummer,
        bedrijf_id,
        bedrijf_naam,
        bedrijfsafdeling,
        bedrijfsadres,
        mentor_naam,
        mentor_email,
        mentor_telefoon,
        mentor_functie,
        stagefunctie,
        opdrachtomschrijving,
        startdatum,
        einddatum,
        aantal_weken,
        uren_per_week,
        totaal_uren,
        ingediend_door_id,
        ingediend_op,
        aangemaakt_op
      )
      VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `,
      [
        stagevoorstelId,
        bedrijfId,
        finalBedrijfNaam,
        bedrijfsafdeling || null,
        bedrijfsadres || null,
        mentorNaam,
        mentorEmail,
        mentorTelefoon || null,
        mentorFunctie || null,
        stagefunctie,
        opdrachtomschrijving,
        startdatum,
        einddatum,
        aantalWeken,
        finalUrenPerWeek,
        totaalUren,
        studentId
      ]
    );

    await connection.commit();

    return ok(
      res,
      {
        stagevoorstelId,
        versieId: versieResult.insertId,
        status: "ingediend"
      },
      "Stagevoorstel ingediend"
    );
  } catch (error) {
    await connection.rollback();
    return fail(res, 500, "Stagevoorstel indienen mislukt", error.message);
  } finally {
    connection.release();
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

  return result.insertId;
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
        d.eindresultaat,

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

    return ok(res, rows[0], "Admin dossier detail opgehaald");
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

module.exports = {
  createInternship,
  getMyInternship,
  getCommitteeApplications,
  decideApplication,
  getAdminDossiers,
  getAdminDossierById,
  updateAdminDossierStatus
};
