const db = require("../config/db");
const { ok, fail } = require("../utils/response");

function getUserId(req) {
  return Number(req.user?.id);
}

// Eigen meldingen ophalen + aantal ongelezen (voor de belteller).
async function listMine(req, res) {
  const userId = getUserId(req);
  try {
    const [rows] = await db.query(
      `
      SELECT id, type, ernst, titel, bericht, status, kanaal, gelezen_op, aangemaakt_op,
             stagevoorstel_id, stagedossier_id, document_id, logboek_week_id
      FROM systeem_meldingen
      WHERE ontvanger_id = ?
      ORDER BY aangemaakt_op DESC, id DESC
      LIMIT 100
      `,
      [userId]
    );

    const ongelezen = rows.filter((r) => r.status !== "gelezen" && r.status !== "gesloten").length;
    return ok(res, { meldingen: rows, ongelezen }, "Meldingen opgehaald");
  } catch (error) {
    return fail(res, 500, "Meldingen ophalen mislukt", error.message);
  }
}

// Eén melding als gelezen markeren (alleen eigen meldingen).
async function markRead(req, res) {
  const userId = getUserId(req);
  const id = Number(req.params.id);
  if (!id) {
    return fail(res, 400, "Ongeldig meldings-id");
  }
  try {
    const [r] = await db.query(
      "UPDATE systeem_meldingen SET status = 'gelezen', gelezen_op = NOW() WHERE id = ? AND ontvanger_id = ?",
      [id, userId]
    );
    if (r.affectedRows === 0) {
      return fail(res, 404, "Melding niet gevonden");
    }
    return ok(res, { id }, "Melding gelezen");
  } catch (error) {
    return fail(res, 500, "Melding bijwerken mislukt", error.message);
  }
}

// Alle eigen meldingen als gelezen markeren.
async function markAllRead(req, res) {
  const userId = getUserId(req);
  try {
    const [r] = await db.query(
      "UPDATE systeem_meldingen SET status = 'gelezen', gelezen_op = NOW() WHERE ontvanger_id = ? AND status NOT IN ('gelezen', 'gesloten')",
      [userId]
    );
    return ok(res, { aantal: r.affectedRows }, "Alle meldingen gelezen");
  } catch (error) {
    return fail(res, 500, "Meldingen bijwerken mislukt", error.message);
  }
}

module.exports = { listMine, markRead, markAllRead };
