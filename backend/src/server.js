const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

const healthRoutes = require("./routes/healthRoutes");
const authRoutes = require("./routes/authRoutes");
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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-user-id"]
}));
app.use(express.json());
const UPLOADS_DIR = path.join(__dirname, "../uploads");
app.use("/uploads", (req, res, next) => {
  const rel = req.path.replace(/^\/+/, "");
  if (!rel || rel.includes("..") || rel.includes("/")) return next();
  const filePath = path.join(UPLOADS_DIR, rel);
  if (!fs.existsSync(filePath)) return next();
  res.sendFile(filePath);
});

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
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

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route niet gevonden"
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
