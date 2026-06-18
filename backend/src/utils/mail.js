const nodemailer = require("nodemailer");

// Verstuurt een echte e-mail via SMTP als die geconfigureerd is (SMTP_HOST/PORT/USER/PASS, MAIL_FROM).
// Zonder configuratie: veilige no-op (geeft {sent:false}) zodat de hoofdactie nooit faalt door mail.
let transporter; // undefined = nog niet bepaald, false = geen SMTP, object = transporter
function getTransporter() {
  if (transporter !== undefined) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) {
    transporter = false;
    return transporter;
  }
  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

async function sendMail({ to, subject, text, html }) {
  if (!to) return { sent: false, reason: "geen ontvanger" };
  const t = getTransporter();
  if (!t) return { sent: false, reason: "SMTP niet geconfigureerd" };
  try {
    const from = process.env.MAIL_FROM || "Stagify <no-reply@stagify.local>";
    await t.sendMail({ from, to, subject, text, html });
    return { sent: true };
  } catch (error) {
    console.error("sendMail mislukt:", error.message);
    return { sent: false, reason: error.message };
  }
}

module.exports = { sendMail };
