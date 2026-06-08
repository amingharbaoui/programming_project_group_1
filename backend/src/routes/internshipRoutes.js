const express = require("express");
const { list, action } = require("../controllers/placeholderController");

const router = express.Router();

router.get("/my", list("Mijn stagevoorstel"));
router.post("/", action("Stagevoorstel indienen"));
router.patch("/:id", action("Stagevoorstel aanpassen"));

module.exports = router;
