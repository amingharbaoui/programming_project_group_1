const express = require("express");
const {
  listCompetencies,
  createCompetency,
  updateCompetency,
  deleteCompetency,
  publishProfile,
  duplicateProfile,
  archiveProfile
} = require("../controllers/competencyController");
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateDemoUser);

// Lezen mag elke ingelogde rol (nodig voor de evaluatie-matrix van student/mentor/docent).
router.get("/", listCompetencies);

// Beheer enkel voor administratie.
router.post("/", requireRole("administratie"), createCompetency);
router.patch("/profiles/:id/publish", requireRole("administratie"), publishProfile);
router.post("/profiles/:id/duplicate", requireRole("administratie"), duplicateProfile);
router.patch("/profiles/:id/archive", requireRole("administratie"), archiveProfile);
router.patch("/:id", requireRole("administratie"), updateCompetency);
router.delete("/:id", requireRole("administratie"), deleteCompetency);

module.exports = router;
