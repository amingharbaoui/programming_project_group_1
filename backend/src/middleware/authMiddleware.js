const db = require("../config/db");
const { fail } = require("../utils/response");
const { verifyToken } = require("../utils/token");

// Echte authenticatie: vereist een geldig sessietoken in de Authorization-header (Bearer).
// (De vroegere x-user-id-demostub is vervangen — elke beveiligde route vereist nu een token.)
async function authenticateDemoUser(req, res, next) {
  const header = req.header("authorization") || req.header("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1].trim() : null;

  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    return fail(res, 401, "Authenticatie vereist: ongeldig of ontbrekend token");
  }

  try {
    const [rows] = await db.query(
      `SELECT id, voornaam, achternaam, email, hoofdrol, status
       FROM gebruikers WHERE id = ? LIMIT 1`,
      [payload.id]
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
    if (!req.user) return fail(res, 401, "Authenticatie vereist");
    if (!allowedRoles.includes(req.user.hoofdrol)) {
      return fail(res, 403, "Geen toegang voor deze rol");
    }
    return next();
  };
}

module.exports = { authenticateDemoUser, requireRole };
