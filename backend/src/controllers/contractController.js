const db = require("../config/db");
const { ok, fail } = require("../utils/response");

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
      SELECT so.id, so.status, so.student_getekend_op
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

module.exports = { getContract, signContract };
