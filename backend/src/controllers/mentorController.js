const db = require("../config/db");
const { ok, fail } = require("../utils/response");
const { meld } = require("../utils/notify");
const { buildSimplePdf } = require("../utils/pdf");

// GET /mentor/students
// Geeft alle studenten terug die gekoppeld zijn aan de ingelogde mentor via stagedossiers.
async function getMentorStudents(req, res) {
  const mentorId = Number(req.user?.id);
  if (!mentorId) return fail(res, 401, "Niet ingelogd");

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
        sd.aantal_weken,
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
    return fail(res, 500, "Studenten ophalen mislukt");
  }
}

// GET /mentor/contract/:dossierId
async function getMentorContract(req, res) {
  const mentorId  = Number(req.user?.id);
  const dossierId = Number(req.params.dossierId);
  if (!Number.isInteger(dossierId)) return fail(res, 404, "Dossier niet gevonden");

  try {
    // Security: controleer of dit dossier van deze mentor is
    const [[dossier]] = await db.query(
      "SELECT id FROM stagedossiers WHERE id = ? AND mentor_id = ? LIMIT 1",
      [dossierId, mentorId]
    );
    if (!dossier) return fail(res, 403, "Geen toegang tot dit dossier");

    const [[contract]] = await db.query(
      `SELECT * FROM stageovereenkomsten WHERE stagedossier_id = ? LIMIT 1`,
      [dossierId]
    );

    return ok(res, contract || null, "Contract opgehaald");
  } catch (err) {
    console.error("getMentorContract error:", err);
    return fail(res, 500, "Contract ophalen mislukt");
  }
}

// PATCH /mentor/contract/:dossierId/teken
// Mentor tekent het contract: bedrijf_getekend_op = NOW()
async function tekenContract(req, res) {
  const mentorId  = Number(req.user?.id);
  const dossierId = Number(req.params.dossierId);
  if (!Number.isInteger(dossierId)) return fail(res, 404, "Dossier niet gevonden");
  const tekenbevoegd = Boolean(req.body?.tekenbevoegd ?? req.body?.tekenBevoegd ?? req.body?.bevoegd);

  if (!tekenbevoegd) {
    return fail(res, 400, "Je moet eerst bevestigen dat je tekenbevoegd bent voor het stagebedrijf");
  }

  // Eén transactie zodat contract-handtekening en dossierfase samen doorgaan of samen terugdraaien (317).
  const conn = await db.getConnection();
  let studentId = null;
  try {
    await conn.beginTransaction();

    // Security check
    const [[dossier]] = await conn.query(
      "SELECT id, student_id FROM stagedossiers WHERE id = ? AND mentor_id = ? LIMIT 1",
      [dossierId, mentorId]
    );
    if (!dossier) { await conn.rollback(); return fail(res, 403, "Geen toegang tot dit dossier"); }
    studentId = dossier.student_id;

    // Haal huidige status op
    const [[contract]] = await conn.query(
      "SELECT id, status, student_getekend_op, bedrijf_getekend_op FROM stageovereenkomsten WHERE stagedossier_id = ? LIMIT 1",
      [dossierId]
    );
    if (!contract) { await conn.rollback(); return fail(res, 404, "Geen stageovereenkomst gevonden"); }
    if (contract.bedrijf_getekend_op) { await conn.rollback(); return fail(res, 409, "Contract is al getekend door mentor"); }
    if (!contract.student_getekend_op) { await conn.rollback(); return fail(res, 409, "De student moet de stageovereenkomst eerst tekenen"); }
    if (contract.status && contract.status !== "getekend_door_student") {
      await conn.rollback();
      return fail(res, 409, "Deze overeenkomst wacht niet op de handtekening van het bedrijf");
    }

    // Student tekende al, dus na de mentor is de overeenkomst volledig ondertekend.
    const nieuweStatus = "volledig_ondertekend";

    await conn.query(
      `UPDATE stageovereenkomsten
       SET bedrijf_getekend_op = NOW(), status = ?
       WHERE stagedossier_id = ?`,
      [nieuweStatus, dossierId]
    );

    await conn.query(
      "UPDATE stagedossiers SET status = 'in_controle_bij_administratie', aangepast_op = NOW() WHERE id = ? AND status IN ('wacht_op_student','wacht_op_bedrijf')",
      [dossierId]
    );

    await conn.commit();

    // Student en administratie verwittigen dat het stagebedrijf getekend heeft (story 28) — na de commit.
    try {
      if (studentId) {
        await meld(studentId, {
          titel: "Stagebedrijf ondertekende de overeenkomst",
          bericht: "Je mentor ondertekende de stageovereenkomst namens het stagebedrijf.",
          aangemaaktDoorId: mentorId,
          stagedossierId: dossierId
        });
      }
      const [admins] = await db.query("SELECT id FROM gebruikers WHERE hoofdrol = 'administratie' AND status = 'actief'");
      for (const a of admins) {
        await meld(a.id, {
          titel: "Stagebedrijf ondertekende de overeenkomst",
          bericht: "Het stagebedrijf ondertekende de stageovereenkomst; je kan ze nu controleren en registreren.",
          aangemaaktDoorId: mentorId,
          stagedossierId: dossierId
        });
      }
    } catch (notifyError) {
      console.error("Melding mentor tekenen mislukt:", notifyError.message);
    }

    return ok(res, { status: nieuweStatus }, "Contract getekend door mentor");
  } catch (err) {
    await conn.rollback();
    console.error("tekenContract error:", err);
    return fail(res, 500, "Tekenen mislukt");
  } finally {
    conn.release();
  }
}

