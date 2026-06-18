const crypto = require("crypto");
const db = require("../config/db");
const { ok, fail } = require("../utils/response");

async function getUsers(req, res) {
  try {
    const [users] = await db.query(
      `
      SELECT
        g.id,
        g.voornaam,
        g.achternaam,
        g.email,
        g.hoofdrol,
        g.status,
        g.auth_provider,
        g.laatste_login_op,
        g.aangemaakt_op,
        g.aangepast_op,
        CASE
          WHEN g.hoofdrol = 'student' THEN (
            SELECT sd.dossiernummer
            FROM stagedossiers sd
            WHERE sd.student_id = g.id
            ORDER BY sd.aangemaakt_op DESC
            LIMIT 1
          )
          WHEN g.hoofdrol = 'mentor' THEN (
            SELECT b.naam
            FROM mentoren m
            JOIN bedrijven b ON m.bedrijf_id = b.id
            WHERE m.gebruiker_id = g.id
            LIMIT 1
          )
          WHEN g.hoofdrol = 'docent' THEN (
            SELECT CONCAT('Stagebegeleider van ', s.voornaam, ' ', s.achternaam)
            FROM stagedossiers sd
            JOIN gebruikers s ON sd.student_id = s.id
            WHERE sd.stagebegeleider_id = g.id
            ORDER BY sd.aangemaakt_op DESC
            LIMIT 1
          )
          WHEN g.hoofdrol = 'administratie' THEN 'Beheerder'
          ELSE NULL
        END AS koppeling
      FROM gebruikers g
      ORDER BY g.hoofdrol, g.achternaam, g.voornaam
      `
    );

    return ok(res, users, "Gebruikers opgehaald");
  } catch (error) {
    return fail(res, 500, "Gebruikers ophalen mislukt", error.message);
  }
}

// Gebruiker deactiveren (status -> inactief). Niet jezelf, niet de laatste actieve admin.
async function deactivateUser(req, res) {
  const id = Number(req.params.id);
  const me = Number(req.user?.id);

  if (!id) return fail(res, 400, "Ongeldig gebruikers-id");
  if (id === me) return fail(res, 400, "Je kan je eigen account niet deactiveren");

  try {
    const [rows] = await db.query("SELECT id, hoofdrol, status FROM gebruikers WHERE id = ? LIMIT 1", [id]);
    if (rows.length === 0) return fail(res, 404, "Gebruiker niet gevonden");

    if (rows[0].hoofdrol === "administratie") {
      const [admins] = await db.query(
        "SELECT COUNT(*) AS aantal FROM gebruikers WHERE hoofdrol = 'administratie' AND status = 'actief'"
      );
      if (admins[0].aantal <= 1) return fail(res, 400, "Laatste actieve administratie-account kan niet gedeactiveerd worden");
    }

    await db.query("UPDATE gebruikers SET status = 'inactief', aangepast_op = NOW() WHERE id = ?", [id]);
    return ok(res, { id, status: "inactief" }, "Gebruiker gedeactiveerd");
  } catch (error) {
    return fail(res, 500, "Deactiveren mislukt", error.message);
  }
}

// Gebruiker opnieuw activeren (status -> actief).
async function reactivateUser(req, res) {
  const id = Number(req.params.id);
  if (!id) return fail(res, 400, "Ongeldig gebruikers-id");

  try {
    const [r] = await db.query("UPDATE gebruikers SET status = 'actief', aangepast_op = NOW() WHERE id = ?", [id]);
    if (r.affectedRows === 0) return fail(res, 404, "Gebruiker niet gevonden");
    return ok(res, { id, status: "actief" }, "Gebruiker geactiveerd");
  } catch (error) {
    return fail(res, 500, "Activeren mislukt", error.message);
  }
}

// Gebruiker wijzigen: voornaam, achternaam, email en/of hoofdrol aanpassen.
const GELDIGE_ROLLEN = ["student", "docent", "mentor", "stagecommissie", "administratie"];

