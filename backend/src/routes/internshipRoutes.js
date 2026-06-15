const express = require("express");
const {
  getMyInternship,
  createInternship,
  saveDraft,
  withdrawInternship,
  resubmitInternship
} = require("../controllers/internshipController");
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateDemoUser, requireRole("student"));

router.get("/my", getMyInternship);
router.post("/draft", saveDraft);
router.patch("/my/intrekken", withdrawInternship);
router.post("/my/herindienen", resubmitInternship);
router.post("/", createInternship);

module.exports = router;
