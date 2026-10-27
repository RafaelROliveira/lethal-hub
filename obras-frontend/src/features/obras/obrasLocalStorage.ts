// src/features/obras/obrasLocalStorage.ts
import type { Obra, Folder, BackupData } from "../../types/backup";

function getStorageKey(userId: string): string {
  return `obras-${userId}`;
}

function getFoldersStorageKey(userId: string): string {
  return `obras-folders-${userId}`;
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

export function loadFoldersFromLocal(userId: string): Folder[] {
  const key = getFoldersStorageKey(userId);
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Folder[];
    return parsed;
  } catch {
    console.warn("Erro ao parsear pastas do localStorage");
    return [];
  }
}

export function saveFoldersToLocal(userId: string, folders: Folder[]) {
  const key = getFoldersStorageKey(userId);
  localStorage.setItem(key, JSON.stringify(folders));
}

export function exportBackup(userId: string): BackupData {
  const obras = loadObrasFromLocal(userId);
  const folders = loadFoldersFromLocal(userId);

  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    obras,
    folders,
  };
}

export function importBackup(userId: string, backup: BackupData) {
  saveObrasToLocal(userId, backup.obras);
  saveFoldersToLocal(userId, backup.folders ?? []);
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

// pastas

export function addFolder(userId: string, nome: string): Folder[] {
  const atuais = loadFoldersFromLocal(userId);
  const nova: Folder = {
    id: `folder-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    nome,
    createdAt: new Date().toISOString(),
  };
  const atualizadas = [...atuais, nova];
  saveFoldersToLocal(userId, atualizadas);
  return atualizadas;
}

export function renameFolder(userId: string, folderId: string, nome: string): Folder[] {
  const atuais = loadFoldersFromLocal(userId);
  const atualizadas = atuais.map((f) => (f.id === folderId ? { ...f, nome } : f));
  saveFoldersToLocal(userId, atualizadas);
  return atualizadas;
}

// remove a pasta e solta as obras que estavam nela (viram "sem pasta")
export function removeFolder(userId: string, folderId: string): { folders: Folder[]; obras: Obra[] } {
  const folders = loadFoldersFromLocal(userId).filter((f) => f.id !== folderId);
  saveFoldersToLocal(userId, folders);

  const obras = loadObrasFromLocal(userId).map((o) =>
    o.folderId === folderId ? { ...o, folderId: null } : o
  );
  saveObrasToLocal(userId, obras);

  return { folders, obras };
}
