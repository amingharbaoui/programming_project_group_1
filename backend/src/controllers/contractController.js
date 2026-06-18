const db = require("../config/db");
const { ok, fail } = require("../utils/response");
const { meld } = require("../utils/notify");
const { buildSimplePdf } = require("../utils/pdf");

function getUserId(req) {
  return Number(req.user?.id || 1);
}

/* GET /api/contracts/my
   Haalt de stageovereenkomst op voor de ingelogde student */
async function getContract(req, res) {
  const studentId = getUserId(req);

  try {
    const [rows] = await db.query(
      `
      SELECT
        so.id,
        so.stagedossier_id,
        so.status,
        so.bestand_url,
        so.student_getekend_op,
        so.bedrijf_getekend_op,
        so.opleiding_getekend_op,
        so.afkeurreden,
        so.aangemaakt_op,

        d.dossiernummer,
        d.startdatum,
        d.einddatum,

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
      WHERE d.student_id = ?
      ORDER BY so.aangemaakt_op DESC
      LIMIT 1
      `,
      [studentId]
    );

    if (rows.length === 0) {
      return fail(res, 404, "Geen stageovereenkomst gevonden");
    }

    return ok(res, rows[0], "Stageovereenkomst opgehaald");
  } catch (error) {
    return fail(res, 500, "Stageovereenkomst ophalen mislukt", error.message);
  }
}

/* POST /api/contracts/sign
   Student tekent de stageovereenkomst digitaal */
async function signContract(req, res) {
  const studentId = getUserId(req);
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `
      SELECT so.id, so.status, so.student_getekend_op, so.stagedossier_id, d.mentor_id
      FROM stageovereenkomsten so
      JOIN stagedossiers d ON d.id = so.stagedossier_id
      WHERE d.student_id = ?
      ORDER BY so.aangemaakt_op DESC
      LIMIT 1
      `,
      [studentId]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return fail(res, 404, "Geen stageovereenkomst gevonden");
    }

    const contract = rows[0];

    if (contract.student_getekend_op) {
      await connection.rollback();
      return fail(res, 409, "Je hebt deze overeenkomst al ondertekend");
    }

    const now = new Date();

    await connection.query(
      `
      UPDATE stageovereenkomsten
      SET student_getekend_op = ?,
          status = 'getekend_door_student',
          aangepast_op = NOW()
      WHERE id = ?
      `,
      [now, contract.id]
    );

    await connection.commit();

    // Administratie + bedrijf (mentor = volgende ondertekenaar) verwittigen
    try {
      const [admins] = await db.query(
        "SELECT id FROM gebruikers WHERE hoofdrol = 'administratie' AND status = 'actief'"
      );
      for (const a of admins) {
        await meld(a.id, {
          titel: "Overeenkomst getekend door student",
          bericht: "Een student heeft de stageovereenkomst digitaal ondertekend.",
          aangemaaktDoorId: studentId,
          stagedossierId: contract.stagedossier_id
        });
      }
      if (contract.mentor_id) {
        await meld(contract.mentor_id, {
          titel: "Stageovereenkomst klaar voor ondertekening",
          bericht: "De student heeft getekend. De overeenkomst wacht nu op de handtekening van het bedrijf.",
          aangemaaktDoorId: studentId,
          stagedossierId: contract.stagedossier_id
        });
      }
    } catch (notifyError) {
      console.error("Melding ondertekening mislukt:", notifyError.message);
    }

    return ok(
      res,
      { getekendOp: now, status: "getekend_door_student" },
      "Stageovereenkomst succesvol ondertekend"
    );
  } catch (error) {
    await connection.rollback();
    return fail(res, 500, "Ondertekenen mislukt", error.message);
  } finally {
    connection.release();
  }
}

/* GET /api/contracts/my/pdf
   Genereert en downloadt de stageovereenkomst als PDF voor de ingelogde student */
async function downloadContractPdf(req, res) {
  const studentId = getUserId(req);

  try {
    const [rows] = await db.query(
      `
      SELECT
        so.id,
        so.status,
        so.student_getekend_op,
        so.bedrijf_getekend_op,
        so.opleiding_getekend_op,
        d.dossiernummer,
        d.startdatum,
        d.einddatum,
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
      WHERE d.student_id = ?
      ORDER BY so.aangemaakt_op DESC
      LIMIT 1
      `,
      [studentId]
    );

    if (rows.length === 0) {
      return fail(res, 404, "Geen stageovereenkomst gevonden");
    }

    const c = rows[0];
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
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="stageovereenkomst-${(c.dossiernummer || c.id)}.pdf"`
    );
    return res.send(pdf);
  } catch (error) {
    return fail(res, 500, "Overeenkomst-PDF genereren mislukt", error.message);
  }
}

module.exports = { getContract, signContract, downloadContractPdf };
