const express = require("express");
const {
  createLogbook,
  saveLogbookDay,
  updateLogbookEntry,
  getLogbooksByStudent,
  studentAntwoordFeedback,
  studentReactieDag
} = require("../controllers/logbookController");
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateDemoUser, requireRole("student"));

router.post("/", createLogbook);
router.post("/day", saveLogbookDay);
router.patch("/entries/:id", updateLogbookEntry);
router.get("/:studentId", getLogbooksByStudent);
router.patch("/weeks/:weekId/antwoord", studentAntwoordFeedback);
router.patch("/days/:dayId/reactie", studentReactieDag);

module.exports = router;
