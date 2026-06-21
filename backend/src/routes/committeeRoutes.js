const express = require("express");
const {
  getCommitteeApplications,
  decideApplication,
  getApplicationVersions,
  getApplicationChecklist,
  saveApplicationChecklist,
  getApplicationDecisions,
  getApplicationHistory
} = require("../controllers/internshipController");
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateDemoUser, requireRole("stagecommissie"));

// Actieve beoordelingscriteria (uit de admin-instellingen) zodat de commissie-checklist niet hardcoded is.
router.get("/checklist-criteria", async (req, res) => {
  const db = require("../config/db");
  const { ok, fail } = require("../utils/response");
  try {
    const [rows] = await db.query("SELECT id, tekst, volgorde FROM checklist_items WHERE actief = 1 ORDER BY volgorde ASC, id ASC");
    return ok(res, { criteria: rows }, "Criteria opgehaald");
  } catch (e) { return fail(res, 500, "Criteria ophalen mislukt", e.message); }
});

router.get("/applications", getCommitteeApplications);
router.get("/applications/:id/versions", getApplicationVersions);
router.get("/applications/:id/historiek", getApplicationHistory);
router.get("/applications/:id/checklist", getApplicationChecklist);
router.put("/applications/:id/checklist", saveApplicationChecklist);
router.get("/applications/:id/decisions", getApplicationDecisions);
router.patch("/applications/:id/decision", decideApplication);

module.exports = router;
