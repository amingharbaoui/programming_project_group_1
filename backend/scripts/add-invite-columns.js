/*
 * add-invite-columns.js — voegt generieke uitnodigingsvelden toe aan `gebruikers` ZONDER data te wissen.
 * Idempotent: controleert information_schema en doet niets als de kolom/index al bestaat.
 * Maakt de admin-onboarding (student/docent/administratie/stagecommissie uitnodigen + activeren) mogelijk,
 * los van de bestaande mentor-flow (die zijn token in `mentoren` bewaart).
 *
 * Gebruik:  node scripts/add-invite-columns.js
 */
const db = require("../src/config/db");

// Vaste, niet-gebruikersgestuurde definities (veilig om te interpoleren).
const KOLOMMEN = [
  ["uitnodiging_token", "VARCHAR(64) NULL"],
  ["uitnodiging_status", "VARCHAR(20) NULL"],
  ["uitnodiging_vervalt_op", "DATETIME NULL"],
];
const INDEX_NAAM = "idx_gebruikers_uitnodiging_token";

async function main() {
  try {
    for (const [naam, definitie] of KOLOMMEN) {
      const [r] = await db.query(
        `SELECT COUNT(*) AS n FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = 'gebruikers' AND column_name = ?`,
        [naam]
      );
      if (r[0].n > 0) { console.log(`  = bestaat al: ${naam}`); continue; }
      await db.query(`ALTER TABLE gebruikers ADD COLUMN ${naam} ${definitie}`);
      console.log(`  + toegevoegd: ${naam}`);
    }
    const [idx] = await db.query(
      `SELECT COUNT(*) AS n FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'gebruikers' AND index_name = ?`,
      [INDEX_NAAM]
    );
    if (idx[0].n === 0) {
      await db.query(`CREATE INDEX ${INDEX_NAAM} ON gebruikers (uitnodiging_token)`);
      console.log(`  + index: ${INDEX_NAAM}`);
    } else {
      console.log(`  = index bestaat al: ${INDEX_NAAM}`);
    }
    console.log("\nKlaar — gebruikers heeft nu generieke uitnodigingsvelden.");
  } catch (e) {
    console.error("Mislukt:", e.message);
    process.exitCode = 1;
  } finally {
    await db.end().catch(() => {});
  }
}
main();
