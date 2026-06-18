const express = require("express");
const router = express.Router();
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");
const { getMyFinalResult, downloadMyEindoverzicht } = require("../controllers/evaluationController");

router.use(authenticateDemoUser, requireRole("student"));

// GET /api/students/me/final-result — vrijgegeven eindresultaat van de ingelogde student
router.get("/me/final-result", getMyFinalResult);

// GET /api/students/me/eindoverzicht.pdf — eindoverzicht downloaden (enkel na vrijgave)
router.get("/me/eindoverzicht.pdf", downloadMyEindoverzicht);

module.exports = router;
