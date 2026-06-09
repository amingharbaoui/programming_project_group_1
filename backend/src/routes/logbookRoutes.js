const express = require("express");
const { list, action } = require("../controllers/placeholderController");

const router = express.Router();

router.post("/", action("Logboek aanmaken"));
router.get("/:studentId", list("Logboeken ophalen"));

module.exports = router;
