const express = require("express");
const {
  getMentorStudents,
  getMentorContract,
  tekenContract,
  getAfspraken,
  updateAfspraken,
} = require("../controllers/mentorController");
const { getMentorInvitation, activateMentor } = require("../controllers/userController");
const {
  getLogbooksByStudent,
  mentorCheckLogbookWeek,
  mentorConfirmLogbookDay,
} = require("../controllers/logbookController");
const {
  listMentorPlanning,
  confirmMentorPlanning,
  proposeAlternative
} = require("../controllers/planningController");
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

// Accountactivatie via uitnodiging (story 27)
router.get("/invitations/:token", getMentorInvitation);
router.post("/activate", activateMentor);

router.use(authenticateDemoUser, requireRole("mentor"));

// Studenten (story 35)
router.get("/students", getMentorStudents);

// Logboeken
router.get("/logbooks/:studentId", getLogbooksByStudent);
router.patch("/logbooks/days/:dayId/confirm", mentorConfirmLogbookDay);
router.patch("/logbooks/days/:dayId/bevestig", mentorConfirmLogbookDay);
router.patch("/logbooks/:weekId/check", mentorCheckLogbookWeek);

// Contract (story 28)
router.get("/contract/:dossierId", getMentorContract);
router.patch("/contract/:dossierId/teken", tekenContract);

// Praktische afspraken (story 29)
router.get("/dossier/:dossierId/afspraken", getAfspraken);
router.patch("/dossier/:dossierId/afspraken", updateAfspraken);

// Planning: bedrijfsbezoek bevestigen of alternatief voorstellen (story 30)
router.get("/planning", listMentorPlanning);
router.get("/planning/:dossierId", listMentorPlanning);
router.patch("/planning/:id/confirm", confirmMentorPlanning);
router.patch("/planning/:id/alternative", proposeAlternative);
// Aliassen die de frontend gebruikt (NL-benamingen)
router.patch("/planning/:id/bevestig", confirmMentorPlanning);
router.patch("/planning/:id/alternatief", proposeAlternative);

module.exports = router;
