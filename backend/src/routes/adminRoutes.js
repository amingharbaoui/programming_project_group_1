const express = require("express");
const {
  getAdminDossiers
} = require("../controllers/internshipController");

const router = express.Router();

router.get("/dossiers", getAdminDossiers);

module.exports = router;
