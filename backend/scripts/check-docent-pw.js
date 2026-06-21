/*
 * check-docent-pw.js — READ-ONLY: toont wachtwoord_hash-status van docent@ehb.be en docent2@ehb.be.
 * Wijzigt niets.
 *
 * Gebruik:  node scripts/check-docent-pw.js
 */
const db = require("../src/config/db");

async function main() {
  try {
    const [rows] = await db.query(
      "SELECT id, email, wachtwoord_hash FROM gebruikers WHERE email IN ('docent@ehb.be','docent2@ehb.be')"
    );
    for (const r of rows) {
      console.log(`${r.email} (id=${r.id}): ${r.wachtwoord_hash === null ? "NULL" : r.wachtwoord_hash}`);
    }
  } catch (e) {
    console.error("Fout:", e.message);
    process.exitCode = 1;
  } finally {
    await db.end().catch(() => {});
  }
}
main();
