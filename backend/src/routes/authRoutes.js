const express = require("express");
const { ok } = require("../utils/response");

const router = express.Router();

const demoUsers = {
  "student@ehb.be": { id: 1, voornaam: "Demo", achternaam: "Student", email: "student@ehb.be", hoofdrol: "student" },
  "student2@ehb.be": { id: 6, voornaam: "Demo", achternaam: "Student 2", email: "student2@ehb.be", hoofdrol: "student" },
  "student3@ehb.be": { id: 7, voornaam: "Demo", achternaam: "Student 3", email: "student3@ehb.be", hoofdrol: "student" },
  "student4@ehb.be": { id: 8, voornaam: "Demo", achternaam: "Student 4", email: "student4@ehb.be", hoofdrol: "student" },
  "commissie@ehb.be": { id: 2, voornaam: "Demo", achternaam: "Commissie", email: "commissie@ehb.be", hoofdrol: "stagecommissie" },
  "docent@ehb.be": { id: 3, voornaam: "Demo", achternaam: "Docent", email: "docent@ehb.be", hoofdrol: "docent" },
  "admin@ehb.be": { id: 4, voornaam: "Demo", achternaam: "Admin", email: "admin@ehb.be", hoofdrol: "administratie" },
  "mentor@bedrijf.be": { id: 5, voornaam: "Demo", achternaam: "Mentor", email: "mentor@bedrijf.be", hoofdrol: "mentor" }
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
