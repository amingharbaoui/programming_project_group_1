const express = require("express");
const { list, action } = require("../controllers/placeholderController");

const router = express.Router();

router.get("/", list("Competenties"));
router.post("/", action("Competentie aanmaken"));
router.patch("/:id", action("Competentie aanpassen"));

module.exports = router;
