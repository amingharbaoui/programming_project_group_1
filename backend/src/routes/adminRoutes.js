const express = require("express");
const {
  getAdminDossiers,
  getAdminDossierById,
  updateAdminDossierStatus,
  assignDossier,
  generateEindoverzicht,
  sendContractReminder
} = require("../controllers/internshipController");
const { getSettings, updateStageRule, updateDocumentType, createDocumentType, resetDocumentTypes, deleteDocumentType, createChecklistItem, updateChecklistItem, deleteChecklistItem, resetChecklistItems } = require("../controllers/settingsController");
const { inviteMentor, inviteUser, resendInvitation, resendUserInvitation } = require("../controllers/userController");
const { approveDocument, rejectDocument } = require("../controllers/documentController");
const { adminDownloadContractPdf, registerOvereenkomst } = require("../controllers/contractController");
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateDemoUser, requireRole("administratie"));

router.get("/dossiers", getAdminDossiers);
router.get("/dossiers/:id", getAdminDossierById);
router.patch("/dossiers/:id/status", updateAdminDossierStatus);
router.patch("/dossiers/:id/assign", assignDossier);
router.patch("/dossiers/:id/overeenkomst/registreer", registerOvereenkomst);
router.post("/dossiers/:id/eindoverzicht", generateEindoverzicht);
router.post("/dossiers/:id/reminder", sendContractReminder);
router.get("/dossiers/:id/contract-pdf", adminDownloadContractPdf);

router.get("/settings", getSettings);
router.patch("/stage-rules/:id", updateStageRule);
router.post("/document-types", createDocumentType);
router.patch("/document-types/:id", updateDocumentType);
router.delete("/document-types/:id", deleteDocumentType);
router.post("/document-types/reset", resetDocumentTypes);

router.get("/checklist-items", async (req, res) => {
  const db = require("../config/db");
  const { ok, fail } = require("../utils/response");
  try {
    const [rows] = await db.query("SELECT id, tekst, volgorde, actief FROM checklist_items ORDER BY volgorde ASC, id ASC");
    return ok(res, { checklistItems: rows }, "Checklist items opgehaald");
  } catch (e) { return fail(res, 500, "Ophalen mislukt", e.message); }
});
router.post("/checklist-items/reset", resetChecklistItems);
router.post("/checklist-items", createChecklistItem);
router.patch("/checklist-items/:id", updateChecklistItem);
router.delete("/checklist-items/:id", deleteChecklistItem);

router.post("/invitations", inviteMentor);
router.post("/invitations/:id/resend", resendInvitation);
router.post("/users/invite", inviteUser);
router.post("/users/:id/resend-invitation", resendUserInvitation);

router.patch("/documents/:id/approve", approveDocument);
router.patch("/documents/:id/reject", rejectDocument);

module.exports = router;
