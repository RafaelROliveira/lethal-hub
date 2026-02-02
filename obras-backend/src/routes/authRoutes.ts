// src/routes/authRoutes.ts
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { UserModel } from "../models/User";
import { AccessCodeModel } from "../models/AccessCode";

const router = Router();

interface RegisterBody {
  username: string;
  name: string;
  email: string;
  password: string;
  accessCode: string;
}

interface LoginBody {
  login: string; // username ou email
  password: string;
}

function generateToken(userId: string, username: string, role: "USER" | "ADMIN" | "DEMO") {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET não configurado");
  }

  return jwt.sign({ userId, username, role }, secret, {
    expiresIn: "7d",
  });
}

// POST /auth/register
router.post("/register", async (req, res) => {
  const { username, name, email, password, accessCode } = req.body as RegisterBody;

  if (!username || !name || !email || !password || !accessCode) {
    return res.status(400).json({ message: "Dados obrigatórios não fornecidos" });
  }

  try {
    // validar código de acesso
    const code = await AccessCodeModel.findOne({ code: accessCode });
    if (!code) {
      return res.status(400).json({ message: "Código de acesso inválido" });
    }
    if (code.used) {
      return res.status(400).json({ message: "Código de acesso já utilizado" });
    }

    // verificar username/email únicos
    const existingUsername = await UserModel.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ message: "Username já está em uso" });
    }

    const existingEmail = await UserModel.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: "E-mail já está em uso" });
    }

    // criar usuário
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await UserModel.create({
      username,
      name,
      email,
      passwordHash,
      role: "USER",
    });

    // marcar código como usado
    code.used = true;
    code.usedAt = new Date();
    await code.save();

    const token = generateToken(user._id.toString(), user.username, user.role);


    return res.status(201).json({
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        name: user.name,
      },
    });
  } catch (err) {
    console.error("Erro em /auth/register:", err);
    return res.status(500).json({ message: "Erro ao registrar usuário" });
  }
});

// POST /auth/login
router.post("/login", async (req, res) => {
  const { login, password } = req.body as LoginBody;

  if (!login || !password) {
    return res.status(400).json({ message: "Login e senha são obrigatórios" });
  }

  try {
    const user = await UserModel.findOne({
      $or: [{ username: login }, { email: login }],
    });

    if (!user) {
      return res.status(400).json({ message: "Usuário ou senha inválidos" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(400).json({ message: "Usuário ou senha inválidos" });
    }

    const token = generateToken(user._id.toString(), user.username, user.role);

    return res.json({
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        name: user.name,
      },
    });
  } catch (err) {
    console.error("Erro em /auth/login:", err);
    return res.status(500).json({ message: "Erro ao fazer login" });
  }
});

export default router;
