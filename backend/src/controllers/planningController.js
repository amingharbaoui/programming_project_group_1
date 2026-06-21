const db = require("../config/db");
const { ok, fail } = require("../utils/response");
const { meld } = require("../utils/notify");

function getUserId(req) {
  return Number(req.user?.id);
}

function normalizeDateTime(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 19).replace("T", " ");
    }
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 19);
    }
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

async function getDocentDossier(dossierId, docentId) {
  const [rows] = await db.query(
    `
    SELECT id, student_id, mentor_id, stagebegeleider_id, status
    FROM stagedossiers
    WHERE id = ? AND stagebegeleider_id = ?
    LIMIT 1
    `,
    [dossierId, docentId]
  );
  return rows[0] || null;
}

async function getMentorDossierByPlanning(planningId, mentorId) {
  const [rows] = await db.query(
    `
    SELECT pm.id AS planning_id, pm.stagedossier_id, pm.status AS planning_status, pm.type AS planning_type,
           sd.student_id, sd.mentor_id, sd.stagebegeleider_id, sd.status AS dossier_status
    FROM planning_momenten pm
    JOIN stagedossiers sd ON sd.id = pm.stagedossier_id
    WHERE pm.id = ? AND sd.mentor_id = ?
    LIMIT 1
    `,
    [planningId, mentorId]
  );
  return rows[0] || null;
}

async function listDocentPlanning(req, res) {
  const docentId = getUserId(req);

  try {
    const [rows] = await db.query(
      `
      SELECT
        pm.*,
        DATE_FORMAT(pm.gepland_op, '%Y-%m-%dT%H:%i:%s') AS gepland_op,
        sd.dossiernummer,
        sd.student_id,
        sd.mentor_id,
        CONCAT(gs.voornaam, ' ', gs.achternaam) AS student_naam,
        CONCAT(gm.voornaam, ' ', gm.achternaam) AS mentor_naam,
        b.naam AS bedrijf_naam
      FROM planning_momenten pm
      JOIN stagedossiers sd ON sd.id = pm.stagedossier_id
      JOIN gebruikers gs ON gs.id = sd.student_id
      LEFT JOIN gebruikers gm ON gm.id = sd.mentor_id
      JOIN bedrijven b ON b.id = sd.bedrijf_id
      WHERE sd.stagebegeleider_id = ?
      ORDER BY pm.gepland_op IS NULL, pm.gepland_op ASC, pm.id DESC
      `,
      [docentId]
    );

    return ok(res, rows, "Planning opgehaald");
  } catch (error) {
    console.error("listDocentPlanning error:", error);
    return fail(res, 500, "Planning ophalen mislukt", error.message);
  }
}

