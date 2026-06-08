const express = require("express");
const { list, detail, action } = require("../controllers/placeholderController");

const router = express.Router();

router.get("/dossiers", list("Admin dossiers"));
router.get("/dossiers/:id", detail("Admin dossier"));
router.patch("/dossiers/:id/status", action("Admin dossier status"));

module.exports = router;
