const express = require("express");
const {
  createLogbook,
  saveLogbookDay,
  getLogbooksByStudent,
  studentAntwoordFeedback
} = require("../controllers/logbookController");
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateDemoUser, requireRole("student"));

router.post("/", createLogbook);
router.post("/day", saveLogbookDay);
router.get("/:studentId", getLogbooksByStudent);
router.patch("/weeks/:weekId/antwoord", studentAntwoordFeedback);

module.exports = router;