// GET /mentor/dossier/:dossierId/afspraken
async function getAfspraken(req, res) {
  const mentorId  = Number(req.user?.id);
  const dossierId = Number(req.params.dossierId);
  if (!Number.isInteger(dossierId)) return fail(res, 404, "Dossier niet gevonden");

  try {
    const [[row]] = await db.query(
      `SELECT id, praktische_afspraken, praktische_afspraken_velden, praktische_afspraken_gedeeld_op
       FROM stagedossiers
       WHERE id = ? AND mentor_id = ?
       LIMIT 1`,
      [dossierId, mentorId]
    );
    if (!row) return fail(res, 403, "Geen toegang tot dit dossier");

    return ok(res, row, "Afspraken opgehaald");
  } catch (err) {
    console.error("getAfspraken error:", err);
    return fail(res, 500, "Afspraken ophalen mislukt");
  }
}

// PATCH /mentor/dossier/:dossierId/afspraken
async function updateAfspraken(req, res) {
  const mentorId          = Number(req.user?.id);
  const dossierId         = Number(req.params.dossierId);
  if (!Number.isInteger(dossierId)) return fail(res, 404, "Dossier niet gevonden");
  const { afspraken, velden } = req.body;

  // Story 29: de afspraken kunnen als losse velden komen (werkuren, thuiswerk, ...) of als één tekst.
  let veldenJson = null;
  let tekst = afspraken;
  if (velden && typeof velden === "object") {
    const labels = [
      ["Werkuren", velden.werkuren],
      ["Thuiswerk", velden.thuiswerk],
      ["Eerste dag", velden.eersteDag ?? velden.eerste_dag],
      ["Contactpersoon", velden.contactpersoon],
      ["Benodigd materiaal", velden.materiaal],
      ["Extra info", velden.extra]
    ];
    tekst = labels.filter(([, v]) => v && String(v).trim()).map(([k, v]) => `${k}: ${v}`).join("\n");
    // Alleen als er minstens één veld effectief ingevuld is, bewaren we de gestructureerde data;
    // een volledig leeg veldenobject mag niet als "gedeeld" tellen.
    if (tekst.trim() !== "") veldenJson = JSON.stringify(velden);
  }

  if ((tekst === undefined || tekst === null || String(tekst).trim() === "") && !veldenJson) {
    return fail(res, 400, "Vul minstens één praktische afspraak in voor je ze deelt");
  }

  try {
    const [[dos]] = await db.query("SELECT status FROM stagedossiers WHERE id = ? AND mentor_id = ? LIMIT 1", [dossierId, mentorId]);
    if (!dos) return fail(res, 403, "Geen toegang tot dit dossier");
    if (["resultaat_vrijgegeven", "afgerond"].includes(dos.status)) {
      return fail(res, 409, "Het dossier is afgerond; praktische afspraken kunnen niet meer gewijzigd worden");
    }

    const [result] = await db.query(
      `UPDATE stagedossiers
       SET praktische_afspraken = ?,
           praktische_afspraken_velden = COALESCE(?, praktische_afspraken_velden),
           praktische_afspraken_gedeeld_op = NOW()
       WHERE id = ? AND mentor_id = ?`,
      // Komt er enkel vrije tekst binnen (geen velden), dan blijft de bestaande gestructureerde data staan
      // i.p.v. ze te wissen — de twee mentorschermen overschrijven elkaar zo niet meer.
      [tekst || null, veldenJson, dossierId, mentorId]
    );

    if (result.affectedRows === 0) return fail(res, 403, "Geen toegang tot dit dossier");

    // Student verwittigen dat de afspraken gedeeld zijn (story 29)
    const [drows] = await db.query(
      "SELECT student_id FROM stagedossiers WHERE id = ? LIMIT 1",
      [dossierId]
    );
    if (drows[0]?.student_id) {
      await meld(drows[0].student_id, {
        titel: "Praktische afspraken gedeeld",
        bericht: "Je mentor heeft de praktische afspraken voor je stage gedeeld.",
        aangemaaktDoorId: mentorId,
        stagedossierId: dossierId
      });
    }

    return ok(res, { dossierId }, "Praktische afspraken opgeslagen");
  } catch (err) {
    console.error("updateAfspraken error:", err);
    return fail(res, 500, "Afspraken opslaan mislukt");
  }
}

