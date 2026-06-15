const express = require("express");
const {
  getAdminDossiers,
  getAdminDossierById,
  updateAdminDossierStatus,
  assignDossier,
  registerDossierStartklaar,
  generateEindoverzicht
} = require("../controllers/internshipController");
const { getSettings, updateStageRule, updateDocumentType } = require("../controllers/settingsController");
const { inviteMentor } = require("../controllers/userController");
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateDemoUser, requireRole("administratie"));

router.get("/dossiers", getAdminDossiers);
router.get("/dossiers/:id", getAdminDossierById);
router.patch("/dossiers/:id/status", updateAdminDossierStatus);
router.patch("/dossiers/:id/assign", assignDossier);
router.patch("/dossiers/:id/startklaar", registerDossierStartklaar);
router.post("/dossiers/:id/eindoverzicht", generateEindoverzicht);

router.get("/settings", getSettings);
router.patch("/stage-rules/:id", updateStageRule);
router.patch("/document-types/:id", updateDocumentType);

router.post("/invitations", inviteMentor);

module.exports = router;
