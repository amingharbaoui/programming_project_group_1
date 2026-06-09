const express = require("express");
const {
  getCommitteeApplications,
  decideApplication
} = require("../controllers/internshipController");

const router = express.Router();

router.get("/applications", getCommitteeApplications);
router.patch("/applications/:id/decision", decideApplication);

module.exports = router;
