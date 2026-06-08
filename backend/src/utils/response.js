function ok(res, data = null, message = "OK") {
  return res.json({
    success: true,
    message,
    data
  });
}

function fail(res, status = 500, message = "Er is iets fout gegaan", details = null) {
  return res.status(status).json({
    success: false,
    message,
    details
  });
}

module.exports = { ok, fail };
