const db = require("../config/db");
const { ok, fail } = require("../utils/response");
const { meld } = require("../utils/notify");
const { buildSimplePdf } = require("../utils/pdf");

function getUserId(req) {
  // Geen demo-fallback meer (auditpunt 312): zonder ingelogde gebruiker liever null dan stil user 1.
  return Number(req.user?.id) || null;
}

/* GET /api/contracts/my
   Haalt de stageovereenkomst op voor de ingelogde student */
async function getContract(req, res) {
  const studentId = getUserId(req);

  try {
    const [rows] = await db.query(
      `
      SELECT
        so.id,
        so.stagedossier_id,
        so.status,
        so.bestand_url,
        so.student_getekend_op,
        so.bedrijf_getekend_op,
        so.opleiding_getekend_op,
        so.afkeurreden,
        so.aangemaakt_op,

        d.dossiernummer,
        d.startdatum,
        d.einddatum,

        CONCAT(gs.voornaam, ' ', gs.achternaam) AS student_naam,
        b.naam AS bedrijf_naam,
        CONCAT(gm.voornaam, ' ', gm.achternaam) AS mentor_naam,
        CONCAT(gdoc.voornaam, ' ', gdoc.achternaam) AS docent_naam
      FROM stageovereenkomsten so
      JOIN stagedossiers d ON d.id = so.stagedossier_id
      JOIN gebruikers gs ON gs.id = d.student_id
      JOIN bedrijven b ON b.id = d.bedrijf_id
      LEFT JOIN gebruikers gm ON gm.id = d.mentor_id
      LEFT JOIN gebruikers gdoc ON gdoc.id = d.stagebegeleider_id
      WHERE d.student_id = ?
      ORDER BY so.aangemaakt_op DESC
      LIMIT 1
      `,
      [studentId]
    );

    if (rows.length === 0) {
      return fail(res, 404, "Geen stageovereenkomst gevonden");
    }

    return ok(res, rows[0], "Stageovereenkomst opgehaald");
  } catch (error) {
    return fail(res, 500, "Stageovereenkomst ophalen mislukt", error.message);
  }
}

/* POST /api/contracts/sign
   Student tekent de stageovereenkomst digitaal */
async function signContract(req, res) {
  const studentId = getUserId(req);

  if (req.body?.bevestigd !== true) {
    return fail(res, 400, "Je moet bevestigen dat je de stageovereenkomst gelezen hebt voor je tekent");
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `
      SELECT so.id, so.status, so.student_getekend_op, so.stagedossier_id, d.mentor_id
      FROM stageovereenkomsten so
      JOIN stagedossiers d ON d.id = so.stagedossier_id
      WHERE d.student_id = ?
      ORDER BY so.aangemaakt_op DESC
      LIMIT 1
      `,
      [studentId]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return fail(res, 404, "Geen stageovereenkomst gevonden");
    }

    const contract = rows[0];

    if (contract.student_getekend_op) {
      await connection.rollback();
      return fail(res, 409, "Je hebt deze overeenkomst al ondertekend");
    }
    // Enkel tekenen wanneer de overeenkomst effectief op de student wacht.
    if (contract.status && contract.status !== "klaar_voor_student") {
      await connection.rollback();
      return fail(res, 409, "Deze overeenkomst kan op dit moment niet getekend worden");
    }

    const now = new Date();

    // Conditioneel zodat een dubbelklik/tweede tab niet alsnog "tekent" o.b.v. een oude status (387).
    const [tekenResult] = await connection.query(
      `
      UPDATE stageovereenkomsten
      SET student_getekend_op = ?,
          status = 'getekend_door_student',
          aangepast_op = NOW()
      WHERE id = ? AND status = 'klaar_voor_student' AND student_getekend_op IS NULL
      `,
      [now, contract.id]
    );
    if (tekenResult.affectedRows === 0) {
      await connection.rollback();
      return fail(res, 409, "Deze overeenkomst is ondertussen al gewijzigd; vernieuw de pagina");
    }

    await connection.query(
      "UPDATE stagedossiers SET status = 'wacht_op_bedrijf', aangepast_op = NOW() WHERE id = ? AND status = 'wacht_op_student'",
      [contract.stagedossier_id]
    );

    await connection.commit();

    // Volgende ondertekenaar (mentor/bedrijf) en de administratie verwittigen.
    try {
      if (contract.mentor_id) {
        await meld(contract.mentor_id, {
          titel: "Stageovereenkomst ondertekend door student",
          bericht: "De student ondertekende de stageovereenkomst. Jij kan ze nu als stagebedrijf ondertekenen.",
          aangemaaktDoorId: studentId,
          stagedossierId: contract.stagedossier_id
        });
      }
      const [admins] = await db.query("SELECT id FROM gebruikers WHERE hoofdrol = 'administratie' AND status = 'actief'");
      for (const a of admins) {
        await meld(a.id, {
          titel: "Student ondertekende de overeenkomst",
          bericht: "Een student ondertekende de stageovereenkomst.",
          aangemaaktDoorId: studentId,
          stagedossierId: contract.stagedossier_id
        });
      }
    } catch (notifyError) {
      console.error("Melding ondertekenen mislukt:", notifyError.message);
    }

    return ok(
      res,
      { getekendOp: now, status: "getekend_door_student" },
      "Stageovereenkomst succesvol ondertekend"
    );
  } catch (error) {
    await connection.rollback();
    return fail(res, 500, "Ondertekenen mislukt", error.message);
  } finally {
    connection.release();
  }
}

