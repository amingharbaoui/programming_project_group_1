const db = require("../config/db");
const { ok, fail } = require("../utils/response");

// GET /mentor/students
// Geeft alle studenten terug die gekoppeld zijn aan de ingelogde mentor via stagedossiers.
async function getMentorStudents(req, res) {
  const mentorId = Number(req.user?.id);
  if (!mentorId) return fail(res, "Niet ingelogd", 401);

  try {
    const [rows] = await db.query(
      `
      SELECT
        g.id,
        g.voornaam,
        g.achternaam,
        st.studentennummer,
        b.naam          AS bedrijf,
        sd.id           AS dossier_id,
        sd.status       AS dossier_status,
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
      JOIN studenten  st ON st.gebruiker_id = sd.student_id
      JOIN gebruikers  g ON g.id             = st.gebruiker_id
      JOIN bedrijven   b ON b.id             = sd.bedrijf_id
      WHERE sd.mentor_id = ?
      ORDER BY g.achternaam, g.voornaam
      `,
      [mentorId]
    );

    return ok(res, rows, "Mentor studenten opgehaald");
  } catch (err) {
    console.error("getMentorStudents error:", err);
    return fail(res, "Studenten ophalen mislukt", 500);
  }
}

// GET /mentor/contract/:dossierId
async function getMentorContract(req, res) {
  const mentorId  = Number(req.user?.id);
  const dossierId = Number(req.params.dossierId);

  try {
    // Security: controleer of dit dossier van deze mentor is
    const [[dossier]] = await db.query(
      "SELECT id FROM stagedossiers WHERE id = ? AND mentor_id = ? LIMIT 1",
      [dossierId, mentorId]
    );
    if (!dossier) return fail(res, "Geen toegang tot dit dossier", 403);

    const [[contract]] = await db.query(
      `SELECT * FROM stageovereenkomsten WHERE stagedossier_id = ? LIMIT 1`,
      [dossierId]
    );

    return ok(res, contract || null, "Contract opgehaald");
  } catch (err) {
    console.error("getMentorContract error:", err);
    return fail(res, "Contract ophalen mislukt", 500);
  }
}

// PATCH /mentor/contract/:dossierId/teken
// Mentor tekent het contract: bedrijf_getekend_op = NOW()
async function tekenContract(req, res) {
  const mentorId  = Number(req.user?.id);
  const dossierId = Number(req.params.dossierId);

  try {
    // Security check
    const [[dossier]] = await db.query(
      "SELECT id FROM stagedossiers WHERE id = ? AND mentor_id = ? LIMIT 1",
      [dossierId, mentorId]
    );
    if (!dossier) return fail(res, "Geen toegang tot dit dossier", 403);

    // Haal huidige status op
    const [[contract]] = await db.query(
      "SELECT id, status, bedrijf_getekend_op FROM stageovereenkomsten WHERE stagedossier_id = ? LIMIT 1",
      [dossierId]
    );
    if (!contract) return fail(res, "Geen stageovereenkomst gevonden", 404);
    if (contract.bedrijf_getekend_op) return fail(res, "Contract is al getekend door mentor", 409);

    // Nieuwe status bepalen
    const nieuweStatus =
      contract.status === "getekend_door_student" ? "volledig_ondertekend" : "wacht_op_bedrijf";

    await db.query(
      `UPDATE stageovereenkomsten
       SET bedrijf_getekend_op = NOW(), status = ?
       WHERE stagedossier_id = ?`,
      [nieuweStatus, dossierId]
    );

    return ok(res, { status: nieuweStatus }, "Contract getekend door mentor");
  } catch (err) {
    console.error("tekenContract error:", err);
    return fail(res, "Tekenen mislukt", 500);
  }
}

// GET /mentor/dossier/:dossierId/afspraken
async function getAfspraken(req, res) {
  const mentorId  = Number(req.user?.id);
  const dossierId = Number(req.params.dossierId);

  try {
    const [[row]] = await db.query(
      `SELECT id, praktische_afspraken, praktische_afspraken_gedeeld_op
       FROM stagedossiers
       WHERE id = ? AND mentor_id = ?
       LIMIT 1`,
      [dossierId, mentorId]
    );
    if (!row) return fail(res, "Geen toegang tot dit dossier", 403);

    return ok(res, row, "Afspraken opgehaald");
  } catch (err) {
    console.error("getAfspraken error:", err);
    return fail(res, "Afspraken ophalen mislukt", 500);
  }
}

// PATCH /mentor/dossier/:dossierId/afspraken
async function updateAfspraken(req, res) {
  const mentorId          = Number(req.user?.id);
  const dossierId         = Number(req.params.dossierId);
  const { afspraken }     = req.body;

  if (!afspraken && afspraken !== "") return fail(res, "Veld 'afspraken' ontbreekt", 400);

  try {
    const [result] = await db.query(
      `UPDATE stagedossiers
       SET praktische_afspraken = ?,
           praktische_afspraken_gedeeld_op = NOW()
       WHERE id = ? AND mentor_id = ?`,
      [afspraken, dossierId, mentorId]
    );

    if (result.affectedRows === 0) return fail(res, "Geen toegang tot dit dossier", 403);

    return ok(res, { dossierId }, "Praktische afspraken opgeslagen");
  } catch (err) {
    console.error("updateAfspraken error:", err);
    return fail(res, "Afspraken opslaan mislukt", 500);
  }
}

module.exports = {
  getMentorStudents,
  getMentorContract,
  tekenContract,
  getAfspraken,
  updateAfspraken,
};
