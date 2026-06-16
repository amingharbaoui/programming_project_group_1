const express = require("express");
const db = require("../config/db");
const { ok, fail } = require("../utils/response");

const router = express.Router();

router.post("/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();

  if (!email) {
    return fail(res, 400, "E-mailadres is verplicht");
  }

  try {
    const [rows] = await db.query(
      `
      SELECT id, voornaam, achternaam, email, hoofdrol, status
      FROM gebruikers
      WHERE LOWER(email) = ?
      LIMIT 1
      `,
      [email]
    );

    const user = rows[0];

    if (!user) {
      return fail(res, 401, "Gebruiker niet gevonden");
    }

    if (user.status !== "actief") {
      return fail(res, 403, "Gebruiker is niet actief");
    }

    return ok(res, user, "Login gelukt");
  } catch (error) {
    return fail(res, 500, "Login mislukt", error.message);
  }
});

router.get("/me", (req, res) => {
  return ok(res, null, "Me endpoint werkt voorlopig met demo login");
});

module.exports = router;
