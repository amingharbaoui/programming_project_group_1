/*
 * check-logboek-david.js — READ-ONLY: toont alle logboek_weken-rijen voor het
 * dossier van David Contract, om te zien waarom mentor-afchecken "niet gevonden" geeft.
 * Wijzigt niets.
 *
 * Gebruik:  node scripts/check-logboek-david.js
 */
const db = require("../src/config/db");

async function main() {
  const conn = await db.getConnection();
  try {
    const [dossiers] = await conn.query(
      `SELECT sd.id, sd.student_id, sd.mentor_id, sd.stagebegeleider_id, sd.status
       FROM stagedossiers sd
       JOIN gebruikers g ON g.id = sd.student_id
       WHERE g.email = 'student.contract@ehb.be'`
    );
    console.log("=== DOSSIER(S) David Contract ===");
    console.log(dossiers);

    if (dossiers.length === 0) {
      console.log("Geen dossier gevonden voor student.contract@ehb.be");
      return;
    }

    for (const d of dossiers) {
      const [weken] = await conn.query(
        `SELECT id, stagedossier_id, week_nummer, status, mentor_id, docent_id, aangemaakt_op, aangepast_op
         FROM logboek_weken
         WHERE stagedossier_id = ?
         ORDER BY week_nummer ASC, id ASC`,
        [d.id]
      );
      console.log(`\n=== logboek_weken voor dossier ${d.id} (mentor_id=${d.mentor_id}) ===`);
      console.log(weken);

      // Specifiek checken of id=61 bestaat, los van dit dossier (misschien hoort het ergens anders).
      const [check61] = await conn.query(
        `SELECT lw.*, sd2.student_id FROM logboek_weken lw
         JOIN stagedossiers sd2 ON sd2.id = lw.stagedossier_id
         WHERE lw.id = 61`
      );
      console.log("\n=== Bestaat id=61 ergens in de hele tabel? ===");
      console.log(check61.length === 0 ? "NEE — id 61 bestaat nergens in logboek_weken." : check61);
    }

    console.log("\nKlaar.");
  } catch (e) {
    console.error("Fout:", e.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await db.end().catch(() => {});
  }
}
main();
