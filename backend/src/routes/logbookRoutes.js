const express = require("express");
const {
  createLogbook,
  getLogbooksByStudent
} = require("../controllers/logbookController");

const router = express.Router();

router.post("/", createLogbook);
router.get("/:studentId", getLogbooksByStudent);

module.exports = router;
