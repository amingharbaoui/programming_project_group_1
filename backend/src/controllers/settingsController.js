const db = require("../config/db");
const { ok, fail } = require("../utils/response");

// Instellingen ophalen: stageregels (periode/min weken-uren) + documenttypes + checklist items.
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
    let checklistItems = [];
    try {
      const [rows] = await db.query(
        "SELECT id, tekst, volgorde, actief FROM checklist_items ORDER BY volgorde ASC, id ASC"
      );
      checklistItems = rows;
    } catch (_) {
      // tabel bestaat nog niet — patch_checklist_items.sql nog niet uitgevoerd
    }
    return ok(res, { stageRegels, documentSoorten, checklistItems }, "Instellingen opgehaald");
  } catch (error) {
    return fail(res, 500, "Instellingen ophalen mislukt", error.message);
  }
}

// Checklist item aanmaken
async function createChecklistItem(req, res) {
  const { tekst, volgorde } = req.body;
  if (!tekst || !String(tekst).trim()) return fail(res, 400, "Tekst is verplicht");
  try {
    const [r] = await db.query(
      "INSERT INTO checklist_items (tekst, volgorde, actief) VALUES (?, ?, 1)",
      [String(tekst).trim(), Number(volgorde) || 0]
    );
    return ok(res, { id: r.insertId, tekst: String(tekst).trim(), volgorde: Number(volgorde) || 0, actief: 1 }, "Checklist item aangemaakt");
  } catch (error) {
    return fail(res, 500, "Checklist item aanmaken mislukt", error.message);
  }
}

// Checklist item aanpassen (tekst / volgorde / actief)
async function updateChecklistItem(req, res) {
  const id = Number(req.params.id);
  if (!id) return fail(res, 400, "Ongeldig checklist item id");

  const fields = [];
  const vals = [];
  if (req.body.tekst !== undefined) {
    const tekst = String(req.body.tekst).trim();
    if (!tekst) return fail(res, 400, "Tekst mag niet leeg zijn");
    fields.push("tekst = ?"); vals.push(tekst);
  }
  if (req.body.volgorde !== undefined) {
    const volgorde = Number(req.body.volgorde);
    if (!Number.isInteger(volgorde) || volgorde < 0) return fail(res, 400, "Volgorde moet een geheel getal ≥ 0 zijn");
    fields.push("volgorde = ?"); vals.push(volgorde);
  }
  if (req.body.actief !== undefined) { fields.push("actief = ?"); vals.push(req.body.actief ? 1 : 0); }
  if (fields.length === 0) return fail(res, 400, "Geen velden om aan te passen");

  try {
    const [r] = await db.query(
      `UPDATE checklist_items SET ${fields.join(", ")}, aangepast_op = NOW() WHERE id = ?`,
      [...vals, id]
    );
    if (r.affectedRows === 0) return fail(res, 404, "Checklist item niet gevonden");
    return ok(res, { id }, "Checklist item bijgewerkt");
  } catch (error) {
    return fail(res, 500, "Checklist item bijwerken mislukt", error.message);
  }
}

// Checklist items resetten naar standaardwaarden
async function resetChecklistItems(req, res) {
  try {
    await db.query("DELETE FROM checklist_items");
    await db.query(`
      INSERT INTO checklist_items (id, tekst, volgorde, actief) VALUES
      (1, 'IT-gerelateerde opdracht met een ontwikkelcomponent', 1, 1),
      (2, 'Mentor met een technische functie binnen het bedrijf', 2, 1),
      (3, 'Concrete omschrijving: technologie, taken en team', 3, 1),
      (4, 'Stage in een professionele bedrijfsomgeving', 4, 1)
    `);
    return ok(res, {}, "Checklist items gereset naar standaardwaarden");
  } catch (error) {
    return fail(res, 500, "Reset mislukt", error.message);
  }
}

