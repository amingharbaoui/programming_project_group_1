/*
 * add-staff.js — voegt EXTRA staf-accounts toe aan de bestaande DB ZONDER iets te wissen.
 * Idempotent: bestaande rijen worden bijgewerkt i.p.v. gedupliceerd (veilig om dubbel te draaien).
 * Zorgt dat elke staf-rol meerdere accounts heeft (commissie/docent/administratie elk 3).
 *
 * Gebruik:  node scripts/add-staff.js
 * Wachtwoord voor deze accounts:  Demo!2026
 */
const crypto = require("crypto");
const db = require("../src/config/db");

const DEMO_WACHTWOORD = "Demo!2026";
function hash(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  const d = crypto.pbkdf2Sync(String(pw), salt, 120000, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$120000$${salt}$${d}`;
}

// [id, voornaam, achternaam, email, rol, personeelsnummer, medewerker_type, functie, dienst]
const STAF = [
  [18, "Bram", "Devos", "commissie2@ehb.be", "stagecommissie", "P0018", "stagecommissie", "Lid stagecommissie", "Toegepaste Informatica"],
  [19, "Eva", "Janssens", "admin2@ehb.be", "administratie", "P0019", "administratie", "Administratief medewerker", "Stageadministratie"],
  [20, "Jeroen", "Claes", "docent3@ehb.be", "docent", "P0020", "docent", "Stagebegeleider", "Toegepaste Informatica"],
  [21, "Inge", "Vermeulen", "commissie3@ehb.be", "stagecommissie", "P0021", "stagecommissie", "Lid stagecommissie", "Toegepaste Informatica"],
  [22, "Karim", "Haddad", "admin3@ehb.be", "administratie", "P0022", "administratie", "Administratief medewerker", "Stageadministratie"],
];

async function main() {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (const [id, vn, an, email, rol, pnr, mtype, functie, dienst] of STAF) {
      const ww = hash(DEMO_WACHTWOORD);
      // Gebruiker: invoegen of bijwerken (idempotent).
      await conn.query(
        `INSERT INTO gebruikers (id, voornaam, achternaam, email, auth_provider, wachtwoord_hash, hoofdrol, status, login_fout_teller, aangemaakt_op, aangepast_op)
         VALUES (?,?,?,?,'school_sso',?,?,'actief',0,NOW(),NOW())
         ON DUPLICATE KEY UPDATE voornaam=VALUES(voornaam), achternaam=VALUES(achternaam), email=VALUES(email),
           wachtwoord_hash=VALUES(wachtwoord_hash), hoofdrol=VALUES(hoofdrol), status='actief', aangepast_op=NOW()`,
        [id, vn, an, email, ww, rol]
      );
      // Medewerker-koppeling: invoegen of bijwerken.
      await conn.query(
        `INSERT INTO medewerkers (gebruiker_id, personeelsnummer, medewerker_type, functie, dienst)
         VALUES (?,?,?,?,?)
         ON DUPLICATE KEY UPDATE personeelsnummer=VALUES(personeelsnummer), medewerker_type=VALUES(medewerker_type),
           functie=VALUES(functie), dienst=VALUES(dienst)`,
        [id, pnr, mtype, functie, dienst]
      );
      console.log(`  + ${rol.padEnd(14)} ${email}`);
    }
    await conn.commit();
    console.log(`\nKlaar — ${STAF.length} staf-accounts toegevoegd/bijgewerkt. Wachtwoord: ${DEMO_WACHTWOORD}`);
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
