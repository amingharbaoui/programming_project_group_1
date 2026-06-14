const path = require("path");
const multer = require("multer");
const db = require("../config/db");
const { ok, fail } = require("../utils/response");

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
      `SELECT id, naam, type FROM document_soorten ORDER BY naam ASC`
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
      JOIN document_soorten ds ON ds.id = doc.document_soort_id
      JOIN stagedossiers d ON d.id = doc.stagedossier_id
      WHERE d.student_id = ?
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
    return fail(res, 400, "document_soort_id is verplicht");
  }

  if (!req.file) {
    return fail(res, 400, "Geen bestand ontvangen");
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [dossiers] = await connection.query(
      `SELECT id FROM stagedossiers WHERE student_id = ? ORDER BY aangemaakt_op DESC LIMIT 1`,
      [studentId]
    );

    if (dossiers.length === 0) {
      await connection.rollback();
      return fail(res, 404, "Geen stagedossier gevonden");
    }

    const dossier_id = dossiers[0].id;

    const [versieRows] = await connection.query(
      `
      SELECT COALESCE(MAX(versie_nummer), 0) AS max_versie
      FROM documenten
      WHERE stagedossier_id = ? AND document_soort_id = ?
      `,
      [dossier_id, document_soort_id]
    );

    const nieuw_versie = versieRows[0].max_versie + 1;
    const bestandUrl = `/uploads/${req.file.filename}`;

    /* Zet vorige actieve versie op afgekeurd */
    await connection.query(
      `
      UPDATE documenten
      SET status = 'afgekeurd', aangepast_op = NOW()
      WHERE stagedossier_id = ? AND document_soort_id = ? AND status NOT IN ('afgekeurd', 'geregistreerd')
      `,
      [dossier_id, document_soort_id]
    );

    const [result] = await connection.query(
      `
      INSERT INTO documenten
        (stagedossier_id, document_soort_id, status, versie_nummer, bestand_url, bestand_naam, opgeladen_door_id, aangemaakt_op, aangepast_op)
      VALUES (?, ?, 'ingediend', ?, ?, ?, ?, NOW(), NOW())
      `,
      [dossier_id, document_soort_id, nieuw_versie, bestandUrl, req.file.originalname, studentId]
    );

    await connection.commit();

    return ok(
      res,
      {
        id: result.insertId,
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

module.exports = { getDocuments, uploadDocument, uploadMiddleware, getSoorten };