async function createPlanningMoment(req, res, type) {
  const docentId = getUserId(req);
  const { dossierId, stagedossierId, geplandOp, datum, locatie, verslag, deelnemers } = req.body;
  const dossierIdFinal = Number(dossierId || stagedossierId);
  const geplandOpFinal = normalizeDateTime(geplandOp || datum);

  if (!dossierIdFinal) return fail(res, 400, "Dossier is verplicht");
  if (!geplandOpFinal) return fail(res, 400, "Geldig tijdstip is verplicht");

  try {
    const dossier = await getDocentDossier(dossierIdFinal, docentId);
    if (!dossier) return fail(res, 403, "Geen toegang tot dit dossier");
    // Planning is pas zinvol zodra de stage geregistreerd is (niet in de contract-/controlefase),
    // en niet meer nadat het dossier is vrijgegeven/afgerond.
    if (!["geregistreerd", "actief", "stage_loopt"].includes(dossier.status)) {
      return fail(res, 409, "Planning kan enkel zolang de stage geregistreerd is of loopt");
    }
    // Zonder gekoppelde mentor kan een moment niet bevestigd worden (de mentor krijgt de melding) — blokkeer
    // dan het inplannen i.p.v. een stille planning zonder bevestiging te laten ontstaan (459).
    if (!dossier.mentor_id) {
      return fail(res, 409, "Koppel eerst een mentor aan dit dossier voor je een moment inplant");
    }
    // 475: per type maximaal één actief moment. Een nieuw moment aanmaken naast een nog lopend/bevestigd moment
    // maakt de finale gates onvoorspelbaar — herplannen gebeurt via wijzigen, niet via een tweede rij.
    const [actief] = await db.query(
      `SELECT COUNT(*) AS aantal FROM planning_momenten
       WHERE stagedossier_id = ? AND type = ? AND status IN ('voorgesteld', 'gepland', 'bevestigd', 'alternatief_gevraagd')`,
      [dossierIdFinal, type]
    );
    if (actief[0].aantal > 0) {
      const label = type === "bedrijfsbezoek" ? "bedrijfsbezoek" : "eindpresentatie";
      return fail(res, 409, `Er is al een actief ${label} ingepland; pas dat moment aan of annuleer het eerst.`);
    }
    // 499: een eindpresentatie kan pas gepland worden nadat het bedrijfsbezoek heeft plaatsgevonden én de
    // tussentijdse evaluatie geregistreerd is — eerst de tussentijdse fase, dan pas de eindfase.
    if (type === "eindpresentatie") {
      const [[bezoek]] = await db.query(
        "SELECT COUNT(*) AS aantal FROM planning_momenten WHERE stagedossier_id = ? AND type = 'bedrijfsbezoek' AND status = 'geweest'",
        [dossierIdFinal]
      );
      const [[tussentijds]] = await db.query(
        "SELECT COUNT(*) AS aantal FROM evaluaties WHERE stagedossier_id = ? AND type = 'tussentijds' AND status IN ('geregistreerd', 'vrijgegeven')",
        [dossierIdFinal]
      );
      if (bezoek.aantal === 0 || tussentijds.aantal === 0) {
        return fail(res, 409, "Plan eerst het bedrijfsbezoek en registreer de tussentijdse evaluatie voor je een eindpresentatie inplant");
      }
    }

    // 477: ook een eindpresentatie start als 'voorgesteld' (niet 'gepland'), zodat de student ze pas ziet
    // nadat de mentor bevestigd heeft — net als het bedrijfsbezoek.
    const status = "voorgesteld";
    const [result] = await db.query(
      `
      INSERT INTO planning_momenten
        (stagedossier_id, type, status, gepland_op, locatie, voorgesteld_door_id, verslag, deelnemers, aangemaakt_op, aangepast_op)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `,
      [dossierIdFinal, type, status, geplandOpFinal, locatie || null, docentId, verslag || null, deelnemers || null]
    );

    const planningId = result.insertId;
    // Flow (prototype): bij het inplannen krijgt ENKEL de mentor een melding om te bevestigen of een ander
    // moment voor te stellen. De student wordt pas verwittigd zodra het moment goedgekeurd is (confirmMentorPlanning).
    const typeLabel = type === "bedrijfsbezoek" ? "bedrijfsbezoek" : "eindpresentatie";
    if (dossier.mentor_id) {
      await meld(dossier.mentor_id, {
        titel: type === "bedrijfsbezoek" ? "Bedrijfsbezoek voorgesteld" : "Eindpresentatie voorgesteld",
        bericht: `De docent stelde een ${typeLabel} voor. Bevestig het moment of stel een ander moment/uur/plaats voor.`,
        aangemaaktDoorId: docentId,
        stagedossierId: dossierIdFinal
      });
    }

    return ok(res, { id: planningId, status, type }, "Planningmoment aangemaakt");
  } catch (error) {
    console.error("createPlanningMoment error:", error);
    return fail(res, 500, "Planningmoment aanmaken mislukt", error.message);
  }
}

async function createVisit(req, res) {
  return createPlanningMoment(req, res, "bedrijfsbezoek");
}

async function createPresentation(req, res) {
  return createPlanningMoment(req, res, "eindpresentatie");
}

