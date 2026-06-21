/*
 * check-amin.js — READ-ONLY: toont gebruiker + stagevoorstellen + stagedossiers van Amin
 * Gharbaoui, om te zien wat er nog in de database staat. Wijzigt niets.
 *
 * Gebruik: node scripts/check-amin.js
 */
const db = require("../src/config/db");

async function main() {
  const conn = await db.getConnection();
  try {
    const [users] = await conn.query(
      "SELECT id, voornaam, achternaam, email, hoofdrol, status FROM gebruikers WHERE voornaam LIKE '%Amin%' OR achternaam LIKE '%Gharbaoui%'"
    );
    console.log("=== Gebruiker(s) Amin Gharbaoui ===");
    console.log(users);

    if (users.length === 0) {
      console.log("\nGeen gebruiker gevonden met die naam — het account zelf bestaat niet (meer).");
      return;
    }

    for (const u of users) {
      const [voorstellen] = await conn.query(
        "SELECT * FROM stagevoorstellen WHERE student_id = ?",
        [u.id]
      );
      console.log(`\n=== Stagevoorstellen van ${u.voornaam} (id ${u.id}) ===`);
      console.log(voorstellen);

      const [dossiers] = await conn.query(
        "SELECT * FROM stagedossiers WHERE student_id = ?",
        [u.id]
      );
      console.log(`=== Stagedossiers van ${u.voornaam} (id ${u.id}) ===`);
      console.log(dossiers);
    }
  } catch (e) {
    console.error("Fout:", e.message);
  } finally {
    conn.release();
    await db.end().catch(() => {});
  }
}
main();
