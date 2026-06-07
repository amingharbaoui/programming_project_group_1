function getHealth(req, res) {
  res.json({
    status: "ok",
    message: "Stageify backend is running"
  });
}

module.exports = {
  getHealth
};