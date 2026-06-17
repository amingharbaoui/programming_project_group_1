const crypto = require("crypto");
const db = require("../config/db");
const { ok, fail } = require("../utils/response");
const { emailMelding } = require("../utils/notify");

function hashLocalPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.pbkdf2Sync(String(password), salt, 120000, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$120000$${salt}$${derived}`;
}

async function getUsers(req, res) {
  try {
    const [users] = await db.query(
      `
      SELECT
        id,
        voornaam,
        achternaam,
        email,
        hoofdrol,
        status,
        auth_provider,
        laatste_login_op,
        aangemaakt_op,
        aangepast_op
      FROM gebruikers
      ORDER BY hoofdrol, achternaam, voornaam
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

// Mentor uitnodigen: maakt een mentor-account + activatielink en registreert de uitnodiging via het e-mailkanaal.
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

    const activatielink = `/activeren?token=${token}`;
    await emailMelding(mentorId, {
      titel: "Uitnodiging stageplatform",
      bericht: `Je bent uitgenodigd als mentor. Activeer je account via ${activatielink}`,
      type: "herinnering",
      ernst: "medium",
      aangemaaktDoorId: Number(req.user?.id) || null
    });

    return ok(res, { mentorId, bedrijfId, activatielink, emailStatus: "geregistreerd" }, "Mentor uitgenodigd");
  } catch (error) {
    await conn.rollback();
    if (error.code === "ER_DUP_ENTRY") return fail(res, 409, "Dubbele invoer");
    return fail(res, 500, "Mentor uitnodigen mislukt", error.message);
  } finally {
    conn.release();
  }
}

async function getMentorInvitation(req, res) {
  const token = req.params.token || req.query.token;
  if (!token) return fail(res, 400, "Token ontbreekt");

  try {
    const [rows] = await db.query(
      `
      SELECT
        g.id,
        g.voornaam,
        g.achternaam,
        g.email,
        g.status,
        m.functie,
        m.uitnodiging_status,
        m.uitnodiging_vervalt_op,
        b.naam AS bedrijf_naam
      FROM mentoren m
      JOIN gebruikers g ON g.id = m.gebruiker_id
      JOIN bedrijven b ON b.id = m.bedrijf_id
      WHERE m.uitnodiging_token = ?
      LIMIT 1
      `,
      [token]
    );

    const invitation = rows[0];
    if (!invitation) return fail(res, 404, "Uitnodiging niet gevonden");
    if (invitation.uitnodiging_vervalt_op && new Date(invitation.uitnodiging_vervalt_op) < new Date()) {
      return fail(res, 410, "Uitnodiging is verlopen");
    }

    return ok(res, invitation, "Uitnodiging opgehaald");
  } catch (error) {
    return fail(res, 500, "Uitnodiging ophalen mislukt", error.message);
  }
}

async function activateMentor(req, res) {
  const { token, wachtwoord, telefoon } = req.body;
  if (!token) return fail(res, 400, "Token ontbreekt");

  try {
    const [rows] = await db.query(
      `
      SELECT m.gebruiker_id, m.uitnodiging_vervalt_op
      FROM mentoren m
      JOIN gebruikers g ON g.id = m.gebruiker_id
      WHERE m.uitnodiging_token = ?
      LIMIT 1
      `,
      [token]
    );

    const mentor = rows[0];
    if (!mentor) return fail(res, 404, "Uitnodiging niet gevonden");
    if (mentor.uitnodiging_vervalt_op && new Date(mentor.uitnodiging_vervalt_op) < new Date()) {
      return fail(res, 410, "Uitnodiging is verlopen");
    }

    const wachtwoordHash = wachtwoord ? hashLocalPassword(wachtwoord) : null;
    await db.query(
      `
      UPDATE gebruikers
      SET status = 'actief',
          wachtwoord_hash = COALESCE(?, wachtwoord_hash),
          aangepast_op = NOW()
      WHERE id = ?
      `,
      [wachtwoordHash, mentor.gebruiker_id]
    );
    await db.query(
      `
      UPDATE mentoren
      SET uitnodiging_status = 'geactiveerd',
          uitnodiging_token = NULL,
          geactiveerd_op = NOW(),
          telefoon = COALESCE(?, telefoon)
      WHERE gebruiker_id = ?
      `,
      [telefoon || null, mentor.gebruiker_id]
    );

    return ok(res, { mentorId: mentor.gebruiker_id }, "Mentoraccount geactiveerd");
  } catch (error) {
    return fail(res, 500, "Mentor activeren mislukt", error.message);
  }
}

module.exports = {
  getUsers,
  deactivateUser,
  reactivateUser,
  inviteMentor,
  getMentorInvitation,
  activateMentor
};
