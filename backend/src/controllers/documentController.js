const path = require("path");
const multer = require("multer");
const db = require("../config/db");
const { ok, fail } = require("../utils/response");
const { meld } = require("../utils/notify");
const { verifyToken } = require("../utils/token");

async function getDocumentStudentId(documentId) {
  const [rows] = await db.query(
    "SELECT d.student_id FROM documenten doc JOIN stagedossiers d ON d.id = doc.stagedossier_id WHERE doc.id = ? LIMIT 1",
    [documentId]
  );
  return rows[0]?.student_id || null;
}

/* ── Multer configuratie ── */
const storage = multer.diskStorage({
  destination: path.join(__dirname, "../../uploads"),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${ts}_${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "image/png", "image/jpeg"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Alleen PDF, PNG of JPEG bestanden zijn toegestaan"));
    }
  },
});

const uploadMiddleware = upload.single("bestand");

function getUserId(req) {
  return Number(req.user?.id || 1);
}

/* GET /api/documents/soorten */
async function getSoorten(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT id, naam, type, is_verplicht FROM document_soorten WHERE status = 'actief' ORDER BY naam ASC`
    );
    return ok(res, rows, "Document soorten opgehaald");
  } catch (error) {
    return fail(res, 500, "Document soorten ophalen mislukt", error.message);
  }
}

/* GET /api/documents/my */
async function getDocuments(req, res) {
  const studentId = getUserId(req);

  try {
    const [rows] = await db.query(
      `
      SELECT
        doc.id,
        doc.stagedossier_id,
        doc.document_soort_id,
        ds.naam AS soort_naam,
        ds.type AS soort_type,
        doc.status,
        doc.versie_nummer,
        doc.bestand_url,
        doc.bestand_naam,
        doc.opgeladen_op,
        doc.afkeurreden
      FROM documenten doc
      LEFT JOIN document_soorten ds ON ds.id = doc.document_soort_id
      JOIN stagedossiers d ON d.id = doc.stagedossier_id
      WHERE d.student_id = ? AND doc.zichtbaar_voor_student = 1
      ORDER BY ds.naam ASC, doc.versie_nummer DESC
      `,
      [studentId]
    );

    return ok(res, rows, "Documenten opgehaald");
  } catch (error) {
    return fail(res, 500, "Documenten ophalen mislukt", error.message);
  }
}

/* POST /api/documents/upload */
async function uploadDocument(req, res) {
  const studentId = getUserId(req);
  const { document_soort_id } = req.body;

  if (!document_soort_id) {
    return fail(res, 400, "document_soort_id is verplicht voor verplichte documenten");
  }

  if (!req.file) {
    return fail(res, 400, "Geen bestand ontvangen");
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [dossiers] = await connection.query(
      `SELECT id, status FROM stagedossiers WHERE student_id = ? ORDER BY aangemaakt_op DESC LIMIT 1`,
      [studentId]
    );

    if (dossiers.length === 0) {
      await connection.rollback();
      return fail(res, 404, "Geen stagedossier gevonden");
    }

    const dossier_id = dossiers[0].id;
    if (["resultaat_vrijgegeven", "afgerond"].includes(dossiers[0].status)) {
      await connection.rollback();
      return fail(res, 409, "Je stagedossier is afgerond; documenten kunnen niet meer gewijzigd worden");
    }

    const bestandUrl = `/uploads/${req.file.filename}`;

    /* Controleer of er al een rij bestaat voor deze soort in dit dossier */
    const [bestaand] = await connection.query(
      `SELECT id, versie_nummer, status FROM documenten WHERE stagedossier_id = ? AND document_soort_id = ? LIMIT 1`,
      [dossier_id, document_soort_id]
    );

    // Een al goedgekeurd/geregistreerd document mag niet zomaar opnieuw geüpload worden.
    if (bestaand.length > 0 && ["goedgekeurd", "geregistreerd"].includes(bestaand[0].status)) {
      await connection.rollback();
      return fail(res, 409, "Dit document is al goedgekeurd en kan niet meer vervangen worden");
    }

    let resultId;
    let nieuw_versie;

    if (bestaand.length > 0) {
      /* Bestaand document: versie ophogen en updaten (UNIQUE constraint staat geen tweede rij toe) */
      resultId = bestaand[0].id;
      nieuw_versie = bestaand[0].versie_nummer + 1;
      await connection.query(
        `UPDATE documenten
         SET status = 'ingediend', versie_nummer = ?, bestand_url = ?, bestand_naam = ?,
             opgeladen_door_id = ?, afkeurreden = NULL, opgeladen_op = NOW(), aangepast_op = NOW()
         WHERE id = ?`,
        [nieuw_versie, bestandUrl, req.file.originalname, studentId, resultId]
      );
    } else {
      /* Eerste upload: nieuwe rij aanmaken */
      nieuw_versie = 1;
      const [ins] = await connection.query(
        `INSERT INTO documenten
           (stagedossier_id, document_soort_id, status, versie_nummer, bestand_url, bestand_naam, opgeladen_door_id, opgeladen_op, aangemaakt_op, aangepast_op)
         VALUES (?, ?, 'ingediend', 1, ?, ?, ?, NOW(), NOW(), NOW())`,
        [dossier_id, document_soort_id, bestandUrl, req.file.originalname, studentId]
      );
      resultId = ins.insertId;
    }

    await connection.commit();

    try {
      const [admins] = await db.query("SELECT id FROM gebruikers WHERE hoofdrol = 'administratie' AND status = 'actief'");
      for (const a of admins) {
        await meld(a.id, { titel: "Nieuw document ingediend", bericht: "Een student heeft een document opgeladen ter controle.", aangemaaktDoorId: studentId, stagedossierId: dossier_id, documentId: resultId });
      }
    } catch (e) { console.error("Melding document upload mislukt:", e.message); }

    return ok(
      res,
      {
        id: resultId,
        bestand_url: bestandUrl,
        bestand_naam: req.file.originalname,
        versie_nummer: nieuw_versie,
        status: "ingediend",
      },
      "Document succesvol geüpload"
    );
  } catch (error) {
    await connection.rollback();
    return fail(res, 500, "Upload mislukt", error.message);
  } finally {
    connection.release();
  }
}

/* POST /api/documents/upload-eigen */
async function uploadEigenDocument(req, res) {
  const studentId = getUserId(req);

  if (!req.file) {
    return fail(res, 400, "Geen bestand ontvangen");
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [dossiers] = await connection.query(
      `SELECT id, status FROM stagedossiers WHERE student_id = ? ORDER BY aangemaakt_op DESC LIMIT 1`,
      [studentId]
    );

    if (dossiers.length === 0) {
      await connection.rollback();
      return fail(res, 404, "Geen stagedossier gevonden");
    }

    const dossier_id = dossiers[0].id;
    if (["resultaat_vrijgegeven", "afgerond"].includes(dossiers[0].status)) {
      await connection.rollback();
      return fail(res, 409, "Je stagedossier is afgerond; documenten kunnen niet meer gewijzigd worden");
    }
    const bestandUrl = `/uploads/${req.file.filename}`;

    const [result] = await connection.query(
      `
      INSERT INTO documenten
        (stagedossier_id, document_soort_id, status, versie_nummer, bestand_url, bestand_naam, opgeladen_door_id, opgeladen_op, aangemaakt_op, aangepast_op)
      VALUES (?, NULL, 'ingediend', 1, ?, ?, ?, NOW(), NOW(), NOW())
      `,
      [dossier_id, bestandUrl, req.file.originalname, studentId]
    );

    await connection.commit();

    try {
      const [admins] = await db.query("SELECT id FROM gebruikers WHERE hoofdrol = 'administratie' AND status = 'actief'");
      for (const a of admins) {
        await meld(a.id, { titel: "Nieuw document toegevoegd", bericht: "Een student heeft een eigen document toegevoegd aan zijn dossier.", aangemaaktDoorId: studentId, stagedossierId: dossier_id, documentId: result.insertId });
      }
    } catch (e) { console.error("Melding eigen document mislukt:", e.message); }

    return ok(
      res,
      {
        id: result.insertId,
        bestand_url: bestandUrl,
        bestand_naam: req.file.originalname,
        versie_nummer: 1,
        status: "ingediend",
      },
      "Eigen document succesvol geüpload"
    );
  } catch (error) {
    await connection.rollback();
    return fail(res, 500, "Upload mislukt", error.message);
  } finally {
    connection.release();
  }
}

// Administratie keurt een document goed.
async function approveDocument(req, res) {
  const id = Number(req.params.id);
  if (!id) return fail(res, 400, "Ongeldig document-id");

  try {
    const [docs] = await db.query("SELECT bestand_url, bestand_naam, status FROM documenten WHERE id = ? LIMIT 1", [id]);
    if (docs.length === 0) return fail(res, 404, "Document niet gevonden");
    if (!docs[0].bestand_url && !docs[0].bestand_naam) {
      return fail(res, 400, "Een document zonder geupload bestand kan niet goedgekeurd worden");
    }
    if (!["ingediend", "in_controle"].includes(docs[0].status)) {
      return fail(res, 409, "Dit document is niet meer in behandeling en kan niet goedgekeurd worden");
    }

    const [r] = await db.query(
      `UPDATE documenten
       SET status = 'goedgekeurd', afkeurreden = NULL, gecontroleerd_door_id = ?, gecontroleerd_op = NOW(), aangepast_op = NOW()
       WHERE id = ?`,
      [Number(req.user?.id), id]
    );
    if (r.affectedRows === 0) return fail(res, 404, "Document niet gevonden");

    try {
      const studentId = await getDocumentStudentId(id);
      if (studentId) await meld(studentId, { titel: "Document goedgekeurd", bericht: "Een van je documenten is goedgekeurd.", aangemaaktDoorId: Number(req.user?.id), documentId: id });
    } catch (e) { console.error("Melding document goedkeuren mislukt:", e.message); }

    return ok(res, { id, status: "goedgekeurd" }, "Document goedgekeurd");
  } catch (error) {
    return fail(res, 500, "Document goedkeuren mislukt", error.message);
  }
}

// Administratie keurt een document af (reden verplicht).
async function rejectDocument(req, res) {
  const id = Number(req.params.id);
  const reden = (req.body.afkeurreden ?? req.body.reden ?? "").trim();
  if (!id) return fail(res, 400, "Ongeldig document-id");
  if (!reden) return fail(res, 400, "Een afkeuringsreden is verplicht");

  try {
    const [docs] = await db.query("SELECT status FROM documenten WHERE id = ? LIMIT 1", [id]);
    if (docs.length === 0) return fail(res, 404, "Document niet gevonden");
    if (!["ingediend", "in_controle"].includes(docs[0].status)) {
      return fail(res, 409, "Dit document is niet meer in behandeling en kan niet afgekeurd worden");
    }

    const [r] = await db.query(
      `UPDATE documenten
       SET status = 'afgekeurd', afkeurreden = ?, gecontroleerd_door_id = ?, gecontroleerd_op = NOW(), aangepast_op = NOW()
       WHERE id = ?`,
      [reden, Number(req.user?.id), id]
    );
    if (r.affectedRows === 0) return fail(res, 404, "Document niet gevonden");

    try {
      const studentId = await getDocumentStudentId(id);
      if (studentId) await meld(studentId, { titel: "Document afgekeurd", bericht: `Een document is afgekeurd: ${reden}`, ernst: "medium", aangemaaktDoorId: Number(req.user?.id), documentId: id });
    } catch (e) { console.error("Melding document afkeuren mislukt:", e.message); }

    return ok(res, { id, status: "afgekeurd" }, "Document afgekeurd");
  } catch (error) {
    return fail(res, 500, "Document afkeuren mislukt", error.message);
  }
}

/* GET /api/documents/bestand/:filename — bestand serveren */
const fs = require("fs");
const UPLOADS_DIR = path.join(__dirname, "../../uploads");

async function serveBestand(req, res) {
  // Auth vereist: token via Authorization-header of ?t= query (een iframe/preview kan geen header sturen).
  const headerToken = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const sessie = verifyToken(headerToken || req.query.t);
  if (!sessie) {
    return res.status(401).json({ success: false, message: "Authenticatie vereist" });
  }
  // Wildcard route: req.params[0] bevat het volledige pad incl. subdirectories
  // Regex route: capture group 0 bevat het volledige pad incl. subdirectories
  const filename = (req.params[0] ?? req.params.filename ?? "").toString();
  if (!filename || filename.includes("..") || filename.includes("\\")) {
    return res.status(400).json({ success: false, message: "Ongeldige bestandsnaam" });
  }

  // Eigenaarschap: enkel betrokkenen van het dossier mogen het bestand openen (administratie alles).
  try {
    const [users] = await db.query("SELECT hoofdrol FROM gebruikers WHERE id = ? LIMIT 1", [sessie.id]);
    const rol = users[0]?.hoofdrol;
    if (rol !== "administratie") {
      const [docs] = await db.query(
        `SELECT d.student_id, d.mentor_id, d.stagebegeleider_id
         FROM documenten doc JOIN stagedossiers d ON d.id = doc.stagedossier_id
         WHERE doc.bestand_url = CONCAT('/uploads/', ?) OR doc.bestand_naam = ?
         LIMIT 1`,
        [filename, filename]
      );
      const d = docs[0];
      const toegestaan = d && (
        (rol === "student" && d.student_id === sessie.id) ||
        (rol === "mentor" && d.mentor_id === sessie.id) ||
        (rol === "docent" && d.stagebegeleider_id === sessie.id)
      );
      if (!toegestaan) {
        return res.status(403).json({ success: false, message: "Geen toegang tot dit bestand" });
      }
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: "Toegangscontrole mislukt" });
  }

  const filePath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: "Bestand niet gevonden" });
  }
  res.sendFile(filePath);
}

module.exports = { getDocuments, uploadDocument, uploadEigenDocument, uploadMiddleware, getSoorten, approveDocument, rejectDocument, serveBestand };
