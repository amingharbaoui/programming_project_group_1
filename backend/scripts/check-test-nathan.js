/*
 * check-test-nathan.js — READ-ONLY: toont het dossier + mentor-koppeling van Test Nathan.
 * Gebruik: node scripts/check-test-nathan.js
 */
const db = require("../src/config/db");

async function main() {
  const conn = await db.getConnection();
  try {
    const [rows] = await conn.query(
      `SELECT sd.id AS dossier_id, sd.status, sd.mentor_id, sd.stagebegeleider_id,
              mg.email AS mentor_email, mg.voornaam AS mentor_voornaam,
              so.student_getekend_op, so.bedrijf_getekend_op
       FROM stagedossiers sd
       JOIN gebruikers g ON g.id = sd.student_id
       LEFT JOIN gebruikers mg ON mg.id = sd.mentor_id
       LEFT JOIN stageovereenkomsten so ON so.stagedossier_id = sd.id
       WHERE g.email = 'test.nathan@ehb.be'`
    );
    console.log("=== Dossier Test Nathan ===");
    console.log(rows);
  } catch (e) {
    console.error("Fout:", e.message);
  } finally {
    conn.release();
    await db.end().catch(() => {});
  }
}
main();
