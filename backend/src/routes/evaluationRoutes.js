const express = require("express");
const router = express.Router();
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");
const { openEvaluation, getEvaluationsForStudent, saveScores, calculateResult, releaseResult, getMyStudents } = require("../controllers/evaluationController");

router.use(authenticateDemoUser);

// Studenten van de huidige docent/mentor (voor de evaluatie-selector). Vóór /:studentId!
router.get("/my-students", requireRole("docent", "mentor", "administratie"), getMyStudents);

// Admin/docent opent een evaluatiemoment voor een dossier.
router.post("/open", requireRole("administratie", "docent"), openEvaluation);

// Scores + motivatie per competentie opslaan/indienen (eigen rol).
router.post("/:evaluationId/scores", requireRole("student", "mentor", "docent"), saveScores);

// Docent berekent/registreert het resultaat en geeft het vrij.
router.post("/:evaluationId/calculate", requireRole("docent", "administratie"), calculateResult);
router.post("/:evaluationId/release", requireRole("docent", "administratie"), releaseResult);

// Lezen door de betrokken rollen.
router.get("/:studentId", requireRole("student", "mentor", "docent", "administratie"), getEvaluationsForStudent);

// Aliassen zodat de frontend (POST + pad zonder /student) ook werkt
router.post("/:id/scores", saveScores);
router.post("/:id/calculate", requireRole("administratie", "docent"), calculateResult);
router.post("/:id/release", requireRole("administratie", "docent"), releaseResult);
// Let op: deze catch-all GET moet als laatste staan (anders vangt hij /my-students etc.)
router.get("/:studentId", getEvaluationsForStudent);

module.exports = router;
