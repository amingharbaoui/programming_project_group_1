const express = require("express");
const {
  getDocentStudents,
  getDocentProposals,
  getDocentProposalById,
  getDocentStudentDossier
} = require("../controllers/docentController");
const {
  getLogbooksByStudent,
  docentReviewLogbookWeek,
  getMissingLogbooksForDocent,
  sendMissingLogbookReminder,
} = require("../controllers/logbookController");
const {
  listDocentPlanning,
  createVisit,
  createPresentation,
  updateDocentPlanning
} = require("../controllers/planningController");
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateDemoUser, requireRole("docent"));

// Studenten (story 37)
router.get("/students", getDocentStudents);
router.get("/students/:id/dossier", getDocentStudentDossier);

// Stagevoorstellen read-only (story 36)
router.get("/proposals", getDocentProposals);
router.get("/proposals/:id", getDocentProposalById);

// Logboeken
router.get("/logbooks/missing", getMissingLogbooksForDocent);
router.post("/logbooks/missing/:studentId/reminder", sendMissingLogbookReminder);
router.get("/logbooks/:studentId", getLogbooksByStudent);
router.patch("/logbooks/:weekId/review", docentReviewLogbookWeek);

// Planning: bedrijfsbezoek en eindpresentatie (stories 38 en 42)
router.get("/planning", listDocentPlanning);
router.post("/planning/visit", createVisit);
router.post("/planning/presentation", createPresentation);
router.patch("/planning/:id", updateDocentPlanning);

module.exports = router;
