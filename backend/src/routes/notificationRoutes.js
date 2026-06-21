const express = require("express");
const { listMine, markRead, markAllRead, deleteOne } = require("../controllers/notificationController");
const { authenticateDemoUser } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateDemoUser);

router.get("/", listMine);
router.post("/read-all", markAllRead);
router.post("/:id/read", markRead);
router.delete("/:id", deleteOne);

module.exports = router;
