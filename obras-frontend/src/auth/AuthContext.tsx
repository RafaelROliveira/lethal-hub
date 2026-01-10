// src/auth/AuthContext.tsx
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { AuthUser } from "../api/apiClient";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthLoading: boolean;
  login: (user: AuthUser, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("authToken");
    const storedUser = localStorage.getItem("authUser");

    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser) as AuthUser;
        setToken(storedToken);
        setUser(parsedUser);
      } catch {
        // se corromper, limpa tudo pra não quebrar o app
        localStorage.removeItem("authToken");
        localStorage.removeItem("authUser");
        setToken(null);
        setUser(null);
      }
    }

    setIsAuthLoading(false);
  }, []);

  function login(nextUser: AuthUser, nextToken: string) {
    setUser(nextUser);
    setToken(nextToken);
    localStorage.setItem("authToken", nextToken);
    localStorage.setItem("authUser", JSON.stringify(nextUser));
  }

  function logout() {
    setUser(null);
    setToken(null);
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
  }

  return (
    <AuthContext.Provider value={{ user, token, isAuthLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
