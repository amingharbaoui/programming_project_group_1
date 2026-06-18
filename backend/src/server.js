const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
const db = require("./config/db");
const { verifyToken } = require("./utils/token");

const healthRoutes = require("./routes/healthRoutes");
const authRoutes = require("./routes/authRoutes");
const invitationRoutes = require("./routes/invitationRoutes");
const userRoutes = require("./routes/userRoutes");
const internshipRoutes = require("./routes/internshipRoutes");
const committeeRoutes = require("./routes/committeeRoutes");
const adminRoutes = require("./routes/adminRoutes");
const mentorRoutes = require("./routes/mentorRoutes");
const docentRoutes = require("./routes/docentRoutes");
const logbookRoutes = require("./routes/logbookRoutes");
const competencyRoutes = require("./routes/competencyRoutes");
const evaluationRoutes = require("./routes/evaluationRoutes");
const contractRoutes = require("./routes/contractRoutes");
const documentRoutes = require("./routes/documentRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const planningRoutes = require("./routes/planningRoutes");
const studentRoutes = require("./routes/studentRoutes");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-user-id"]
}));
app.use(express.json({ limit: "1mb" }));
const UPLOADS_DIR = path.join(__dirname, "../uploads");
app.use("/uploads", (req, res, next) => {
  // Auth vereist: token via Authorization-header of ?t= query (een preview/iframe kan geen header sturen).
  const headerToken = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!verifyToken(headerToken || req.query.t)) {
    return res.status(401).json({ success: false, message: "Authenticatie vereist" });
  }
  const rel = req.path.replace(/^\/+/, "");
  if (!rel || rel.includes("..") || rel.includes("/")) return next();
  const filePath = path.join(UPLOADS_DIR, rel);
  if (!fs.existsSync(filePath)) return next();
  res.sendFile(filePath);
});

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/invitations", invitationRoutes);
app.use("/api/users", userRoutes);
app.use("/api/internships", internshipRoutes);
app.use("/api/committee", committeeRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/mentor", mentorRoutes);
app.use("/api/docent", docentRoutes);
app.use("/api/logbooks", logbookRoutes);
app.use("/api/competencies", competencyRoutes);
app.use("/api/evaluations", evaluationRoutes);
app.use("/api/contracts", contractRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/planning", planningRoutes);
app.use("/api/students", studentRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route niet gevonden"
  });
});

// Centrale error-handler: vangt onverwachte fouten (incl. kapotte JSON) op zodat de client een
// nette JSON-fout krijgt i.p.v. een rauwe stacktrace, en de server niet crasht.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Onafgevangen route-fout:", err);
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  const body = { success: false, message: status === 400 ? "Ongeldige aanvraag" : "Interne serverfout" };
  if (process.env.NODE_ENV !== "production") body.details = err.message;
  res.status(status).json(body);
});

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Vangnet: laat één onafgevangen fout de server NIET platleggen (anders staat alles plat).
process.on("unhandledRejection", (reason) => {
  console.error("Onafgehandelde promise-rejection (server blijft draaien):", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Onafgevangen uitzondering (server blijft draaien):", err);
});

// Nette afsluiting bij stopsignalen: HTTP-server sluiten + DB-pool vrijgeven.
function shutdown(signaal) {
  console.log(`\n${signaal} ontvangen — server wordt netjes afgesloten...`);
  server.close(() => {
    db.end().catch(() => {}).finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(0), 5000).unref();
}
["SIGINT", "SIGTERM"].forEach((s) => process.on(s, () => shutdown(s)));
