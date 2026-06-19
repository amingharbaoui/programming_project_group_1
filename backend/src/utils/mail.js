const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

// Bouw een branded HTML e-mail op met Stagify-logo.
function buildMailHtml({ title, body, buttonText, buttonUrl, footer }) {
  const logoPath = path.join(__dirname, "../assets/logo.png");
  let logoTag = "";
  if (fs.existsSync(logoPath)) {
    const logoBase64 = fs.readFileSync(logoPath).toString("base64");
    logoTag = `<img src="data:image/png;base64,${logoBase64}" alt="Stagify" style="height:48px;display:block;margin:0 auto 24px;" />`;
  }
  return `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f6fa;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6fa;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background:#1e40af;padding:32px 40px;text-align:center;">
          ${logoTag}
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">${title}</h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:36px 40px;color:#374151;font-size:15px;line-height:1.7;">
          ${body}
          ${buttonUrl ? `
          <div style="text-align:center;margin:32px 0;">
            <a href="${buttonUrl}" style="background:#1e40af;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;">${buttonText || "Open link"}</a>
          </div>
          <p style="font-size:13px;color:#6b7280;word-break:break-all;">Of kopieer deze link: <a href="${buttonUrl}" style="color:#1e40af;">${buttonUrl}</a></p>
          ` : ""}
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">${footer || "© 2026 Stagify — EHB Erasmushogeschool Brussel"}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

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

async function sendMail({ to, subject, text, html, from }) {
  if (!to) return { sent: false, reason: "geen ontvanger" };
  const t = getTransporter();
  if (!t) return { sent: false, reason: "SMTP niet geconfigureerd" };
  try {
    const sender = from || process.env.MAIL_FROM || "Stagify <no-reply@stagify.local>";
    console.log(`[mail] Versturen naar ${to} via ${process.env.SMTP_USER}...`);
    await t.sendMail({ from: sender, to, subject, text, html });
    console.log(`[mail] Verstuurd naar ${to}`);
    return { sent: true };
  } catch (error) {
    console.error("[mail] sendMail mislukt:", error.message);
    return { sent: false, reason: error.message };
  }
}

module.exports = { sendMail, buildMailHtml };
