const db = require("../config/db");
const { ok, fail } = require("../utils/response");

// Instellingen ophalen: stageregels (periode/min weken-uren) + documenttypes.
async function getSettings(req, res) {
  try {
    const [stageRegels] = await db.query(
      `SELECT id, opleiding, academiejaar, stagevenster_start, stagevenster_einde,
              minimum_weken, minimum_uren, standaard_uren_per_week, status
       FROM stage_regels
       ORDER BY (status = 'actief') DESC, id DESC`
    );
    const [documentSoorten] = await db.query(
      "SELECT id, naam, type, is_verplicht, is_vast, status FROM document_soorten ORDER BY id"
    );
    return ok(res, { stageRegels, documentSoorten }, "Instellingen opgehaald");
  } catch (error) {
    return fail(res, 500, "Instellingen ophalen mislukt", error.message);
  }
}

// Stageregel aanpassen (periode, minimum weken/uren).
async function updateStageRule(req, res) {
  const id = Number(req.params.id);
  if (!id) return fail(res, 400, "Ongeldig stageregel-id");

  const b = req.body;
  const fields = [];
  const vals = [];
  const set = (col, val) => { if (val !== undefined && val !== null) { fields.push(`${col} = ?`); vals.push(val); } };
  set("stagevenster_start", b.stagevensterStart ?? b.stagevenster_start);
  set("stagevenster_einde", b.stagevensterEinde ?? b.stagevenster_einde);
  set("minimum_weken", b.minimumWeken ?? b.minimum_weken);
  set("minimum_uren", b.minimumUren ?? b.minimum_uren);
  set("standaard_uren_per_week", b.standaardUrenPerWeek ?? b.standaard_uren_per_week);

  if (fields.length === 0) return fail(res, 400, "Geen velden om aan te passen");

  try {
    const [r] = await db.query(
      `UPDATE stage_regels SET ${fields.join(", ")}, aangepast_op = NOW() WHERE id = ?`,
      [...vals, id]
    );
    if (r.affectedRows === 0) return fail(res, 404, "Stageregel niet gevonden");
    return ok(res, { id }, "Stageregel bijgewerkt");
  } catch (error) {
    return fail(res, 500, "Stageregel bijwerken mislukt", error.message);
  }
}

// Documenttype aanpassen (naam / verplicht).
async function updateDocumentType(req, res) {
  const id = Number(req.params.id);
  if (!id) return fail(res, 400, "Ongeldig documenttype-id");

  const fields = [];
  const vals = [];
  if (req.body.naam !== undefined) { fields.push("naam = ?"); vals.push(String(req.body.naam).trim()); }
  if (req.body.isVerplicht !== undefined || req.body.is_verplicht !== undefined) {
    fields.push("is_verplicht = ?");
    vals.push((req.body.isVerplicht ?? req.body.is_verplicht) ? 1 : 0);
  }
  if (fields.length === 0) return fail(res, 400, "Geen velden om aan te passen");

  try {
    const [r] = await db.query(
      `UPDATE document_soorten SET ${fields.join(", ")}, aangepast_op = NOW() WHERE id = ?`,
      [...vals, id]
    );
    if (r.affectedRows === 0) return fail(res, 404, "Documenttype niet gevonden");
    return ok(res, { id }, "Documenttype bijgewerkt");
  } catch (error) {
    return fail(res, 500, "Documenttype bijwerken mislukt", error.message);
  }
}

async function createDocumentType(req, res) {
  const { naam, type, isVerplicht, is_verplicht, opleiding, academiejaar } = req.body;
  const adminId = Number(req.user?.id);

  if (!naam) return fail(res, 400, "Naam is verplicht");

  try {
    const [result] = await db.query(
      `
      INSERT INTO document_soorten
        (naam, type, is_verplicht, is_vast, opleiding, academiejaar, status, aangemaakt_door_id, aangemaakt_op, aangepast_op)
      VALUES (?, ?, ?, 0, ?, ?, 'actief', ?, NOW(), NOW())
      `,
      [
        naam,
        type || "stage",
        isVerplicht ?? is_verplicht ? 1 : 0,
        opleiding || null,
        academiejaar || null,
        adminId || null
      ]
    );

    return ok(
      res,
      {
        id: result.insertId,
        naam,
        type: type || "stage",
        is_verplicht: isVerplicht ?? is_verplicht ? 1 : 0,
        status: "actief"
      },
      "Documenttype aangemaakt"
    );
  } catch (error) {
    return fail(res, 500, "Documenttype aanmaken mislukt", error.message);
  }
}

module.exports = { getSettings, updateStageRule, updateDocumentType, createDocumentType };
