require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

async function main() {
  const database = process.env.DB_NAME;

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database
  });

  const [tables] = await connection.query(
    `
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = ?
      AND TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME
    `,
    [database]
  );

  let sql = "";
  sql += `-- Auto-exported schema from database: ${database}\n`;
  sql += `-- No passwords or private credentials in this file.\n\n`;
  sql += `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n`;
  sql += `USE \`${database}\`;\n\n`;
  sql += "SET FOREIGN_KEY_CHECKS = 0;\n\n";

  for (const table of tables) {
    const tableName = table.TABLE_NAME;
    const [rows] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
    const createSql = rows[0]["Create Table"];

    sql += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
    sql += `${createSql};\n\n`;
  }

  sql += "SET FOREIGN_KEY_CHECKS = 1;\n";

  const outputPath = path.join(__dirname, "..", "database", "schema.sql");
  fs.writeFileSync(outputPath, sql, "utf8");

  console.log(`Schema exported to ${outputPath}`);
  console.log(`Tables exported: ${tables.length}`);

  await connection.end();
}

main().catch((error) => {
  console.error("Schema export failed");
  console.error("code:", error.code);
  console.error("message:", error.message);
  process.exit(1);
});
