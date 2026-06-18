const express = require("express");
const {
  getAdminDossiers,
  getAdminDossierById,
  updateAdminDossierStatus,
  assignDossier,
  registerDossierStartklaar,
  generateEindoverzicht,
  sendContractReminder
} = require("../controllers/internshipController");
const { getSettings, updateStageRule, updateDocumentType, createDocumentType, resetDocumentTypes, deleteDocumentType } = require("../controllers/settingsController");
const { inviteMentor, inviteUser } = require("../controllers/userController");
const { approveDocument, rejectDocument } = require("../controllers/documentController");
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateDemoUser, requireRole("administratie"));

router.get("/dossiers", getAdminDossiers);
router.get("/dossiers/:id", getAdminDossierById);
router.patch("/dossiers/:id/status", updateAdminDossierStatus);
router.patch("/dossiers/:id/assign", assignDossier);
router.patch("/dossiers/:id/startklaar", registerDossierStartklaar);
router.post("/dossiers/:id/eindoverzicht", generateEindoverzicht);
router.post("/dossiers/:id/reminder", sendContractReminder);

router.get("/settings", getSettings);
router.patch("/stage-rules/:id", updateStageRule);
router.post("/document-types", createDocumentType);
router.patch("/document-types/:id", updateDocumentType);
router.delete("/document-types/:id", deleteDocumentType);
router.post("/document-types/reset", resetDocumentTypes);

router.post("/invitations", inviteMentor);
router.post("/users/invite", inviteUser);

router.patch("/documents/:id/approve", approveDocument);
router.patch("/documents/:id/reject", rejectDocument);

module.exports = router;
