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

  const [columns] = await connection.query(
    `
    SELECT
      TABLE_NAME,
      COLUMN_NAME,
      COLUMN_TYPE,
      IS_NULLABLE,
      COLUMN_KEY,
      COLUMN_DEFAULT,
      EXTRA
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = ?
    ORDER BY TABLE_NAME, ORDINAL_POSITION
    `,
    [database]
  );

  let output = "";

  let currentTable = null;

  for (const col of columns) {
    if (col.TABLE_NAME !== currentTable) {
      currentTable = col.TABLE_NAME;
      output += `\n## ${currentTable}\n`;
    }

    output += `- ${col.COLUMN_NAME} | ${col.COLUMN_TYPE} | null:${col.IS_NULLABLE} | key:${col.COLUMN_KEY || "-"} | default:${col.COLUMN_DEFAULT ?? "-"} | ${col.EXTRA || "-"}\n`;
  }

  const outputPath = path.join(__dirname, "..", "database", "structure-overview.txt");
  fs.writeFileSync(outputPath, output.trim() + "\n", "utf8");

  console.log(`Structure overview exported to ${outputPath}`);
  console.log(`Columns found: ${columns.length}`);

  await connection.end();
}

main().catch((error) => {
  console.error("Inspect failed");
  console.error("code:", error.code);
  console.error("message:", error.message);
  process.exit(1);
});
