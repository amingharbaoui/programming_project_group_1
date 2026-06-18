const express = require("express");
const db = require("../config/db");
const { ok, fail } = require("../utils/response");
const { createToken, verifyPassword } = require("../utils/token");

const router = express.Router();

// POST /api/auth/login — echte login met e-mail + wachtwoord, geeft een sessietoken terug.
router.post("/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const wachtwoord = req.body.wachtwoord ?? req.body.password ?? "";

  if (!email || !wachtwoord) {
    return fail(res, 400, "E-mailadres en wachtwoord zijn verplicht");
  }

  try {
    const [rows] = await db.query(
      `SELECT id, voornaam, achternaam, email, hoofdrol, status, wachtwoord_hash
       FROM gebruikers WHERE LOWER(email) = ? LIMIT 1`,
      [email]
    );
    const user = rows[0];

    // Bewust generieke melding (geen onderscheid tussen 'bestaat niet' en 'fout wachtwoord').
    if (!user) return fail(res, 401, "Onjuiste e-mail of wachtwoord");
    if (user.status !== "actief") return fail(res, 403, "Account is niet actief");
    if (!user.wachtwoord_hash) return fail(res, 401, "Voor dit account is nog geen wachtwoord ingesteld");
    if (!verifyPassword(wachtwoord, user.wachtwoord_hash)) {
      return fail(res, 401, "Onjuiste e-mail of wachtwoord");
    }

    const token = createToken(user.id);
    try { await db.query("UPDATE gebruikers SET laatste_login_op = NOW(), login_fout_teller = 0 WHERE id = ?", [user.id]); } catch { /* niet kritisch */ }

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

router.get("/me", (req, res) => {
  return ok(res, null, "Gebruik het token in de Authorization-header");
});

module.exports = router;
