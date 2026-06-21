/*
 * fix-test-nathan-mentor.js — koppelt het dossier van Test Nathan opnieuw aan de échte
 * Sofie Maris (mentor@bedrijf.be, id 5) i.p.v. het per-ongeluk aangemaakte spook-account
 * (id 208, gemaakt met een verkeerd mentor-e-mailadres bij het indienen van het voorstel).
 * Raakt enkel dit ene dossier aan.
 *
 * Gebruik: node scripts/fix-test-nathan-mentor.js
 */
const db = require("../src/config/db");

async function main() {
  const conn = await db.getConnection();
  try {
    const [rows] = await conn.query(
      `SELECT sd.id FROM stagedossiers sd
       JOIN gebruikers g ON g.id = sd.student_id
       WHERE g.email = 'test.nathan@ehb.be'`
    );
    if (rows.length === 0) {
      console.log("Geen dossier gevonden voor test.nathan@ehb.be.");
      return;
    }
    const dossierId = rows[0].id;

    const [mentorRows] = await conn.query(
      "SELECT id FROM gebruikers WHERE email = 'mentor@bedrijf.be' LIMIT 1"
    );
    if (mentorRows.length === 0) {
      console.log("mentor@bedrijf.be niet gevonden — niets aangepast.");
      return;
    }
    const echteMentorId = mentorRows[0].id;

    await conn.query(
      "UPDATE stagedossiers SET mentor_id = ?, aangepast_op = NOW() WHERE id = ?",
      [echteMentorId, dossierId]
    );
    console.log(`Dossier ${dossierId}: mentor_id gezet naar ${echteMentorId} (mentor@bedrijf.be).`);
  } catch (e) {
    console.error("Fout:", e.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await db.end().catch(() => {});
  }
}
main();
