const express = require("express");
const db = require("../config/db");
const { ok, fail } = require("../utils/response");
const { createToken, verifyPassword } = require("../utils/token");
const { authenticateDemoUser } = require("../middleware/authMiddleware");

const router = express.Router();

// Brute-force-rem: na MAX_LOGIN_POGINGEN mislukte pogingen wordt het account LOCKOUT_MINUTEN geblokkeerd.
const MAX_LOGIN_POGINGEN = 5;
const LOCKOUT_MINUTEN = 15;

// POST /api/auth/login — echte login met e-mail + wachtwoord, geeft een sessietoken terug.
router.post("/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const wachtwoord = req.body.wachtwoord ?? req.body.password ?? "";

  if (!email || !wachtwoord) {
    return fail(res, 400, "E-mailadres en wachtwoord zijn verplicht");
  }

  try {
    const [rows] = await db.query(
      `SELECT id, voornaam, achternaam, email, hoofdrol, status, wachtwoord_hash, login_fout_teller, geblokkeerd_tot
       FROM gebruikers WHERE LOWER(email) = ? LIMIT 1`,
      [email]
    );
    const user = rows[0];

    // Bewust generieke melding (geen onderscheid tussen 'bestaat niet' en 'fout wachtwoord').
    if (!user) return fail(res, 401, "Onjuiste e-mail of wachtwoord");

    // Tijdelijke lockout actief? Dan login weigeren tot de blokkade verlopen is.
    if (user.geblokkeerd_tot && new Date(user.geblokkeerd_tot) > new Date()) {
      return fail(res, 429, "Te veel mislukte pogingen. Probeer het later opnieuw.");
    }

    if (user.status !== "actief") return fail(res, 403, "Account is niet actief");
    if (!user.wachtwoord_hash) return fail(res, 401, "Voor dit account is nog geen wachtwoord ingesteld");
    if (!verifyPassword(wachtwoord, user.wachtwoord_hash)) {
      // Misser optellen; bij de drempel het account kort blokkeren.
      const pogingen = Number(user.login_fout_teller || 0) + 1;
      try {
        if (pogingen >= MAX_LOGIN_POGINGEN) {
          await db.query(
            "UPDATE gebruikers SET login_fout_teller = ?, geblokkeerd_tot = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id = ?",
            [pogingen, LOCKOUT_MINUTEN, user.id]
          );
        } else {
          await db.query("UPDATE gebruikers SET login_fout_teller = ? WHERE id = ?", [pogingen, user.id]);
        }
      } catch { /* niet kritisch */ }
      return fail(res, 401, "Onjuiste e-mail of wachtwoord");
    }

    const token = createToken(user.id);
    // Geslaagde login: teller en eventuele blokkade resetten.
    try { await db.query("UPDATE gebruikers SET laatste_login_op = NOW(), login_fout_teller = 0, geblokkeerd_tot = NULL WHERE id = ?", [user.id]); } catch { /* niet kritisch */ }

    return ok(res, {
      id: user.id,
      voornaam: user.voornaam,
      achternaam: user.achternaam,
      email: user.email,
      hoofdrol: user.hoofdrol,
      status: user.status,
      token,
    }, "Login gelukt");
  } catch (error) {
    return fail(res, 500, "Login mislukt", error.message);
  }
});

// Sessiecheck: valideert het token en geeft de actuele ingelogde gebruiker terug.
// Zo kan de frontend bij opstart een stale localStorage-sessie verifiëren i.p.v. wachten op de eerste 401.
router.get("/me", authenticateDemoUser, (req, res) => {
  return ok(res, req.user, "Ingelogde gebruiker");
});

module.exports = router;
