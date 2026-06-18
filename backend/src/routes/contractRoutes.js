const express = require("express");
const router = express.Router();
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");
const { getContract, signContract, downloadContractPdf } = require("../controllers/contractController");

router.use(authenticateDemoUser);

// GET /api/contracts/my — stageovereenkomst ophalen
router.get("/my", requireRole("student"), getContract);

// GET /api/contracts/my/pdf — stageovereenkomst als pdf downloaden
router.get("/my/pdf", requireRole("student"), downloadContractPdf);

// POST /api/contracts/sign — student ondertekent
router.post("/sign", requireRole("student"), signContract);

module.exports = router;
