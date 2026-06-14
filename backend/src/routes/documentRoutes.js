const express = require("express");
const router = express.Router();
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");
const { getDocuments, uploadDocument, uploadMiddleware, getSoorten } = require("../controllers/documentController");

router.use(authenticateDemoUser);

// GET /api/documents/soorten — alle document soorten ophalen
router.get("/soorten", getSoorten);

// GET /api/documents/my — alle documenten van de student ophalen
router.get("/my", requireRole("student"), getDocuments);

// POST /api/documents/upload — nieuw document (of nieuwe versie) uploaden
router.post("/upload", requireRole("student"), uploadMiddleware, uploadDocument);

module.exports = router;
