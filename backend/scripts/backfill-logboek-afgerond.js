/*
 * backfill-logboek-afgerond.js — READ + ADDITIEF: vult logboekweken/dagen bij
 * voor dossiers die al "afgerond"/"resultaat_vrijgegeven" staan maar nog 0
 * logboekweken hebben (bv. "Nora Afgerond") — anders toont de app een volledig
 * eindcijfer naast een 100% leeg logboek, wat niet logisch is.
 *
 * Additief en idempotent: dossiers met al minstens 1 logboekweek worden overgeslagen.
 *
 * Gebruik:  node scripts/backfill-logboek-afgerond.js
 */
const db = require("../src/config/db");

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
    const [dossiers] = await conn.query(
      `SELECT sd.id, sd.startdatum, sd.einddatum, sd.aantal_weken, sd.mentor_id, sd.stagebegeleider_id,
              CONCAT(g.voornaam, ' ', g.achternaam) AS student_naam
       FROM stagedossiers sd
       JOIN gebruikers g ON g.id = sd.student_id
       WHERE sd.status IN ('afgerond', 'resultaat_vrijgegeven')`
    );

    if (dossiers.length === 0) {
      console.log("Geen afgeronde dossiers gevonden.");
      return;
    }

    await conn.beginTransaction();
    for (const dossier of dossiers) {
      const [weekRows] = await conn.query(
        `SELECT COUNT(*) AS cnt FROM logboek_weken WHERE stagedossier_id = ?`,
        [dossier.id]
      );
      if (weekRows[0].cnt > 0) {
        console.log(`  ${dossier.student_naam} (dossier ${dossier.id}): heeft al ${weekRows[0].cnt} logboekweek(en) — overgeslagen.`);
        continue;
      }

      const totaalWeken = Number(dossier.aantal_weken) || 13;
      const start = dossier.startdatum ? new Date(dossier.startdatum) : new Date();

      // Alle weken 'goedgekeurd_door_docent' (volledig afgerond logboek), elk met 5 ingevulde dagen.
      for (let wkNr = 1; wkNr <= totaalWeken; wkNr++) {
        const weekStart = addDays(start, (wkNr - 1) * 7);
        const weekEind = addDays(weekStart, 4);
        const [w] = await conn.query(
          `INSERT INTO logboek_weken
           (stagedossier_id, week_nummer, week_start, week_einde, status, totaal_uren, ingediend_op,
            mentor_id, mentor_nagekeken_op, docent_id, docent_nagekeken_op, aangemaakt_op, aangepast_op)
           VALUES (?,?,?,?,'goedgekeurd_door_docent',38.0,?,?,?,?,?, NOW(), NOW())`,
          [
            dossier.id, wkNr, fmt(weekStart), fmt(weekEind), fmt(weekEind),
            dossier.mentor_id, fmt(weekEind), dossier.stagebegeleider_id, fmt(weekEind)
          ]
        );
        const weekId = w.insertId;
        for (let d = 0; d < 5; d++) {
          await conn.query(
            `INSERT INTO logboek_dagen (logboek_week_id, datum, status, titel, uitgevoerde_taken, reflectie, aantal_uren, aangemaakt_op, aangepast_op)
             VALUES (?,?,'ingevuld','Stagewerk','Taken uitgevoerd.','Leerrijke dag.',7.6, NOW(), NOW())`,
            [weekId, fmt(addDays(weekStart, d))]
          );
        }
      }
      console.log(`  ${dossier.student_naam} (dossier ${dossier.id}): ${totaalWeken} logboekweken aangevuld.`);
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
