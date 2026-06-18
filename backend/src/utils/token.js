// Stateless sessietoken (HMAC-SHA256), zonder externe libs.
// Vorm: base64url(payload).base64url(signature) — payload = {id, exp}.
const crypto = require("crypto");

const FALLBACK_SECRET = "stagify-dev-secret-change-in-prod";
const SECRET = process.env.AUTH_SECRET || FALLBACK_SECRET;
// Een publiek bekende default maakt tokens vervalsbaar. In productie weigeren we te starten;
// in dev waarschuwen we luid zodat niemand er per ongeluk mee live gaat.
if (SECRET === FALLBACK_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET ontbreekt: zet een sterke AUTH_SECRET in de omgeving voordat je in productie start.");
  }
  console.warn("[WAARSCHUWING] AUTH_SECRET is niet gezet — er wordt een onveilige standaardsleutel gebruikt. Zet AUTH_SECRET in backend/.env.");
}
const TTL_MS = 12 * 60 * 60 * 1000; // 12 uur

function sign(payloadB64) {
  return crypto.createHmac("sha256", SECRET).update(payloadB64).digest("base64url");
}

function createToken(userId) {
  const payload = Buffer.from(JSON.stringify({ id: Number(userId), exp: Date.now() + TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  // constant-time vergelijking
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let data;
  try { data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); }
  catch { return null; }
  if (!data || !data.id || !data.exp || Date.now() > Number(data.exp)) return null;
  return { id: Number(data.id) };
}

// Verifieert een wachtwoord tegen het opgeslagen pbkdf2-formaat (pbkdf2_sha256$iter$salt$hash).
function verifyPassword(password, stored) {
  if (!stored || typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2_sha256") return false;
  const iter = parseInt(parts[1], 10);
  const salt = parts[2];
  const hash = parts[3];
  if (!iter || !salt || !hash) return false;
  const derived = crypto.pbkdf2Sync(String(password), salt, iter, 32, "sha256").toString("hex");
  const a = Buffer.from(derived);
  const b = Buffer.from(hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { createToken, verifyToken, verifyPassword };
