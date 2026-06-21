/*
 * add-test-student.js — voegt ÉÉN NIEUWE testaccount toe (student), zonder iets te wissen
 * of te overschrijven. Gebruikt auto-increment (geen vast id), dus geen kans op botsing met
 * bestaande accounts. Idempotent op e-mailadres: als het al bestaat, wordt enkel het
 * wachtwoord teruggezet.
 *
 * Gebruik:  node scripts/add-test-student.js
 * Login:    test.nathan@ehb.be / Demo!2026
 */
const crypto = require("crypto");
const db = require("../src/config/db");

const EMAIL = "test.nathan@ehb.be";
const WACHTWOORD = "Demo!2026";
const VOORNAAM = "Test";
const ACHTERNAAM = "Nathan";

function hash(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  const d = crypto.pbkdf2Sync(String(pw), salt, 120000, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$120000$${salt}$${d}`;
}

async function main() {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [bestaand] = await conn.query("SELECT id FROM gebruikers WHERE email = ? LIMIT 1", [EMAIL]);
    let gebruikerId;

    if (bestaand.length > 0) {
      gebruikerId = bestaand[0].id;
      await conn.query(
        "UPDATE gebruikers SET wachtwoord_hash = ?, status = 'actief', login_fout_teller = 0, aangepast_op = NOW() WHERE id = ?",
        [hash(WACHTWOORD), gebruikerId]
      );
      console.log(`Account bestond al (id ${gebruikerId}) — wachtwoord gereset naar ${WACHTWOORD}.`);
    } else {
      const [result] = await conn.query(
        `INSERT INTO gebruikers (voornaam, achternaam, email, auth_provider, wachtwoord_hash, hoofdrol, status, login_fout_teller, aangemaakt_op, aangepast_op)
         VALUES (?, ?, ?, 'school_sso', ?, 'student', 'actief', 0, NOW(), NOW())`,
        [VOORNAAM, ACHTERNAAM, EMAIL, hash(WACHTWOORD)]
      );
      gebruikerId = result.insertId;

      await conn.query(
        `INSERT INTO studenten (gebruiker_id, studentennummer, opleiding, klasgroep, academiejaar)
         VALUES (?, ?, 'Toegepaste Informatica', '1TI-A', '2025-2026')`,
        [gebruikerId, `S${String(gebruikerId).padStart(4, "0")}`]
      );
      console.log(`Nieuwe student aangemaakt — id ${gebruikerId}.`);
    }

    await conn.commit();
    console.log(`\nLogin: ${EMAIL} / ${WACHTWOORD}`);
    console.log("Geen bestaand voorstel/dossier gekoppeld — start helemaal vanaf 'voorstel indienen'.");
  } catch (e) {
    await conn.rollback();
    console.error("Mislukt, alles teruggedraaid:", e.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await db.end().catch(() => {});
  }
}
main();
