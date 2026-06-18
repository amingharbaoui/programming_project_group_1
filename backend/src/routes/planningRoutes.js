const express = require("express");
const { listMyPlanning } = require("../controllers/planningController");
const { authenticateDemoUser } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateDemoUser);

router.get("/my", listMyPlanning);

module.exports = router;
