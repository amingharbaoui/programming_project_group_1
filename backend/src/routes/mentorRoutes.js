const express = require("express");
const { list, action } = require("../controllers/placeholderController");

const router = express.Router();

router.get("/students", list("Mentor studenten"));
router.get("/logbooks/:studentId", list("Mentor logboeken"));
router.patch("/logbooks/:weekId/check", action("Mentor logboek check"));

module.exports = router;
