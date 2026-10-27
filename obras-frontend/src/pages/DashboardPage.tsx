// src/pages/DashboardPage.tsx
import {
    useEffect,
    useMemo,
    useState,
    useRef,
} from "react";

import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";
import {
    loadObrasFromLocal,
    saveObrasToLocal,
    loadFoldersFromLocal,
    addFolder,
    renameFolder,
    removeFolder,
    exportBackup,
    importBackup,
} from "../features/obras/obrasLocalStorage";
import type { Obra, Folder, StatusObra, TipoObra, BackupData } from "../types/backup";
import { apiGetBackup, apiSaveBackup } from "../api/apiClient";
import "./DashboardPage.css";

import {
    Star,
    Pencil,
    Trash2,
    BookOpen,
    Cloud,
    Plus,
    LogOut,
    ChevronDown,
    MoreVertical,
    FolderPlus,
    Folder as FolderIcon,
    PanelTop,
    PanelLeft,
} from "lucide-react";
import logo from "../assets/png2.png";

import { toast } from "react-toastify";
import { createPortal } from "react-dom";

type SortOption =
    | "ADICAO_DESC"
    | "ADICAO_ASC"
    | "NOTA_DESC"
    | "NOTA_ASC"
    | "FAV_FIRST"
    | "STATUS_ORDER";

type Filtro =
    | "TODOS"
    | "EM_ANDAMENTO"
    | "EM_ESPERA"
    | "FINALIZADOS"
    | "CANCELADOS"
    | "DROPADOS";

type Tab = "BACKUP" | "LISTA";
type NavPosition = "top" | "side";

const statusLabels: Record<StatusObra, string> = {
    EM_ANDAMENTO: "Em andamento",
    EM_ESPERA: "Em espera",
    FINALIZADO: "Finalizado",
    CANCELADO: "Cancelado",
    DROPADO: "Dropado",
};

const SEM_PASTA_ID = "__sem_pasta__";

const statusPillLabels: Record<Filtro, string> = {
    TODOS: "Todos",
    EM_ANDAMENTO: "Em andamento",
    EM_ESPERA: "Em espera",
    FINALIZADOS: "Finalizados",
    CANCELADOS: "Cancelados",
    DROPADOS: "Dropados",
};

