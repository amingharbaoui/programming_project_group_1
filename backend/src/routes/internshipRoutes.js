const express = require("express");
const {
  getMyInternship,
  createInternship
} = require("../controllers/internshipController");

const router = express.Router();

router.get("/my", getMyInternship);
router.post("/", createInternship);

module.exports = router;
