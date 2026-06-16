const express = require("express");
const {
  getMyInternship,
  createInternship,
  saveDraft,
  withdrawInternship
} = require("../controllers/internshipController");
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateDemoUser, requireRole("student"));

router.get("/my", getMyInternship);
router.post("/draft", saveDraft);
router.patch("/my/intrekken", withdrawInternship);
router.post("/", createInternship);

module.exports = router;
