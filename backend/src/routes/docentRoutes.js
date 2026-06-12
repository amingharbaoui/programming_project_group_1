const express = require("express");
const { list, detail } = require("../controllers/placeholderController");
const {
  getLogbooksByStudent,
  docentReviewLogbookWeek
} = require("../controllers/logbookController");
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateDemoUser, requireRole("docent"));

router.get("/students", list("Docent studenten"));
router.get("/students/:id", detail("Docent student"));
router.get("/logbooks/:studentId", getLogbooksByStudent);
router.patch("/logbooks/:weekId/review", docentReviewLogbookWeek);

module.exports = router;
