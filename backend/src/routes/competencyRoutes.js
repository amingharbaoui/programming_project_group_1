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

// Lezen mag elke ingelogde rol (nodig voor de evaluatie-matrix van student/mentor/docent).
router.get("/", listCompetencies);

// Beheer enkel voor administratie.
router.post("/", requireRole("administratie"), createCompetency);
router.patch("/profiles/:id/publish", requireRole("administratie"), publishProfile);
router.patch("/:id", requireRole("administratie"), updateCompetency);

module.exports = router;
