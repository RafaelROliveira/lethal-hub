// src/features/obras/obrasLocalStorage.ts
import type { Obra, BackupData } from "../../types/backup";

function getStorageKey(userId: string): string {
  return `obras-${userId}`;
}

export function loadObrasFromLocal(userId: string): Obra[] {
  const key = getStorageKey(userId);
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Obra[];
    return parsed;
  } catch {
    console.warn("Erro ao parsear obras do localStorage");
    return [];
  }
}

export function saveObrasToLocal(userId: string, obras: Obra[]) {
  const key = getStorageKey(userId);
  localStorage.setItem(key, JSON.stringify(obras));
}

export function exportBackup(userId: string): BackupData {
  const obras = loadObrasFromLocal(userId);
  const backup: BackupData = {
    version: 1,
    obras,
  };
  return backup;
}

export function importBackup(userId: string, backup: BackupData) {
  saveObrasToLocal(userId, backup.obras);
}

// helpers opcionais para o futuro

export function addObra(userId: string, nova: Obra): Obra[] {
  const atuais = loadObrasFromLocal(userId);
  const atualizadas = [...atuais, nova];
  saveObrasToLocal(userId, atualizadas);
  return atualizadas;
}

export function updateObra(userId: string, obraAtualizada: Obra): Obra[] {
  const atuais = loadObrasFromLocal(userId);
  const atualizadas = atuais.map((o) =>
    o.id === obraAtualizada.id ? obraAtualizada : o
  );
  saveObrasToLocal(userId, atualizadas);
  return atualizadas;
}

export function removeObra(userId: string, obraId: string): Obra[] {
  const atuais = loadObrasFromLocal(userId);
  const atualizadas = atuais.filter((o) => o.id !== obraId);
  saveObrasToLocal(userId, atualizadas);
  return atualizadas;
}
