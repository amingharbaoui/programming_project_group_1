const express = require("express");
const { getDocentStudents } = require("../controllers/docentController");
const {
  getLogbooksByStudent,
  docentReviewLogbookWeek,
} = require("../controllers/logbookController");
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateDemoUser, requireRole("docent"));

// Studenten (story 37)
router.get("/students", getDocentStudents);

// Logboeken
router.get("/logbooks/:studentId", getLogbooksByStudent);
router.patch("/logbooks/:weekId/review", docentReviewLogbookWeek);

module.exports = router;