// Checklist item verwijderen
async function deleteChecklistItem(req, res) {
  const id = Number(req.params.id);
  if (!id) return fail(res, 400, "Ongeldig checklist item id");
  try {
    const [r] = await db.query("DELETE FROM checklist_items WHERE id = ?", [id]);
    if (r.affectedRows === 0) return fail(res, 404, "Checklist item niet gevonden");
    return ok(res, { id }, "Checklist item verwijderd");
  } catch (error) {
    return fail(res, 500, "Checklist item verwijderen mislukt", error.message);
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

  // Basisvalidatie zodat er geen onlogische stageperiodes/uren opgeslagen worden.
  const startD = b.stagevensterStart ?? b.stagevenster_start;
  const eindD = b.stagevensterEinde ?? b.stagevenster_einde;
  if (startD && eindD && new Date(startD) > new Date(eindD)) {
    return fail(res, 400, "De startdatum van het stagevenster moet vóór de einddatum liggen");
  }
  const minW = b.minimumWeken ?? b.minimum_weken;
  if (minW !== undefined && minW !== null && (!Number.isFinite(Number(minW)) || Number(minW) < 1 || Number(minW) > 52)) {
    return fail(res, 400, "Minimum aantal weken moet tussen 1 en 52 liggen");
  }
  const minU = b.minimumUren ?? b.minimum_uren;
  if (minU !== undefined && minU !== null && (!Number.isFinite(Number(minU)) || Number(minU) < 1)) {
    return fail(res, 400, "Minimum aantal uren moet een positief getal zijn");
  }
  const stdU = b.standaardUrenPerWeek ?? b.standaard_uren_per_week;
  if (stdU !== undefined && stdU !== null && (!Number.isFinite(Number(stdU)) || Number(stdU) < 1 || Number(stdU) > 60)) {
    return fail(res, 400, "Standaarduren per week moeten tussen 1 en 60 liggen");
  }

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
  if (req.body.naam !== undefined) {
    const naam = String(req.body.naam).trim();
    if (!naam) return fail(res, 400, "Naam mag niet leeg zijn");
    fields.push("naam = ?"); vals.push(naam);
  }
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
  const { type, isVerplicht, is_verplicht, opleiding, academiejaar } = req.body;
  const adminId = Number(req.user?.id);

  const naam = String(req.body.naam ?? "").trim();
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


// Reset documenttypes: verwijder custom types (is_vast=0), herstel vaste types naar seed-defaults.
async function resetDocumentTypes(req, res) {
  try {
    // Nullify FK in documenten for custom types before deleting
    await db.query(
      "UPDATE documenten SET document_soort_id = NULL WHERE document_soort_id IN (SELECT id FROM document_soorten WHERE is_vast = 0)"
    );
    // Delete admin-added types
    await db.query("DELETE FROM document_soorten WHERE is_vast = 0");
    // Restore fixed types to seed defaults (is_verplicht + status)
    await db.query(`
      UPDATE document_soorten SET
        is_verplicht = CASE id WHEN 4 THEN 0 ELSE 1 END,
        status = 'actief',
        aangepast_op = NOW()
      WHERE is_vast = 1
    `);
    return ok(res, {}, "Documenttypes gereset naar standaardwaarden");
  } catch (error) {
    return fail(res, 500, "Reset mislukt", error.message);
  }
}

// Verwijdert een (niet-vast) documenttype. Vaste types blijven; FK in documenten wordt losgemaakt
// (zelfde aanpak als resetDocumentTypes) zodat bestaande documenten de verwijdering niet blokkeren.
async function deleteDocumentType(req, res) {
  const id = Number(req.params.id);
  if (!id) return fail(res, 400, "Ongeldig documenttype-id");
  try {
    const [rows] = await db.query("SELECT is_vast FROM document_soorten WHERE id = ? LIMIT 1", [id]);
    if (rows.length === 0) return fail(res, 404, "Documenttype niet gevonden");
    if (rows[0].is_vast) return fail(res, 409, "Een vast documenttype kan niet verwijderd worden");
    await db.query("UPDATE documenten SET document_soort_id = NULL WHERE document_soort_id = ?", [id]);
    await db.query("DELETE FROM document_soorten WHERE id = ?", [id]);
    return ok(res, { id }, "Documenttype verwijderd");
  } catch (error) {
    return fail(res, 500, "Documenttype verwijderen mislukt", error.message);
  }
}

module.exports = { getSettings, updateStageRule, updateDocumentType, createDocumentType, resetDocumentTypes, deleteDocumentType, createChecklistItem, updateChecklistItem, deleteChecklistItem, resetChecklistItems };
