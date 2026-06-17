const express = require("express");
const router = express.Router();
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");
const { getDocuments, uploadDocument, uploadEigenDocument, uploadMiddleware, getSoorten } = require("../controllers/documentController");

router.use(authenticateDemoUser);

// GET /api/documents/soorten — alle document soorten ophalen
router.get("/soorten", getSoorten);

// GET /api/documents/my — alle documenten van de student ophalen
router.get("/my", requireRole("student"), getDocuments);

// POST /api/documents/upload — nieuw document (of nieuwe versie) uploaden
router.post("/upload", requireRole("student"), uploadMiddleware, uploadDocument);

// POST /api/documents/upload-eigen — eigen document uploaden (geen verplicht soort)
router.post("/upload-eigen", requireRole("student"), uploadMiddleware, uploadEigenDocument);

module.exports = router;
