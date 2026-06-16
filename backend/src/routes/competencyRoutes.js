const express = require("express");
const {
  listCompetencies,
  createCompetency,
  updateCompetency,
  publishProfile
} = require("../controllers/competencyController");
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateDemoUser);

// Lezen mag elke ingelogde rol
router.get("/", listCompetencies);

// Beheer — alleen admin/docent
router.post("/", requireRole("administratie", "docent"), createCompetency);
router.patch("/:id", requireRole("administratie", "docent"), updateCompetency);
router.patch("/profile/:id/publish", requireRole("administratie", "docent"), publishProfile);

module.exports = router;