function criarNovaObra(
    titulo: string,
    tipo: TipoObra,
    status: StatusObra,
    imagemUrl?: string,
    notaStr?: string,
    diaLancamento?: string,
    comentario?: string,
    linkUrl?: string,
    capituloStr?: string,
    folderId?: string | null
): Obra {
    const agora = new Date().toISOString();

    let notaNum: number | null = null;
    if (notaStr && notaStr.trim() !== "") {
        const n = Number(notaStr);
        if (!Number.isNaN(n)) {
            notaNum = Math.min(10, Math.max(0, n));
        }
    }

    let capituloNum: number | undefined;
    if (capituloStr && capituloStr.trim() !== "") {
        const c = Number(capituloStr);
        if (!Number.isNaN(c)) {
            capituloNum = Math.max(0, c);
        }
    }

    return {
        id: `obra-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        titulo,
        tipo,
        status,
        favorito: false,
        tags: [],
        nota: notaNum,
        diaLancamento: diaLancamento || "",
        comentario: comentario?.trim() || "",
        imagemUrl: imagemUrl?.trim() || undefined,
        linkUrl: linkUrl?.trim() || undefined,
        capitulo: capituloNum,
        folderId: folderId || null,
        createdAt: agora,
        updatedAt: agora,
    };
}

/** Trava scroll do body enquanto `locked` for true */
function useBodyScrollLock(locked: boolean) {
    useEffect(() => {
        if (!locked) return;

        const scrollY = window.scrollY;
        const prev = {
            position: document.body.style.position,
            top: document.body.style.top,
            left: document.body.style.left,
            right: document.body.style.right,
            width: document.body.style.width,
            overflow: document.body.style.overflow,
        };

        document.body.style.position = "fixed";
        document.body.style.top = `-${scrollY}px`;
        document.body.style.left = "0";
        document.body.style.right = "0";
        document.body.style.width = "100%";
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.position = prev.position;
            document.body.style.top = prev.top;
            document.body.style.left = prev.left;
            document.body.style.right = prev.right;
            document.body.style.width = prev.width;
            document.body.style.overflow = prev.overflow;

            window.scrollTo(0, scrollY);
        };
    }, [locked]);
}

/** Fecha no ESC enquanto `enabled` for true */
function useEscapeToClose(enabled: boolean, onClose: () => void) {
    useEffect(() => {
        if (!enabled) return;

        function onKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [enabled, onClose]);
}

/** Minimiza a nav de topo ao rolar pra baixo, maximiza ao rolar pra cima */
function useNavScrollCollapse(enabled: boolean) {
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        if (!enabled) {
            setCollapsed(false);
            return;
        }

        let lastY = window.scrollY;
        let ticking = false;

        function update() {
            const y = window.scrollY;
            const delta = y - lastY;

            if (y < 60) {
                setCollapsed(false);
            } else if (delta > 6) {
                setCollapsed(true);
            } else if (delta < -6) {
                setCollapsed(false);
            }

            lastY = y;
            ticking = false;
        }

        function onScroll() {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(update);
        }

        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, [enabled]);

    return [collapsed, setCollapsed] as const;
}

/** true enquanto a viewport estiver em largura de celular */
function useIsMobile(breakpoint = 720) {
    const [isMobile, setIsMobile] = useState(
        () => typeof window !== "undefined" && window.innerWidth <= breakpoint
    );

    useEffect(() => {
        const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
        const onChange = () => setIsMobile(mq.matches);
        onChange();
        mq.addEventListener("change", onChange);
        return () => mq.removeEventListener("change", onChange);
    }, [breakpoint]);

    return isMobile;
}

/** Modal base por Portal, reaproveitando teu CSS .modal-overlay e .modal-box */
function ModalPortal({
    children,
    onClose,
}: {
    children: React.ReactNode;
    onClose: () => void;
}) {
    const root = document.getElementById("modal-root");
    if (!root) return null;

    return createPortal(
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                {children}
            </div>
        </div>,
        root
    );
}

export function DashboardPage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [obras, setObras] = useState<Obra[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [filtro, setFiltro] = useState<Filtro>("TODOS");
    const [tipoFiltro, setTipoFiltro] = useState<TipoObra | "TODOS">("TODOS");
    const [sortBy, setSortBy] = useState<SortOption>("FAV_FIRST");
    const [tab, setTab] = useState<Tab>("LISTA");
    const [search, setSearch] = useState("");

    // popovers dos cards (status rápido / menu editar-deletar)
    const [obraStatusMenuId, setObraStatusMenuId] = useState<string | null>(null);
    const [obraMenuId, setObraMenuId] = useState<string | null>(null);

    const [diaFiltro, setDiaFiltro] = useState<string>("TODOS");

    const [obraEditando, setObraEditando] = useState<Obra | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showFolderModal, setShowFolderModal] = useState(false);
    const [folderEditando, setFolderEditando] = useState<Folder | null>(null);

    const [loadingBackup, setLoadingBackup] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // ====== NAV: posição (topo/lateral) + colapso ao rolar ======
    const [navPosition, setNavPosition] = useState<NavPosition>("top");

    useEffect(() => {
        try {
            const saved = localStorage.getItem("lethalhub:nav-position");
            if (saved === "top" || saved === "side") setNavPosition(saved);
        } catch {
            // ignore
        }
    }, []);

    function toggleNavPosition() {
        setNavPosition((atual) => {
            const proxima: NavPosition = atual === "top" ? "side" : "top";
            try {
                localStorage.setItem("lethalhub:nav-position", proxima);
            } catch {
                // ignore
            }
            return proxima;
        });
    }

    // no celular a nav sempre fica no topo, mesmo que a preferência salva seja lateral
    const isMobile = useIsMobile();
    const effectiveNavPosition: NavPosition = isMobile ? "top" : navPosition;

    const [navCollapsed, setNavCollapsed] = useNavScrollCollapse(effectiveNavPosition === "top");

    // ====== ESC + scroll lock (para QUALQUER modal aberto) ======
    const anyModalOpen = !!obraEditando || showAddModal || showFolderModal || !!folderEditando;
    useBodyScrollLock(anyModalOpen);
    useEscapeToClose(anyModalOpen || !!obraStatusMenuId || !!obraMenuId, () => {
        if (showAddModal) setShowAddModal(false);
        else if (obraEditando) setObraEditando(null);
        else if (showFolderModal) setShowFolderModal(false);
        else if (folderEditando) setFolderEditando(null);

        setObraStatusMenuId(null);
        setObraMenuId(null);
    });

    // ====== seções colapsáveis (favoritos / pastas / sem pasta) ======
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!user) return;
        try {
            const raw = localStorage.getItem(`lethalhub:collapsed-sections:${user.id}`);
            if (raw) setCollapsedSections(new Set(JSON.parse(raw)));
        } catch {
            // ignore
        }
    }, [user]);

    function toggleSection(id: string) {
        setCollapsedSections((atual) => {
            const nova = new Set(atual);
            if (nova.has(id)) nova.delete(id);
            else nova.add(id);

            if (user) {
                try {
                    localStorage.setItem(
                        `lethalhub:collapsed-sections:${user.id}`,
                        JSON.stringify([...nova])
                    );
                } catch {
                    // ignore
                }
            }

            return nova;
        });
    }

    // referências de cada seção pra rolar até ela (atalho de pasta)
    const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

    function jumpToSection(id: string) {
        setTab("LISTA");

        setCollapsedSections((atual) => {
            if (!atual.has(id)) return atual;
            const nova = new Set(atual);
            nova.delete(id);

            if (user) {
                try {
                    localStorage.setItem(
                        `lethalhub:collapsed-sections:${user.id}`,
                        JSON.stringify([...nova])
                    );
                } catch {
                    // ignore
                }
            }

            return nova;
        });

        // pequeno atraso pra garantir que a seção já esteja renderizada
        // (troca de aba / expansão podem mudar o layout antes do scroll)
        window.setTimeout(() => {
            sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 60);
    }

    // quantos itens mostrar por seção antes do "mostrar mais"
    const SECTION_PAGE_SIZE = 12;
    const [sectionShowAll, setSectionShowAll] = useState<Set<string>>(new Set());

    function expandSection(id: string) {
        setSectionShowAll((atual) => new Set(atual).add(id));
    }

    const lastRemoteUpdatedAtRef = useRef<string | null>(null);

    function applyRemoteBackup(userId: string, backup: BackupData, updatedAt?: string) {
        importBackup(userId, backup);
        setObras(loadObrasFromLocal(userId));
        setFolders(loadFoldersFromLocal(userId));
        lastRemoteUpdatedAtRef.current = updatedAt ?? null;
        setLocalSyncedAt(userId, updatedAt ?? null);
    }

    function getLocalSyncMetaKey(userId: string) {
        return `lethalhub:backup-meta:${userId}`;
    }

    function getLocalSyncedAt(userId: string): string | null {
        try {
            return localStorage.getItem(getLocalSyncMetaKey(userId));
        } catch {
            return null;
        }
    }

    function setLocalSyncedAt(userId: string, updatedAt: string | null) {
        try {
            if (!updatedAt) {
                localStorage.removeItem(getLocalSyncMetaKey(userId));
                return;
            }

            localStorage.setItem(getLocalSyncMetaKey(userId), updatedAt);
        } catch {
            // ignore
        }
    }

    // salva na nuvem automaticamente, com debounce, sempre que algo muda localmente
    const autoSaveTimeoutRef = useRef<number | null>(null);

    function scheduleAutoSave(userId: string) {
        if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
        }

        autoSaveTimeoutRef.current = window.setTimeout(async () => {
            try {
                const backup = exportBackup(userId);
                const result = await apiSaveBackup(backup, lastRemoteUpdatedAtRef.current);

                if (result.conflict) {
                    applyRemoteBackup(userId, result.data, result.updatedAt);
                    toast.warn(
                        "Uma versão mais recente foi salva em outro dispositivo/aba — ela foi aplicada aqui."
                    );
                    return;
                }

                lastRemoteUpdatedAtRef.current = result.updatedAt;
                setLocalSyncedAt(userId, result.updatedAt);
            } catch (err) {
                // falha silenciosa (ex: sem conexão) — a próxima edição tenta salvar de novo
                console.warn("Não foi possível salvar automaticamente na nuvem:", err);
            }
        }, 2500);
    }

    useEffect(() => {
        return () => {
            if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
        };
    }, [user]);

    function syncLocal(obrasAtualizadas: Obra[]) {
        if (!user) return;

        setObras(obrasAtualizadas);
        saveObrasToLocal(user.id, obrasAtualizadas);
        scheduleAutoSave(user.id);
    }

    // carrega obras/pastas do localStorage; puxa o backup da nuvem só na abertura,
    // se ele for mais novo que o que já está salvo neste navegador
    useEffect(() => {
        if (!user) return;
        const currentUser = user;

        async function initSync() {
            try {
                const localObras = loadObrasFromLocal(currentUser.id);
                const localFolders = loadFoldersFromLocal(currentUser.id);
                const remoto = await apiGetBackup();

                if (remoto.status !== "ok") {
                    setObras(localObras);
                    setFolders(localFolders);
                    lastRemoteUpdatedAtRef.current = null;
                    return;
                }

                const remotoTime = Date.parse(remoto.updatedAt);
                const localSyncedAt = getLocalSyncedAt(currentUser.id);
                const localSyncedTime = Date.parse(localSyncedAt || "");

                if (Number.isNaN(localSyncedTime)) {
                    applyRemoteBackup(currentUser.id, remoto.data, remoto.updatedAt);
                } else if (!Number.isNaN(remotoTime) && remotoTime > localSyncedTime) {
                    applyRemoteBackup(currentUser.id, remoto.data, remoto.updatedAt);
                } else {
                    setObras(localObras);
                    setFolders(localFolders);
                    lastRemoteUpdatedAtRef.current = remoto.updatedAt;
                }
            } catch (err) {
                console.error("Erro na sincronização inicial:", err);

                setObras(loadObrasFromLocal(currentUser.id));
                setFolders(loadFoldersFromLocal(currentUser.id));
            }
        }

        initSync();
    }, [user]);

    function handleLogout() {
        logout();
        navigate("/");
    }

    async function handleSalvarBackup() {
        if (!user) return;
        setLoadingBackup(true);
        setMessage(null);
        setError(null);

        try {
            const backup: BackupData = exportBackup(user.id);
            const result = await apiSaveBackup(backup, lastRemoteUpdatedAtRef.current);

            if (result.conflict) {
                applyRemoteBackup(user.id, result.data, result.updatedAt);
                setMessage(
                    "Havia uma versão mais recente salva em outro dispositivo — ela foi aplicada. Revise e salve novamente se precisar."
                );
                return;
            }

            lastRemoteUpdatedAtRef.current = result.updatedAt;
            setLocalSyncedAt(user.id, result.updatedAt);
            setMessage("Backup salvo na nuvem com sucesso.");
        } catch (err: any) {
            setError(err.message ?? "Erro ao salvar backup");
        } finally {
            setLoadingBackup(false);
        }
    }

    async function handleRestaurarBackup() {
        if (!user) return;
        setLoadingBackup(true);
        setMessage(null);
        setError(null);

        try {
            const result = await apiGetBackup();
            if (result.status !== "ok") {
                setMessage("Você ainda não tem backup salvo na nuvem.");
                return;
            }

            applyRemoteBackup(user.id, result.data, result.updatedAt);
            setMessage("Backup restaurado com sucesso.");
        } catch (err: any) {
            setError(err.message ?? "Erro ao restaurar backup");
        } finally {
            setLoadingBackup(false);
        }
    }

    function toggleFavorito(id: string) {
        const atualizadas = obras.map((o) =>
            o.id === id
                ? { ...o, favorito: !o.favorito, updatedAt: new Date().toISOString() }
                : o
        );
        syncLocal(atualizadas);
    }

    function removerObra(id: string) {
        if (!confirm("Tem certeza que deseja remover esta obra da sua lista?")) return;
        const atualizadas = obras.filter((o) => o.id !== id);
        syncLocal(atualizadas);
    }

    function alterarCapitulo(id: string, delta: number) {
        const atualizadas = obras.map((o) => {
            if (o.id !== id) return o;
            const atual = o.capitulo ?? 0;
            const novo = Math.max(0, atual + delta);
            return { ...o, capitulo: novo, updatedAt: new Date().toISOString() };
        });
        syncLocal(atualizadas);
    }

    function incrementarCapitulo(id: string) {
        alterarCapitulo(id, 1);
    }

    function decrementarCapitulo(id: string) {
        alterarCapitulo(id, -1);
    }

    function atualizarStatus(id: string, novoStatus: StatusObra) {
        const atualizadas = obras.map((o) =>
            o.id === id
                ? { ...o, status: novoStatus, updatedAt: new Date().toISOString() }
                : o
        );
        syncLocal(atualizadas);
    }

    // ====== PASTAS ======
    function handleCreateFolder(nome: string) {
        if (!user) return;
        const tituloFinal = nome.trim();
        if (!tituloFinal) return;

        const atualizadas = addFolder(user.id, tituloFinal);
        setFolders(atualizadas);
        scheduleAutoSave(user.id);
        toast.success(`Pasta "${tituloFinal}" criada.`);
    }

    function handleRenameFolder(folderId: string, nome: string) {
        if (!user) return;
        const tituloFinal = nome.trim();
        if (!tituloFinal) return;

        const atualizadas = renameFolder(user.id, folderId, tituloFinal);
        setFolders(atualizadas);
        scheduleAutoSave(user.id);
    }

    function handleDeleteFolder(folderId: string) {
        if (!user) return;
        if (!confirm("Excluir esta pasta? As obras dela voltam para \"Sem pasta\".")) return;

        const resultado = removeFolder(user.id, folderId);
        setFolders(resultado.folders);
        setObras(resultado.obras);
        scheduleAutoSave(user.id);
    }

    // backup em arquivo
    function handleExportJson() {
        if (!user) return;
        setError(null);
        setMessage(null);

        try {
            const backup: BackupData = exportBackup(user.id);
            const blob = new Blob([JSON.stringify(backup, null, 2)], {
                type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            const fileName = `obras-backup-${user.username || user.id}.json`;
            a.href = url;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(url);
            setMessage(`Backup exportado como ${fileName}.`);
        } catch (err: any) {
            setError("Erro ao exportar backup local.");
            console.error(err);
        }
    }

    function handleClickImportFile() {
        setError(null);
        setMessage(null);
        fileInputRef.current?.click();
    }

    function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
        if (!user) return;

        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const text = reader.result as string;
                const data = JSON.parse(text) as BackupData;
                importBackup(user.id, data);
                setObras(loadObrasFromLocal(user.id));
                setFolders(loadFoldersFromLocal(user.id));
                scheduleAutoSave(user.id);
                setMessage("Backup importado do arquivo com sucesso.");
            } catch (err) {
                console.error(err);
                setError("Erro ao importar o arquivo de backup. Verifique se é um JSON válido.");
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };

        reader.onerror = () => setError("Erro ao ler o arquivo de backup.");
        reader.readAsText(file);
    }

    // ====== MODAL NOVA/EDITAR PASTA ======
    function FolderModal({
        folder,
        onClose,
    }: {
        folder: Folder | null;
        onClose: () => void;
    }) {
        const [nome, setNome] = useState(folder?.nome ?? "");

        function salvar(e?: React.FormEvent) {
            e?.preventDefault();
            const tituloFinal = nome.trim();
            if (!tituloFinal) return;

            if (folder) handleRenameFolder(folder.id, tituloFinal);
            else handleCreateFolder(tituloFinal);

            onClose();
        }

        return (
            <ModalPortal onClose={onClose}>
                <h3>{folder ? "Renomear pasta" : "Nova pasta"}</h3>

                <form onSubmit={salvar}>
                    <div className="modal-field">
                        <label>Nome da pasta</label>
                        <input
                            autoFocus
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            placeholder="ex: Assistindo agora"
                        />
                    </div>

                    <div className="modal-actions">
                        <button type="button" onClick={onClose}>Cancelar</button>
                        <button type="submit">{folder ? "Salvar" : "Criar"}</button>
                    </div>
                </form>
            </ModalPortal>
        );
    }

    // ====== MODAL ADICIONAR (Portal + mesmo CSS do editar) ======
    function AdicionarObraModal({ onClose }: { onClose: () => void }) {
        const [titulo, setTitulo] = useState("");
        const [tipo, setTipo] = useState<TipoObra>("ANIME");
        const [status, setStatus] = useState<StatusObra>("EM_ANDAMENTO");
        const [imagemUrl, setImagemUrl] = useState("");
        const [diaLancamento, setDiaLancamento] = useState("");
        const [nota, setNota] = useState<string>("");
        const [comentario, setComentario] = useState("");
        const [linkUrl, setLinkUrl] = useState("");
        const [capitulo, setCapitulo] = useState<string>("");
        const [folderId, setFolderId] = useState<string>("");

        const [imgOk, setImgOk] = useState(false);


        function salvar(e?: React.MouseEvent) {
            e?.preventDefault();
            if (!user) return;

            const tituloFinal = titulo.trim();
            if (!tituloFinal) return;

            const nova = criarNovaObra(
                tituloFinal,
                tipo,
                status,
                imagemUrl,
                nota,
                diaLancamento,
                comentario,
                linkUrl,
                capitulo,
                folderId || null
            );

            syncLocal([...obras, nova]);

            toast.success(`${tituloFinal} adicionado com sucesso!`);

            // limpa form pra adicionar outra (não fecha modal)
            setTitulo("");
            setTipo("ANIME");
            setStatus("EM_ANDAMENTO");
            setImagemUrl("");
            setImgOk(false);
            setDiaLancamento("");
            setNota("");
            setComentario("");
            setLinkUrl("");
            setCapitulo("");
        }

        return (
            <ModalPortal onClose={onClose}>
                <h3>Adicionar obra</h3>

                <div className="modal-field">
                    <label>Título</label>
                    <input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
                </div>

                <div className="modal-section-label">Mídia</div>

                <div className="modal-field">
                    <label>Imagem URL</label>
                    <input
                        value={imagemUrl}
                        onChange={(e) => {
                            setImagemUrl(e.target.value);
                            setImgOk(false);
                        }}
                        placeholder="https://..."
                    />

                    {/* Preview */}
                    {imagemUrl.trim() !== "" && (
                        <div style={{ marginTop: 10 }}>
                            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>
                                Prévia:
                            </div>

                            <div
                                style={{
                                    width: "100%",
                                    height: 160,
                                    borderRadius: 10,
                                    overflow: "hidden",
                                    border: "1px solid rgba(255,255,255,0.15)",
                                    background: "rgba(0,0,0,0.25)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <img
                                    src={imagemUrl}
                                    alt="Prévia"
                                    onLoad={() => setImgOk(true)}
                                    onError={() => setImgOk(false)}
                                    loading="lazy"
                                    decoding="async"
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                        display: imgOk ? "block" : "none",
                                    }}
                                />

                                {!imgOk && (
                                    <span style={{ fontSize: 12, opacity: 0.7 }}>
                                        Não foi possível carregar a imagem (verifique a URL).
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-field">
                    <label>Link (Ler/Visualizar)</label>
                    <input
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        placeholder="https://..."
                    />
                </div>

                <div className="modal-section-label">Detalhes</div>

                <div className="modal-row">
                    <div className="modal-field">
                        <label>Tipo</label>
                        <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoObra)}>
                            <option value="ANIME">Anime</option>
                            <option value="MANGA">Mangá</option>
                            <option value="MANHUA">Manhua</option>
                            <option value="SERIE">Série</option>
                            <option value="FILME">Filme</option>
                            <option value="NOVEL">Novel</option>
                            <option value="OUTRO">Outro</option>
                        </select>
                    </div>

                    <div className="modal-field">
                        <label>Status</label>
                        <select value={status} onChange={(e) => setStatus(e.target.value as StatusObra)}>
                            <option value="EM_ANDAMENTO">Em andamento</option>
                            <option value="EM_ESPERA">Em espera</option>
                            <option value="FINALIZADO">Finalizado</option>
                            <option value="DROPADO">Dropado</option>
                            <option value="CANCELADO">Cancelado</option>
                        </select>
                    </div>
                </div>

                <div className="modal-row">
                    <div className="modal-field">
                        <label>Capítulo</label>
                        <input
                            type="number"
                            min={0}
                            value={capitulo}
                            onChange={(e) => setCapitulo(e.target.value)}
                        />
                    </div>

                    <div className="modal-field">
                        <label>Nota</label>
                        <input
                            type="number"
                            min={0}
                            max={10}
                            step={0.5}
                            value={nota}
                            onChange={(e) => setNota(e.target.value)}
                        />
                    </div>
                </div>

                <div className="modal-section-label">Organização</div>

                <div className="modal-row">
                    <div className="modal-field">
                        <label>Dia de lançamento</label>
                        <select value={diaLancamento} onChange={(e) => setDiaLancamento(e.target.value)}>
                            <option value="">Nenhum</option>
                            <option value="SEGUNDA">Segunda</option>
                            <option value="TERCA">Terça</option>
                            <option value="QUARTA">Quarta</option>
                            <option value="QUINTA">Quinta</option>
                            <option value="SEXTA">Sexta</option>
                            <option value="SABADO">Sábado</option>
                            <option value="DOMINGO">Domingo</option>
                        </select>
                    </div>

                    <div className="modal-field">
                        <label>Pasta</label>
                        <select value={folderId} onChange={(e) => setFolderId(e.target.value)}>
                            <option value="">Sem pasta</option>
                            {folders.map((f) => (
                                <option key={f.id} value={f.id}>{f.nome}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="modal-field">
                    <label>Comentário</label>
                    <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} />
                </div>

                <div className="modal-actions">
                    <button type="button" onClick={onClose}>Cancelar</button>
                    <button type="submit" onClick={salvar}>Adicionar</button>
                </div>
            </ModalPortal>
        );
    }

    // ====== MODAL EDITAR (Portal + mesmo CSS) ======
    function abrirEdicao(obra: Obra) {
        setObraEditando(obra);
        setObraMenuId(null);
    }

    function salvarEdicao(obraAtualizada: Obra) {
        const lista = obras.map((o) => (o.id === obraAtualizada.id ? obraAtualizada : o));
        syncLocal(lista);
        setObraEditando(null);
    }

    function EditarObraModal({
        obra,
        onClose,
        onSave,
    }: {
        obra: Obra;
        onClose: () => void;
        onSave: (obraAtualizada: Obra) => void;
    }) {
        const [titulo, setTitulo] = useState(obra.titulo);
        const [tipo, setTipo] = useState<TipoObra>(obra.tipo);
        const [status, setStatus] = useState<StatusObra>(obra.status);
        const [imagemUrl, setImagemUrl] = useState(obra.imagemUrl || "");
        const [nota, setNota] = useState(obra.nota?.toString() || "");
        const [comentario, setComentario] = useState(obra.comentario || "");
        const [linkUrl, setLinkUrl] = useState(obra.linkUrl || "");
        const [capitulo, setCapitulo] = useState(obra.capitulo?.toString() || "");
        const [diaLancamento, setDiaLancamento] = useState(obra.diaLancamento || "");
        const [folderId, setFolderId] = useState(obra.folderId || "");

        function salvar() {
            const atualizado: Obra = {
                ...obra,
                titulo,
                tipo,
                status,
                imagemUrl,
                nota: nota ? Number(nota) : null,
                comentario,
                linkUrl,
                capitulo: capitulo ? Number(capitulo) : undefined,
                diaLancamento,
                folderId: folderId || null,
                updatedAt: new Date().toISOString(),
            };

            onSave(atualizado);
        }

        return (
            <ModalPortal onClose={onClose}>
                <h3>Editar obra</h3>

                <div className="modal-field">
                    <label>Título</label>
                    <input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
                </div>

                <div className="modal-section-label">Mídia</div>

                <div className="modal-field">
                    <label>Imagem URL</label>
                    <input value={imagemUrl} onChange={(e) => setImagemUrl(e.target.value)} />
                </div>

                <div className="modal-field">
                    <label>Link</label>
                    <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
                </div>

                <div className="modal-section-label">Detalhes</div>

                <div className="modal-row">
                    <div className="modal-field">
                        <label>Tipo</label>
                        <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoObra)}>
                            <option value="ANIME">Anime</option>
                            <option value="MANGA">Mangá</option>
                            <option value="MANHUA">Manhua</option>
                            <option value="SERIE">Série</option>
                            <option value="FILME">Filme</option>
                            <option value="NOVEL">Novel</option>
                            <option value="OUTRO">Outro</option>
                        </select>
                    </div>

                    <div className="modal-field">
                        <label>Status</label>
                        <select value={status} onChange={(e) => setStatus(e.target.value as StatusObra)}>
                            <option value="EM_ANDAMENTO">Em andamento</option>
                            <option value="EM_ESPERA">Em espera</option>
                            <option value="FINALIZADO">Finalizado</option>
                            <option value="DROPADO">Dropado</option>
                            <option value="CANCELADO">Cancelado</option>
                        </select>
                    </div>
                </div>

                <div className="modal-row">
                    <div className="modal-field">
                        <label>Capítulo</label>
                        <input
                            type="number"
                            min={0}
                            value={capitulo}
                            onChange={(e) => setCapitulo(e.target.value)}
                        />
                    </div>

                    <div className="modal-field">
                        <label>Nota</label>
                        <input
                            type="number"
                            min={0}
                            max={10}
                            step={0.5}
                            value={nota}
                            onChange={(e) => setNota(e.target.value)}
                        />
                    </div>
                </div>

                <div className="modal-section-label">Organização</div>

                <div className="modal-row">
                    <div className="modal-field">
                        <label>Dia de lançamento</label>
                        <select value={diaLancamento} onChange={(e) => setDiaLancamento(e.target.value)}>
                            <option value="">Nenhum</option>
                            <option value="SEGUNDA">Segunda</option>
                            <option value="TERCA">Terça</option>
                            <option value="QUARTA">Quarta</option>
                            <option value="QUINTA">Quinta</option>
                            <option value="SEXTA">Sexta</option>
                            <option value="SABADO">Sábado</option>
                            <option value="DOMINGO">Domingo</option>
                        </select>
                    </div>

                    <div className="modal-field">
                        <label>Pasta</label>
                        <select value={folderId} onChange={(e) => setFolderId(e.target.value)}>
                            <option value="">Sem pasta</option>
                            {folders.map((f) => (
                                <option key={f.id} value={f.id}>{f.nome}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="modal-field">
                    <label>Comentário</label>
                    <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} />
                </div>

                <div className="modal-actions">
                    <button type="button" onClick={onClose}>Cancelar</button>
                    <button type="submit" onClick={salvar}>Salvar</button>
                </div>
            </ModalPortal>
        );
    }

    // filtro + busca (status/tipo/dia/busca + ordenação) — sem "favoritos" aqui,
    // favoritos agora é uma seção fixa, não um filtro
    const obrasFiltradas = useMemo(() => {
        let lista = [...obras];

        lista = lista.filter((obra) => {
            switch (filtro) {
                case "EM_ANDAMENTO":
                    return obra.status === "EM_ANDAMENTO";
                case "EM_ESPERA":
                    return obra.status === "EM_ESPERA";
                case "FINALIZADOS":
                    return obra.status === "FINALIZADO";
                case "CANCELADOS":
                    return obra.status === "CANCELADO";
                case "DROPADOS":
                    return obra.status === "DROPADO";
                case "TODOS":
                default:
                    return true;
            }
        });

        if (diaFiltro !== "TODOS") {
            lista = lista.filter((obra) => obra.diaLancamento === diaFiltro);
        }

        if (tipoFiltro !== "TODOS") {
            lista = lista.filter((obra) => obra.tipo === tipoFiltro);
        }

        if (search.trim()) {
            const norm = search.toLowerCase();
            lista = lista.filter((obra) => obra.titulo.toLowerCase().includes(norm));
        }

        const statusRank: Record<StatusObra, number> = {
            EM_ANDAMENTO: 0,
            EM_ESPERA: 1,
            FINALIZADO: 2,
            CANCELADO: 3,
            DROPADO: 4,
        };

        const getTime = (o: Obra) => {
            const t = Date.parse(o.createdAt || "");
            return Number.isNaN(t) ? 0 : t;
        };

        const getNota = (o: Obra) => (typeof o.nota === "number" ? o.nota : -1);

        lista.sort((a, b) => {
            switch (sortBy) {
                case "ADICAO_DESC":
                    return getTime(b) - getTime(a);
                case "ADICAO_ASC":
                    return getTime(a) - getTime(b);

                case "NOTA_DESC":
                    return getNota(b) - getNota(a);
                case "NOTA_ASC":
                    return getNota(a) - getNota(b);

                case "FAV_FIRST": {
                    if (a.favorito !== b.favorito) return a.favorito ? -1 : 1;
                    return getTime(b) - getTime(a);
                }

                case "STATUS_ORDER": {
                    const ra = statusRank[a.status];
                    const rb = statusRank[b.status];
                    if (ra !== rb) return ra - rb;

                    if (a.favorito !== b.favorito) return a.favorito ? -1 : 1;
                    return getTime(b) - getTime(a);
                }

                default:
                    return 0;
            }
        });

        return lista;
    }, [obras, filtro, search, diaFiltro, tipoFiltro, sortBy]);

    // contagens por status (respeita tipo/dia/busca, mas não o próprio status)
    const statusCounts = useMemo(() => {
        let base = [...obras];
        if (diaFiltro !== "TODOS") base = base.filter((o) => o.diaLancamento === diaFiltro);
        if (tipoFiltro !== "TODOS") base = base.filter((o) => o.tipo === tipoFiltro);
        if (search.trim()) {
            const norm = search.toLowerCase();
            base = base.filter((o) => o.titulo.toLowerCase().includes(norm));
        }

        return {
            total: base.length,
            emAndamento: base.filter((o) => o.status === "EM_ANDAMENTO").length,
            emEspera: base.filter((o) => o.status === "EM_ESPERA").length,
            finalizados: base.filter((o) => o.status === "FINALIZADO").length,
            cancelados: base.filter((o) => o.status === "CANCELADO").length,
            dropados: base.filter((o) => o.status === "DROPADO").length,
        };
    }, [obras, diaFiltro, tipoFiltro, search]);

    // agrupa em seções: cada pasta + Sem pasta
    type Secao = { id: string; titulo: string; obras: Obra[]; folder?: Folder };

    const secoes = useMemo<Secao[]>(() => {
        const porPasta = new Map<string, Obra[]>();
        for (const obra of obrasFiltradas) {
            const chave = obra.folderId || SEM_PASTA_ID;
            const lista = porPasta.get(chave) ?? [];
            lista.push(obra);
            porPasta.set(chave, lista);
        }

        const resultado: Secao[] = [];

        for (const folder of folders) {
            const itens = porPasta.get(folder.id) ?? [];
            if (itens.length === 0) continue;
            resultado.push({ id: folder.id, titulo: folder.nome, obras: itens, folder });
        }

        const semPasta = porPasta.get(SEM_PASTA_ID) ?? [];
        if (semPasta.length > 0) {
            resultado.push({ id: SEM_PASTA_ID, titulo: "Sem pasta", obras: semPasta });
        }

        return resultado;
    }, [obrasFiltradas, folders]);

    const pageTitle = tab === "BACKUP" ? "Backup" : "Minhas Obras";

    const lastSyncedAtRaw = user ? getLocalSyncedAt(user.id) : null;
    const lastSyncedLabel =
        lastSyncedAtRaw && !Number.isNaN(Date.parse(lastSyncedAtRaw))
            ? new Date(lastSyncedAtRaw).toLocaleString("pt-BR")
            : null;

    // ====== render de um card de obra (reaproveitado em todas as seções) ======
    function renderObraCard(obra: Obra) {
        return (
            <li key={obra.id}
                className={`obra-card status-card-${obra.status.toLowerCase()}`}
                style={
                    obra.imagemUrl
                        ? ({ ["--cover-url" as any]: `url(${obra.imagemUrl})` } as React.CSSProperties)
                        : undefined
                }>
                {/* CAPA */}
                <div className="obra-cover">
                    {obra.imagemUrl && (
                        <img
                            src={obra.imagemUrl}
                            alt={obra.titulo}
                            loading="lazy"
                            decoding="async"
                            className="obra-cover-img"
                        />
                    )}

                    {/* STATUS — indicador discreto */}
                    <div className="obra-status-area">
                        <button
                            type="button"
                            className={`obra-status-dot status-${obra.status.toLowerCase()}`}
                            title={statusLabels[obra.status]}
                            onClick={(e) => {
                                e.stopPropagation();
                                setObraStatusMenuId((atual) => (atual === obra.id ? null : obra.id));
                            }}
                        />

                        <div className={"status-pop " + (obraStatusMenuId === obra.id ? "" : "hidden")}>
                            {(
                                ["EM_ANDAMENTO", "EM_ESPERA", "FINALIZADO", "CANCELADO", "DROPADO"] as StatusObra[]
                            )
                                .filter((st) => st !== obra.status)
                                .map((st) => (
                                    <button
                                        key={st}
                                        className={`status-pop-item status-${st.toLowerCase()}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            atualizarStatus(obra.id, st);
                                            setObraStatusMenuId(null);
                                        }}
                                        type="button"
                                        title={statusLabels[st]}
                                    >
                                        {statusLabels[st]}
                                    </button>
                                ))}
                        </div>
                    </div>

                    {/* FAVORITO — bottom-left */}
                    <button
                        className={"obra-fav-btn-bottom-left" + (obra.favorito ? " active" : "")}
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorito(obra.id);
                        }}
                        type="button"
                        title={obra.favorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                    >
                        <Star
                            size={24}
                            strokeWidth={2.2}
                            fill={obra.favorito ? "#8940ff" : "none"}
                            color={obra.favorito ? "#8940ff" : "#ffffff"}
                        />
                    </button>

                    {/* NOTA bottom-right */}
                    {typeof obra.nota === "number" && (
                        <div
                            className="obra-rating"
                            title="Clique para ver o comentário"
                            onClick={(e) => {
                                e.stopPropagation();

                                toast.info(
                                    <div>
                                        <strong>{obra.titulo}</strong>

                                        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>
                                            {obra.comentario && obra.comentario.trim() !== ""
                                                ? obra.comentario
                                                : "Sem comentário"}
                                        </div>
                                    </div>
                                );
                            }}
                        >
                            {obra.nota === 10 ? "10" : obra.nota.toFixed(1)}
                        </div>
                    )}
                </div>

                {/* INFO */}
                <div className="obra-info">
                    <h3 className="obra-title2">{obra.titulo}</h3>

                    <div className="obra-chapters">
                        <span className="chap-label">Capítulo:</span>

                        <div className="chap-controls">
                            <button className="chap-btn" type="button" onClick={() => decrementarCapitulo(obra.id)}>
                                -
                            </button>

                            <span className="chap-badge">{obra.capitulo ?? 0}</span>

                            <button className="chap-btn" type="button" onClick={() => incrementarCapitulo(obra.id)}>
                                +
                            </button>
                        </div>
                    </div>

                    <div className="obra-actions2">
                        {obra.linkUrl && (
                            <a
                                href={obra.linkUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="btn-action btn-primary"
                                title="Ler/Visualizar"
                            >
                                <BookOpen size={16} strokeWidth={2.2} />
                                <span>Ler</span>
                            </a>
                        )}

                        <div className="obra-menu-area">
                            <button
                                className="btn-action"
                                type="button"
                                title="Mais opções"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setObraMenuId((atual) => (atual === obra.id ? null : obra.id));
                                }}
                            >
                                <MoreVertical size={16} strokeWidth={2.2} />
                            </button>

                            <div className={"status-pop obra-menu-pop " + (obraMenuId === obra.id ? "" : "hidden")}>
                                <button
                                    className="status-pop-item"
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        abrirEdicao(obra);
                                    }}
                                >
                                    Editar
                                </button>
                                <button
                                    className="status-pop-item"
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setObraMenuId(null);
                                        removerObra(obra.id);
                                    }}
                                >
                                    Deletar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </li>
        );
    }

    function renderSecao(secao: Secao) {
        const colapsada = collapsedSections.has(secao.id);
        const mostrarTudo = sectionShowAll.has(secao.id);
        const visiveis = mostrarTudo ? secao.obras : secao.obras.slice(0, SECTION_PAGE_SIZE);
        const restantes = secao.obras.length - visiveis.length;

        return (
            <section
                className="obras-section"
                key={secao.id}
                ref={(el) => { sectionRefs.current[secao.id] = el; }}
            >
                <div
                    className="obras-section-header"
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleSection(secao.id)}
                    onKeyDown={(e) => e.key === "Enter" && toggleSection(secao.id)}
                >
                    <ChevronDown
                        size={18}
                        className={"obras-section-chevron " + (colapsada ? "is-collapsed" : "")}
                    />

                    {secao.folder && <FolderIcon size={16} strokeWidth={2} />}

                    <h3 className="obras-section-title">{secao.titulo}</h3>
                    <span className="obras-section-count">{secao.obras.length}</span>

                    {secao.folder && (
                        <div className="obras-section-actions">
                            <button
                                type="button"
                                title="Renomear pasta"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setFolderEditando(secao.folder!);
                                }}
                            >
                                <Pencil size={14} strokeWidth={2.2} />
                            </button>
                            <button
                                type="button"
                                title="Excluir pasta"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteFolder(secao.folder!.id);
                                }}
                            >
                                <Trash2 size={14} strokeWidth={2.2} />
                            </button>
                        </div>
                    )}
                </div>

                {!colapsada && (
                    <>
                        <ul className="obras-list">
                            {visiveis.map(renderObraCard)}
                        </ul>

                        {restantes > 0 && (
                            <button
                                type="button"
                                className="obras-section-more"
                                onClick={() => expandSection(secao.id)}
                            >
                                Mostrar mais {restantes}
                            </button>
                        )}
                    </>
                )}
            </section>
        );
    }

    return (
        <div className={"app-root" + (effectiveNavPosition === "side" ? " has-sidebar" : "")}>
            {effectiveNavPosition === "top" ? (
                <header className={"topbar" + (navCollapsed ? " is-collapsed" : "")}>
                    <div
                        className="topbar-clickzone"
                        onClick={() => navCollapsed && setNavCollapsed(false)}
                    >
                        <div className="topbar-left">
                            <button className="btnLogo" type="button" onClick={() => setTab("LISTA")}>
                                <img className="topbar-logo" src={logo} alt="Logo" />
                            </button>

                            <div className="topbar-brand">
                                <div className="topbar-title">Hub</div>
                                <div className="topbar-subtitle">Bem-vindo, {user?.name}!</div>
                            </div>
                        </div>

                        <div className="topbar-right">
                            {!isMobile && (
                                <button
                                    className="topbar-icon-btn"
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleNavPosition();
                                    }}
                                    title="Mover menu para a lateral"
                                    aria-label="Mover menu para a lateral"
                                >
                                    <PanelLeft size={18} strokeWidth={2.2} />
                                </button>
                            )}

                            <button
                                className="topbar-backup"
                                type="button"
                                onClick={() => setTab("BACKUP")}
                                title="Backup"
                                aria-label="Backup"
                            >
                                <Cloud size={20} strokeWidth={2.2} />
                                <span>Backup</span>
                            </button>

                            <button
                                className="topbar-add"
                                type="button"
                                onClick={() => setShowAddModal(true)}
                                title="Adicionar"
                                aria-label="Adicionar"
                            >
                                <Plus size={20} strokeWidth={2.4} />
                                <span>Adicionar</span>
                            </button>

                            <button
                                className="topbar-logout"
                                onClick={handleLogout}
                                type="button"
                                title="Sair"
                                aria-label="Sair"
                            >
                                <LogOut size={20} strokeWidth={2.2} />
                                <span>Sair</span>
                            </button>
                        </div>
                    </div>
                </header>
            ) : (
                <aside className="sidebar">
                    <button className="btnLogo sidebar-logo-btn" type="button" onClick={() => setTab("LISTA")}>
                        <img className="topbar-logo" src={logo} alt="Logo" />
                        <div className="topbar-brand">
                            <div className="topbar-title">Hub</div>
                            <div className="topbar-subtitle">{user?.name}</div>
                        </div>
                    </button>

                    <nav className="sidebar-nav">
                        <button
                            className={"sidebar-link" + (tab === "LISTA" ? " active" : "")}
                            type="button"
                            onClick={() => setTab("LISTA")}
                        >
                            <FolderIcon size={18} strokeWidth={2.2} />
                            <span>Minhas Obras</span>
                        </button>

                        <button
                            className={"sidebar-link" + (tab === "BACKUP" ? " active" : "")}
                            type="button"
                            onClick={() => setTab("BACKUP")}
                        >
                            <Cloud size={18} strokeWidth={2.2} />
                            <span>Backup</span>
                        </button>

                        <button className="sidebar-link" type="button" onClick={() => setShowAddModal(true)}>
                            <Plus size={18} strokeWidth={2.4} />
                            <span>Adicionar</span>
                        </button>
                    </nav>

                    <div className="sidebar-footer">
                        <button
                            className="sidebar-link"
                            type="button"
                            onClick={toggleNavPosition}
                            title="Mover menu para o topo"
                        >
                            <PanelTop size={18} strokeWidth={2.2} />
                            <span>Menu no topo</span>
                        </button>

                        <button className="sidebar-link sidebar-logout" type="button" onClick={handleLogout}>
                            <LogOut size={18} strokeWidth={2.2} />
                            <span>Sair</span>
                        </button>
                    </div>
                </aside>
            )}

            <div className="dashboard-container">
                <section className="search-row">
                    <h2 className="page-title">{pageTitle}</h2>
                </section>

                {tab === "BACKUP" && (
                    <div className="backup-grid">
                        <section className="backup-panel">
                            <div className="backup-panel-header">
                                <Cloud className="backup-panel-icon" size={26} strokeWidth={2} />
                                <div>
                                    <h3>Backup na nuvem</h3>
                                    <p>Sincroniza sua lista com a nuvem pra acessar de outro dispositivo.</p>
                                </div>
                            </div>

                            <div className="backup-panel-actions">
                                <button
                                    className="backup-btn backup-btn-primary"
                                    type="button"
                                    onClick={handleSalvarBackup}
                                    disabled={loadingBackup}
                                >
                                    {loadingBackup ? "Salvando..." : "Salvar na nuvem"}
                                </button>
                                <button
                                    className="backup-btn"
                                    type="button"
                                    onClick={handleRestaurarBackup}
                                    disabled={loadingBackup}
                                >
                                    {loadingBackup ? "Restaurando..." : "Restaurar da nuvem"}
                                </button>
                            </div>

                            {lastSyncedLabel && (
                                <p className="backup-panel-meta">
                                    Última sincronização: {lastSyncedLabel}
                                </p>
                            )}
                        </section>

                        <section className="backup-panel">
                            <div className="backup-panel-header">
                                <div>
                                    <h3>Backup em arquivo</h3>
                                    <p>Exporta ou importa um arquivo .json com todas as suas obras.</p>
                                </div>
                            </div>

                            <div className="backup-panel-actions">
                                <button className="backup-btn" type="button" onClick={handleExportJson}>
                                    Exportar (.json)
                                </button>
                                <button className="backup-btn" type="button" onClick={handleClickImportFile}>
                                    Importar (.json)
                                </button>
                            </div>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="application/json"
                                style={{ display: "none" }}
                                onChange={handleFileChange}
                            />
                        </section>
                    </div>
                )}

                {message && <div className="info-box">{message}</div>}
                {error && <div className="error-box">{error}</div>}

                {tab === "LISTA" && (
                    <>
                        {/* toolbar única: busca + filtros + ordenar + nova pasta */}
                        <section className="toolbar-row">
                            <div className={"search-wrap " + (search.trim() ? "filter-active" : "")}>
                                <input
                                    type="text"
                                    placeholder="Pesquisar..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>

                            <div className="stat-pills">
                                {(["TODOS", "EM_ANDAMENTO", "EM_ESPERA", "FINALIZADOS", "CANCELADOS", "DROPADOS"] as Filtro[]).map((f) => {
                                    const contagem =
                                        f === "TODOS" ? statusCounts.total
                                            : f === "EM_ANDAMENTO" ? statusCounts.emAndamento
                                                : f === "EM_ESPERA" ? statusCounts.emEspera
                                                    : f === "FINALIZADOS" ? statusCounts.finalizados
                                                        : f === "CANCELADOS" ? statusCounts.cancelados
                                                            : statusCounts.dropados;

                                    return (
                                        <button
                                            key={f}
                                            type="button"
                                            className={"stat-pill" + (filtro === f ? " is-active" : "")}
                                            onClick={() => setFiltro(f)}
                                        >
                                            {statusPillLabels[f]} ({contagem})
                                        </button>
                                    );
                                })}
                            </div>

                            <select
                                className={"tb-select " + (tipoFiltro !== "TODOS" ? "filter-active" : "")}
                                value={tipoFiltro}
                                onChange={(e) => setTipoFiltro(e.target.value as any)}
                            >
                                <option value="TODOS">Tipo: Todos</option>
                                <option value="ANIME">Anime</option>
                                <option value="MANGA">Mangá</option>
                                <option value="MANHUA">Manhua</option>
                                <option value="SERIE">Série</option>
                                <option value="FILME">Filme</option>
                                <option value="NOVEL">Novel</option>
                                <option value="OUTRO">Outro</option>
                            </select>

                            <select
                                className={"tb-select " + (diaFiltro !== "TODOS" ? "filter-active" : "")}
                                value={diaFiltro}
                                onChange={(e) => setDiaFiltro(e.target.value)}
                            >
                                <option value="TODOS">Dia: Todos</option>
                                <option value="SEGUNDA">Segunda</option>
                                <option value="TERCA">Terça</option>
                                <option value="QUARTA">Quarta</option>
                                <option value="QUINTA">Quinta</option>
                                <option value="SEXTA">Sexta</option>
                                <option value="SABADO">Sábado</option>
                                <option value="DOMINGO">Domingo</option>
                            </select>

                            <select
                                className={"tb-select " + (sortBy !== "FAV_FIRST" ? "filter-active" : "")}
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as SortOption)}
                            >
                                <option value="FAV_FIRST">Ordem: Favoritos</option>
                                <option value="ADICAO_ASC">Primeiros adicionados</option>
                                <option value="ADICAO_DESC">Últimos adicionados</option>
                                <option value="NOTA_DESC">Nota maior</option>
                                <option value="NOTA_ASC">Nota menor</option>
                                <option value="STATUS_ORDER">Status</option>
                            </select>

                            <button
                                type="button"
                                className="tb-new-folder"
                                onClick={() => setShowFolderModal(true)}
                                title="Nova pasta"
                            >
                                <FolderPlus size={16} strokeWidth={2.2} />
                                <span>Nova pasta</span>
                            </button>
                        </section>

                        {secoes.length > 1 && (
                            <nav className="folder-jump-row">
                                {secoes.map((s) => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        className="folder-jump-chip"
                                        onClick={() => jumpToSection(s.id)}
                                    >
                                        {s.folder && <FolderIcon size={12} strokeWidth={2.4} />}
                                        {s.titulo} ({s.obras.length})
                                    </button>
                                ))}
                            </nav>
                        )}

                        <main>
                            {obrasFiltradas.length === 0 ? (
                                <p className="empty-text">Nenhuma obra encontrada neste filtro.</p>
                            ) : (
                                secoes.map(renderSecao)
                            )}
                        </main>
                    </>
                )}
            </div>

            {/* MODAIS (Portal) */}
            {showAddModal && <AdicionarObraModal onClose={() => setShowAddModal(false)} />}

            {obraEditando && (
                <EditarObraModal
                    obra={obraEditando}
                    onClose={() => setObraEditando(null)}
                    onSave={salvarEdicao}
                />
            )}

            {showFolderModal && <FolderModal folder={null} onClose={() => setShowFolderModal(false)} />}
            {folderEditando && (
                <FolderModal folder={folderEditando} onClose={() => setFolderEditando(null)} />
            )}

            <footer className="app-footer">
                <div className="footer-content">
                    <div className="footer-left">
                        <img src={logo} alt="" className="footer-logo" />
                        <div className="footer-brand">
                            <strong>Lethal Hub</strong>
                            <span>Gerenciador de obras</span>
                        </div>
                    </div>

                    <div className="footer-center">
                        Criado por <strong>Rafael R. Oliveira</strong> © 2025
                    </div>

                    <div className="footer-right">
                        <a href="https://github.com/RafaelROliveira/lethal-hub" target="_blank" rel="noreferrer">
                            Documentação
                        </a>
                        <span className="footer-dot">•</span>
                        <a href="https://github.com/RafaelROliveira" target="_blank" rel="noreferrer">
                            Créditos
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
