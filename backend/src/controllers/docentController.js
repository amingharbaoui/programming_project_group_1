const db = require("../config/db");
const { ok, fail } = require("../utils/response");

// GET /docent/students
// Geeft alle studenten terug die gekoppeld zijn aan de ingelogde docent (stagebegeleider).
async function getDocentStudents(req, res) {
  const docentId = Number(req.user?.id);
  if (!docentId) return fail(res, 401, "Niet ingelogd");

  try {
    const [rows] = await db.query(
      `
      SELECT
        g.id,
        g.voornaam,
        g.achternaam,
        st.studentennummer,
        b.naam           AS bedrijf,
        gm.voornaam      AS mentor_voornaam,
        gm.achternaam    AS mentor_achternaam,
        sd.id            AS dossier_id,
        sd.status        AS dossier_status,
        sd.startdatum,
        sd.einddatum,
        (
          SELECT lw.status
          FROM logboek_weken lw
          WHERE lw.stagedossier_id = sd.id
          ORDER BY lw.week_nummer DESC
          LIMIT 1
        ) AS logboek_status
      FROM stagedossiers sd
      JOIN studenten   st ON st.gebruiker_id = sd.student_id
      JOIN gebruikers   g ON g.id             = st.gebruiker_id
      JOIN bedrijven    b ON b.id             = sd.bedrijf_id
      LEFT JOIN gebruikers gm ON gm.id        = sd.mentor_id
      WHERE sd.stagebegeleider_id = ?
      ORDER BY g.achternaam, g.voornaam
      `,
      [docentId]
    );

    return ok(res, rows, "Docent studenten opgehaald");
  } catch (err) {
    console.error("getDocentStudents error:", err);
    return fail(res, 500, "Studenten ophalen mislukt");
  }
}

async function getDocentProposals(req, res) {
  const docentId = Number(req.user?.id);
  if (!docentId) return fail(res, 401, "Niet ingelogd");

  try {
    const [rows] = await db.query(
      `
      SELECT
        sv.id AS versie_id,
        sv.stagevoorstel_id,
        sv.versie_nummer,
        sv.bedrijf_naam,
        sv.bedrijfsafdeling,
        sv.bedrijfsadres,
        sv.mentor_naam,
        sv.mentor_email,
        sv.mentor_telefoon,
        sv.mentor_functie,
        sv.stagefunctie,
        sv.opdrachtomschrijving,
        sv.startdatum,
        sv.einddatum,
        sv.aantal_weken,
        sv.uren_per_week,
        sv.totaal_uren,
        sp.status AS voorstel_status,
        d.id AS dossier_id,
        d.status AS dossier_status,
        CONCAT(gs.voornaam, ' ', gs.achternaam) AS student_naam,
        gs.email AS student_email,
        st.studentennummer
      FROM stagedossiers d
      JOIN stagevoorstellen sp ON sp.id = d.stagevoorstel_id
      JOIN stagevoorstel_versies sv
        ON sv.stagevoorstel_id = sp.id
       AND sv.versie_nummer = sp.huidige_versie_nummer
      JOIN studenten st ON st.gebruiker_id = d.student_id
      JOIN gebruikers gs ON gs.id = d.student_id
      WHERE d.stagebegeleider_id = ?
      ORDER BY gs.achternaam, gs.voornaam
      `,
      [docentId]
    );

    return ok(res, rows, "Voorstellen opgehaald");
  } catch (err) {
    console.error("getDocentProposals error:", err);
    return fail(res, 500, "Voorstellen ophalen mislukt", err.message);
  }
}