async function updateDocentPlanning(req, res) {
  const docentId = getUserId(req);
  const planningId = Number(req.params.id);
  const { geplandOp, datum, locatie, status, verslag, deelnemers } = req.body;
  const geplandOpFinal = normalizeDateTime(geplandOp || datum);

  if (!planningId) return fail(res, 400, "Ongeldig planning-id");

  const allowedStatuses = ["voorgesteld", "bevestigd", "alternatief_gevraagd", "gepland", "gegeven", "geweest", "geannuleerd"];
  if (status && !allowedStatuses.includes(status)) return fail(res, 400, "Ongeldige planningstatus");

  // Altijd de huidige status + dossierfase ophalen — ook bij louter inhoudelijke wijzigingen
  // (datum/locatie/verslag/deelnemers), zodat een afgesloten moment of afgerond dossier niet
  // stilletjes nog aangepast kan worden.
  const [huidig] = await db.query(
    `SELECT pm.status, pm.type, pm.gepland_op, (pm.gepland_op > NOW()) AS in_de_toekomst, sd.status AS dossier_status
     FROM planning_momenten pm
     JOIN stagedossiers sd ON sd.id = pm.stagedossier_id
     WHERE pm.id = ? AND sd.stagebegeleider_id = ? LIMIT 1`,
    [planningId, docentId]
  );
  if (huidig.length === 0) return fail(res, 403, "Geen toegang tot dit planningmoment");
  const huidigeStatus = huidig[0].status;

  // Eindfase van het dossier: planning is historisch en read-only.
  if (["resultaat_vrijgegeven", "afgerond"].includes(huidig[0].dossier_status)) {
    return fail(res, 409, "Het dossier is afgerond; planning kan niet meer gewijzigd worden");
  }

  const wijzigtDatumLocatieDeelnemers =
    Boolean(geplandOp || datum) || locatie !== undefined || deelnemers !== undefined;

  // Een geannuleerd moment niet heropenen of inhoudelijk wijzigen.
  if (huidigeStatus === "geannuleerd" && status !== "geannuleerd") {
    return fail(res, 409, "Een geannuleerd moment kan niet opnieuw geactiveerd of gewijzigd worden");
  }
  // Een moment dat al heeft plaatsgevonden: enkel het verslag mag nog, geen datum/locatie/deelnemers.
  if (["gegeven", "geweest"].includes(huidigeStatus) && wijzigtDatumLocatieDeelnemers) {
    return fail(res, 409, "Dit moment heeft al plaatsgevonden; enkel het verslag kan nog aangepast worden");
  }
  // Overgangscontrole: "gegeven/geweest" alleen vanuit een logische status.
  if (status && ["gegeven", "geweest"].includes(status) && !["bevestigd", "gepland"].includes(huidigeStatus)) {
    return fail(res, 409, "Dit moment kan niet als gegeven/geweest gemarkeerd worden vanuit de huidige status");
  }
  // 473: een moment dat nog in de toekomst ligt kan niet al als gegeven/geweest gemarkeerd worden.
  if (status && ["gegeven", "geweest"].includes(status) && Number(huidig[0].in_de_toekomst) === 1) {
    return fail(res, 409, "Dit moment ligt nog in de toekomst en kan pas als gegeven/geweest gemarkeerd worden nadat het heeft plaatsgevonden");
  }

  const fields = [];
  const values = [];
  if (geplandOp || datum) {
    if (!geplandOpFinal) return fail(res, 400, "Geldig tijdstip is verplicht");
    fields.push("pm.gepland_op = ?");
    values.push(geplandOpFinal);
  }
  if (locatie !== undefined) {
    fields.push("pm.locatie = ?");
    values.push(locatie || null);
  }
  if (status) {
    fields.push("pm.status = ?");
    values.push(status);
  }
  // 480: accepteert de docent het mentor-alternatief, dan wordt dat voorgestelde moment het officiële.
  const accepteertAlternatief = status === "bevestigd" && huidigeStatus === "alternatief_gevraagd";
  if (accepteertAlternatief) {
    fields.push("pm.gepland_op = COALESCE(pm.alternatief_gepland_op, pm.gepland_op)");
    fields.push("pm.locatie = COALESCE(pm.alternatief_locatie, pm.locatie)");
    fields.push("pm.alternatief_gepland_op = NULL");
    fields.push("pm.alternatief_locatie = NULL");
    fields.push("pm.alternatief_voorstel = NULL");
  }
  if (verslag !== undefined) {
    fields.push("pm.verslag = ?");
    values.push(verslag || null);
  }
  if (deelnemers !== undefined) {
    fields.push("pm.deelnemers = ?");
    values.push(deelnemers || null);
  }

  if (fields.length === 0) return fail(res, 400, "Geen wijzigingen meegegeven");

  const runUpdate = (setFields) => db.query(
    `UPDATE planning_momenten pm
     JOIN stagedossiers sd ON sd.id = pm.stagedossier_id
     SET ${setFields.join(", ")}, pm.aangepast_op = NOW()
     WHERE pm.id = ? AND sd.stagebegeleider_id = ? AND pm.status = ?`,
    [...values, planningId, docentId, huidigeStatus]
  );

  try {
    // Optimistische concurrency: enkel updaten als de status nog gelijk is aan wat we net lazen (393).
    let result;
    try {
      [result] = await runUpdate(fields);
    } catch (kolomError) {
      if (kolomError.code !== "ER_BAD_FIELD_ERROR") throw kolomError;
      // patch_planning_alternatief.sql nog niet uitgevoerd → de alternatief-kopieervelden weglaten.
      [result] = await runUpdate(fields.filter((f) => !f.includes("alternatief")));
    }

    if (result.affectedRows === 0) return fail(res, 409, "Dit planningmoment is ondertussen gewijzigd; vernieuw de pagina");

    // 488: de student krijgt enkel een melding bij een bevestigd/afgehandeld moment (niet bij elke tussentijdse
    // wijziging tijdens de docent↔mentor-loop). De mentor wordt wel van wijzigingen op de hoogte gehouden.
    try {
      const [info] = await db.query(
        `SELECT pm.type, pm.status, pm.stagedossier_id, sd.student_id, sd.mentor_id
         FROM planning_momenten pm JOIN stagedossiers sd ON sd.id = pm.stagedossier_id
         WHERE pm.id = ? LIMIT 1`,
        [planningId]
      );
      const moment = info[0];
      if (moment) {
        const label = moment.type === "eindpresentatie" ? "de eindpresentatie" : "het bedrijfsbezoek";
        const studentMag = ["bevestigd", "gegeven", "geweest"].includes(moment.status);
        const ontvangers = [moment.mentor_id, ...(studentMag ? [moment.student_id] : [])].filter(Boolean);
        for (const ontvangerId of ontvangers) {
          await meld(ontvangerId, {
            titel: moment.status === "bevestigd" ? "Planningmoment bevestigd" : "Planning bijgewerkt",
            bericht: moment.status === "bevestigd"
              ? `${label[0].toUpperCase() + label.slice(1)} is bevestigd.`
              : `De docent heeft ${label} bijgewerkt.`,
            aangemaaktDoorId: docentId,
            stagedossierId: moment.stagedossier_id
          });
        }
      }
    } catch (notifyError) {
      console.error("Melding planning bijwerken mislukt:", notifyError.message);
    }

    return ok(res, { id: planningId }, "Planningmoment bijgewerkt");
  } catch (error) {
    console.error("updateDocentPlanning error:", error);
    return fail(res, 500, "Planningmoment bijwerken mislukt", error.message);
  }
}

