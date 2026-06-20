const express = require("express");
const {
  getMyInternship,
  getMyInternshipHistory,
  createInternship,
  saveDraft,
  withdrawInternship,
  resubmitInternship
} = require("../controllers/internshipController");
const { getSettings } = require("../controllers/settingsController");
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateDemoUser, requireRole("student"));

router.get("/my", getMyInternship);
router.get("/my/historiek", getMyInternshipHistory);
router.get("/settings", getSettings);
router.post("/draft", saveDraft);
router.patch("/my/intrekken", withdrawInternship);
router.post("/my/herindienen", resubmitInternship);
router.post("/", createInternship);

module.exports = router;
