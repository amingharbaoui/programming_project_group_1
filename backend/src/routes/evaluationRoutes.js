const express = require("express");
const {
  openEvaluation,
  getEvaluationsForStudent,
  saveScores,
  calculateResult,
  releaseResult
} = require("../controllers/evaluationController");
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateDemoUser);

// Admin/docent opent een evaluatiemoment voor een dossier.
router.post("/open", requireRole("administratie", "docent"), openEvaluation);

// Scores + motivatie per competentie opslaan/indienen (eigen rol).
router.post("/:evaluationId/scores", requireRole("student", "mentor", "docent"), saveScores);

// Docent berekent/registreert het resultaat en geeft het vrij.
router.post("/:evaluationId/calculate", requireRole("docent", "administratie"), calculateResult);
router.post("/:evaluationId/release", requireRole("docent", "administratie"), releaseResult);

// Lezen door de betrokken rollen (student enkel eigen dossier; mentor/docent indien gekoppeld).
router.get("/:studentId", requireRole("student", "mentor", "docent", "administratie"), getEvaluationsForStudent);

module.exports = router;
