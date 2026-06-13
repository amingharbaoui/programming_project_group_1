const express = require("express");
const {
  openEvaluation,
  getEvaluationsForStudent,
  saveScores
} = require("../controllers/evaluationController");
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateDemoUser);

// Admin/docent opent een evaluatiemoment voor een dossier.
router.post("/open", requireRole("administratie", "docent"), openEvaluation);

// Scores + motivatie per competentie opslaan/indienen (eigen rol).
router.post("/:evaluationId/scores", requireRole("student", "mentor", "docent"), saveScores);

// Lezen door de betrokken rollen (student enkel eigen dossier; mentor/docent indien gekoppeld).
router.get("/:studentId", requireRole("student", "mentor", "docent", "administratie"), getEvaluationsForStudent);

module.exports = router;
