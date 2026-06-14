const express = require("express");
const router = express.Router();
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");
const { openEvaluation, getEvaluationsForStudent, saveScores, calculateResult, releaseResult } = require("../controllers/evaluationController");

router.use(authenticateDemoUser);

// Admin/docent opent een evaluatiemoment voor een dossier.
router.post("/open", requireRole("administratie", "docent"), openEvaluation);

// Scores + motivatie per competentie opslaan/indienen (eigen rol).
router.post("/:evaluationId/scores", requireRole("student", "mentor", "docent"), saveScores);

// Docent berekent/registreert het resultaat en geeft het vrij.
router.post("/:evaluationId/calculate", requireRole("docent", "administratie"), calculateResult);
router.post("/:evaluationId/release", requireRole("docent", "administratie"), releaseResult);

// Lezen door de betrokken rollen.
router.get("/:studentId", requireRole("student", "mentor", "docent", "administratie"), getEvaluationsForStudent);

module.exports = router;
