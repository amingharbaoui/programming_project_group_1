/*
 * add-restwerk-columns.js — voegt twee nullable kolommen toe ZONDER data te wissen (idempotent).
 *  - planning_momenten.deelnemers          (story 42: deelnemers bij de eindpresentatie)
 *  - evaluaties.mentor_algemene_feedback    (story 33: algemene praktijkfeedback van de mentor)
 *
 * Gebruik:  node scripts/add-restwerk-columns.js
 */
const db = require("../src/config/db");

// [tabel, kolom, definitie] — vaste, niet-gebruikersgestuurde waarden (veilig te interpoleren).
const KOLOMMEN = [
  ["planning_momenten", "deelnemers", "TEXT NULL"],
  ["evaluaties", "mentor_algemene_feedback", "TEXT NULL"],
];

async function main() {
  try {
    for (const [tabel, kolom, definitie] of KOLOMMEN) {
      const [r] = await db.query(
        `SELECT COUNT(*) AS n FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
        [tabel, kolom]
      );
      if (r[0].n > 0) { console.log(`  = bestaat al: ${tabel}.${kolom}`); continue; }
      await db.query(`ALTER TABLE \`${tabel}\` ADD COLUMN \`${kolom}\` ${definitie}`);
      console.log(`  + toegevoegd: ${tabel}.${kolom}`);
    }
    console.log("\nKlaar.");
  } catch (e) {
    console.error("Mislukt:", e.message);
    process.exitCode = 1;
  } finally {
    await db.end().catch(() => {});
  }
}
main();
