const db = require("../config/db");

// Maakt een in-app melding aan voor een gebruiker. Faalt nooit hard:
// als het mislukt loggen we het en gaan we door (een melding mag de hoofdactie niet breken).
async function meld(ontvangerId, opts = {}) {
  if (!ontvangerId) return null;

  const {
    titel,
    bericht,
    type = "notificatie",
    ernst = "laag",
    kanaal = "in_app",
    aangemaaktDoorId = null,
    stagevoorstelId = null,
    stagedossierId = null,
    documentId = null,
    logboekWeekId = null
  } = opts;

  try {
    const [r] = await db.query(
      `
      INSERT INTO systeem_meldingen
        (ontvanger_id, aangemaakt_door_id, stagevoorstel_id, stagedossier_id, document_id, logboek_week_id,
         type, ernst, titel, bericht, status, kanaal, aangemaakt_op)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'nieuw', ?, NOW())
      `,
      [
        ontvangerId,
        aangemaaktDoorId,
        stagevoorstelId,
        stagedossierId,
        documentId,
        logboekWeekId,
        type,
        ernst,
        titel || "Melding",
        bericht || "",
        kanaal
      ]
    );
    return r.insertId;
  } catch (error) {
    console.error("meld() mislukt:", error.message);
    return null;
  }
}

module.exports = { meld };
