function ok(res, data = null, message = "OK") {
  return res.json({
    success: true,
    message,
    data
  });
}

function fail(res, status = 500, message = "Er is iets fout gegaan", details = null) {
  const body = { success: false, message };
  // Interne details (vaak error.message / SQL-fouten) enkel buiten productie meesturen → geen info-lek.
  if (details != null && process.env.NODE_ENV !== "production") {
    body.details = details;
  }
  return res.status(status).json(body);
}

module.exports = { ok, fail };
