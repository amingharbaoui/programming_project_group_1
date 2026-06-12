const express = require("express");
const { list } = require("../controllers/placeholderController");
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateDemoUser, requireRole("administratie"));

router.get("/", list("Gebruikers"));

module.exports = router;