// GET /mentor/contract/:dossierId/pdf — mentor downloadt de stageovereenkomst als PDF (story 28).
async function downloadMentorContractPdf(req, res) {
  const mentorId = Number(req.user?.id);
  const dossierId = Number(req.params.dossierId);
  if (!Number.isInteger(dossierId)) return fail(res, 404, "Dossier niet gevonden");

  try {
    const [rows] = await db.query(
      `
      SELECT
        so.status, so.student_getekend_op, so.bedrijf_getekend_op, so.opleiding_getekend_op,
        d.dossiernummer, d.startdatum, d.einddatum,
        CONCAT(gs.voornaam, ' ', gs.achternaam) AS student_naam,
        b.naam AS bedrijf_naam,
        CONCAT(gm.voornaam, ' ', gm.achternaam) AS mentor_naam,
        CONCAT(gdoc.voornaam, ' ', gdoc.achternaam) AS docent_naam
      FROM stageovereenkomsten so
      JOIN stagedossiers d ON d.id = so.stagedossier_id
      JOIN gebruikers gs ON gs.id = d.student_id
      JOIN bedrijven b ON b.id = d.bedrijf_id
      LEFT JOIN gebruikers gm ON gm.id = d.mentor_id
      LEFT JOIN gebruikers gdoc ON gdoc.id = d.stagebegeleider_id
      WHERE so.stagedossier_id = ? AND d.mentor_id = ?
      LIMIT 1
      `,
      [dossierId, mentorId]
    );

    const c = rows[0];
    if (!c) return fail(res, 403, "Geen toegang tot dit dossier of geen overeenkomst gevonden");

    const tekenStatus = (op) => (op ? `Getekend op ${String(op).slice(0, 10)}` : "Nog niet getekend");
    const lines = [
      "Stageovereenkomst",
      `Dossier: ${c.dossiernummer || "-"}`,
      `Status: ${c.status || "-"}`,
      "",
      `Student: ${c.student_naam || "-"}`,
      `Bedrijf: ${c.bedrijf_naam || "-"}`,
      `Mentor: ${c.mentor_naam || "-"}`,
      `Stagebegeleider: ${c.docent_naam || "-"}`,
      `Periode: ${c.startdatum ? String(c.startdatum).slice(0, 10) : "-"} tot ${c.einddatum ? String(c.einddatum).slice(0, 10) : "-"}`,
      "",
      "Handtekeningen:",
      `  Student: ${tekenStatus(c.student_getekend_op)}`,
      `  Bedrijf: ${tekenStatus(c.bedrijf_getekend_op)}`,
      `  Opleiding: ${tekenStatus(c.opleiding_getekend_op)}`,
      "",
      `Gegenereerd op: ${new Date().toISOString().slice(0, 10)}`
    ];

    const pdf = buildSimplePdf(lines);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="stageovereenkomst-${c.dossiernummer || dossierId}.pdf"`);
    return res.send(pdf);
  } catch (err) {
    console.error("downloadMentorContractPdf error:", err);
    return fail(res, 500, "Overeenkomst-PDF genereren mislukt");
  }
}

module.exports = {
  getMentorStudents,
  getMentorContract,
  tekenContract,
  downloadMentorContractPdf,
  getAfspraken,
  updateAfspraken,
};
