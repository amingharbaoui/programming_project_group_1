const db = require("../config/db");
const { ok, fail } = require("../utils/response");

// GET /docent/students
// Geeft alle studenten terug die gekoppeld zijn aan de ingelogde docent (stagebegeleider).
async function getDocentStudents(req, res) {
  const docentId = Number(req.user?.id);
  if (!docentId) return fail(res, "Niet ingelogd", 401);

  try {
    const [rows] = await db.query(
      `
      SELECT
        g.id,
        g.voornaam,
        g.achternaam,
        st.studentennummer,
        b.naam           AS bedrijf,
        gm.voornaam      AS mentor_voornaam,
        gm.achternaam    AS mentor_achternaam,
        sd.id            AS dossier_id,
        sd.status        AS dossier_status,
        sd.startdatum,
        sd.einddatum,
        (
          SELECT lw.status
          FROM logboek_weken lw
          WHERE lw.stagedossier_id = sd.id
          ORDER BY lw.week_nummer DESC
          LIMIT 1
        ) AS logboek_status
      FROM stagedossiers sd
      JOIN studenten   st ON st.gebruiker_id = sd.student_id
      JOIN gebruikers   g ON g.id             = st.gebruiker_id
      JOIN bedrijven    b ON b.id             = sd.bedrijf_id
      LEFT JOIN gebruikers gm ON gm.id        = sd.mentor_id
      WHERE sd.stagebegeleider_id = ?
      ORDER BY g.achternaam, g.voornaam
      `,
      [docentId]
    );

    return ok(res, rows, "Docent studenten opgehaald");
  } catch (err) {
    console.error("getDocentStudents error:", err);
    return fail(res, "Studenten ophalen mislukt", 500);
  }
}

module.exports = { getDocentStudents };
