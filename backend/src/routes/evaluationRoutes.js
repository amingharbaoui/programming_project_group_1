const express = require("express");
const {
  openEvaluation,
  getEvaluationsForStudent
} = require("../controllers/evaluationController");
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateDemoUser);

// Admin/docent opent een evaluatiemoment voor een dossier.
router.post("/open", requireRole("administratie", "docent"), openEvaluation);

// Lezen door de betrokken rollen (student enkel eigen dossier; mentor/docent indien gekoppeld).
router.get("/:studentId", requireRole("student", "mentor", "docent", "administratie"), getEvaluationsForStudent);

module.exports = router;
