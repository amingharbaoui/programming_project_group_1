const express = require("express");
const {
  getAdminDossiers,
  getAdminDossierById,
  updateAdminDossierStatus
} = require("../controllers/internshipController");

const router = express.Router();

router.get("/dossiers", getAdminDossiers);
router.get("/dossiers/:id", getAdminDossierById);
router.patch("/dossiers/:id/status", updateAdminDossierStatus);

module.exports = router;
