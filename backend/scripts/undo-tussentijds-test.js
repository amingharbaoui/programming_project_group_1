/*
 * undo-tussentijds-test.js
 * Zet de tussentijdse evaluatie van Liam Loopt exact terug naar de waarden van vóór
 * polish-test-tussentijds.js, op basis van .tussentijds-backup.json.
 *
 * Gebruik:  node scripts/undo-tussentijds-test.js
 */
const fs = require("fs");
const path = require("path");
const db = require("../src/config/db");

const BACKUP_FILE = path.join(__dirname, ".tussentijds-backup.json");

async function main() {
  if (!fs.existsSync(BACKUP_FILE)) {
    console.log("Geen backup-bestand gevonden — niets om terug te zetten (of polish-test-tussentijds.js is nooit gedraaid).");
    return;
  }

  const origineel = JSON.parse(fs.readFileSync(BACKUP_FILE, "utf8"));
  const conn = await db.getConnection();
  try {
    await conn.query(
      `UPDATE evaluaties
       SET status = ?, verslag = ?, docent_geregistreerd_op = ?, aangepast_op = NOW()
       WHERE id = ?`,
      [origineel.status, origineel.verslag, origineel.docent_geregistreerd_op, origineel.id]
    );
    console.log(`Evaluatie ${origineel.id} teruggezet naar:`);
    console.log(origineel);
    fs.unlinkSync(BACKUP_FILE);
    console.log("Backup-bestand verwijderd. Alles staat weer zoals het was.");
  } catch (e) {
    console.error("Fout:", e.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await db.end().catch(() => {});
  }
}
main();
