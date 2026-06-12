const db = require("../config/db");
const { fail } = require("../utils/response");

async function authenticateDemoUser(req, res, next) {
  const rawUserId = req.header("x-user-id");
  const userId = Number(rawUserId);

  if (!rawUserId || !Number.isInteger(userId) || userId <= 0) {
    return fail(res, 401, "Authenticatie vereist: x-user-id ontbreekt of is ongeldig");
  }

  try {
    const [rows] = await db.query(
      `
      SELECT id, voornaam, achternaam, email, hoofdrol, status
      FROM gebruikers
      WHERE id = ?
      LIMIT 1
      `,
      [userId]
    );

    const user = rows[0];

    if (!user || user.status !== "actief") {
      return fail(res, 401, "Gebruiker niet gevonden of niet actief");
    }

    req.user = user;
    return next();
  } catch (error) {
    return fail(res, 500, "Authenticatie controleren mislukt", error.message);
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return fail(res, 401, "Authenticatie vereist");
    }

    if (!allowedRoles.includes(req.user.hoofdrol)) {
      return fail(res, 403, "Geen toegang voor deze rol");
    }

    return next();
  };
}

module.exports = {
  authenticateDemoUser,
  requireRole
};
