const express = require("express");
const { list, action } = require("../controllers/placeholderController");
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateDemoUser, requireRole("student", "mentor", "docent"));

router.get("/:studentId", list("Evaluaties ophalen"));
router.post("/", action("Evaluatie aanmaken"));
router.patch("/:id", action("Evaluatie aanpassen"));

module.exports = router;
