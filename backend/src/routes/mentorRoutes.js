const express = require("express");
const { list } = require("../controllers/placeholderController");
const {
  getLogbooksByStudent,
  mentorCheckLogbookWeek
} = require("../controllers/logbookController");
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateDemoUser, requireRole("mentor"));

router.get("/students", list("Mentor studenten"));
router.get("/logbooks/:studentId", getLogbooksByStudent);
router.patch("/logbooks/:weekId/check", mentorCheckLogbookWeek);

module.exports = router;
