const express = require("express");
const { getInvitation, activateAccount } = require("../controllers/userController");

const router = express.Router();

// Publiek (geen login): de uitgenodigde gebruiker heeft nog geen account/sessie.
// GET  /api/invitations/:token   -> uitnodigingsgegevens voor de activatiepagina
// POST /api/invitations/activate -> account activeren met token + zelfgekozen wachtwoord
router.get("/:token", getInvitation);
router.post("/activate", activateAccount);

module.exports = router;
