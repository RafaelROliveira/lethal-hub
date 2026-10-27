// src/routes/backupRoutes.ts
import { Router } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { BackupModel } from "../models/Backup";

const router = Router();

// Todas as rotas daqui exigem estar logado
router.use(authMiddleware);

// POST /backup  -> salva/atualiza backup
router.post("/", async (req: AuthRequest, res) => {
  const userId = req.user?.userId;
  const role = req.user?.role;
  const { data } = req.body;

  if (!userId) {
    return res.status(401).json({ message: "Usuário não autenticado" });
  }

  if (role === "DEMO") {
    return res
      .status(403)
      .json({ message: "Usuário de demonstração não pode salvar backup na nuvem" });
  }

  if (!data) {
    return res.status(400).json({ message: "Dados de backup não fornecidos" });
  }

  try {
    const backup = await BackupModel.findOneAndUpdate(
      { userId },
      { data, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    return res.json({
      message: "Backup salvo com sucesso",
      updatedAt: backup.updatedAt,
    });
  } catch (err) {
    console.error("Erro em POST /backup:", err);
    return res.status(500).json({ message: "Erro ao salvar backup" });
  }
});

// GET /backup  -> retorna backup do usuário
router.get("/", async (req: AuthRequest, res) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: "Usuário não autenticado" });
  }

  try {
    const backup = await BackupModel.findOne({ userId });

    if (!backup) {
      // pode ser 200 com data null ou 404; teu front está preparado para 404
      return res.status(404).json({ message: "Nenhum backup encontrado" });
    }

    return res.json({
      data: backup.data,
      updatedAt: backup.updatedAt,
    });
  } catch (err) {
    console.error("Erro em GET /backup:", err);
    return res.status(500).json({ message: "Erro ao buscar backup" });
  }
});

export default router;
