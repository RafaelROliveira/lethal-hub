// src/config/db.ts
import mongoose from "mongoose";

export async function connectDB(uri: string) {
  try {
    await mongoose.connect(uri);
    console.log("✅ Conectado ao MongoDB");
  } catch (err) {
    console.error("❌ Erro ao conectar ao MongoDB", err);
    process.exit(1);
  }
}
