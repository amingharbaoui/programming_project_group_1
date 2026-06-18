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

// Studenten (story 35)
router.get("/students", getDocentStudents);
router.get("/students/:dossierId/dossier", getDocentStudentDossier);

// Voorstellen (story 36)
router.get("/proposals", getDocentProposals);
router.get("/proposals/:id", getDocentProposalById);

// Logboeken (stories 39, 40)
router.get("/logbooks/:studentId", getLogbooksByStudent);
router.patch("/logbooks/:weekId/review", docentReviewLogbookWeek);
router.get("/logbooks/missing", getMissingLogbooksForDocent);
router.post("/logbooks/:studentId/remind", sendMissingLogbookReminder);

// Planning (stories 38, 42)
router.get("/planning", listDocentPlanning);
router.post("/planning/visit", createVisit);
router.post("/planning/presentation", createPresentation);
router.patch("/planning/:id", updateDocentPlanning);

module.exports = router;
