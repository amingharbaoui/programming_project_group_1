/*
 * list-docent-dossiers.js — READ-ONLY diagnose: toont per docent-account
 * hoeveel dossiers, logboekweken en evaluaties er gekoppeld zijn.
 * Wijzigt niets aan de database.
 *
 * Gebruik:  node scripts/list-docent-dossiers.js
 */
const db = require("../src/config/db");

async function main() {
  const conn = await db.getConnection();
  try {
    const [docenten] = await conn.query(
      `SELECT id, voornaam, achternaam, email FROM gebruikers WHERE hoofdrol = 'docent' ORDER BY id`
    );

    for (const docent of docenten) {
      const [dossiers] = await conn.query(
        `SELECT sd.id, sd.student_id, CONCAT(gs.voornaam,' ',gs.achternaam) AS student_naam,
                (SELECT COUNT(*) FROM logboek_weken lw WHERE lw.stagedossier_id = sd.id) AS weken,
                (SELECT COUNT(*) FROM evaluaties e WHERE e.stagedossier_id = sd.id) AS evals
         FROM stagedossiers sd
         JOIN gebruikers gs ON gs.id = sd.student_id
         WHERE sd.stagebegeleider_id = ?`,
        [docent.id]
      );
      console.log(`\nDocent: ${docent.voornaam} ${docent.achternaam} <${docent.email}> (id=${docent.id})`);
      if (dossiers.length === 0) {
        console.log("  -> geen dossiers gekoppeld");
      } else {
        for (const d of dossiers) {
          console.log(`  -> dossier ${d.id} | student: ${d.student_naam} | logboekweken: ${d.weken} | evaluaties: ${d.evals}`);
        }
      }
    }
  } catch (e) {
    console.error("Fout:", e.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await db.end().catch(() => {});
  }
}

main();
