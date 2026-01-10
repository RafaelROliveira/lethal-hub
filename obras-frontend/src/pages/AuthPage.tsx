import {type FormEvent, useState } from "react";
import { apiLogin, apiRegister } from "../api/apiClient";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";

export function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const form = e.currentTarget;
    const loginValue = (form.elements.namedItem("login") as HTMLInputElement)
      .value;
    const password = (form.elements.namedItem("password") as HTMLInputElement)
      .value;

    try {
      const res = await apiLogin({ login: loginValue, password });
      login(res.user, res.token);
      navigate("/app");
    } catch (err: any) {
      setError(err.message ?? "Erro ao fazer login");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const form = e.currentTarget;
    const username = (form.elements.namedItem("username") as HTMLInputElement)
      .value;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement)
      .value;
    const accessCode = (form.elements.namedItem(
      "accessCode"
    ) as HTMLInputElement).value;

    try {
      const res = await apiRegister({
        username,
        name,
        email,
        password,
        accessCode,
      });
      login(res.user, res.token);
      navigate("/app");
    } catch (err: any) {
      setError(err.message ?? "Erro ao registrar");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        style={{
          maxWidth: 400,
          width: "100%",
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: "1.5rem",
        }}
      >
        <h1 style={{ marginBottom: "0.5rem" }}>Controle de Obras</h1>
        <p style={{ marginBottom: "1rem", fontSize: 14, color: "#555" }}>
          Organize animes, mangás, séries e muito mais. Seus dados ficam salvos
          no navegador, com backup opcional na nuvem.
        </p>

        <div style={{ display: "flex", marginBottom: "1rem", gap: 8 }}>
          <button
            type="button"
            onClick={() => setMode("login")}
            style={{
              flex: 1,
              padding: "0.5rem",
              borderRadius: 4,
              border: "1px solid #ccc",
              background: mode === "login" ? "#eee" : "white",
            }}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            style={{
              flex: 1,
              padding: "0.5rem",
              borderRadius: 4,
              border: "1px solid #ccc",
              background: mode === "register" ? "#eee" : "white",
            }}
          >
            Cadastrar
          </button>
        </div>

        {error && (
          <div
            style={{
              marginBottom: "0.75rem",
              padding: "0.5rem",
              background: "#ffe5e5",
              color: "#b00000",
              borderRadius: 4,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        {mode === "login" ? (
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: "0.75rem" }}>
              <label>
                Usuário ou e-mail
                <input
                  name="login"
                  type="text"
                  required
                  style={{ width: "100%", padding: "0.4rem", marginTop: 4 }}
                />
              </label>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label>
                Senha
                <input
                  name="password"
                  type="password"
                  required
                  style={{ width: "100%", padding: "0.4rem", marginTop: 4 }}
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: "100%",
                padding: "0.5rem",
                borderRadius: 4,
                border: "none",
                background: "#333",
                color: "white",
              }}
            >
              {isLoading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <div style={{ marginBottom: "0.75rem" }}>
              <label>
                Username (@)
                <input
                  name="username"
                  type="text"
                  required
                  style={{ width: "100%", padding: "0.4rem", marginTop: 4 }}
                />
              </label>
            </div>
            <div style={{ marginBottom: "0.75rem" }}>
              <label>
                Nome
                <input
                  name="name"
                  type="text"
                  required
                  style={{ width: "100%", padding: "0.4rem", marginTop: 4 }}
                />
              </label>
            </div>
            <div style={{ marginBottom: "0.75rem" }}>
              <label>
                E-mail
                <input
                  name="email"
                  type="email"
                  required
                  style={{ width: "100%", padding: "0.4rem", marginTop: 4 }}
                />
              </label>
            </div>
            <div style={{ marginBottom: "0.75rem" }}>
              <label>
                Senha
                <input
                  name="password"
                  type="password"
                  required
                  style={{ width: "100%", padding: "0.4rem", marginTop: 4 }}
                />
              </label>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label>
                Código de acesso
                <input
                  name="accessCode"
                  type="text"
                  required
                  style={{ width: "100%", padding: "0.4rem", marginTop: 4 }}
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: "100%",
                padding: "0.5rem",
                borderRadius: 4,
                border: "none",
                background: "#333",
                color: "white",
              }}
            >
              {isLoading ? "Cadastrando..." : "Cadastrar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
