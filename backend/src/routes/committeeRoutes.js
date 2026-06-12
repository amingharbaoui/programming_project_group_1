const express = require("express");
const {
  getCommitteeApplications,
  decideApplication
} = require("../controllers/internshipController");
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateDemoUser, requireRole("stagecommissie"));

router.get("/applications", getCommitteeApplications);
router.patch("/applications/:id/decision", decideApplication);

module.exports = router;
