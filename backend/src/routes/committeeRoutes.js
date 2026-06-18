const express = require("express");
const {
  getCommitteeApplications,
  decideApplication,
  getApplicationVersions,
  getApplicationHistory,
  getApplicationChecklist
} = require("../controllers/internshipController");
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateDemoUser, requireRole("stagecommissie"));

router.get("/applications", getCommitteeApplications);
router.get("/applications/:id/versions", getApplicationVersions);
router.get("/applications/:id/historiek", getApplicationHistory);
router.get("/applications/:id/checklist", getApplicationChecklist);
router.patch("/applications/:id/decision", decideApplication);

module.exports = router;
