const db = require("../config/db");

function getHealth(req, res) {
  res.json({
    status: "ok",
    message: "Stagify backend is running"
  });
}

async function getDatabaseHealth(req, res) {
  try {
    const [databaseRows] = await db.query("SELECT DATABASE() AS databaseName");
    const [tables] = await db.query("SHOW TABLES");

    res.json({
      status: "ok",
      message: "Database connection works",
      database: databaseRows[0].databaseName,
      tableCount: tables.length
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Database connection failed",
      error: error.message
    });
  }
}

module.exports = {
  getHealth,
  getDatabaseHealth
};