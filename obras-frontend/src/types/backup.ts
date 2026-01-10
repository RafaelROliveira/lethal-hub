// src/types/backup.ts

export type TipoObra =
    | "ANIME"
    | "MANGA"
    | "SERIE"
    | "FILME"
    | "NOVEL"
    | "OUTRO";

export type StatusObra =
    | "EM_ANDAMENTO"
    | "EM_ESPERA"
    | "FINALIZADO"
    | "CANCELADO"
    | "DROPADO";

export interface Obra {
    id: string; // uuid ou timestamp
    titulo: string;
    tipo: TipoObra;
    status: StatusObra;
    favorito: boolean;
    tags: string[]; // ex: ["hiato"], ["cancelado"]
    nota?: number | null;
    comentario?: string;
    imagemUrl?: string;
    linkUrl?: string;
    capitulo?: number;
    diaLancamento?: string;
    createdAt: string; // ISO
    updatedAt: string; // ISO
}

export interface BackupData {
    version: number;
    obras: Obra[];
}