async function confirmMentorPlanning(req, res) {
  const mentorId = getUserId(req);
  const planningId = Number(req.params.id);
  if (!planningId) return fail(res, 400, "Ongeldig planning-id");

  try {
    const dossier = await getMentorDossierByPlanning(planningId, mentorId);
    if (!dossier) return fail(res, 403, "Geen toegang tot dit planningmoment");
    if (["resultaat_vrijgegeven", "afgerond"].includes(dossier.dossier_status)) return fail(res, 409, "Het dossier is afgerond; planning kan niet meer gewijzigd worden");
    if (!["bedrijfsbezoek", "eindpresentatie"].includes(dossier.planning_type)) return fail(res, 409, "Dit moment kan niet door de mentor behandeld worden");
    if (!["voorgesteld", "gepland"].includes(dossier.planning_status)) return fail(res, 409, "Dit moment kan in de huidige status niet meer aangepast worden");
    const isPresentatie = dossier.planning_type === "eindpresentatie";

    // Conditioneel op de status zodat een dubbelklik of een gelijktijdige docentwijziging niet overschrijft (393).
    const [bevestigResult] = await db.query(
      `
      UPDATE planning_momenten
      SET status = 'bevestigd', bevestigd_door_id = ?, alternatief_voorstel = NULL, aangepast_op = NOW()
      WHERE id = ? AND status IN ('voorgesteld', 'gepland')
      `,
      [mentorId, planningId]
    );
    if (bevestigResult.affectedRows === 0) return fail(res, 409, "Dit planningmoment is ondertussen gewijzigd; vernieuw de pagina");

    await meld(dossier.stagebegeleider_id, {
      titel: isPresentatie ? "Eindpresentatie bevestigd" : "Bedrijfsbezoek bevestigd",
      bericht: isPresentatie ? "De mentor heeft de voorgestelde eindpresentatie bevestigd." : "De mentor heeft het voorgestelde bedrijfsbezoek bevestigd.",
      aangemaaktDoorId: mentorId,
      stagedossierId: dossier.stagedossier_id
    });
    if (dossier.student_id) {
      // Pas nu (na goedkeuring) krijgt de student bericht, inclusief de deadline voor de zelf-evaluatie:
      // tot uiterlijk 1 week vóór het moment, anders telt die als 0 (flow/prototype).
      await meld(dossier.student_id, {
        titel: isPresentatie ? "Eindpresentatie bevestigd" : "Bedrijfsbezoek bevestigd",
        bericht: isPresentatie
          ? "Je eindpresentatie is bevestigd. Vul je finale zelf-evaluatie in tot uiterlijk 1 week vóór de presentatie — niet ingevuld telt als 0."
          : "Het bedrijfsbezoek is bevestigd. Vul je tussentijdse zelf-evaluatie in tot uiterlijk 1 week vóór het bezoek — niet ingevuld telt als 0.",
        aangemaaktDoorId: mentorId,
        stagedossierId: dossier.stagedossier_id
      });
    }

    return ok(res, { id: planningId, status: "bevestigd" }, "Planningmoment bevestigd");
  } catch (error) {
    console.error("confirmMentorPlanning error:", error);
    return fail(res, 500, "Planningmoment bevestigen mislukt", error.message);
  }
}

