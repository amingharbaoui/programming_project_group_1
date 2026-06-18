const express = require("express");
const { getUsers, updateUser, deactivateUser, reactivateUser } = require("../controllers/userController");
const { authenticateDemoUser, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateDemoUser, requireRole("administratie"));

router.get("/", getUsers);
router.patch("/:id", updateUser);
router.patch("/:id/deactivate", deactivateUser);
router.patch("/:id/reactivate", reactivateUser);

module.exports = router;
