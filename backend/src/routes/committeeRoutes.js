const express = require("express");
const { list, detail, action } = require("../controllers/placeholderController");

const router = express.Router();

router.get("/applications", list("Stagecommissie aanvragen"));
router.get("/applications/:id", detail("Stagecommissie aanvraag"));
router.patch("/applications/:id/decision", action("Stagecommissie beslissing"));

module.exports = router;