async function updateUser(req, res) {
  const id = Number(req.params.id);
  const me = Number(req.user?.id);
  if (!id) return fail(res, 400, "Ongeldig gebruikers-id");

  const { voornaam, achternaam, email, hoofdrol } = req.body;

  if (hoofdrol && !GELDIGE_ROLLEN.includes(hoofdrol)) {
    return fail(res, 400, `Ongeldige rol. Kies uit: ${GELDIGE_ROLLEN.join(", ")}`);
  }

  // Eigen rol mag niet gewijzigd worden
  if (id === me && hoofdrol) {
    return fail(res, 400, "Je kan je eigen rol niet wijzigen");
  }

  const fields = [];
  const values = [];

  if (voornaam !== undefined) { fields.push("voornaam = ?"); values.push(voornaam.trim()); }
  if (achternaam !== undefined) { fields.push("achternaam = ?"); values.push(achternaam.trim()); }
  if (email !== undefined) { fields.push("email = ?"); values.push(email.trim()); }
  if (hoofdrol !== undefined) { fields.push("hoofdrol = ?"); values.push(hoofdrol); }

  if (fields.length === 0) return fail(res, 400, "Geen velden om aan te passen");

  try {
    const [r] = await db.query(
      `UPDATE gebruikers SET ${fields.join(", ")}, aangepast_op = NOW() WHERE id = ?`,
      [...values, id]
    );
    if (r.affectedRows === 0) return fail(res, 404, "Gebruiker niet gevonden");
    return ok(res, { id }, "Gebruiker bijgewerkt");
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return fail(res, 409, "Dit e-mailadres is al in gebruik");
    return fail(res, 500, "Wijzigen mislukt", error.message);
  }
}

// Mentor uitnodigen: maakt een mentor-account (status uitgenodigd) + mentoren-rij + activatielink (demo, geen e-mail).
async function inviteMentor(req, res) {
  const { voornaam, achternaam, email, functie } = req.body;
  let bedrijfId = req.body.bedrijfId ?? req.body.bedrijf_id ?? null;
  const bedrijfNaam = req.body.bedrijfNaam ?? req.body.bedrijf_naam ?? null;

  if (!voornaam || !achternaam || !email) {
    return fail(res, 400, "Voornaam, achternaam en e-mail zijn verplicht");
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [dup] = await conn.query("SELECT id FROM gebruikers WHERE email = ? LIMIT 1", [email]);
    if (dup.length > 0) {
      await conn.rollback();
      return fail(res, 409, "Er bestaat al een gebruiker met dit e-mailadres");
    }

    if (!bedrijfId) {
      if (!bedrijfNaam) {
        await conn.rollback();
        return fail(res, 400, "bedrijfId of bedrijfNaam is verplicht");
      }
      const [b] = await conn.query("INSERT INTO bedrijven (naam, aangemaakt_op, aangepast_op) VALUES (?, NOW(), NOW())", [bedrijfNaam]);
      bedrijfId = b.insertId;
    }

    const [u] = await conn.query(
      `INSERT INTO gebruikers (voornaam, achternaam, email, auth_provider, hoofdrol, status, aangemaakt_op, aangepast_op)
       VALUES (?, ?, ?, 'local', 'mentor', 'uitgenodigd', NOW(), NOW())`,
      [voornaam, achternaam, email]
    );
    const mentorId = u.insertId;

    const token = crypto.randomBytes(24).toString("hex");
    await conn.query(
      `INSERT INTO mentoren (gebruiker_id, bedrijf_id, functie, mag_stageovereenkomst_tekenen, uitnodiging_status, uitnodiging_token, uitnodiging_vervalt_op)
       VALUES (?, ?, ?, 1, 'verstuurd', ?, DATE_ADD(NOW(), INTERVAL 14 DAY))`,
      [mentorId, bedrijfId, functie || "Mentor", token]
    );

    await conn.commit();
    return ok(res, { mentorId, bedrijfId, activatielink: `/activeren?token=${token}` }, "Mentor uitgenodigd");
  } catch (error) {
    await conn.rollback();
    if (error.code === "ER_DUP_ENTRY") return fail(res, 409, "Dubbele invoer");
    return fail(res, 500, "Mentor uitnodigen mislukt", error.message);
  } finally {
    conn.release();
  }
}

module.exports = {
  getUsers,
  updateUser,
  deactivateUser,
  reactivateUser,
  inviteMentor
};
