// src/api/apiClient.ts
const API_URL = import.meta.env.VITE_API_URL as string;

if (!API_URL) {
  console.warn("VITE_API_URL não definida! Verifique seu .env");
}

export interface LoginRequest {
  login: string; // username ou email
  password: string;
}

export interface RegisterRequest {
  username: string;
  name: string;
  email: string;
  password: string;
  accessCode: string;
}

export interface AuthUser {
  id: string;
  username: string;
  name: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

// headers como Record<string, string> para agradar o TS
type JsonHeaders = Record<string, string>;

function getAuthHeaders(): JsonHeaders {
  const token = localStorage.getItem("authToken");
  const headers: JsonHeaders = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function apiLogin(data: LoginRequest): Promise<AuthResponse> {
  const headers: JsonHeaders = {
    "Content-Type": "application/json",
  };

  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || "Erro ao fazer login");
  }

  return res.json();
}

export async function apiRegister(
  data: RegisterRequest
): Promise<AuthResponse> {
  const headers: JsonHeaders = {
    "Content-Type": "application/json",
  };

  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || "Erro ao registrar");
  }

  return res.json();
}

// backup – salvar
export async function apiSaveBackup(backupData: unknown): Promise<void> {
  const headers: JsonHeaders = {
    "Content-Type": "application/json",
    ...getAuthHeaders(),
  };

  const res = await fetch(`${API_URL}/backup`, {
    method: "POST",
    headers,
    body: JSON.stringify({ data: backupData }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || "Erro ao salvar backup");
  }
}

// backup – restaurar
export async function apiGetBackup(): Promise<unknown | null> {
  const headers: JsonHeaders = {
    "Content-Type": "application/json",
    ...getAuthHeaders(),
  };

  const res = await fetch(`${API_URL}/backup`, {
    method: "GET",
    headers,
  });

  if (!res.ok) {
    if (res.status === 404) {
      return null;
    }
    const errorText = await res.text();
    throw new Error(errorText || "Erro ao buscar backup");
  }

  const body = await res.json();
  return (body as any)?.data ?? null;
}
