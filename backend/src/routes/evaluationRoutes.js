const express = require("express");
const router = express.Router();
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");
const { openEvaluation, getEvaluationsForStudent, saveScores, calculateResult, releaseResult, getMyStudents } = require("../controllers/evaluationController");

router.use(authenticateDemoUser);

// Studenten van de huidige docent/mentor (voor de evaluatie-selector). Vóór /:studentId!
router.get("/my-students", requireRole("docent", "mentor", "administratie"), getMyStudents);

// Admin/docent opent een evaluatiemoment voor een dossier.
router.post("/open", requireRole("administratie", "docent"), openEvaluation);

// Scores + motivaties opslaan (mentor of docent)
router.get("/student/:studentId", getEvaluationsForStudent);
router.patch("/:id/scores", saveScores);
router.patch("/:id/calculate", requireRole("administratie", "docent"), calculateResult);
router.patch("/:id/release", requireRole("administratie", "docent"), releaseResult);

// Aliassen zodat de frontend (POST + pad zonder /student) ook werkt
router.post("/:id/scores", saveScores);
router.post("/:id/calculate", requireRole("administratie", "docent"), calculateResult);
router.post("/:id/release", requireRole("administratie", "docent"), releaseResult);
// Let op: deze catch-all GET moet als laatste staan (anders vangt hij /my-students etc.)
router.get("/:studentId", getEvaluationsForStudent);

module.exports = router;
