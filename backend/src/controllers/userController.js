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

module.exports = {
  getUsers,
  deactivateUser,
  reactivateUser
};
