/*
 * seed-demo.js — wist ALLE data en herseedt een ruime demo-dataset over alle stage-states.
 * Transactioneel: bij een fout wordt alles teruggedraaid (de DB blijft nooit half geseed).
 * Wachtwoorden worden gehasht (pbkdf2, zelfde schema als userController) zodat echte login werkt.
 *
 * Gebruik:  node scripts/seed-demo.js
 * Demo-wachtwoord voor ELKE gebruiker:  Demo!2026
 */
const crypto = require("crypto");
const db = require("../src/config/db");

const DEMO_WACHTWOORD = "Demo!2026";
function hash(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  const d = crypto.pbkdf2Sync(String(pw), salt, 120000, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$120000$${salt}$${d}`;
}

// Alle tabellen in volgorde (kindtabellen eerst voor de netheid; FK-checks gaan toch uit).
const TABELLEN = [
  "logboek_dagen", "logboek_weken", "evaluaties", "competentie_scores",
  "documenten", "stageovereenkomsten", "voorstel_checklist", "voorstel_beslissingen",
  "planning_momenten", "stagevoorstel_versies", "stagedossiers", "stagevoorstellen",
  "systeem_meldingen", "mentoren", "studenten", "medewerkers",
  "competenties", "competentie_profielen", "document_soorten", "stage_regels",
  "bedrijven", "gebruikers",
];

async function main() {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    // DELETE i.p.v. TRUNCATE: TRUNCATE doet een impliciete commit in MySQL (breekt de transactie/rollback).
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const t of TABELLEN) {
      try { await conn.query(`DELETE FROM \`${t}\``); }
      catch (e) { console.warn(`  (DELETE ${t} overgeslagen: ${e.code || e.message})`); }
    }
    await conn.query("SET FOREIGN_KEY_CHECKS = 1");

    const ww = hash(DEMO_WACHTWOORD);
    const q = (sql, p) => conn.query(sql, p);

    /* ---------- GEBRUIKERS ---------- */
    // Personeel + mentoren krijgen een wachtwoord (local); studenten ook (demo: iedereen logt in met wachtwoord).
    const users = [
      // staf
      [1, "Sara", "Commissie", "commissie@ehb.be", "stagecommissie", "actief"],
      [2, "Koen", "Wouters", "docent@ehb.be", "docent", "actief"],
      [3, "Lien", "Maes", "docent2@ehb.be", "docent", "actief"],
      [4, "Tom", "Admin", "admin@ehb.be", "administratie", "actief"],
      [18, "Bram", "Devos", "commissie2@ehb.be", "stagecommissie", "actief"],
      [19, "Eva", "Janssens", "admin2@ehb.be", "administratie", "actief"],
      [20, "Jeroen", "Claes", "docent3@ehb.be", "docent", "actief"],
      [21, "Inge", "Vermeulen", "commissie3@ehb.be", "stagecommissie", "actief"],
      [22, "Karim", "Haddad", "admin3@ehb.be", "administratie", "actief"],
      // mentoren
      [5, "Sofie", "Maris", "mentor@bedrijf.be", "mentor", "actief"],
      [6, "Jan", "Peeters", "mentor2@bedrijf.be", "mentor", "actief"],
      [7, "Nieuwe", "Mentor", "mentor3@bedrijf.be", "mentor", "uitgenodigd"], // nog te activeren
      // studenten per state
      [8, "Emma", "Geen", "student.geen@ehb.be", "student", "actief"],
      [9, "Noah", "Ingediend", "student.ingediend@ehb.be", "student", "actief"],
      [10, "Lina", "Aanpassingen", "student.aanpassingen@ehb.be", "student", "actief"],
      [11, "Mila", "Heringediend", "student.heringediend@ehb.be", "student", "actief"],
      [12, "Sam", "Afgekeurd", "student.afgekeurd@ehb.be", "student", "actief"],
      [13, "Yara", "Ingetrokken", "student.ingetrokken@ehb.be", "student", "actief"],
      [14, "David", "Contract", "student.contract@ehb.be", "student", "actief"],
      [15, "Aya", "Startklaar", "student.startklaar@ehb.be", "student", "actief"],
      [16, "Liam", "Loopt", "student.loopt@ehb.be", "student", "actief"],
      [17, "Nora", "Afgerond", "student.afgerond@ehb.be", "student", "actief"],
    ];
    for (const [id, vn, an, email, rol, status] of users) {
      const provider = rol === "mentor" ? "local" : "school_sso";
      const tokenActief = id === 7; // pending mentor: token gezet, geen wachtwoord
      await q(
        `INSERT INTO gebruikers (id, voornaam, achternaam, email, auth_provider, wachtwoord_hash, hoofdrol, status, login_fout_teller, aangemaakt_op, aangepast_op)
         VALUES (?,?,?,?,?,?,?,?,0,NOW(),NOW())`,
        [id, vn, an, email, provider, tokenActief ? null : ww, rol, status]
      );
    }

    /* ---------- BEDRIJVEN ---------- */
    await q(`INSERT INTO bedrijven (id, naam, afdeling, adres, postcode, stad, land, email, telefoon, aangemaakt_op, aangepast_op) VALUES
      (1,'CodeLab Brussels','Software Development','Nijverheidsstraat 10','1000','Brussel','België','info@codelab.local','+3220000000',NOW(),NOW()),
      (2,'DataForge','Data & AI','Havenlaan 5','9000','Gent','België','hr@dataforge.local','+3290000000',NOW(),NOW())`);

    /* ---------- MEDEWERKERS ---------- */
    await q(`INSERT INTO medewerkers (gebruiker_id, personeelsnummer, medewerker_type, functie, dienst) VALUES
      (1,'P0001','stagecommissie','Lid stagecommissie','Toegepaste Informatica'),
      (2,'P0002','docent','Stagebegeleider','Toegepaste Informatica'),
      (3,'P0003','docent','Stagebegeleider','Toegepaste Informatica'),
      (4,'P0004','administratie','Administratief medewerker','Stageadministratie'),
      (18,'P0018','stagecommissie','Lid stagecommissie','Toegepaste Informatica'),
      (19,'P0019','administratie','Administratief medewerker','Stageadministratie'),
      (20,'P0020','docent','Stagebegeleider','Toegepaste Informatica'),
      (21,'P0021','stagecommissie','Lid stagecommissie','Toegepaste Informatica'),
      (22,'P0022','administratie','Administratief medewerker','Stageadministratie')`);

    /* ---------- MENTOREN ---------- */
    await q(`INSERT INTO mentoren (gebruiker_id, bedrijf_id, functie, telefoon, mag_stageovereenkomst_tekenen, uitnodiging_status, uitnodiging_token, uitnodiging_vervalt_op, geactiveerd_op) VALUES
      (5,1,'Lead Developer','+3220000001',1,'geactiveerd',NULL,NULL,NOW()),
      (6,2,'Data Engineer','+3290000001',1,'geactiveerd',NULL,NULL,NOW()),
      (7,2,'Teamlead',NULL,1,'verstuurd',?,DATE_ADD(NOW(),INTERVAL 14 DAY),NULL)`,
      [crypto.randomBytes(24).toString("hex")]);

    /* ---------- STAGE_REGELS ---------- */
    await q(`INSERT INTO stage_regels (id, opleiding, academiejaar, stagevenster_start, stagevenster_einde, minimum_weken, minimum_uren, standaard_uren_per_week, status, aangemaakt_door_id, aangemaakt_op, aangepast_op) VALUES
      (1,'Toegepaste Informatica','2025-2026','2026-02-01','2026-06-30',12,450,38,'actief',2,NOW(),NOW())`);

    /* ---------- COMPETENTIES ---------- */
    await q(`INSERT INTO competentie_profielen (id, opleiding, academiejaar, naam, versie, status, aangemaakt_door_id, gepubliceerd_door_id, gepubliceerd_op, aangemaakt_op, aangepast_op) VALUES
      (1,'Toegepaste Informatica','2025-2026','TI stageprofiel','v1.0','actief',2,2,NOW(),NOW(),NOW())`);
    const comps = [
      ["LO1","Planningsproces",9],["LO2","Ontwerpen van IT-oplossingen",10],["LO3","Implementatie",12],
      ["LO4","Integratie technologie",10],["LO5","Onderzoekende houding",9],["LO6","Communiceren",10],
      ["LO7","Probleemoplossend vermogen",10],["LO8","Persoonlijke ontwikkeling",9],["LO9","Professionele attitude",10],
      ["LO10","Ondernemend handelen",8],["LO11","Ethisch handelen",3],
    ];
    let cid = 1;
    for (const [code, naam, g] of comps) {
      await q(`INSERT INTO competenties (id, competentie_profiel_id, code, naam, beschrijving, gewicht_percentage, volgorde, is_actief, aangemaakt_op, aangepast_op)
               VALUES (?,1,?,?,?,?,?,1,NOW(),NOW())`, [cid, code, naam, naam + ".", g, cid]);
      cid++;
    }

    /* ---------- DOCUMENT_SOORTEN ---------- */
    await q(`INSERT INTO document_soorten (id, naam, type, is_verplicht, is_vast, opleiding, academiejaar, status, aangemaakt_door_id, aangemaakt_op, aangepast_op) VALUES
      (1,'Stageovereenkomst','stageovereenkomst',1,1,'Toegepaste Informatica','2025-2026','actief',4,NOW(),NOW()),
      (2,'Verzekeringsbewijs','verzekeringsbewijs',1,1,'Toegepaste Informatica','2025-2026','actief',4,NOW(),NOW()),
      (3,'Stageplan','stageplan',1,1,'Toegepaste Informatica','2025-2026','actief',4,NOW(),NOW()),
      (4,'Eindoverzicht','eindoverzicht',0,1,'Toegepaste Informatica','2025-2026','actief',4,NOW(),NOW())`);

    await q(`INSERT INTO studenten (gebruiker_id, studentennummer, opleiding, klasgroep, academiejaar) VALUES
      (8,'S0008','Toegepaste Informatica','1TI-A','2025-2026'),
      (9,'S0009','Toegepaste Informatica','1TI-A','2025-2026'),
      (10,'S0010','Toegepaste Informatica','1TI-A','2025-2026'),
      (11,'S0011','Toegepaste Informatica','1TI-A','2025-2026'),
      (12,'S0012','Toegepaste Informatica','1TI-A','2025-2026'),
      (13,'S0013','Toegepaste Informatica','1TI-A','2025-2026'),
      (14,'S0014','Toegepaste Informatica','1TI-B','2025-2026'),
      (15,'S0015','Toegepaste Informatica','1TI-B','2025-2026'),
      (16,'S0016','Toegepaste Informatica','1TI-B','2025-2026'),
      (17,'S0017','Toegepaste Informatica','1TI-B','2025-2026')`);

    /* ---------- VOORSTELLEN (versie-helper) ---------- */
    let vid = 1, vvid = 1;
    async function voorstel(studentId, status, { docent = 2, versies = 1 } = {}) {
      const myId = vid++;
      await q(`INSERT INTO stagevoorstellen (id, student_id, bedrijf_id, stage_regel_id, voorlopige_stagebegeleider_id, status, huidige_versie_nummer,
                 ingediend_op, heringediend_op, goedgekeurd_op, afgekeurd_op, ingetrokken_op, aangemaakt_op, aangepast_op)
               VALUES (?,?,?,1,?,?,?, NOW(), ?, ?, ?, ?, NOW(), NOW())`,
        [myId, studentId, 1, docent, status, versies,
         status !== "concept" ? new Date() : null,
         status === "heringediend" ? new Date() : null,
         status === "goedgekeurd" ? new Date() : null,
         status === "afgekeurd" ? new Date() : null,
         status === "ingetrokken" ? new Date() : null]);
      for (let v = 1; v <= versies; v++) {
        await q(`INSERT INTO stagevoorstel_versies (id, stagevoorstel_id, versie_nummer, bedrijf_id, bedrijf_naam, bedrijfsafdeling, bedrijfsadres,
                   mentor_naam, mentor_email, mentor_telefoon, mentor_functie, stagefunctie, opdrachtomschrijving,
                   startdatum, einddatum, aantal_weken, uren_per_week, totaal_uren, ingediend_door_id, ingediend_op, aangemaakt_op)
                 VALUES (?,?,?,1,'CodeLab Brussels','Software Development','Nijverheidsstraat 10, 1000 Brussel',
                   'Sofie Maris','mentor@bedrijf.be','+3220000001','Lead Developer','Software Developer Stagiair',
                   'De stagiair werkt mee aan ontwikkeling en testen van webapplicaties binnen het team.',
                   '2026-02-09','2026-06-27',13,38,494,?, NOW(), NOW())`,
          [vvid++, myId, v, studentId]);
      }
      return myId;
    }

    // 8 = geen voorstel
    await voorstel(9, "ingediend");
    const vAanp = await voorstel(10, "aanpassingen_gevraagd");
    const vHer = await voorstel(11, "heringediend", { versies: 2 });
    const vAfg = await voorstel(12, "afgekeurd");
    await voorstel(13, "ingetrokken");
    const vContract = await voorstel(14, "goedgekeurd");
    const vStart = await voorstel(15, "goedgekeurd", { docent: 3 });
    const vLoopt = await voorstel(16, "goedgekeurd");
    const vAfgerond = await voorstel(17, "goedgekeurd", { docent: 3 });

    /* ---------- BESLISSINGEN (feedback/afkeur) ---------- */
    await q(`INSERT INTO voorstel_beslissingen (stagevoorstel_id, stagevoorstel_versie_id, beslist_door_id, beslissing, feedback, motivering, beslist_op)
             VALUES (?, ?, 1, 'aanpassingen_gevraagd', '[Opdrachtomschrijving] Maak de opdracht concreter: vermeld technologie en team.', NULL, NOW())`,
      [vAanp, vAanp]);
    await q(`INSERT INTO voorstel_beslissingen (stagevoorstel_id, stagevoorstel_versie_id, beslist_door_id, beslissing, feedback, motivering, beslist_op)
             VALUES (?, ?, 1, 'afgekeurd', NULL, 'Onvoldoende IT-inhoud en te weinig weken.', NOW())`,
      [vAfg, vAfg]);
    await q(`INSERT INTO voorstel_beslissingen (stagevoorstel_id, stagevoorstel_versie_id, beslist_door_id, beslissing, feedback, motivering, beslist_op)
             VALUES (?, ?, 1, 'goedgekeurd', NULL, 'Voldoet aan alle criteria.', NOW())`,
      [vLoopt, vLoopt]);

    /* ---------- DOSSIER-helper (contract/startklaar/loopt/afgerond) ---------- */
    let did = 1;
    async function dossier(studentId, voorstelId, docentId, status, startdatum, einddatum = "2026-06-27") {
      const myId = did++;
      await q(`INSERT INTO stagedossiers (id, dossiernummer, stagevoorstel_id, student_id, bedrijf_id, stagebegeleider_id, mentor_id, status,
                 opleiding, academiejaar, startdatum, einddatum, aantal_weken, uren_per_week, totaal_uren, verzekering_in_orde, aangemaakt_op, aangepast_op)
               VALUES (?, ?, ?, ?, 1, ?, 5, ?, 'Toegepaste Informatica','2025-2026', ?, ?, 13, 38, 494, ?, NOW(), NOW())`,
        [myId, `D-2026-${String(myId).padStart(4, "0")}`, voorstelId, studentId, docentId, status,
         startdatum, einddatum, ["geregistreerd", "stage_loopt", "resultaat_vrijgegeven", "afgerond"].includes(status) ? 1 : 0]);
      return myId;
    }
    function ovk(dossierId, status, { student = null, bedrijf = null, opleiding = null } = {}) {
      return q(`INSERT INTO stageovereenkomsten (stagedossier_id, status, versie_nummer, bestand_url, student_getekend_op, bedrijf_getekend_op, opleiding_getekend_op, aangemaakt_op, aangepast_op)
                VALUES (?, ?, 1, '/uploads/demo-overeenkomst.pdf', ?, ?, ?, NOW(), NOW())`,
        [dossierId, status, student, bedrijf, opleiding]);
    }
    function doc(dossierId, soortId, status, opgeladen) {
      return q(`INSERT INTO documenten (stagedossier_id, document_soort_id, status, versie_nummer, bestand_url, bestand_naam, opgeladen_door_id, opgeladen_op, aangemaakt_op, aangepast_op)
                VALUES (?, ?, ?, 1, '/uploads/demo.pdf', 'document.pdf', ?, ?, NOW(), NOW())`,
        [dossierId, soortId, status, opgeladen ? null : null, opgeladen]);
    }

    // 14 — CONTRACT: goedgekeurd, overeenkomst klaar voor student, documenten nog te uploaden
    const dContract = await dossier(14, vContract, 2, "wacht_op_student", "2026-03-09");
    await ovk(dContract, "klaar_voor_student");
    await doc(dContract, 2, "ontbreekt", null);
    await doc(dContract, 3, "ontbreekt", null);

    // 15 — STARTKLAAR: volledig getekend, documenten goedgekeurd, geregistreerd (stage nog niet begonnen)
    const dStart = await dossier(15, vStart, 3, "geregistreerd", "2026-09-15", "2026-12-12");
    await ovk(dStart, "geregistreerd", { student: new Date(), bedrijf: new Date(), opleiding: new Date() });
    await doc(dStart, 1, "geregistreerd", new Date());
    await doc(dStart, 2, "goedgekeurd", new Date());
    await doc(dStart, 3, "goedgekeurd", new Date());

    // 16 — STAGE LOOPT: logboek + open tussentijdse evaluatie
    const dLoopt = await dossier(16, vLoopt, 2, "stage_loopt", "2026-02-09");
    await ovk(dLoopt, "geregistreerd", { student: new Date(), bedrijf: new Date(), opleiding: new Date() });
    await doc(dLoopt, 1, "geregistreerd", new Date());
    await doc(dLoopt, 2, "goedgekeurd", new Date());
    await doc(dLoopt, 3, "goedgekeurd", new Date());
    await q(`INSERT INTO planning_momenten (stagedossier_id, type, status, gepland_op, locatie, voorgesteld_door_id, aangemaakt_op, aangepast_op)
             VALUES (?, 'bedrijfsbezoek', 'voorgesteld', '2026-04-20 10:00:00', 'CodeLab Brussels', 2, NOW(), NOW())`, [dLoopt]);
    await q(`INSERT INTO evaluaties (id, stagedossier_id, type, status, aangemaakt_op, aangepast_op) VALUES
      (1, ?, 'tussentijds', 'open', NOW(), NOW()),
      (2, ?, 'finaal', 'niet_open', NOW(), NOW())`, [dLoopt, dLoopt]);
    // week 1 goedgekeurd, week 2 ingediend (mentor moet afchecken)
    await q(`INSERT INTO logboek_weken (id, stagedossier_id, week_nummer, week_start, week_einde, status, totaal_uren, ingediend_op, mentor_id, mentor_feedback, mentor_nagekeken_op, docent_id, aangemaakt_op, aangepast_op) VALUES
      (1, ?, 1, '2026-02-09','2026-02-13','goedgekeurd_door_docent',38, '2026-02-13 17:00:00', 5, 'Sterke eerste week.', '2026-02-16 09:00:00', 2, NOW(), NOW()),
      (2, ?, 2, '2026-02-16','2026-02-20','ingediend',38,'2026-02-20 17:00:00', 5, NULL, NULL, 2, NOW(), NOW())`, [dLoopt, dLoopt]);
    const dagen = ["Onboarding", "Eerste taak", "Code review", "Feature", "Retro"];
    for (let i = 0; i < 5; i++) {
      await q(`INSERT INTO logboek_dagen (logboek_week_id, datum, status, titel, uitgevoerde_taken, reflectie, aantal_uren, aangemaakt_op, aangepast_op)
               VALUES (1, DATE_ADD('2026-02-09', INTERVAL ? DAY), 'ingevuld', ?, 'Taken uitgevoerd.', 'Leerrijk.', 7.6, NOW(), NOW())`, [i, dagen[i]]);
      await q(`INSERT INTO logboek_dagen (logboek_week_id, datum, status, titel, uitgevoerde_taken, reflectie, aantal_uren, aangemaakt_op, aangepast_op)
               VALUES (2, DATE_ADD('2026-02-16', INTERVAL ? DAY), 'ingevuld', ?, 'Taken uitgevoerd.', 'Leerrijk.', 7.6, NOW(), NOW())`, [i, dagen[i]]);
    }

    // 17 — AFGEROND: resultaat vrijgegeven + eindoverzicht
    const dAfg = await dossier(17, vAfgerond, 3, "afgerond", "2025-09-09");
    await ovk(dAfg, "geregistreerd", { student: new Date(), bedrijf: new Date(), opleiding: new Date() });
    await doc(dAfg, 1, "geregistreerd", new Date());
    await doc(dAfg, 4, "geregistreerd", new Date()); // eindoverzicht
    await q(`UPDATE stagedossiers SET eindresultaat = 16.5, eindresultaat_vrijgegeven_op = NOW(), eindoverzicht_gegenereerd_op = NOW() WHERE id = ?`, [dAfg]);
    await q(`INSERT INTO evaluaties (id, stagedossier_id, type, status, verslag, eindpresentatie_score, competentie_score, eindcijfer, vrijgegeven_door_id, vrijgegeven_op, aangemaakt_op, aangepast_op) VALUES
      (3, ?, 'tussentijds', 'geregistreerd', 'Goede tussentijdse evaluatie.', NULL, 3.8, NULL, NULL, NULL, NOW(), NOW()),
      (4, ?, 'finaal', 'vrijgegeven', 'Sterke eindstage, professioneel gegroeid.', 17, 4.1, 16.5, 3, NOW(), NOW(), NOW())`, [dAfg, dAfg]);

    await conn.commit();

    // Tellingen tonen
    const [[gu]] = await conn.query("SELECT COUNT(*) AS n FROM gebruikers");
    const [[dd]] = await conn.query("SELECT COUNT(*) AS n FROM stagedossiers");
    const [[vv]] = await conn.query("SELECT COUNT(*) AS n FROM stagevoorstellen");
    console.log("\n✅ SEED KLAAR");
    console.log(`   gebruikers: ${gu.n} | voorstellen: ${vv.n} | dossiers: ${dd.n}`);
    console.log(`   Wachtwoord voor iedereen: ${DEMO_WACHTWOORD}`);
    console.log("   Voorbeelden: commissie@ehb.be · docent@ehb.be · admin@ehb.be · mentor@bedrijf.be · student.loopt@ehb.be");
    process.exit(0);
  } catch (e) {
    await conn.rollback();
    console.error("\n❌ SEED MISLUKT (alles teruggedraaid):", e.message);
    process.exit(1);
  } finally {
    conn.release();
  }
}

main();
