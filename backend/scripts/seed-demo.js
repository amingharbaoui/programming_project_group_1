/*
 * seed-demo.js
 *
 * Laadt de demo-data uit backend/database/seed.sql, maakt de demo-accounts
 * loginbaar met Demo!2026 en zorgt dat de eindpresentatie-rubriek bestaat.
 *
 * Gebruik op een verse database:
 *   mysql -u <db_user> -p <db_name> < database/schema.sql
 *   node scripts/seed-demo.js
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const DEMO_PASSWORD = "Demo!2026";
const DEMO_USER_IDS = [1, 2, 3, 4, 5, 6, 7, 8];
const DEMO_RUBRIEK = [
  ["Inhoud en technische diepgang", 1],
  ["Structuur en opbouw", 2],
  ["Communicatie en presentatie", 3],
  ["Beantwoording van vragen", 4],
  ["Professionaliteit", 5],
];

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.pbkdf2Sync(String(password), salt, 120000, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$120000$${salt}$${derived}`;
}

function readSeedSql() {
  const seedPath = path.join(__dirname, "..", "database", "seed.sql");
  return fs
    .readFileSync(seedPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => !/^\s*USE\s+/i.test(line))
    .join("\n");
}

async function main() {
  const required = ["DB_HOST", "DB_USER", "DB_NAME"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Ontbrekende DB-config: ${missing.join(", ")}. Zet deze in backend/.env.`);
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  try {
    console.log(`Demo seed laden in database "${process.env.DB_NAME}"...`);
    await connection.query(readSeedSql());

    const passwordHash = hashPassword(DEMO_PASSWORD);
    await connection.query(
      `UPDATE gebruikers
       SET wachtwoord_hash = ?, auth_provider = 'local', status = 'actief',
           geblokkeerd_tot = NULL, login_fout_teller = 0, aangepast_op = NOW()
       WHERE id IN (?)`,
      [passwordHash, DEMO_USER_IDS]
    );

    await connection.query(
      `UPDATE gebruikers
       SET uitnodiging_status = NULL, uitnodiging_token = NULL, uitnodiging_vervalt_op = NULL
       WHERE id IN (?)`,
      [DEMO_USER_IDS]
    ).catch(() => {});

    for (const [titel, volgorde] of DEMO_RUBRIEK) {
      await connection.query(
        `INSERT INTO rubriek_criteria (titel, volgorde, actief)
         SELECT ?, ?, 1
         WHERE NOT EXISTS (SELECT 1 FROM rubriek_criteria WHERE titel = ?)`,
        [titel, volgorde, titel]
      );
    }

    console.log("Demo-data klaar.");
    console.log(`Wachtwoord voor demo-accounts: ${DEMO_PASSWORD}`);
    console.log("Accounts: student@ehb.be, commissie@ehb.be, docent@ehb.be, admin@ehb.be, mentor@bedrijf.be");
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("Demo seed mislukt:", error.message);
  process.exitCode = 1;
});
