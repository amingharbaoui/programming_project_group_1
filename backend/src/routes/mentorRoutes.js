const express = require("express");
const {
  getMentorStudents,
  getMentorContract,
  tekenContract,
  getAfspraken,
  updateAfspraken,
} = require("../controllers/mentorController");
const {
  getLogbooksByStudent,
  mentorCheckLogbookWeek,
} = require("../controllers/logbookController");
const {
  getMentorPlanning,
  bevestigBezoek,
  alternatiefsVoorstel,
} = require("../controllers/planningController");
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateDemoUser, requireRole("mentor"));

// Studenten (story 35)
router.get("/students", getMentorStudents);

// Logboeken
router.get("/logbooks/:studentId", getLogbooksByStudent);
router.patch("/logbooks/:weekId/check", mentorCheckLogbookWeek);

// Contract (story 28)
router.get("/contract/:dossierId", getMentorContract);
router.patch("/contract/:dossierId/teken", tekenContract);

// Praktische afspraken (story 29)
router.get("/dossier/:dossierId/afspraken", getAfspraken);
router.patch("/dossier/:dossierId/afspraken", updateAfspraken);

// Planning — bedrijfsbezoek (story 30)
router.get("/planning/:dossierId", getMentorPlanning);
router.patch("/planning/:id/bevestig", bevestigBezoek);
router.patch("/planning/:id/alternatief", alternatiefsVoorstel);

module.exports = router;
