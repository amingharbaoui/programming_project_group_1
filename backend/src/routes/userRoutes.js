const express = require("express");
const { list } = require("../controllers/placeholderController");

const router = express.Router();

router.get("/", list("Gebruikers"));

module.exports = router;
