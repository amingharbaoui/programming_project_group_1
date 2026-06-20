const crypto = require("crypto");
const db = require("../config/db");
const { ok, fail } = require("../utils/response");
const { emailMelding } = require("../utils/notify");
const { sendMail, buildMailHtml } = require("../utils/mail");

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

  // Een rol mag niet naar een andere rolfamilie wisselen: dat zou student-/mentor-/medewerkerrijen
  // inconsistent maken. Voor zo'n wissel hoort een nieuwe gebruiker via de uitnodigingsflow.
  if (hoofdrol !== undefined) {
    const [huidig] = await db.query("SELECT hoofdrol FROM gebruikers WHERE id = ? LIMIT 1", [id]);
    if (huidig.length === 0) return fail(res, 404, "Gebruiker niet gevonden");
    const familie = (rol) => (rol === "student" ? "student" : rol === "mentor" ? "mentor" : "medewerker");
    if (familie(hoofdrol) !== familie(huidig[0].hoofdrol)) {
      return fail(res, 409, "Een gebruiker kan niet naar een andere rolfamilie (student, mentor, medewerker) gewijzigd worden. Maak hiervoor een nieuwe gebruiker aan via een uitnodiging.");
    }
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

// Mentor uitnodigen: maakt een mentor-account + activatielink en registreert de uitnodiging via het e-mailkanaal.
async function inviteMentor(req, res) {
  const { voornaam, achternaam, email, functie } = req.body;
  let bedrijfId = req.body.bedrijfId ?? req.body.bedrijf_id ?? null;
  const bedrijfNaam = req.body.bedrijfNaam ?? req.body.bedrijf_naam ?? null;

  if (!voornaam || !achternaam || !email) {
    return fail(res, 400, "Voornaam, achternaam en e-mail zijn verplicht");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return fail(res, 400, "Ongeldig e-mailadres");
  }

  // Admin e-mailadres ophalen als afzender
  const adminId = Number(req.user?.id);
  let adminEmail = null;
  if (adminId) {
    const [adminRows] = await db.query("SELECT email, voornaam, achternaam FROM gebruikers WHERE id = ? LIMIT 1", [adminId]);
    if (adminRows[0]) {
      adminEmail = `${adminRows[0].voornaam} ${adminRows[0].achternaam} <${adminRows[0].email}>`;
    }
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

    const activatielink = `/mentor/activate?token=${token}`;
    await emailMelding(mentorId, {
      titel: "Uitnodiging stageplatform",
      bericht: `Je bent uitgenodigd als mentor. Activeer je account via ${activatielink}`,
      type: "herinnering",
      ernst: "medium",
      aangemaaktDoorId: Number(req.user?.id) || null
    });

    // Echte e-mail naar de mentor (best-effort: faalt nooit hard als SMTP ontbreekt/foutloopt).
    const volledigeLink = `${process.env.APP_URL || "http://localhost:5173"}${activatielink}`;
    const mailResultaat = await sendMail({
      to: email,
      from: adminEmail || undefined,
      subject: "Uitnodiging als mentor — Stagify",
      text: `Je bent uitgenodigd als mentor op Stagify.\n\nActiveer je account en kies een wachtwoord via:\n${volledigeLink}\n\nDeze link is 14 dagen geldig.`,
      html: buildMailHtml({
        title: "Uitnodiging als mentor",
        body: `<p>Hallo,</p>
               <p>Je bent uitgenodigd om als <strong>mentor</strong> te fungeren op het stageplatform van <strong>Stagify</strong>.</p>
               <p>Klik op de knop hieronder om je account te activeren en een wachtwoord in te stellen. Deze link is <strong>14 dagen</strong> geldig.</p>`,
        buttonText: "Account activeren",
        buttonUrl: volledigeLink,
      })
    });

    return ok(res, { mentorId, bedrijfId, activatielink, emailStatus: mailResultaat.sent ? "verzonden" : "geregistreerd" }, "Mentor uitgenodigd");
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

// POST /api/admin/invitations/:id/resend — uitnodiging opnieuw versturen (nieuwe token + e-mail).
async function resendInvitation(req, res) {
  const mentorGebruikerId = Number(req.params.id);
  if (!mentorGebruikerId) return fail(res, 400, "Ongeldig mentor-id");

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT m.gebruiker_id, g.status, g.email
       FROM mentoren m JOIN gebruikers g ON g.id = m.gebruiker_id
       WHERE m.gebruiker_id = ? LIMIT 1`,
      [mentorGebruikerId]
    );
    if (rows.length === 0) { await conn.rollback(); return fail(res, 404, "Mentor niet gevonden"); }
    if (rows[0].status === "actief") { await conn.rollback(); return fail(res, 409, "Deze mentor heeft het account al geactiveerd"); }

    const token = crypto.randomBytes(24).toString("hex");
    await conn.query(
      `UPDATE mentoren
       SET uitnodiging_token = ?, uitnodiging_status = 'verstuurd', uitnodiging_vervalt_op = DATE_ADD(NOW(), INTERVAL 14 DAY)
       WHERE gebruiker_id = ?`,
      [token, mentorGebruikerId]
    );

    await conn.commit();

    const activatielink = `/mentor/activate?token=${token}`;
    await emailMelding(mentorGebruikerId, {
      titel: "Uitnodiging stageplatform (opnieuw verstuurd)",
      bericht: `Hier is je nieuwe activatielink: ${activatielink}`,
      type: "herinnering",
      ernst: "medium",
      aangemaaktDoorId: Number(req.user?.id) || null
    });

    // Echte e-mail opnieuw versturen (best-effort).
    const volledigeLink = `${process.env.APP_URL || "http://localhost:5173"}${activatielink}`;
    const mailResultaat = await sendMail({
      to: rows[0].email,
      subject: "Nieuwe activatielink — Stagify",
      text: `Hier is je nieuwe activatielink voor Stagify:\n${volledigeLink}\n\nDeze link is 14 dagen geldig.`,
      html: buildMailHtml({
        title: "Nieuwe activatielink",
        body: `<p>Hallo,</p>
               <p>Hier is je nieuwe activatielink voor <strong>Stagify</strong>.</p>
               <p>Klik op de knop hieronder om je account te activeren. Deze link is <strong>14 dagen</strong> geldig.</p>`,
        buttonText: "Account activeren",
        buttonUrl: volledigeLink,
      })
    });

    return ok(res, { mentorId: mentorGebruikerId, activatielink, emailStatus: mailResultaat.sent ? "verzonden" : "geregistreerd" }, "Uitnodiging opnieuw verstuurd");
  } catch (error) {
    await conn.rollback();
    return fail(res, 500, "Uitnodiging opnieuw versturen mislukt", error.message);
  } finally {
    conn.release();
  }
}

// ---------------------------------------------------------------------------
// Generieke onboarding: admin nodigt student/docent/administratie/stagecommissie uit.
// Zelfde patroon als de mentor (uitnodiging -> activatielink -> wachtwoord), maar de
// token leeft op `gebruikers` zodat het voor elke rol werkt. (Mentor-flow blijft ongewijzigd.)
// ---------------------------------------------------------------------------
const GELDIGE_INVITE_ROLLEN = ["student", "docent", "administratie", "stagecommissie"];

function maakNummer(prefix, id) {
  return `${prefix}${String(id).padStart(4, "0")}`;
}

async function inviteUser(req, res) {
  const voornaam = String(req.body.voornaam || "").trim();
  const achternaam = String(req.body.achternaam || "").trim();
  const email = String(req.body.email || "").trim();
  const rol = String(req.body.rol ?? req.body.hoofdrol ?? "").trim();

  if (!voornaam || !achternaam || !email) return fail(res, 400, "Voornaam, achternaam en e-mail zijn verplicht");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(res, 400, "Ongeldig e-mailadres");
  if (!GELDIGE_INVITE_ROLLEN.includes(rol)) {
    return fail(res, 400, `Ongeldige rol. Kies uit: ${GELDIGE_INVITE_ROLLEN.join(", ")}`);
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [dup] = await conn.query("SELECT id FROM gebruikers WHERE email = ? LIMIT 1", [email]);
    if (dup.length > 0) { await conn.rollback(); return fail(res, 409, "Er bestaat al een gebruiker met dit e-mailadres"); }

    const token = crypto.randomBytes(24).toString("hex");
    const [u] = await conn.query(
      `INSERT INTO gebruikers (voornaam, achternaam, email, auth_provider, hoofdrol, status,
         uitnodiging_token, uitnodiging_status, uitnodiging_vervalt_op, aangemaakt_op, aangepast_op)
       VALUES (?, ?, ?, 'local', ?, 'uitgenodigd', ?, 'verstuurd', DATE_ADD(NOW(), INTERVAL 14 DAY), NOW(), NOW())`,
      [voornaam, achternaam, email, rol, token]
    );
    const userId = u.insertId;

    // Rol-specifieke rij zodat de gebruiker meteen in de juiste lijsten verschijnt.
    if (rol === "student") {
      await conn.query(
        `INSERT INTO studenten (gebruiker_id, studentennummer, opleiding, klasgroep, academiejaar) VALUES (?, ?, ?, ?, ?)`,
        [userId, maakNummer("S", userId), req.body.opleiding || "Toegepaste Informatica",
         req.body.klasgroep || null, req.body.academiejaar || "2025-2026"]
      );
    } else {
      await conn.query(
        `INSERT INTO medewerkers (gebruiker_id, personeelsnummer, medewerker_type, functie, dienst) VALUES (?, ?, ?, ?, ?)`,
        [userId, maakNummer("P", userId), rol, req.body.functie || null, req.body.dienst || null]
      );
    }

    await conn.commit();

    const activatielink = `/activeren?token=${token}`;
    await emailMelding(userId, {
      titel: "Uitnodiging stageplatform",
      bericht: `Je bent uitgenodigd op Stagify. Activeer je account via ${activatielink}`,
      type: "herinnering",
      ernst: "medium",
      aangemaaktDoorId: Number(req.user?.id) || null
    });
    const volledigeLink = `${process.env.APP_URL || "http://localhost:5173"}${activatielink}`;
    const mailResultaat = await sendMail({
      to: email,
      subject: "Uitnodiging — Stagify",
      text: `Je bent uitgenodigd op Stagify.\n\nActiveer je account en kies een wachtwoord via:\n${volledigeLink}\n\nDeze link is 14 dagen geldig.`,
      html: buildMailHtml({
        title: "Uitnodiging op Stagify",
        body: `<p>Hallo,</p>
               <p>Je bent uitgenodigd op het stageplatform van <strong>Stagify</strong>.</p>
               <p>Klik op de knop hieronder om je account te activeren en een wachtwoord in te stellen. Deze link is <strong>14 dagen</strong> geldig.</p>`,
        buttonText: "Account activeren",
        buttonUrl: volledigeLink,
      })
    });

    return ok(res, { userId, rol, activatielink, emailStatus: mailResultaat.sent ? "verzonden" : "geregistreerd" }, "Gebruiker uitgenodigd");
  } catch (error) {
    await conn.rollback();
    if (error.code === "ER_DUP_ENTRY") return fail(res, 409, "Dubbele invoer");
    return fail(res, 500, "Gebruiker uitnodigen mislukt", error.message);
  } finally {
    conn.release();
  }
}

// Publiek: uitnodiging ophalen op token (voert de activatiepagina met naam/rol).
async function getInvitation(req, res) {
  const token = req.params.token || req.query.token;
  if (!token) return fail(res, 400, "Token ontbreekt");
  try {
    const [rows] = await db.query(
      `SELECT id, voornaam, achternaam, email, hoofdrol AS rol, status, uitnodiging_status, uitnodiging_vervalt_op
       FROM gebruikers WHERE uitnodiging_token = ? LIMIT 1`,
      [token]
    );
    const inv = rows[0];
    if (!inv) return fail(res, 404, "Uitnodiging niet gevonden");
    if (inv.uitnodiging_vervalt_op && new Date(inv.uitnodiging_vervalt_op) < new Date()) {
      return fail(res, 410, "Uitnodiging is verlopen");
    }
    return ok(res, inv, "Uitnodiging opgehaald");
  } catch (error) {
    return fail(res, 500, "Uitnodiging ophalen mislukt", error.message);
  }
}

// Publiek: account activeren met token + zelfgekozen wachtwoord.
async function activateAccount(req, res) {
  const token = req.body.token;
  const wachtwoord = req.body.wachtwoord ?? req.body.password;
  if (!token) return fail(res, 400, "Token ontbreekt");
  if (!wachtwoord || String(wachtwoord).length < 8) return fail(res, 400, "Kies een wachtwoord van minstens 8 tekens");
  try {
    const [rows] = await db.query(
      "SELECT id, uitnodiging_vervalt_op FROM gebruikers WHERE uitnodiging_token = ? LIMIT 1",
      [token]
    );
    const u = rows[0];
    if (!u) return fail(res, 404, "Uitnodiging niet gevonden");
    if (u.uitnodiging_vervalt_op && new Date(u.uitnodiging_vervalt_op) < new Date()) {
      return fail(res, 410, "Uitnodiging is verlopen");
    }
    await db.query(
      `UPDATE gebruikers
       SET status='actief', wachtwoord_hash=?, uitnodiging_token=NULL, uitnodiging_status='geactiveerd', aangepast_op=NOW()
       WHERE id = ?`,
      [hashLocalPassword(wachtwoord), u.id]
    );
    return ok(res, { userId: u.id }, "Account geactiveerd");
  } catch (error) {
    return fail(res, 500, "Account activeren mislukt", error.message);
  }
}

module.exports = {
  getUsers,
  updateUser,
  deactivateUser,
  reactivateUser,
  inviteMentor,
  resendInvitation,
  getMentorInvitation,
  activateMentor,
  inviteUser,
  getInvitation,
  activateAccount
};
