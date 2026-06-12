const express = require("express");
const { getUsers } = require("../controllers/userController");
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateDemoUser, requireRole("administratie"));

router.get("/", getUsers);

module.exports = router;
