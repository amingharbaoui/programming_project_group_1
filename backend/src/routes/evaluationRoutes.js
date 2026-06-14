const express = require("express");
const router = express.Router();
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");
const { getEvaluationsForStudent, saveScores } = require("../controllers/evaluationController");

router.use(authenticateDemoUser);

// GET /api/evaluations/:studentId — evaluaties + competenties + scores ophalen
router.get("/:studentId", requireRole("student", "mentor", "docent", "administratie"), getEvaluationsForStudent);

// POST /api/evaluations/:evaluationId/scores — scores opslaan of indienen
router.post("/:evaluationId/scores", requireRole("student", "mentor", "docent"), saveScores);

module.exports = router;