/* PATCH /api/admin/dossiers/:id/overeenkomst/registreer
   Administratie controleert en registreert de volledig ondertekende stageovereenkomst.
   Daarna is de verzekering in orde en kan de stage officieel starten. */
async function registerOvereenkomst(req, res) {
  const dossierId = Number(req.params.id);
  const adminId = getUserId(req);

  if (!dossierId) return fail(res, 400, "Ongeldig dossier-id");

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT so.id, so.status, so.student_getekend_op, so.bedrijf_getekend_op,
              d.student_id, d.mentor_id, d.stagebegeleider_id
       FROM stageovereenkomsten so
       JOIN stagedossiers d ON d.id = so.stagedossier_id
       WHERE so.stagedossier_id = ? LIMIT 1`,
      [dossierId]
    );

    if (rows.length === 0) { await conn.rollback(); return fail(res, 404, "Geen stageovereenkomst gevonden voor dit dossier"); }
    const o = rows[0];
    if (o.status === "geregistreerd") { await conn.rollback(); return fail(res, 409, "Deze overeenkomst is al geregistreerd"); }
    if (!o.student_getekend_op || !o.bedrijf_getekend_op) {
      await conn.rollback();
      return fail(res, 409, "De overeenkomst is nog niet door alle partijen ondertekend");
    }
    // Koppel-gate: een stage kan pas starten als zowel de mentor als de stagebegeleider (docent)
    // gekoppeld zijn — anders kan de stage niet begeleid/geëvalueerd worden.
    if (!o.mentor_id || !o.stagebegeleider_id) {
      await conn.rollback();
      const ontbreekt = [!o.mentor_id ? "een mentor" : null, !o.stagebegeleider_id ? "een stagebegeleider (docent)" : null].filter(Boolean).join(" en ");
      return fail(res, 409, `Koppel eerst ${ontbreekt} aan dit dossier vóór je de stage registreert`);
    }

    const [docs] = await conn.query(
      `SELECT COUNT(*) AS openstaand
       FROM documenten doc JOIN document_soorten ds ON ds.id = doc.document_soort_id
       WHERE doc.stagedossier_id = ? AND ds.is_verplicht = 1 AND ds.type != 'stageovereenkomst' AND doc.status NOT IN ('goedgekeurd', 'geregistreerd')`,
      [dossierId]
    );
    if (docs[0].openstaand > 0) {
      await conn.rollback();
      return fail(res, 400, `Dossier nog niet startklaar: ${docs[0].openstaand} verplichte document(en) nog niet goedgekeurd`);
    }

    // Conditioneel zodat twee admins/dubbelklik niet allebei registreren o.b.v. een oude status (387).
    const [regResult] = await conn.query(
      `UPDATE stageovereenkomsten
       SET status = 'geregistreerd',
           opleiding_getekend_op = COALESCE(opleiding_getekend_op, NOW()),
           gecontroleerd_door_id = ?, gecontroleerd_op = NOW(),
           geregistreerd_door_id = ?, geregistreerd_op = NOW(),
           aangepast_op = NOW()
       WHERE id = ? AND status = 'volledig_ondertekend'`,
      [adminId, adminId, o.id]
    );
    if (regResult.affectedRows === 0) {
      await conn.rollback();
      return fail(res, 409, "Deze overeenkomst is ondertussen al geregistreerd of gewijzigd; vernieuw de pagina");
    }

    // Verzekering in orde + dossier startklaar registreren. Forward-only: nooit een dossier dat al verder
    // staat terugzetten naar 'geregistreerd' (auditpunt 404).
    await conn.query(
      `UPDATE stagedossiers SET status = 'geregistreerd', verzekering_in_orde = 1, aangepast_op = NOW()
       WHERE id = ? AND status NOT IN ('geregistreerd', 'stage_loopt', 'resultaat_vrijgegeven', 'afgerond')`,
      [dossierId]
    );

    // De overeenkomst-documentrij mee op geregistreerd zetten (indien aanwezig).
    await conn.query(
      `UPDATE documenten doc
       JOIN document_soorten ds ON ds.id = doc.document_soort_id
       SET doc.status = 'geregistreerd', doc.aangepast_op = NOW()
       WHERE doc.stagedossier_id = ? AND ds.type = 'stageovereenkomst'`,
      [dossierId]
    );

    await conn.commit();

    // Student, mentor en docent verwittigen.
    for (const ontvangerId of [o.student_id, o.mentor_id, o.stagebegeleider_id]) {
      await meld(ontvangerId, {
        titel: "Stageovereenkomst geregistreerd",
        bericht: "De administratie heeft de stageovereenkomst gecontroleerd en geregistreerd. De verzekering is in orde voor de volledige stageperiode.",
        aangemaaktDoorId: adminId,
        stagedossierId: dossierId,
      });
    }

    return ok(res, { dossierId, status: "geregistreerd" }, "Stageovereenkomst geregistreerd");
  } catch (error) {
    await conn.rollback();
    return fail(res, 500, "Stageovereenkomst registreren mislukt", error.message);
  } finally {
    conn.release();
  }
}

/* GET /api/contracts/my/pdf
   Student downloadt de stageovereenkomst als pdf (story 5) */
async function downloadContractPdf(req, res) {
  const studentId = getUserId(req);

  try {
    const [rows] = await db.query(
      `
      SELECT
        so.status, so.student_getekend_op, so.bedrijf_getekend_op, so.opleiding_getekend_op,
        d.dossiernummer, d.startdatum, d.einddatum,
        CONCAT(gs.voornaam, ' ', gs.achternaam) AS student_naam,
        b.naam AS bedrijf_naam,
        CONCAT(gm.voornaam, ' ', gm.achternaam) AS mentor_naam,
        CONCAT(gdoc.voornaam, ' ', gdoc.achternaam) AS docent_naam
      FROM stageovereenkomsten so
      JOIN stagedossiers d ON d.id = so.stagedossier_id
      JOIN gebruikers gs ON gs.id = d.student_id
      JOIN bedrijven b ON b.id = d.bedrijf_id
      LEFT JOIN gebruikers gm ON gm.id = d.mentor_id
      LEFT JOIN gebruikers gdoc ON gdoc.id = d.stagebegeleider_id
      WHERE d.student_id = ?
      ORDER BY so.aangemaakt_op DESC
      LIMIT 1
      `,
      [studentId]
    );

    if (rows.length === 0) return fail(res, 404, "Geen stageovereenkomst gevonden");

    const c = rows[0];
    const tekenStatus = (datum) => (datum ? `getekend op ${new Date(datum).toISOString().slice(0, 10)}` : "nog niet getekend");
    const lines = [
      "Stageovereenkomst",
      `Dossier: ${c.dossiernummer || "-"}`,
      "",
      `Student: ${c.student_naam}`,
      `Stagebedrijf: ${c.bedrijf_naam || "-"}`,
      `Stagementor: ${c.mentor_naam || "-"}`,
      `Stagebegeleider: ${c.docent_naam || "-"}`,
      `Periode: ${c.startdatum || "-"} tot ${c.einddatum || "-"}`,
      "",
      `Status: ${c.status}`,
      `Handtekening student: ${tekenStatus(c.student_getekend_op)}`,
      `Handtekening stagebedrijf: ${tekenStatus(c.bedrijf_getekend_op)}`,
      `Handtekening opleiding: ${tekenStatus(c.opleiding_getekend_op)}`
    ];

    const pdf = buildSimplePdf(lines);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="stageovereenkomst.pdf"');
    return res.send(pdf);
  } catch (error) {
    return fail(res, 500, "Stageovereenkomst-pdf genereren mislukt", error.message);
  }
}

/* GET /api/admin/dossiers/:id/contract-pdf
   Admin bekijkt de stageovereenkomst als pdf */
async function adminDownloadContractPdf(req, res) {
  const dossierId = Number(req.params.id);
  try {
    const [rows] = await db.query(
      `
      SELECT
        so.status, so.student_getekend_op, so.bedrijf_getekend_op, so.opleiding_getekend_op,
        so.bestand_url,
        d.dossiernummer, d.startdatum, d.einddatum,
        CONCAT(gs.voornaam, ' ', gs.achternaam) AS student_naam,
        b.naam AS bedrijf_naam,
        CONCAT(gm.voornaam, ' ', gm.achternaam) AS mentor_naam,
        CONCAT(gdoc.voornaam, ' ', gdoc.achternaam) AS docent_naam
      FROM stageovereenkomsten so
      JOIN stagedossiers d ON d.id = so.stagedossier_id
      JOIN gebruikers gs ON gs.id = d.student_id
      JOIN bedrijven b ON b.id = d.bedrijf_id
      LEFT JOIN gebruikers gm ON gm.id = d.mentor_id
      LEFT JOIN gebruikers gdoc ON gdoc.id = d.stagebegeleider_id
      WHERE so.stagedossier_id = ?
      ORDER BY so.aangemaakt_op DESC
      LIMIT 1
      `,
      [dossierId]
    );

    if (rows.length === 0) return fail(res, 404, "Geen stageovereenkomst gevonden");

    const c = rows[0];
    const tekenStatus = (datum) => (datum ? `getekend op ${new Date(datum).toISOString().slice(0, 10)}` : "nog niet getekend");
    const lines = [
      "Stageovereenkomst",
      `Dossier: ${c.dossiernummer || "-"}`,
      "",
      `Student: ${c.student_naam}`,
      `Stagebedrijf: ${c.bedrijf_naam || "-"}`,
      `Stagementor: ${c.mentor_naam || "-"}`,
      `Stagebegeleider: ${c.docent_naam || "-"}`,
      `Periode: ${c.startdatum || "-"} tot ${c.einddatum || "-"}`,
      "",
      `Status: ${c.status}`,
      `Handtekening student: ${tekenStatus(c.student_getekend_op)}`,
      `Handtekening stagebedrijf: ${tekenStatus(c.bedrijf_getekend_op)}`,
      `Handtekening opleiding: ${tekenStatus(c.opleiding_getekend_op)}`
    ];

    const pdf = buildSimplePdf(lines);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="stageovereenkomst.pdf"');
    return res.send(pdf);
  } catch (error) {
    return fail(res, 500, "Stageovereenkomst-pdf genereren mislukt", error.message);
  }
}

module.exports = { getContract, signContract, registerOvereenkomst, downloadContractPdf, adminDownloadContractPdf };
