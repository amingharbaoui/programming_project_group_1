const db = require("../config/db");
const { ok, fail } = require("../utils/response");
const { meld } = require("../utils/notify");

function getUserId(req, fallback = 1) {
  return Number(req.user?.id || req.headers["x-user-id"] || fallback);
}

// GET /mentor/planning/:dossierId
async function getMentorPlanning(req, res) {
  const dossierId = Number(req.params.dossierId);
  const mentorId = getUserId(req, 5);

  if (!dossierId) return fail(res, 400, "dossierId is verplicht");

  try {
    // Controleer of mentor gekoppeld is aan dossier
    const [linked] = await db.query(
      "SELECT id FROM stagedossiers WHERE id = ? AND mentor_id = ? LIMIT 1",
      [dossierId, mentorId]
    );
    if (linked.length === 0) {
      return fail(res, 403, "Mentor is niet gekoppeld aan dit dossier");
    }

    const [momenten] = await db.query(
      `SELECT pm.*,
        vb.voornaam AS voorgesteld_door_naam
       FROM planning_momenten pm
       LEFT JOIN gebruikers vb ON vb.id = pm.voorgesteld_door_id
       WHERE pm.stagedossier_id = ?
       ORDER BY pm.gepland_op ASC`,
      [dossierId]
    );

    return ok(res, momenten, "Planning opgehaald");
  } catch (error) {
    return fail(res, 500, "Planning ophalen mislukt", error.message);
  }
}

// PATCH /mentor/planning/:id/bevestig
async function bevestigBezoek(req, res) {
  const momentId = Number(req.params.id);
  const mentorId = getUserId(req, 5);

  try {
    const [rows] = await db.query(
      `SELECT pm.*, sd.mentor_id, sd.student_id, sd.stagebegeleider_id
       FROM planning_momenten pm
       JOIN stagedossiers sd ON sd.id = pm.stagedossier_id
       WHERE pm.id = ? LIMIT 1`,
      [momentId]
    );

    if (rows.length === 0) return fail(res, 404, "Planning moment niet gevonden");
    const moment = rows[0];

    if (moment.mentor_id !== mentorId) {
      return fail(res, 403, "Je bent niet de mentor van dit dossier");
    }

    await db.query(
      `UPDATE planning_momenten
       SET status = 'bevestigd', bevestigd_door_id = ?, aangepast_op = NOW()
       WHERE id = ?`,
      [mentorId, momentId]
    );

    // Notificeer docent + student
    if (moment.stagebegeleider_id) {
      await meld(moment.stagebegeleider_id, {
        titel: "Bedrijfsbezoek bevestigd door mentor",
        bericht: `De mentor heeft het bedrijfsbezoek bevestigd.`,
        type: "notificatie",
        aangemaaktDoorId: mentorId,
      });
    }
    if (moment.student_id) {
      await meld(moment.student_id, {
        titel: "Bedrijfsbezoek bevestigd",
        bericht: `De mentor heeft het geplande bedrijfsbezoek bevestigd.`,
        type: "notificatie",
        aangemaaktDoorId: mentorId,
      });
    }

    return ok(res, null, "Bedrijfsbezoek bevestigd");
  } catch (error) {
    return fail(res, 500, "Bevestigen mislukt", error.message);
  }
}

// PATCH /mentor/planning/:id/alternatief
async function alternatiefsVoorstel(req, res) {
  const momentId = Number(req.params.id);
  const mentorId = getUserId(req, 5);
  const { bericht } = req.body;

  if (!bericht || !bericht.trim()) {
    return fail(res, 400, "Een bericht is verplicht bij een alternatief voorstel");
  }

  try {
    const [rows] = await db.query(
      `SELECT pm.*, sd.mentor_id, sd.stagebegeleider_id
       FROM planning_momenten pm
       JOIN stagedossiers sd ON sd.id = pm.stagedossier_id
       WHERE pm.id = ? LIMIT 1`,
      [momentId]
    );

    if (rows.length === 0) return fail(res, 404, "Planning moment niet gevonden");
    const moment = rows[0];

    if (moment.mentor_id !== mentorId) {
      return fail(res, 403, "Je bent niet de mentor van dit dossier");
    }

    await db.query(
      `UPDATE planning_momenten
       SET status = 'alternatief_gevraagd', alternatief_voorstel = ?, aangepast_op = NOW()
       WHERE id = ?`,
      [bericht.trim(), momentId]
    );

    // Notificeer docent
    if (moment.stagebegeleider_id) {
      await meld(moment.stagebegeleider_id, {
        titel: "Mentor stelt alternatief bezoekmoment voor",
        bericht: `De mentor past het geplande bedrijfsbezoek niet: "${bericht.trim()}"`,
        type: "notificatie",
        aangemaaktDoorId: mentorId,
      });
    }

    return ok(res, null, "Alternatief voorstel verstuurd");
  } catch (error) {
    return fail(res, 500, "Alternatief voorstel mislukt", error.message);
  }
}

module.exports = {
  getMentorPlanning,
  bevestigBezoek,
  alternatiefsVoorstel,
};
