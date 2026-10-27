import type { BackupData } from "../types/backup";

type BackupApiResponse = {
  data: BackupData;
  updatedAt: string;
};

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

type SaveBackupResponse = {
  message: string;
  updatedAt: string;
};

export type SaveBackupResult =
  | { conflict: false; message: string; updatedAt: string }
  | { conflict: true; data: BackupData; updatedAt: string };

export type BackupFetchResult =
  | { status: "ok"; data: BackupData; updatedAt: string }
  | { status: "not_modified" }
  | { status: "not_found" };

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
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
export async function apiSaveBackup(
  backupData: unknown,
  expectedUpdatedAt?: string | null,
  opts?: { keepalive?: boolean }
): Promise<SaveBackupResult> {
  const headers: JsonHeaders = {
    "Content-Type": "application/json",
    ...getAuthHeaders(),
  };

  const res = await fetch(`${API_URL}/backup`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      data: backupData,
      expectedUpdatedAt: expectedUpdatedAt ?? undefined,
    }),
    keepalive: opts?.keepalive,
  });

  if (res.status === 409) {
    const body = (await res.json()) as { data: BackupData; updatedAt: string };
    return { conflict: true, data: body.data, updatedAt: body.updatedAt };
  }

  if (!res.ok) {
    const errorText = await res.text();
    throw new ApiError(errorText || "Erro ao salvar backup", res.status);
  }

  const body = (await res.json()) as SaveBackupResponse;
  return { conflict: false, ...body };
}

// backup – restaurar / sincronizar
export async function apiGetBackup(
  ifModifiedSince?: string | null
): Promise<BackupFetchResult> {
  const headers: JsonHeaders = {
    "Content-Type": "application/json",
    ...getAuthHeaders(),
  };

  if (ifModifiedSince) {
    headers["If-Modified-Since"] = ifModifiedSince;
  }

  const res = await fetch(`${API_URL}/backup`, {
    method: "GET",
    headers,
  });

  if (res.status === 304) {
    return { status: "not_modified" };
  }

  if (res.status === 404) {
    return { status: "not_found" };
  }

  if (!res.ok) {
    const errorText = await res.text();
    throw new ApiError(errorText || "Erro ao buscar backup", res.status);
  }

  const body = (await res.json()) as BackupApiResponse;
  return { status: "ok", data: body.data, updatedAt: body.updatedAt };
}
