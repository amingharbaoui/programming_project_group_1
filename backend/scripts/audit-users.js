/*
 * audit-users.js — READ-ONLY: overzicht van alle gebruikers per rol, met
 * wachtwoord-status (kan inloggen of niet) en, voor mentoren, hun gekoppelde
 * bedrijven/studenten — om overbodige of kapotte accounts op te sporen.
 * Wijzigt niets.
 *
 * Gebruik:  node scripts/audit-users.js
 */
const db = require("../src/config/db");

async function main() {
  const conn = await db.getConnection();
  try {
    const [users] = await conn.query(
      `SELECT id, voornaam, achternaam, email, hoofdrol, status, wachtwoord_hash, auth_provider
       FROM gebruikers
       ORDER BY hoofdrol, id`
    );

    const perRol = {};
    for (const u of users) {
      perRol[u.hoofdrol] = perRol[u.hoofdrol] || [];
      perRol[u.hoofdrol].push(u);
    }

    for (const [rol, lijst] of Object.entries(perRol)) {
      console.log(`\n=== ${rol.toUpperCase()} (${lijst.length}) ===`);
      for (const u of lijst) {
        const kanInloggen = u.wachtwoord_hash ? "OK" : "GEEN WACHTWOORD (kan niet inloggen)";
        console.log(`  [${u.id}] ${u.email} — ${u.voornaam} ${u.achternaam} — status=${u.status} — ${kanInloggen}`);
      }
    }

    // Mentoren: tonen hoeveel dossiers/bedrijven elke mentor heeft, om overbodige/dubbele te zien.
    const mentoren = perRol["mentor"] || [];
    if (mentoren.length > 0) {
      console.log(`\n=== MENTOR -> GEKOPPELDE DOSSIERS/BEDRIJVEN ===`);
      for (const m of mentoren) {
        const [dossiers] = await conn.query(
          `SELECT sd.id, b.naam AS bedrijf, CONCAT(g.voornaam,' ',g.achternaam) AS student
           FROM stagedossiers sd
           JOIN bedrijven b ON b.id = sd.bedrijf_id
           JOIN gebruikers g ON g.id = sd.student_id
           WHERE sd.mentor_id = ?`,
          [m.id]
        );
        if (dossiers.length === 0) {
          console.log(`  ${m.email}: GEEN dossiers gekoppeld — mogelijk overbodig.`);
        } else {
          console.log(`  ${m.email}: ${dossiers.length} dossier(s):`);
          for (const d of dossiers) console.log(`     - dossier ${d.id} | ${d.student} | ${d.bedrijf}`);
        }
      }
    }

    // Docenten: zelfde check als mentor — wie heeft 0 dossiers, en wie heeft (per ongeluk) hetzelfde wachtwoord als een collega.
    const docenten = perRol["docent"] || [];
    if (docenten.length > 0) {
      console.log(`\n=== DOCENT -> GEKOPPELDE DOSSIERS ===`);
      for (const d of docenten) {
        const [dossiers] = await conn.query(
          `SELECT sd.id, b.naam AS bedrijf, CONCAT(g.voornaam,' ',g.achternaam) AS student
           FROM stagedossiers sd
           JOIN bedrijven b ON b.id = sd.bedrijf_id
           JOIN gebruikers g ON g.id = sd.student_id
           WHERE sd.stagebegeleider_id = ?`,
          [d.id]
        );
        if (dossiers.length === 0) {
          console.log(`  ${d.email}: GEEN dossiers gekoppeld — mogelijk overbodig.`);
        } else {
          console.log(`  ${d.email}: ${dossiers.length} dossier(s):`);
          for (const dos of dossiers) console.log(`     - dossier ${dos.id} | ${dos.student} | ${dos.bedrijf}`);
        }
      }
      // Dubbele wachtwoord-hashes opsporen (zelfde hash = zelfde wachtwoord, kan wijzen op kopieerfout in seed).
      const hashGroepen = {};
      for (const d of docenten) {
        if (!d.wachtwoord_hash) continue;
        hashGroepen[d.wachtwoord_hash] = hashGroepen[d.wachtwoord_hash] || [];
        hashGroepen[d.wachtwoord_hash].push(d.email);
      }
      const dubbels = Object.values(hashGroepen).filter((lijst) => lijst.length > 1);
      if (dubbels.length > 0) {
        console.log(`\n  Let op: deze docenten delen exact dezelfde wachtwoord-hash (normaal als ze allen "Demo!2026" als wachtwoord hebben, dan is dit oké):`);
        dubbels.forEach((lijst) => console.log(`     - ${lijst.join(", ")}`));
      }
    }

    // Studenten zonder enig stagedossier — kunnen niet veel tonen in de demo.
    const studenten = perRol["student"] || [];
    if (studenten.length > 0) {
      console.log(`\n=== STUDENT -> HEEFT DOSSIER? ===`);
      for (const s of studenten) {
        const [dossiers] = await conn.query(
          `SELECT id FROM stagedossiers WHERE student_id = ?`,
          [s.id]
        );
        console.log(`  ${s.email}: ${dossiers.length} dossier(s)${dossiers.length === 0 ? " — geen dossier, enkel nuttig voor 'voorstel indienen'-demo" : ""}`);
      }
    }

    console.log("\nKlaar.");
  } catch (e) {
    console.error("Fout:", e.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await db.end().catch(() => {});
  }
}
main();
