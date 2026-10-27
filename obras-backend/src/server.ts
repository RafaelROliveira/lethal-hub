// src/server.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { connectDB } from "./config/db";
import authRoutes from "./routes/authRoutes";
import backupRoutes from "./routes/backupRoutes";

const app = express();

app.use(compression());
app.use(express.json());


const allowedOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // permite requests sem origin (ex: curl/postman)
      if (!origin) return cb(null, true);

      // se não definiu nada, libera tudo (não recomendo em prod)
      if (allowedOrigins.length === 0) {
        console.warn(
          `⚠️  CORS_ORIGIN não definida — liberando origem "${origin}" (NÃO recomendado em produção).`
        );
        return cb(null, true);
      }

      if (allowedOrigins.includes(origin)) return cb(null, true);

      return cb(new Error(`CORS bloqueado para: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);


// limita tentativas de login/registro pra dificultar força bruta
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Muitas tentativas. Tente novamente em alguns minutos." },
});

// rotas
app.use("/auth", authLimiter, authRoutes);
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
