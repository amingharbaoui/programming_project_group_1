const express = require("express");
const router = express.Router();
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");
const { openEvaluation, getEvaluationsForStudent, saveScores, calculateResult, releaseResult, getMyStudents, getRubriek, saveRubriekScores } = require("../controllers/evaluationController");

router.use(authenticateDemoUser);

// Studenten van de huidige docent/mentor (voor de evaluatie-selector). Vóór /:studentId!
router.get("/my-students", requireRole("docent", "mentor", "administratie"), getMyStudents);

// Admin/docent opent een evaluatiemoment voor een dossier.
router.post("/open", requireRole("administratie", "docent"), openEvaluation);

// Scores + motivatie per competentie opslaan/indienen (eigen rol).
router.post("/:evaluationId/scores", requireRole("student", "mentor", "docent"), saveScores);

// Presentatie-rubriek lezen (betrokkenen) en scoren (docent, concept of definitief — telt 20% mee).
router.get("/:evaluationId/rubriek", requireRole("student", "mentor", "docent", "administratie"), getRubriek);
router.post("/:evaluationId/rubriek", requireRole("docent"), saveRubriekScores);

// Docent berekent/registreert het resultaat en geeft het vrij.
router.post("/:evaluationId/calculate", requireRole("docent", "administratie"), calculateResult);
router.post("/:evaluationId/release", requireRole("docent", "administratie"), releaseResult);

// Lezen door de betrokken rollen.
router.get("/:studentId", requireRole("student", "mentor", "docent", "administratie"), getEvaluationsForStudent);

module.exports = router;
