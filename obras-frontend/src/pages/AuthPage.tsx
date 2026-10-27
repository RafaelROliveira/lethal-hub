import { type FormEvent, useState } from "react";
import { apiLogin, apiRegister } from "../api/apiClient";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";
import logo from "../assets/png2.png";
import "./AuthPage.css";

export function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  function trocarModo(novoModo: "login" | "register") {
    setMode(novoModo);
    setError(null);
  }

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
    <div className="auth-page">
      <div className="auth-card">
        <img className="auth-logo" src={logo} alt="Lethal Hub" />

        <h1 className="auth-title">Lethal Hub</h1>
        <p className="auth-subtitle">
          Organize animes, mangás, séries e muito mais. Seus dados ficam
          salvos no navegador, com backup opcional na nuvem.
        </p>

        <div className="auth-tabs">
          <button
            type="button"
            className={"auth-tab" + (mode === "login" ? " active" : "")}
            onClick={() => trocarModo("login")}
          >
            Entrar
          </button>
          <button
            type="button"
            className={"auth-tab" + (mode === "register" ? " active" : "")}
            onClick={() => trocarModo("register")}
          >
            Cadastrar
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        {mode === "login" ? (
          <form onSubmit={handleLogin}>
            <div className="auth-field">
              <label htmlFor="login">Usuário ou e-mail</label>
              <input
                id="login"
                name="login"
                type="text"
                autoFocus
                autoComplete="username"
                disabled={isLoading}
                required
              />
            </div>

            <div className="auth-field">
              <label htmlFor="password">Senha</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                disabled={isLoading}
                required
              />
            </div>

            <button className="auth-submit" type="submit" disabled={isLoading}>
              {isLoading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <div className="auth-field">
              <label htmlFor="username">Username (@)</label>
              <input
                id="username"
                name="username"
                type="text"
                autoFocus
                disabled={isLoading}
                required
              />
            </div>

            <div className="auth-field">
              <label htmlFor="name">Nome</label>
              <input id="name" name="name" type="text" disabled={isLoading} required />
            </div>

            <div className="auth-field">
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                disabled={isLoading}
                required
              />
            </div>

            <div className="auth-field">
              <label htmlFor="register-password">Senha</label>
              <input
                id="register-password"
                name="password"
                type="password"
                autoComplete="new-password"
                disabled={isLoading}
                required
              />
            </div>

            <div className="auth-field">
              <label htmlFor="accessCode">Código de acesso</label>
              <input
                id="accessCode"
                name="accessCode"
                type="text"
                disabled={isLoading}
                required
              />
            </div>

            <button className="auth-submit" type="submit" disabled={isLoading}>
              {isLoading ? "Cadastrando..." : "Cadastrar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
