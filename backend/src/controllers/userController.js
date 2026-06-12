const db = require("../config/db");
const { ok, fail } = require("../utils/response");

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

module.exports = {
  getUsers
};
