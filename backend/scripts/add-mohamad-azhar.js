/*
 * add-mohamad-azhar.js — maakt student Mohamad Azhar aan met volledig gesimuleerde stage:
 *   - stagevoorstel goedgekeurd, contract volledig getekend
 *   - stage loopt, 4 logboekweken (ingevuld/goedgekeurd)
 *   - bedrijfsbezoek gegeven, eindpresentatie bevestigd
 *   - tussentijdse evaluatie open, finale evaluatie open
 *
 * Gebruik: node scripts/add-mohamad-azhar.js
 * Login:   mohamad.azhar@ehb.be / Demo!2026
 */
const crypto = require("crypto");
const db = require("../src/config/db");

const EMAIL    = "mohamad.azhar@ehb.be";
const WACHTWOORD = "Demo!2026";

function hash(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  const d = crypto.pbkdf2Sync(String(pw), salt, 120000, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$120000$${salt}$${d}`;
}

async function main() {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // ── 1. Gebruiker aanmaken (of wachtwoord resetten) ──
    const [bestaand] = await conn.query("SELECT id FROM gebruikers WHERE email = ? LIMIT 1", [EMAIL]);
    let gId;

    if (bestaand.length > 0) {
      gId = bestaand[0].id;
      await conn.query(
        "UPDATE gebruikers SET wachtwoord_hash = ?, voornaam = 'Mohamad', achternaam = 'Azhar', status = 'actief', login_fout_teller = 0, aangepast_op = NOW() WHERE id = ?",
        [hash(WACHTWOORD), gId]
      );
      console.log(`Account bestond al (id ${gId}) — wachtwoord gereset.`);
    } else {
      const [r] = await conn.query(
        `INSERT INTO gebruikers (voornaam, achternaam, email, auth_provider, wachtwoord_hash, hoofdrol, status, login_fout_teller, aangemaakt_op, aangepast_op)
         VALUES ('Mohamad', 'Azhar', ?, 'local', ?, 'student', 'actief', 0, NOW(), NOW())`,
        [EMAIL, hash(WACHTWOORD)]
      );
      gId = r.insertId;
      console.log(`Gebruiker aangemaakt — id ${gId}`);
    }

    // ── 2. Oude data opruimen (schone lei) ──
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    await conn.query("DELETE FROM stagedossiers WHERE student_id = ?", [gId]);
    await conn.query("DELETE FROM stagevoorstellen WHERE student_id = ?", [gId]);
    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
    console.log(`Oude data opgeruimd`);

    // ── 3. Studentprofiel ──
    const [stBestaand] = await conn.query("SELECT gebruiker_id FROM studenten WHERE gebruiker_id = ? LIMIT 1", [gId]);
    if (stBestaand.length === 0) {
      await conn.query(
        `INSERT INTO studenten (gebruiker_id, studentennummer, opleiding, klasgroep, academiejaar)
         VALUES (?, ?, 'Toegepaste Informatica', '1TI-A', '2025-2026')`,
        [gId, `S${String(gId).padStart(4, "0")}`]
      );
      console.log(`Studentprofiel aangemaakt`);
    }

    // Hergebruik bestaande hulpdata (bedrijf 1, mentor 5, docent 3, stageregel 1)
    const BEDRIJF_ID  = 1;
    const MENTOR_ID   = 5;
    const DOCENT_ID   = 3;
    const REGEL_ID    = 1;

    // ── 3. Stagevoorstel ──
    const [vr] = await conn.query(
      `INSERT INTO stagevoorstellen (student_id, bedrijf_id, stage_regel_id, voorlopige_stagebegeleider_id, status, huidige_versie_nummer, ingediend_op, goedgekeurd_op, aangemaakt_op, aangepast_op)
       VALUES (?, ?, ?, ?, 'goedgekeurd', 1, '2026-01-20 10:00:00', '2026-01-25 11:00:00', NOW(), NOW())`,
      [gId, BEDRIJF_ID, REGEL_ID, DOCENT_ID]
    );
    const voorstelId = vr.insertId;
    console.log(`Stagevoorstel aangemaakt — id ${voorstelId}`);

    const [vvr] = await conn.query(
      `INSERT INTO stagevoorstel_versies
         (stagevoorstel_id, versie_nummer, bedrijf_id, bedrijf_naam, bedrijfsafdeling, bedrijfsadres,
          mentor_naam, mentor_email, mentor_telefoon, mentor_functie, stagefunctie, opdrachtomschrijving,
          startdatum, einddatum, aantal_weken, uren_per_week, totaal_uren, ingediend_door_id, ingediend_op, aangemaakt_op)
       VALUES (?, 1, ?, 'CodeLab Brussels', 'Software Development', 'Nijverheidsstraat 10, 1000 Brussel',
               'Demo Mentor', 'mentor@bedrijf.be', '+3200000001', 'Lead Developer', 'React Developer Stagiair',
               'De stagiair werkt mee aan de ontwikkeling van webapplicaties met React en Node.js.',
               '2026-02-09', '2026-06-27', 13, 38, 494, ?, '2026-01-20 10:00:00', NOW())`,
      [voorstelId, BEDRIJF_ID, gId]
    );
    const versieId = vvr.insertId;

    // Goedkeuringsbeslissing
    await conn.query(
      `INSERT INTO voorstel_beslissingen (stagevoorstel_id, stagevoorstel_versie_id, beslist_door_id, beslissing, motivering, beslist_op)
       VALUES (?, ?, 2, 'goedgekeurd', 'Sterk voorstel — voldoet aan alle criteria.', '2026-01-25 11:00:00')`,
      [voorstelId, versieId]
    );

    // ── 4. Stagedossier ──
    const dossierNr = `D-2026-${String(gId).padStart(4, "0")}`;
    const [dr] = await conn.query(
      `INSERT INTO stagedossiers (dossiernummer, stagevoorstel_id, student_id, bedrijf_id, stagebegeleider_id, mentor_id, status, opleiding, academiejaar, startdatum, einddatum, aantal_weken, uren_per_week, totaal_uren, verzekering_in_orde, aangemaakt_op, aangepast_op)
       VALUES (?, ?, ?, ?, ?, ?, 'stage_loopt', 'Toegepaste Informatica', '2025-2026', '2026-02-09', '2026-06-27', 13, 38, 494, 1, NOW(), NOW())`,
      [dossierNr, voorstelId, gId, BEDRIJF_ID, DOCENT_ID, MENTOR_ID]
    );
    const dossierId = dr.insertId;
    console.log(`Stagedossier aangemaakt — id ${dossierId}`);

    // ── 5. Stageovereenkomst (volledig getekend) ──
    await conn.query(
      `INSERT INTO stageovereenkomsten (stagedossier_id, status, versie_nummer, bestand_url, student_getekend_op, bedrijf_getekend_op, opleiding_getekend_op, gecontroleerd_door_id, gecontroleerd_op, geregistreerd_door_id, geregistreerd_op, aangemaakt_op, aangepast_op)
       VALUES (?, 'geregistreerd', 1, '/uploads/demo-overeenkomst-mohamad.pdf', '2026-02-06 10:00:00', '2026-02-07 09:00:00', '2026-02-10 11:00:00', 4, '2026-02-10 11:00:00', 4, '2026-02-10 11:00:00', NOW(), NOW())`,
      [dossierId]
    );

    // ── 6. Documenten ──
    await conn.query(
      `INSERT INTO documenten (stagedossier_id, document_soort_id, status, versie_nummer, bestand_url, bestand_naam, opgeladen_door_id, opgeladen_op, gecontroleerd_door_id, gecontroleerd_op, aangemaakt_op, aangepast_op)
       VALUES
         (?, 1, 'geregistreerd', 1, '/uploads/demo-overeenkomst-mohamad.pdf',  'stageovereenkomst.pdf',  ?, '2026-02-06 10:00:00', 4, '2026-02-10 11:00:00', NOW(), NOW()),
         (?, 2, 'goedgekeurd',   1, '/uploads/demo-verzekering-mohamad.pdf',   'verzekeringsbewijs.pdf', ?, '2026-02-12 09:00:00', 4, '2026-02-13 10:00:00', NOW(), NOW()),
         (?, 3, 'goedgekeurd',   1, '/uploads/demo-stageplan-mohamad.pdf',     'stageplan.pdf',          ?, '2026-02-12 09:30:00', 4, '2026-02-13 10:00:00', NOW(), NOW())`,
      [dossierId, gId, dossierId, gId, dossierId, gId]
    );

    // ── 7. Logboekweken (4 weken) ──
    const weken = [
      { nr: 1, start: "2026-02-09", einde: "2026-02-13", status: "goedgekeurd_door_docent", mentorFeedback: "Goede eerste week, mooi op dreef.", docentFeedback: "Prima logboek." },
      { nr: 2, start: "2026-02-16", einde: "2026-02-20", status: "goedgekeurd_door_docent", mentorFeedback: "Sterke week, goed initiatief getoond.",  docentFeedback: "Inhoudelijk goed." },
      { nr: 3, start: "2026-02-23", einde: "2026-02-27", status: "goedgekeurd_door_mentor", mentorFeedback: "Zelfstandiger deze week.",               docentFeedback: null },
      { nr: 4, start: "2026-03-02", einde: "2026-03-06", status: "ingediend",               mentorFeedback: null,                                     docentFeedback: null },
    ];

    const weekIds = [];
    for (const w of weken) {
      const [wr] = await conn.query(
        `INSERT INTO logboek_weken (stagedossier_id, week_nummer, week_start, week_einde, status, totaal_uren, ingediend_op, mentor_id, mentor_feedback, mentor_nagekeken_op, docent_id, docent_feedback, docent_nagekeken_op, aangemaakt_op, aangepast_op)
         VALUES (?, ?, ?, ?, ?, 38.0, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          dossierId, w.nr, w.start, w.einde, w.status,
          `${w.einde} 17:00:00`,
          MENTOR_ID,
          w.mentorFeedback,
          w.mentorFeedback ? `${w.einde} 17:00:00` : null,
          DOCENT_ID,
          w.docentFeedback,
          w.docentFeedback ? `${w.einde} 17:00:00` : null,
        ]
      );
      weekIds.push({ id: wr.insertId, start: w.start });
    }

    // Logboekdagen (5 per week)
    const dagData = [
      ["Onboarding",   "Kennismaking team, dev-omgeving opgezet.",       "Veel nieuwe tools, maar goed begeleid.",         7.6],
      ["Eerste taak",  "Bug gefixt in de loginflow.",                    "Codebase wordt duidelijker.",                    7.6],
      ["Code review",  "Mee in een code review gezeten.",                "Geleerd hoe het team kwaliteit bewaakt.",        7.6],
      ["Feature",      "Kleine UI-aanpassing gebouwd.",                  "Trots op eerste merge.",                         7.6],
      ["Retro",        "Sprint-retro bijgewoond.",                       "Begrijp de sprintwerking nu beter.",             7.6],
      ["API-werk",     "Endpoint uitgebreid met validatie.",             "Backend wordt vertrouwder.",                     7.6],
      ["Tests",        "Unit tests geschreven.",                         "Testen vangt fouten vroeg.",                     7.6],
      ["Bugfix",       "Edge case opgelost.",                            "Debuggen gaat vlotter.",                         7.6],
      ["Docs",         "Documentatie aangevuld.",                        "Schrijven dwingt tot helder denken.",            7.6],
      ["Demo",         "Feature gedemod aan het team.",                  "Spannend maar leerrijk.",                        7.6],
      ["Planning",     "Sprintplanning meegemaakt.",                     "Prioriteiten stellen is een vak apart.",         7.6],
      ["Refactor",     "Oude code opgeruimd en vereenvoudigd.",          "Leesbaarheid is ook kwaliteit.",                 7.6],
      ["Research",     "Nieuwe bibliotheek onderzocht.",                 "Goed om te weten wat er bestaat.",               7.6],
      ["Review",       "Pull request gereviewed van collega.",           "Code lezen leer je veel van.",                   7.6],
      ["Deploy",       "Feature naar staging omgeving gebracht.",        "Deployproces beter begrepen.",                   7.6],
      ["Integratie",   "API-koppeling met externe service gemaakt.",     "Complexer dan verwacht maar gelukt.",            7.6],
      ["Troubleshoot", "Productieprobleem opgespoord en opgelost.",      "Logs lezen is heel waardevol.",                  7.6],
      ["Pair prog.",   "Samen geprogrammeerd met collega.",              "Van elkaar leren gaat snel.",                    7.6],
      ["Dashboard",    "Nieuw dashboard onderdeel gebouwd.",             "Gebruiksvriendelijkheid is belangrijk.",          7.6],
      ["Afsluiting",   "Week afgerond en samenvatting gemaakt.",         "Reflecteren helpt om bij te sturen.",            7.6],
    ];

    for (let wi = 0; wi < weekIds.length; wi++) {
      const { id: weekId, start } = weekIds[wi];
      const maandag = new Date(start);
      for (let dag = 0; dag < 5; dag++) {
        const datum = new Date(maandag);
        datum.setDate(datum.getDate() + dag);
        const datumStr = datum.toISOString().split("T")[0];
        const [titel, taken, reflectie, uren] = dagData[wi * 5 + dag];
        await conn.query(
          `INSERT INTO logboek_dagen (logboek_week_id, datum, status, titel, uitgevoerde_taken, reflectie, aantal_uren, aangemaakt_op, aangepast_op)
           VALUES (?, ?, 'ingevuld', ?, ?, ?, ?, NOW(), NOW())`,
          [weekId, datumStr, titel, taken, reflectie, uren]
        );
      }
    }
    console.log(`Logboekweken aangemaakt — ${weekIds.length} weken, 20 dagen`);

    // ── 8. Planning: bedrijfsbezoek (gegeven) + eindpresentatie (bevestigd) ──
    await conn.query(
      `INSERT INTO planning_momenten (stagedossier_id, type, status, gepland_op, locatie, voorgesteld_door_id, aangemaakt_op, aangepast_op)
       VALUES
         (?, 'bedrijfsbezoek',       'gegeven',    '2026-04-10 10:00:00', 'CodeLab Brussels — Nijverheidsstraat 10, 1000 Brussel', ?, NOW(), NOW()),
         (?, 'tussentijdse_bespreking', 'bevestigd', '2026-05-14 14:00:00', 'Online (Teams)', ?, NOW(), NOW()),
         (?, 'eindpresentatie',       'gegeven',    '2026-06-20 10:00:00', 'Erasmushogeschool Brussel — Lokaal A201', ?, NOW(), NOW())`,
      [dossierId, DOCENT_ID, dossierId, DOCENT_ID, dossierId, DOCENT_ID]
    );
    console.log(`Planning aangemaakt — bedrijfsbezoek gegeven, eindpresentatie bevestigd`);

    // ── 9. Evaluaties: tussentijds open, finaal open ──
    await conn.query(
      `INSERT INTO evaluaties (stagedossier_id, type, status, deadline_student, deadline_mentor, deadline_docent, aangemaakt_op, aangepast_op)
       VALUES
         (?, 'tussentijds', 'open', '2026-05-08', '2026-05-11', '2026-05-15', NOW(), NOW()),
         (?, 'finaal',      'open', '2026-06-19', '2026-06-21', '2026-06-26', NOW(), NOW())`,
      [dossierId, dossierId]
    );
    console.log(`Evaluaties aangemaakt — tussentijds open, finaal open`);

    await conn.commit();
    console.log(`\n✓ Klaar!`);
    console.log(`Login: ${EMAIL} / ${WACHTWOORD}`);
    console.log(`Dossiernummer: ${dossierNr}`);
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
