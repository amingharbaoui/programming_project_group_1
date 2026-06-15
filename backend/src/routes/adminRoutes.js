const express = require("express");
const {
  getAdminDossiers,
  getAdminDossierById,
  updateAdminDossierStatus,
  assignDossier,
  registerDossierStartklaar,
  generateEindoverzicht
} = require("../controllers/internshipController");
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateDemoUser, requireRole("administratie"));

router.get("/dossiers", getAdminDossiers);
router.get("/dossiers/:id", getAdminDossierById);
router.patch("/dossiers/:id/status", updateAdminDossierStatus);
router.patch("/dossiers/:id/assign", assignDossier);
router.patch("/dossiers/:id/startklaar", registerDossierStartklaar);
router.post("/dossiers/:id/eindoverzicht", generateEindoverzicht);

module.exports = router;
