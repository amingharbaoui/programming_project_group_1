const express = require("express");
const { list, action } = require("../controllers/placeholderController");

const router = express.Router();

router.get("/:studentId", list("Evaluaties ophalen"));
router.post("/", action("Evaluatie aanmaken"));
router.patch("/:id", action("Evaluatie aanpassen"));

module.exports = router;
