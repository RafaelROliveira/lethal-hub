// src/server.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db";
import authRoutes from "./routes/authRoutes";
import backupRoutes from "./routes/backupRoutes";

const app = express();

app.use(express.json());

const allowedOrigin = process.env.CORS_ORIGIN || "*";

app.use(
  cors({
    origin: allowedOrigin,
  })
);

// rotas
app.use("/auth", authRoutes);
app.use("/backup", backupRoutes);

// healthcheck
app.get("/", (_req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 8080;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI não configurado no .env");
  process.exit(1);
}

connectDB(MONGODB_URI).then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
  });
});
