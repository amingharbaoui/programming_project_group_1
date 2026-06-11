const express = require("express");
const { list } = require("../controllers/placeholderController");
const {
  getLogbooksByStudent,
  mentorCheckLogbookWeek
} = require("../controllers/logbookController");

const router = express.Router();

router.get("/students", list("Mentor studenten"));
router.get("/logbooks/:studentId", getLogbooksByStudent);
router.patch("/logbooks/:weekId/check", mentorCheckLogbookWeek);

module.exports = router;
