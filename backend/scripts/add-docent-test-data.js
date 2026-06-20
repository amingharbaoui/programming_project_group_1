/*
 * add-docent-test-data.js — voegt logboekweken + evaluaties toe aan dossiers
 * die aan een docent gekoppeld zijn maar nog geen data hebben, zodat de
 * docent-pagina's (logboeken, evaluaties) functioneel te testen zijn.
 *
 * Additief en idempotent: dossiers die al logboekweken/evaluaties hebben
 * worden overgeslagen, er wordt niets verwijderd of overschreven.
 *
 * Gebruik:  node scripts/add-docent-test-data.js [docent-email]
 * (standaard: docent3@ehb.be)
 */
const db = require("../src/config/db");

const DOCENT_EMAIL = process.argv[2] || "docent3@ehb.be";

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function fmt(d) {
  return d.toISOString().slice(0, 10);
}

async function main() {
  const conn = await db.getConnection();
  try {
    const [docentRows] = await conn.query(
      `SELECT id, voornaam, achternaam FROM gebruikers WHERE email = ? LIMIT 1`,
      [DOCENT_EMAIL]
    );
    const docent = docentRows[0];
    if (!docent) {
      console.error(`Geen gebruiker gevonden met email ${DOCENT_EMAIL}`);
      process.exitCode = 1;
      return;
    }
    console.log(`Docent: ${docent.voornaam} ${docent.achternaam} (id=${docent.id})`);

    const [dossiers] = await conn.query(
      `SELECT id, student_id, mentor_id, startdatum FROM stagedossiers WHERE stagebegeleider_id = ?`,
      [docent.id]
    );
    if (dossiers.length === 0) {
      console.log("Geen dossiers gekoppeld aan deze docent — niets te doen.");
      return;
    }

    await conn.beginTransaction();

    for (const dossier of dossiers) {
      const [weekRows] = await conn.query(
        `SELECT COUNT(*) AS cnt FROM logboek_weken WHERE stagedossier_id = ?`,
        [dossier.id]
      );
      if (weekRows[0].cnt > 0) {
        console.log(`  Dossier ${dossier.id}: heeft al ${weekRows[0].cnt} logboekweek(en) — overgeslagen.`);
      } else {
        const start1 = dossier.startdatum ? new Date(dossier.startdatum) : new Date("2026-02-09");
        const week1Start = start1;
        const week1Eind = addDays(week1Start, 4);
        const week2Start = addDays(week1Start, 7);
        const week2Eind = addDays(week2Start, 4);

        // Week 1: volledig afgerond (docent heeft al goedgekeurd) — geschiedenis.
        const [w1] = await conn.query(
          `INSERT INTO logboek_weken
           (stagedossier_id, week_nummer, week_start, week_einde, status, totaal_uren, ingediend_op,
            mentor_id, mentor_feedback, mentor_nagekeken_op, docent_id, docent_feedback, docent_nagekeken_op,
            aangemaakt_op, aangepast_op)
           VALUES (?,1,?,?,'goedgekeurd_door_docent',38.0,?,?,?,?,?,?,?, NOW(), NOW())`,
          [
            dossier.id, fmt(week1Start), fmt(week1Eind), fmt(week1Eind),
            dossier.mentor_id, "Goede eerste week, mooi op dreef.", fmt(week1Eind),
            docent.id, "Prima logboek.", fmt(week1Eind)
          ]
        );

        // Week 2: mentor heeft al afgecheckt — staat klaar als actie voor de docent (zoals het prototype).
        const [w2] = await conn.query(
          `INSERT INTO logboek_weken
           (stagedossier_id, week_nummer, week_start, week_einde, status, totaal_uren, ingediend_op,
            mentor_id, mentor_nagekeken_op, docent_id, aangemaakt_op, aangepast_op)
           VALUES (?,2,?,?,'afgecheckt_door_mentor',38.0,?,?,?,?, NOW(), NOW())`,
          [dossier.id, fmt(week2Start), fmt(week2Eind), fmt(week2Eind), dossier.mentor_id, fmt(week2Eind), docent.id]
        );

        const week1Id = w1.insertId;
        const week2Id = w2.insertId;
        const dagen = [
          [week1Id, week1Start, "Onboarding", "Kennismaking team, dev-omgeving opgezet.", "Veel nieuwe tools, maar goed begeleid."],
          [week1Id, addDays(week1Start, 1), "Eerste taak", "Bug gefixt in de loginflow.", "Codebase wordt duidelijker."],
          [week1Id, addDays(week1Start, 2), "Code review", "Mee in een code review gezeten.", "Geleerd hoe het team kwaliteit bewaakt."],
          [week1Id, addDays(week1Start, 3), "Feature", "Kleine UI-aanpassing gebouwd.", "Trots op eerste merge."],
          [week1Id, addDays(week1Start, 4), "Retro", "Sprint-retro bijgewoond.", "Begrijp de sprintwerking nu beter."],
          [week2Id, week2Start, "API-werk", "Endpoint uitgebreid met validatie.", "Backend wordt vertrouwder."],
          [week2Id, addDays(week2Start, 1), "Tests", "Unit tests geschreven.", "Testen vangt fouten vroeg."],
          [week2Id, addDays(week2Start, 2), "Bugfix", "Edge case opgelost.", "Debuggen gaat vlotter."],
          [week2Id, addDays(week2Start, 3), "Docs", "Documentatie aangevuld.", "Schrijven dwingt tot helder denken."],
          [week2Id, addDays(week2Start, 4), "Demo", "Feature gedemod aan het team.", "Spannend maar leerrijk."]
        ];
        for (const [weekId, datum, titel, taken, reflectie] of dagen) {
          await conn.query(
            `INSERT INTO logboek_dagen (logboek_week_id, datum, status, titel, uitgevoerde_taken, reflectie, aantal_uren, aangemaakt_op, aangepast_op)
             VALUES (?,?,'ingevuld',?,?,?,7.6, NOW(), NOW())`,
            [weekId, fmt(datum), titel, taken, reflectie]
          );
        }
        console.log(`  Dossier ${dossier.id}: 2 logboekweken + 10 dagen toegevoegd (week 2 staat klaar voor docent).`);
      }

      const [evalRows] = await conn.query(
        `SELECT COUNT(*) AS cnt FROM evaluaties WHERE stagedossier_id = ?`,
        [dossier.id]
      );
      if (evalRows[0].cnt > 0) {
        console.log(`  Dossier ${dossier.id}: heeft al ${evalRows[0].cnt} evaluatie(s) — overgeslagen.`);
      } else {
        const vandaag = new Date();
        await conn.query(
          `INSERT INTO evaluaties (stagedossier_id, type, status, deadline_student, deadline_mentor, deadline_docent, aangemaakt_op, aangepast_op)
           VALUES (?, 'tussentijds', 'open', ?, ?, ?, NOW(), NOW())`,
          [dossier.id, fmt(addDays(vandaag, -7)), fmt(addDays(vandaag, -4)), fmt(addDays(vandaag, 2))]
        );
        await conn.query(
          `INSERT INTO evaluaties (stagedossier_id, type, status, deadline_student, deadline_mentor, deadline_docent, aangemaakt_op, aangepast_op)
           VALUES (?, 'finaal', 'niet_open', ?, ?, ?, NOW(), NOW())`,
          [dossier.id, fmt(addDays(vandaag, 14)), fmt(addDays(vandaag, 16)), fmt(addDays(vandaag, 21))]
        );
        console.log(`  Dossier ${dossier.id}: evaluaties toegevoegd (tussentijds open, finaal niet_open).`);
      }
    }

    await conn.commit();
    console.log("\nKlaar.");
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
