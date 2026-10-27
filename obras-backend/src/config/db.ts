// src/config/db.ts
import mongoose from "mongoose";

export async function connectDB(uri: string, retries = 5, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 20000,
      });
      console.log("✅ Conectado ao MongoDB");
      return;
    } catch (err) {
      console.error(`❌ Erro ao conectar ao MongoDB (tentativa ${attempt}/${retries})`, err);

      if (attempt === retries) {
        process.exit(1);
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
}
