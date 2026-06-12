const express = require("express");
const { list, action } = require("../controllers/placeholderController");
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateDemoUser, requireRole("administratie"));

router.get("/", list("Competenties"));
router.post("/", action("Competentie aanmaken"));
router.patch("/:id", action("Competentie aanpassen"));

module.exports = router;