async function proposeAlternative(req, res) {
  const mentorId = getUserId(req);
  const planningId = Number(req.params.id);
  const { alternatief, reden, bericht, geplandOp, datum, locatie } = req.body;
  const tekst = alternatief || reden || bericht;
  const geplandOpFinal = normalizeDateTime(geplandOp || datum);

  if (!planningId) return fail(res, 400, "Ongeldig planning-id");
  if (!tekst || !String(tekst).trim()) return fail(res, 400, "Een bericht is verplicht bij een alternatief voorstel");

  try {
    const dossier = await getMentorDossierByPlanning(planningId, mentorId);
    if (!dossier) return fail(res, 403, "Geen toegang tot dit planningmoment");
    if (["resultaat_vrijgegeven", "afgerond"].includes(dossier.dossier_status)) return fail(res, 409, "Het dossier is afgerond; planning kan niet meer gewijzigd worden");
    if (!["bedrijfsbezoek", "eindpresentatie"].includes(dossier.planning_type)) return fail(res, 409, "Dit moment kan niet door de mentor behandeld worden");
    if (!["voorgesteld", "gepland"].includes(dossier.planning_status)) return fail(res, 409, "Dit moment kan in de huidige status niet meer aangepast worden");
    const isPresentatie = dossier.planning_type === "eindpresentatie";

    // 479: het alternatief apart bewaren — de officiële gepland_op/locatie wijzigt pas als de docent accepteert.
    // Conditioneel op de status zodat een dubbelklik of een gelijktijdige docentwijziging niet overschrijft (393).
    let altResult;
    try {
      [altResult] = await db.query(
        `UPDATE planning_momenten
         SET status = 'alternatief_gevraagd', alternatief_voorstel = ?, alternatief_gepland_op = ?,
             alternatief_locatie = ?, bevestigd_door_id = ?, aangepast_op = NOW()
         WHERE id = ? AND status IN ('voorgesteld', 'gepland')`,
        [tekst || null, geplandOpFinal, locatie || null, mentorId, planningId]
      );
    } catch (kolomError) {
      if (kolomError.code !== "ER_BAD_FIELD_ERROR") throw kolomError;
      // patch_planning_alternatief.sql nog niet uitgevoerd → enkel de tekst bewaren, officieel moment ongemoeid.
      [altResult] = await db.query(
        `UPDATE planning_momenten
         SET status = 'alternatief_gevraagd', alternatief_voorstel = ?, bevestigd_door_id = ?, aangepast_op = NOW()
         WHERE id = ? AND status IN ('voorgesteld', 'gepland')`,
        [tekst || null, mentorId, planningId]
      );
    }
    if (altResult.affectedRows === 0) return fail(res, 409, "Dit planningmoment is ondertussen gewijzigd; vernieuw de pagina");

    const altLabel = isPresentatie ? "de eindpresentatie" : "het bedrijfsbezoek";
    await meld(dossier.stagebegeleider_id, {
      titel: isPresentatie ? "Alternatief presentatiemoment voorgesteld" : "Alternatief bezoekmoment voorgesteld",
      bericht: `De mentor heeft een alternatief moment voorgesteld voor ${altLabel}. Plan het opnieuw in of bevestig.`,
      aangemaaktDoorId: mentorId,
      stagedossierId: dossier.stagedossier_id
    });
    // Tijdens de planning-loop krijgt de student nog geen melding (pas na goedkeuring, in confirmMentorPlanning).

    return ok(res, { id: planningId, status: "alternatief_gevraagd" }, "Alternatief voorgesteld");
  } catch (error) {
    console.error("proposeAlternative error:", error);
    return fail(res, 500, "Alternatief voorstellen mislukt", error.message);
  }
}

