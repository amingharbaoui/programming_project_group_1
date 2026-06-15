const db = require("../config/db");
const { ok, fail } = require("../utils/response");

function getUserId(req, fallbackId) {
  return Number(req.user?.id || fallbackId);
}

// Zoekt het actieve competentieprofiel, anders het meest recente.
async function resolveProfileId(conn, requestedProfileId) {
  if (requestedProfileId) {
    return Number(requestedProfileId);
  }

  const [rows] = await conn.query(
    `
    SELECT id
    FROM competentie_profielen
    ORDER BY (status = 'actief') DESC, id DESC
    LIMIT 1
    `
  );

  return rows[0]?.id || null;
}

async function listCompetencies(req, res) {
  try {
    const profielId = await resolveProfileId(db, req.query.profielId || req.query.profileId);

    if (!profielId) {
      return ok(res, { profiel: null, competenties: [], totaalGewicht: 0 }, "Geen profiel gevonden");
    }

    const [profielen] = await db.query(
      "SELECT id, opleiding, academiejaar, naam, versie, status FROM competentie_profielen WHERE id = ? LIMIT 1",
      [profielId]
    );

    const [competenties] = await db.query(
      `
      SELECT id, competentie_profiel_id, code, naam, beschrijving, gewicht_percentage, volgorde, is_actief
      FROM competenties
      WHERE competentie_profiel_id = ?
      ORDER BY volgorde ASC, id ASC
      `,
      [profielId]
    );

    const totaalGewicht = competenties
      .filter((c) => c.is_actief)
      .reduce((sum, c) => sum + Number(c.gewicht_percentage || 0), 0);

    return ok(
      res,
      { profiel: profielen[0] || null, competenties, totaalGewicht },
      "Competenties opgehaald"
    );
  } catch (error) {
    return fail(res, 500, "Competenties ophalen mislukt", error.message);
  }
}

async function createCompetency(req, res) {
  const { competentieProfielId, competentie_profiel_id, code, naam, beschrijving, gewichtPercentage, gewicht_percentage, volgorde } = req.body;

  const finalCode = (code || "").trim();
  const finalNaam = (naam || "").trim();
  const finalGewicht = Number(gewichtPercentage ?? gewicht_percentage);

  if (!finalCode || !finalNaam) {
    return fail(res, 400, "Code en naam zijn verplicht");
  }

  if (!Number.isFinite(finalGewicht) || finalGewicht < 0) {
    return fail(res, 400, "Gewicht moet een positief getal zijn");
  }

  try {
    const profielId = await resolveProfileId(db, competentieProfielId || competentie_profiel_id);

    if (!profielId) {
      return fail(res, 404, "Geen competentieprofiel gevonden om aan toe te voegen");
    }

    const [result] = await db.query(
      `
      INSERT INTO competenties
        (competentie_profiel_id, code, naam, beschrijving, gewicht_percentage, volgorde, is_actief, aangemaakt_op, aangepast_op)
      VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
      `,
      [profielId, finalCode, finalNaam, beschrijving || null, finalGewicht, volgorde ?? null]
    );

    return ok(res, { id: result.insertId, competentieProfielId: profielId }, "Competentie aangemaakt");
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return fail(res, 409, "Er bestaat al een competentie met deze code in dit profiel");
    }
    return fail(res, 500, "Competentie aanmaken mislukt", error.message);
  }
}

async function updateCompetency(req, res) {
  const id = Number(req.params.id);

  if (!id) {
    return fail(res, 400, "Ongeldig competentie-id");
  }

  const { naam, beschrijving, gewichtPercentage, gewicht_percentage, volgorde, isActief, is_actief } = req.body;

  const fields = [];
  const values = [];

  if (naam !== undefined) { fields.push("naam = ?"); values.push(String(naam).trim()); }
  if (beschrijving !== undefined) { fields.push("beschrijving = ?"); values.push(beschrijving || null); }
  if (gewichtPercentage !== undefined || gewicht_percentage !== undefined) {
    fields.push("gewicht_percentage = ?");
    values.push(Number(gewichtPercentage ?? gewicht_percentage));
  }
  if (volgorde !== undefined) { fields.push("volgorde = ?"); values.push(volgorde); }
  if (isActief !== undefined || is_actief !== undefined) {
    fields.push("is_actief = ?");
    values.push((isActief ?? is_actief) ? 1 : 0);
  }

  if (fields.length === 0) {
    return fail(res, 400, "Geen velden om aan te passen");
  }

  try {
    const [result] = await db.query(
      `UPDATE competenties SET ${fields.join(", ")}, aangepast_op = NOW() WHERE id = ?`,
      [...values, id]
    );

    if (result.affectedRows === 0) {
      return fail(res, 404, "Competentie niet gevonden");
    }

    return ok(res, { id }, "Competentie aangepast");
  } catch (error) {
    return fail(res, 500, "Competentie aanpassen mislukt", error.message);
  }
}

// Publiceren mag alleen als het totaalgewicht van de actieve competenties exact 100% is.
async function publishProfile(req, res) {
  const profielId = Number(req.params.id);

  if (!profielId) {
    return fail(res, 400, "Ongeldig profiel-id");
  }

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [competenties] = await conn.query(
      "SELECT gewicht_percentage FROM competenties WHERE competentie_profiel_id = ? AND is_actief = 1",
      [profielId]
    );

    if (competenties.length === 0) {
      await conn.rollback();
      return fail(res, 400, "Profiel heeft geen actieve competenties");
    }

    const totaal = competenties.reduce((sum, c) => sum + Number(c.gewicht_percentage || 0), 0);

    if (Math.abs(totaal - 100) > 0.01) {
      await conn.rollback();
      return fail(res, 400, `Totaalgewicht moet 100% zijn (nu ${totaal}%)`);
    }

    // Andere profielen archiveren, dit profiel activeren.
    await conn.query("UPDATE competentie_profielen SET status = 'gearchiveerd', aangepast_op = NOW() WHERE status = 'actief' AND id <> ?", [profielId]);
    await conn.query(
      `
      UPDATE competentie_profielen
      SET status = 'actief', gepubliceerd_door_id = ?, gepubliceerd_op = NOW(), aangepast_op = NOW()
      WHERE id = ?
      `,
      [getUserId(req), profielId]
    );

    await conn.commit();

    return ok(res, { id: profielId, totaalGewicht: totaal }, "Competentieprofiel gepubliceerd");
  } catch (error) {
    await conn.rollback();
    return fail(res, 500, "Profiel publiceren mislukt", error.message);
  } finally {
    conn.release();
  }
}

async function deleteCompetency(req, res) {
  const id = Number(req.params.id);

  if (!id) {
    return fail(res, 400, "Ongeldig competentie-id");
  }

  try {
    const [result] = await db.query(
      "DELETE FROM competenties WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return fail(res, 404, "Competentie niet gevonden");
    }

    return ok(res, { id }, "Competentie verwijderd");
  } catch (error) {
    // FK constraint: competentie heeft nog scores gekoppeld
    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return fail(res, 409, "Competentie kan niet worden verwijderd omdat er scores aan gekoppeld zijn");
    }
    return fail(res, 500, "Competentie verwijderen mislukt", error.message);
  }
}

module.exports = {
  listCompetencies,
  createCompetency,
  updateCompetency,
  deleteCompetency,
  publishProfile
};
