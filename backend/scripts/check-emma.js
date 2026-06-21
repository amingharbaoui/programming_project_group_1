/*
 * check-emma.js — READ-ONLY: toont alle stagevoorstellen en stagedossiers van Emma Geen,
 * om te zien wat er momenteel echt in de database staat. Wijzigt niets.
 *
 * Gebruik:  node scripts/check-emma.js
 */
const db = require("../src/config/db");

async function main() {
  const conn = await db.getConnection();
  try {
    const [emma] = await conn.query("SELECT id, voornaam, achternaam, email FROM gebruikers WHERE email = 'student.geen@ehb.be'");
    if (emma.length === 0) {
      console.log("Emma Geen niet gevonden in gebruikers-tabel.");
      return;
    }
    console.log("=== Emma Geen ===");
    console.log(emma[0]);

    const [voorstellen] = await conn.query(
      "SELECT * FROM stagevoorstellen WHERE student_id = ? ORDER BY aangemaakt_op DESC",
      [emma[0].id]
    );
    console.log(`\n=== Stagevoorstellen van Emma (${voorstellen.length}) ===`);
    console.log(voorstellen);

    const [dossiers] = await conn.query(
      "SELECT id, student_id, status, dossiernummer, mentor_id, stagebegeleider_id, aangemaakt_op FROM stagedossiers WHERE student_id = ? ORDER BY aangemaakt_op DESC",
      [emma[0].id]
    );
    console.log(`\n=== Stagedossiers van Emma (${dossiers.length}) ===`);
    console.log(dossiers);

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