async function listMentorPlanning(req, res) {
  const mentorId = getUserId(req);
  const dossierId = req.params.dossierId ? Number(req.params.dossierId) : null;

  try {
    const params = [mentorId];
    let dossierFilter = "";
    if (dossierId) {
      dossierFilter = "AND pm.stagedossier_id = ?";
      params.push(dossierId);
    }

    const [rows] = await db.query(
      `
      SELECT
        pm.*,
        DATE_FORMAT(pm.gepland_op, '%Y-%m-%dT%H:%i:%s') AS gepland_op,
        sd.dossiernummer,
        sd.student_id,
        CONCAT(gs.voornaam, ' ', gs.achternaam) AS student_naam,
        CONCAT(gd.voornaam, ' ', gd.achternaam) AS docent_naam,
        b.naam AS bedrijf_naam
      FROM planning_momenten pm
      JOIN stagedossiers sd ON sd.id = pm.stagedossier_id
      JOIN gebruikers gs ON gs.id = sd.student_id
      JOIN gebruikers gd ON gd.id = sd.stagebegeleider_id
      JOIN bedrijven b ON b.id = sd.bedrijf_id
      WHERE sd.mentor_id = ? ${dossierFilter}
      ORDER BY pm.gepland_op IS NULL, pm.gepland_op ASC, pm.id DESC
      `,
      params
    );

    return ok(res, rows, "Mentorplanning opgehaald");
  } catch (error) {
    console.error("listMentorPlanning error:", error);
    return fail(res, 500, "Mentorplanning ophalen mislukt", error.message);
  }
}

async function listMyPlanning(req, res) {
  const userId = getUserId(req);
  const role = req.user?.hoofdrol;

  const roleWhere = {
    student: "sd.student_id = ?",
    mentor: "sd.mentor_id = ?",
    docent: "sd.stagebegeleider_id = ?",
    administratie: "1 = ?"
  }[role];

  if (!roleWhere) return fail(res, 403, "Geen planning voor deze rol");

  // De student ziet pas een moment nadat het goedgekeurd is — onbevestigde voorstellen blijven verborgen
  // tot mentor/docent akkoord zijn (zelfde flow als de meldingen).
  const statusFilter = role === "student" ? " AND pm.status IN ('bevestigd', 'gegeven', 'geweest')" : "";

  try {
    const [rows] = await db.query(
      `
      SELECT
        pm.*,
        DATE_FORMAT(pm.gepland_op, '%Y-%m-%dT%H:%i:%s') AS gepland_op,
        sd.dossiernummer,
        sd.student_id,
        sd.mentor_id,
        sd.stagebegeleider_id,
        CONCAT(gs.voornaam, ' ', gs.achternaam) AS student_naam,
        CONCAT(gm.voornaam, ' ', gm.achternaam) AS mentor_naam,
        CONCAT(gd.voornaam, ' ', gd.achternaam) AS docent_naam,
        b.naam AS bedrijf_naam
      FROM planning_momenten pm
      JOIN stagedossiers sd ON sd.id = pm.stagedossier_id
      JOIN gebruikers gs ON gs.id = sd.student_id
      LEFT JOIN gebruikers gm ON gm.id = sd.mentor_id
      LEFT JOIN gebruikers gd ON gd.id = sd.stagebegeleider_id
      JOIN bedrijven b ON b.id = sd.bedrijf_id
      WHERE ${roleWhere}${statusFilter}
      ORDER BY pm.gepland_op IS NULL, pm.gepland_op ASC, pm.id DESC
      `,
      [role === "administratie" ? 1 : userId]
    );

    return ok(res, rows, "Mijn planning opgehaald");
  } catch (error) {
    console.error("listMyPlanning error:", error);
    return fail(res, 500, "Mijn planning ophalen mislukt", error.message);
  }
}

module.exports = {
  listMyPlanning,
  listDocentPlanning,
  createVisit,
  createPresentation,
  updateDocentPlanning,
  listMentorPlanning,
  confirmMentorPlanning,
  proposeAlternative
};
