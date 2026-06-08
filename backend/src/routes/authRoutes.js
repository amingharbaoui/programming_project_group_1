const express = require("express");
const { ok } = require("../utils/response");

const router = express.Router();

const demoUsers = {
  "student@ehb.be": { id: 1, voornaam: "Demo", achternaam: "Student", email: "student@ehb.be", hoofdrol: "student" },
  "commissie@ehb.be": { id: 2, voornaam: "Demo", achternaam: "Commissie", email: "commissie@ehb.be", hoofdrol: "stagecommissie" },
  "admin@ehb.be": { id: 3, voornaam: "Demo", achternaam: "Admin", email: "admin@ehb.be", hoofdrol: "administratie" },
  "mentor@bedrijf.be": { id: 4, voornaam: "Demo", achternaam: "Mentor", email: "mentor@bedrijf.be", hoofdrol: "mentor" },
  "docent@ehb.be": { id: 5, voornaam: "Demo", achternaam: "Docent", email: "docent@ehb.be", hoofdrol: "docent" }
};

router.post("/login", (req, res) => {
  const { email } = req.body;
  const user = demoUsers[email];

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Demo gebruiker niet gevonden"
    });
  }

  return ok(res, user, "Login gelukt");
});

router.get("/me", (req, res) => {
  return ok(res, null, "Me endpoint werkt voorlopig met demo login");
});

module.exports = router;
