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

    // Dossiers hangen niet met een FK aan een profiel, maar via opleiding + academiejaar.
    let aantalDossiers = 0;
    if (profielen[0]) {
      const [telling] = await db.query(
        "SELECT COUNT(*) AS aantal FROM stagedossiers WHERE opleiding = ? AND academiejaar = ?",
        [profielen[0].opleiding, profielen[0].academiejaar]
      );
      aantalDossiers = telling[0]?.aantal || 0;
    }

    return ok(
      res,
      { profiel: profielen[0] || null, competenties, totaalGewicht, aantalDossiers },
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

  // Een actief profiel is read-only zodat lopende evaluaties niet stilzwijgend wijzigen — bewerk een concept-versie.
  const [prof] = await db.query(
    `SELECT p.status FROM competenties c JOIN competentie_profielen p ON p.id = c.competentie_profiel_id WHERE c.id = ? LIMIT 1`,
    [id]
  );
  if (prof.length === 0) return fail(res, 404, "Competentie niet gevonden");
  if (prof[0].status === "actief") {
    return fail(res, 409, "Een actief competentieprofiel is read-only; dupliceer het en pas de nieuwe versie aan");
  }

  const { naam, beschrijving, gewichtPercentage, gewicht_percentage, volgorde, isActief, is_actief } = req.body;

  const fields = [];
  const values = [];

  if (naam !== undefined) { fields.push("naam = ?"); values.push(String(naam).trim()); }
  if (beschrijving !== undefined) { fields.push("beschrijving = ?"); values.push(beschrijving || null); }
  if (gewichtPercentage !== undefined || gewicht_percentage !== undefined) {
    const g = Number(gewichtPercentage ?? gewicht_percentage);
    if (!Number.isFinite(g) || g < 0 || g > 100) {
      return fail(res, 400, "Gewicht moet een getal tussen 0 en 100 zijn");
    }
    fields.push("gewicht_percentage = ?");
    values.push(g);
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

  // Een actief profiel is read-only — verwijderen mag enkel op een concept-versie.
  const [prof] = await db.query(
    `SELECT p.status FROM competenties c JOIN competentie_profielen p ON p.id = c.competentie_profiel_id WHERE c.id = ? LIMIT 1`,
    [id]
  );
  if (prof.length === 0) return fail(res, 404, "Competentie niet gevonden");
  if (prof[0].status === "actief") {
    return fail(res, 409, "Een actief competentieprofiel is read-only; dupliceer het en pas de nieuwe versie aan");
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


const DEFAULT_COMPETENTIES = [
  { code: "LO1",  naam: "Beheersing van het planningsproces",          beschrijving: "De student plant en stuurt het eigen werkproces.",                          gewicht: 9.00,  volgorde: 1  },
  { code: "LO2",  naam: "Ontwerpen van IT-oplossingen",                beschrijving: "De student analyseert en ontwerpt passende IT-oplossingen.",               gewicht: 11.00, volgorde: 2  },
  { code: "LO3",  naam: "Implementatie van digitale producten",        beschrijving: "De student bouwt en test digitale producten.",                              gewicht: 12.00, volgorde: 3  },
  { code: "LO4",  naam: "Integratie van technologie en infrastructuur",beschrijving: "De student integreert systemen en infrastructuur.",                         gewicht: 8.00,  volgorde: 4  },
  { code: "LO5",  naam: "Onderzoekende houding",                       beschrijving: "De student verkent nieuwe technologieën en onderbouwt keuzes.",             gewicht: 9.00,  volgorde: 5  },
  { code: "LO6",  naam: "Helder en transparant communiceren",          beschrijving: "De student communiceert duidelijk met mentor en docent.",                   gewicht: 10.00, volgorde: 6  },
  { code: "LO7",  naam: "Probleemoplossend vermogen",                  beschrijving: "De student analyseert problemen en werkt naar een oplossing.",              gewicht: 11.00, volgorde: 7  },
  { code: "LO8",  naam: "Persoonlijke ontwikkeling",                   beschrijving: "De student reflecteert op eigen functioneren.",                             gewicht: 9.00,  volgorde: 8  },
  { code: "LO9",  naam: "Professionele attitude",                      beschrijving: "De student gedraagt zich professioneel in de bedrijfscontext.",             gewicht: 10.00, volgorde: 9  },
  { code: "LO10", naam: "Ondernemend handelen",                        beschrijving: "De student toont initiatief en draagt actief bij.",                         gewicht: 8.00,  volgorde: 10 },
  { code: "LO11", naam: "Ethisch en deontologisch handelen",           beschrijving: "De student handelt integer en respecteert privacy.",                        gewicht: 3.00,  volgorde: 11 },
];

// Reset profiel volledig: verwijder alle huidige competenties en herstel de 11 standaardcompetenties met standaardgewichten.
async function createNewVersion(req, res) {
  const profielId = Number(req.params.id);
  if (!profielId) return fail(res, 400, "Ongeldig profiel-id");

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Veiligheid: nooit een profiel resetten waarvan al evaluatiescores bestaan — dupliceer dan i.p.v. wissen.
    const [scoreCount] = await conn.query(
      `SELECT COUNT(*) AS aantal FROM competentie_scores cs
       JOIN competenties c ON c.id = cs.competentie_id
       WHERE c.competentie_profiel_id = ?`,
      [profielId]
    );
    if (Number(scoreCount[0].aantal) > 0) {
      await conn.rollback();
      return fail(res, 409, "Dit profiel heeft al evaluaties; gebruik 'dupliceren' om een nieuwe versie te maken");
    }

    // Verwijder alle huidige competenties (scores eerst vanwege FK constraint)
    const [bestaande] = await conn.query(
      "SELECT id FROM competenties WHERE competentie_profiel_id = ?",
      [profielId]
    );
    for (const c of bestaande) {
      await conn.query("DELETE FROM competentie_scores WHERE competentie_id = ?", [c.id]);
    }
    await conn.query(
      "DELETE FROM competenties WHERE competentie_profiel_id = ?",
      [profielId]
    );

    // Voeg de 11 standaardcompetenties opnieuw in
    for (const c of DEFAULT_COMPETENTIES) {
      await conn.query(
        `INSERT INTO competenties
          (competentie_profiel_id, code, naam, beschrijving, gewicht_percentage, volgorde, is_actief, aangemaakt_op, aangepast_op)
         VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
        [profielId, c.code, c.naam, c.beschrijving, c.gewicht, c.volgorde]
      );
    }

    // Zet profiel terug op concept
    await conn.query(
      "UPDATE competentie_profielen SET status = 'concept', aangepast_op = NOW() WHERE id = ?",
      [profielId]
    );

    await conn.commit();
    return ok(res, { id: profielId }, "Profiel volledig gereset naar standaard");
  } catch (error) {
    await conn.rollback();
    return fail(res, 500, "Reset mislukt", error.message);
  } finally {
    conn.release();
  }
}

// Maakt een nieuwe (concept-)versie van een profiel met een kopie van alle competenties.
// Wordt gebruikt door "Nieuwe versie maken" en "Dupliceren".
async function duplicateProfile(req, res) {
  const bronId = Number(req.params.id);

  if (!bronId) {
    return fail(res, 400, "Ongeldig profiel-id");
  }

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [bronnen] = await conn.query(
      "SELECT * FROM competentie_profielen WHERE id = ? LIMIT 1",
      [bronId]
    );
    const bron = bronnen[0];

    if (!bron) {
      await conn.rollback();
      return fail(res, 404, "Bronprofiel niet gevonden");
    }

    // Volgnummer bepalen voor de nieuwe versie binnen opleiding + academiejaar.
    const [telling] = await conn.query(
      "SELECT COUNT(*) AS aantal FROM competentie_profielen WHERE opleiding = ? AND academiejaar = ?",
      [bron.opleiding, bron.academiejaar]
    );
    const nieuweVersie = `v${(telling[0]?.aantal || 1) + 1}.0`;

    const [result] = await conn.query(
      `
      INSERT INTO competentie_profielen
        (opleiding, academiejaar, naam, versie, status, aangemaakt_door_id, aangemaakt_op, aangepast_op)
      VALUES (?, ?, ?, ?, 'concept', ?, NOW(), NOW())
      `,
      [bron.opleiding, bron.academiejaar, bron.naam, nieuweVersie, getUserId(req)]
    );

    const nieuwId = result.insertId;

    // Alle competenties van het bronprofiel mee kopiëren.
    await conn.query(
      `
      INSERT INTO competenties
        (competentie_profiel_id, code, naam, beschrijving, gewicht_percentage, volgorde, is_actief, aangemaakt_op, aangepast_op)
      SELECT ?, code, naam, beschrijving, gewicht_percentage, volgorde, is_actief, NOW(), NOW()
      FROM competenties
      WHERE competentie_profiel_id = ?
      `,
      [nieuwId, bronId]
    );

    await conn.commit();

    return ok(res, { id: nieuwId, versie: nieuweVersie, status: "concept" }, "Nieuwe profielversie aangemaakt");
  } catch (error) {
    await conn.rollback();
    if (error.code === "ER_DUP_ENTRY") {
      return fail(res, 409, "Er bestaat al een profielversie met dit versienummer");
    }
    return fail(res, 500, "Nieuwe versie aanmaken mislukt", error.message);
  } finally {
    conn.release();
  }
}

// Zet een profiel op gearchiveerd.
async function archiveProfile(req, res) {
  const profielId = Number(req.params.id);

  if (!profielId) {
    return fail(res, 400, "Ongeldig profiel-id");
  }

  try {
    // Het enige actieve profiel niet archiveren — anders vallen evaluaties zonder actieve competenties.
    const [[huidig]] = await db.query("SELECT status FROM competentie_profielen WHERE id = ? LIMIT 1", [profielId]);
    if (!huidig) return fail(res, 404, "Profiel niet gevonden");
    if (huidig.status === "actief") {
      const [[telling]] = await db.query("SELECT COUNT(*) AS aantal FROM competentie_profielen WHERE status = 'actief'");
      if (Number(telling.aantal) <= 1) {
        return fail(res, 409, "Je kan het enige actieve competentieprofiel niet archiveren; publiceer eerst een ander profiel");
      }
    }

    const [result] = await db.query(
      "UPDATE competentie_profielen SET status = 'gearchiveerd', aangepast_op = NOW() WHERE id = ?",
      [profielId]
    );

    if (result.affectedRows === 0) {
      return fail(res, 404, "Profiel niet gevonden");
    }

    return ok(res, { id: profielId, status: "gearchiveerd" }, "Competentieprofiel gearchiveerd");
  } catch (error) {
    return fail(res, 500, "Profiel archiveren mislukt", error.message);
  }
}

module.exports = {
  listCompetencies,
  createCompetency,
  updateCompetency,
  deleteCompetency,
  publishProfile,
  createNewVersion,
  duplicateProfile,
  archiveProfile,
};
