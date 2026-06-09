const express = require("express");
const { list, detail, action } = require("../controllers/placeholderController");

const router = express.Router();

router.get("/students", list("Docent studenten"));
router.get("/students/:id", detail("Docent student"));
router.get("/logbooks/:studentId", list("Docent logboeken"));
router.patch("/logbooks/:weekId/review", action("Docent logboek review"));

module.exports = router;
