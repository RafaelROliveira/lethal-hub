// src/router.tsx
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";
import { useAuth } from "./auth/AuthContext";
import type { JSX } from "react";

function PrivateRoute({ children }: { children: JSX.Element }) {
  const { user, isAuthLoading } = useAuth();

  // enquanto carrega do localStorage, não decide nada ainda
  if (isAuthLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          color: "#fff",
          background: "#111",
          fontFamily: "Lexend, sans-serif",
        }}
      >
        Carregando...
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;
  return children;
}

function PublicRoute({ children }: { children: JSX.Element }) {
  const { user, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          color: "#fff",
          background: "#111",
          fontFamily: "Lexend, sans-serif",
        }}
      >
        Carregando...
      </div>
    );
  }

  // se já tá logado e tentar abrir "/", manda pro app
  if (user) return <Navigate to="/app" replace />;
  return children;
}

export const routerConfig = createBrowserRouter([
  {
    path: "/",
    element: (
      <PublicRoute>
        <AuthPage />
      </PublicRoute>
    ),
  },
  {
    path: "/app",
    element: (
      <PrivateRoute>
        <DashboardPage />
      </PrivateRoute>
    ),
  },
]);
