const express = require("express");
const router = express.Router();
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");
const { openEvaluation, getEvaluationsForStudent, saveScores, calculateResult, releaseResult } = require("../controllers/evaluationController");

router.use(authenticateDemoUser);

// Admin/docent opent een evaluatiemoment voor een dossier.
router.post("/open", requireRole("administratie", "docent"), openEvaluation);

// Scores + motivaties opslaan (mentor of docent)
router.get("/student/:studentId", getEvaluationsForStudent);
router.patch("/:id/scores", saveScores);
router.patch("/:id/calculate", requireRole("administratie", "docent"), calculateResult);
router.patch("/:id/release", requireRole("administratie", "docent"), releaseResult);

module.exports = router;
