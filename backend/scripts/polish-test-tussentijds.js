/*
 * polish-test-tussentijds.js
 * Zet de tussentijdse evaluatie van Liam Loopt TIJDELIJK op status 'geregistreerd' met een
 * test-verslag, puur om de nieuwe "Verslag bekijken"-knop/modal bij mentor te kunnen zien
 * zonder de hele keten (student -> mentor -> docent) te moeten doorlopen.
 *
 * Bewaart eerst de originele waarden in .tussentijds-backup.json, zodat
 * undo-tussentijds-test.js alles exact kan terugzetten.
 *
 * Gebruik:  node scripts/polish-test-tussentijds.js
 */
const fs = require("fs");
const path = require("path");
const db = require("../src/config/db");

const BACKUP_FILE = path.join(__dirname, ".tussentijds-backup.json");

async function main() {
  const conn = await db.getConnection();
  try {
    const [rows] = await conn.query(
      `SELECT e.id, e.status, e.verslag, e.docent_geregistreerd_op
       FROM evaluaties e
       JOIN stagedossiers d ON d.id = e.stagedossier_id
       JOIN gebruikers g ON g.id = d.student_id
       WHERE g.email = 'student.loopt@ehb.be' AND e.type = 'tussentijds'
       LIMIT 1`
    );

    if (rows.length === 0) {
      console.log("Geen tussentijdse evaluatie gevonden voor Liam Loopt — eerst via de app openen (knop 'Tussentijdse evaluatie openen' bij docent) en dan dit script opnieuw draaien.");
      return;
    }

    const origineel = rows[0];
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(origineel, null, 2));
    console.log("Originele waarden bewaard in .tussentijds-backup.json:");
    console.log(origineel);

    await conn.query(
      `UPDATE evaluaties
       SET status = 'geregistreerd',
           verslag = 'TEST: Op schema. Sterk technisch werk en een consequent logboek. Vaker zelf initiatief nemen is het werkpunt voor de tweede helft van de stage.',
           docent_geregistreerd_op = NOW(),
           aangepast_op = NOW()
       WHERE id = ?`,
      [origineel.id]
    );

    console.log(`\nEvaluatie ${origineel.id} (Liam Loopt, tussentijds) staat nu tijdelijk op 'geregistreerd' met testverslag.`);
    console.log("Ga nu naar mentor -> Evaluatie -> Liam Loopt -> Tussentijds om de 'Verslag bekijken'-knop te zien.");
    console.log("Draai daarna node scripts/undo-tussentijds-test.js om alles terug te zetten.");
  } catch (e) {
    console.error("Fout:", e.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await db.end().catch(() => {});
  }
}
main();