async function getDocentProposalById(req, res) {
  const docentId = Number(req.user?.id);
  const voorstelId = Number(req.params.id);
  if (!docentId) return fail(res, 401, "Niet ingelogd");
  if (!voorstelId) return fail(res, 400, "Ongeldig voorstel-id");

  try {
    const [rows] = await db.query(
      `
      SELECT
        sv.*,
        sp.status AS voorstel_status,
        d.id AS dossier_id,
        d.status AS dossier_status,
        CONCAT(gs.voornaam, ' ', gs.achternaam) AS student_naam,
        gs.email AS student_email,
        st.studentennummer
      FROM stagedossiers d
      JOIN stagevoorstellen sp ON sp.id = d.stagevoorstel_id
      JOIN stagevoorstel_versies sv ON sv.stagevoorstel_id = sp.id
      JOIN studenten st ON st.gebruiker_id = d.student_id
      JOIN gebruikers gs ON gs.id = d.student_id
      WHERE d.stagebegeleider_id = ? AND sp.id = ?
      ORDER BY sv.versie_nummer DESC
      `,
      [docentId, voorstelId]
    );
    if (rows.length === 0) return fail(res, 404, "Voorstel niet gevonden");

    const [beslissingen] = await db.query(
      `
      SELECT vb.*, CONCAT(g.voornaam, ' ', g.achternaam) AS beslist_door
      FROM voorstel_beslissingen vb
      LEFT JOIN gebruikers g ON g.id = vb.beslist_door_id
      WHERE vb.stagevoorstel_id = ?
      ORDER BY vb.beslist_op DESC
      `,
      [voorstelId]
    );

    return ok(res, { huidige: rows[0], versies: rows, beslissingen }, "Voorstel opgehaald");
  } catch (err) {
    console.error("getDocentProposalById error:", err);
    return fail(res, 500, "Voorstel ophalen mislukt", err.message);
  }
}

async function getDocentStudentDossier(req, res) {
  const docentId = Number(req.user?.id);
  const studentId = Number(req.params.id);
  if (!docentId) return fail(res, 401, "Niet ingelogd");
  if (!studentId) return fail(res, 400, "Ongeldig student-id");

  try {
    const [dossiers] = await db.query(
      `
      SELECT
        d.*,
        CONCAT(gs.voornaam, ' ', gs.achternaam) AS student_naam,
        gs.email AS student_email,
        st.studentennummer,
        st.opleiding,
        st.klasgroep,
        b.naam AS bedrijf_naam,
        b.afdeling AS bedrijf_afdeling,
        b.adres AS bedrijf_adres,
        b.email AS bedrijf_email,
        b.telefoon AS bedrijf_telefoon,
        CONCAT(gm.voornaam, ' ', gm.achternaam) AS mentor_naam,
        gm.email AS mentor_email
      FROM stagedossiers d
      JOIN studenten st ON st.gebruiker_id = d.student_id
      JOIN gebruikers gs ON gs.id = d.student_id
      JOIN bedrijven b ON b.id = d.bedrijf_id
      LEFT JOIN gebruikers gm ON gm.id = d.mentor_id
      WHERE d.student_id = ? AND d.stagebegeleider_id = ?
      ORDER BY d.aangemaakt_op DESC
      LIMIT 1
      `,
      [studentId, docentId]
    );
    const dossier = dossiers[0];
    if (!dossier) return fail(res, 404, "Dossier niet gevonden");

    const [documenten] = await db.query(
      `
      SELECT doc.*, ds.naam AS documenttype, ds.is_verplicht
      FROM documenten doc
      LEFT JOIN document_soorten ds ON ds.id = doc.document_soort_id
      WHERE doc.stagedossier_id = ?
      ORDER BY ds.is_verplicht DESC, ds.naam ASC, doc.aangemaakt_op DESC
      `,
      [dossier.id]
    );
    const [contracten] = await db.query("SELECT * FROM stageovereenkomsten WHERE stagedossier_id = ? LIMIT 1", [dossier.id]);
    const [planning] = await db.query(
      "SELECT *, DATE_FORMAT(gepland_op, '%Y-%m-%dT%H:%i:%s') AS gepland_op FROM planning_momenten WHERE stagedossier_id = ? ORDER BY gepland_op ASC",
      [dossier.id]
    );
    const [logboeken] = await db.query("SELECT id, week_nummer, week_start, week_einde, status, totaal_uren FROM logboek_weken WHERE stagedossier_id = ? ORDER BY week_nummer", [dossier.id]);
    const [evaluaties] = await db.query("SELECT * FROM evaluaties WHERE stagedossier_id = ? ORDER BY type", [dossier.id]);

    return ok(
      res,
      {
        dossier,
        documenten,
        stageovereenkomst: contracten[0] || null,
        planning,
        logboeken,
        evaluaties
      },
      "Studentdossier opgehaald"
    );
  } catch (err) {
    console.error("getDocentStudentDossier error:", err);
    return fail(res, 500, "Studentdossier ophalen mislukt", err.message);
  }
}

module.exports = {
  getDocentStudents,
  getDocentProposals,
  getDocentProposalById,
  getDocentStudentDossier
};
