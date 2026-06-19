/*
 * set-demo-password.js — zet voor ALLE bestaande demo-accounts één nieuw wachtwoord ZONDER data te wissen.
 * Updatet enkel wachtwoord_hash (accounts zonder hash, bv. nog-uit-te-nodigen mentor, blijven ongemoeid).
 *
 * Gebruik:  node scripts/set-demo-password.js
 */
const crypto = require("crypto");
const db = require("../src/config/db");

const NIEUW_WACHTWOORD = "Demo!2026";
function hash(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  const d = crypto.pbkdf2Sync(String(pw), salt, 120000, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$120000$${salt}$${d}`;
}

async function main() {
  try {
    const [users] = await db.query("SELECT id, email FROM gebruikers WHERE wachtwoord_hash IS NOT NULL");
    for (const u of users) {
      await db.query(
        "UPDATE gebruikers SET wachtwoord_hash = ?, aangepast_op = NOW() WHERE id = ?",
        [hash(NIEUW_WACHTWOORD), u.id]
      );
    }
    console.log(`${users.length} accounts bijgewerkt. Nieuw demo-wachtwoord: ${NIEUW_WACHTWOORD}`);
  } catch (e) {
    console.error("Mislukt:", e.message);
    process.exitCode = 1;
  } finally {
    await db.end().catch(() => {});
  }
}
main();
