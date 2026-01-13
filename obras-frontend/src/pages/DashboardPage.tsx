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
    exportBackup,
    importBackup,
} from "../features/obras/obrasLocalStorage";
import type { Obra, StatusObra, TipoObra, BackupData } from "../types/backup";
import { apiGetBackup, apiSaveBackup } from "../api/apiClient";
import "./DashboardPage.css";


import favIconOff from "../assets/favIconOffB.png";     // estrela vazia
import favIconOn from "../assets/favIconOnB.png";    // estrela preenchida


import editIcon from "../assets/icon-edit.png";
import deleteIcon from "../assets/icon-delete.png";
import viewIcon from "../assets/ler.png";
import backupIcon from "../assets/nuvemB.png";
import adicionar from "../assets/add.png";
import sair from "../assets/sairB.png";
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
    | "FAVORITOS"
    | "EM_ANDAMENTO"
    | "EM_ESPERA"
    | "FINALIZADOS"
    | "CANCELADOS"
    | "DROPADOS";

type Tab = "BACKUP" | "LISTA" | "ADICIONAR"; // mantido, mas não usamos mais "ADICIONAR"

const statusLabels: Record<StatusObra, string> = {
    EM_ANDAMENTO: "Em andamento",
    EM_ESPERA: "Em espera",
    FINALIZADO: "Finalizado",
    CANCELADO: "Cancelado",
    DROPADO: "Dropado",
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
    capituloStr?: string
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
    const [filtro, setFiltro] = useState<Filtro>("TODOS");
    const [tipoFiltro, setTipoFiltro] = useState<TipoObra | "TODOS">("TODOS");
    const [sortBy, setSortBy] = useState<SortOption>("FAV_FIRST");
    const [tab, setTab] = useState<Tab>("LISTA");
    const [search, setSearch] = useState("");

    // status popover (qual card está com menu aberto)
    const [obraStatusMenuId, setObraStatusMenuId] = useState<string | null>(null);

    // filtro de dia da semana
    const [diaFiltro, setDiaFiltro] = useState<string>("TODOS");

    // editar
    const [obraEditando, setObraEditando] = useState<Obra | null>(null);

    // adicionar (modal)
    const [showAddModal, setShowAddModal] = useState(false);

    // feedback / backup
    const [loadingBackup, setLoadingBackup] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const statsRowRef = useRef<HTMLElement | null>(null);

    // ====== ESC + scroll lock (para QUALQUER modal aberto) ======
    const anyModalOpen = !!obraEditando || showAddModal;
    useBodyScrollLock(anyModalOpen);
    useEscapeToClose(anyModalOpen, () => {
        // ESC fecha o que estiver aberto (prioridade: adicionar)
        if (showAddModal) setShowAddModal(false);
        else if (obraEditando) setObraEditando(null);

        // também fecha popover de status
        setObraStatusMenuId(null);
    });

    // mobile (esconder stats ao descer)
    useEffect(() => {
        if (tab !== "LISTA") return;

        const el = statsRowRef.current;
        if (!el) return;

        // só no mobile (mesma largura do seu CSS @media 720px)
        const isMobile = window.matchMedia("(max-width: 720px)").matches;
        if (!isMobile) return;

        // garante estado limpo ao entrar
        el.classList.remove("is-hidden");

        let lastY = window.scrollY;

        const onScroll = () => {
            const y = window.scrollY;
            const goingDown = y > lastY;

            if (goingDown && y > 40) el.classList.add("is-hidden");
            else el.classList.remove("is-hidden");

            lastY = y;
        };

        window.addEventListener("scroll", onScroll, { passive: true });

        // aplica uma vez pra ficar consistente ao entrar na tela
        onScroll();

        return () => {
            window.removeEventListener("scroll", onScroll);
            // limpa ao sair da LISTA (evita voltar bugado)
            el.classList.remove("is-hidden");
        };
    }, [tab]);


    // carregar obras do localStorage
    useEffect(() => {
        if (!user) return;
        const loaded = loadObrasFromLocal(user.id);
        setObras(loaded);
    }, [user]);

    function syncLocal(obrasAtualizadas: Obra[]) {
        if (!user) return;
        setObras(obrasAtualizadas);
        saveObrasToLocal(user.id, obrasAtualizadas);
    }

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
            await apiSaveBackup(backup);
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
            const data = await apiGetBackup();
            if (!data) {
                setMessage("Você ainda não tem backup salvo na nuvem.");
                return;
            }
            importBackup(user.id, data as BackupData);
            const obrasRestauradas = loadObrasFromLocal(user.id);
            setObras(obrasRestauradas);
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
                const obrasRestauradas = loadObrasFromLocal(user.id);
                setObras(obrasRestauradas);
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
                capitulo
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
                    <label>Comentário</label>
                    <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} />
                </div>

                <div className="modal-actions">
                    <button onClick={onClose}>Cancelar</button>
                    <button onClick={salvar}>Adicionar</button>
                </div>
            </ModalPortal>
        );
    }

    // ====== MODAL EDITAR (Portal + mesmo CSS) ======
    function abrirEdicao(obra: Obra) {
        setObraEditando(obra);
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

                <div className="modal-field">
                    <label>Imagem URL</label>
                    <input value={imagemUrl} onChange={(e) => setImagemUrl(e.target.value)} />
                </div>

                <div className="modal-field">
                    <label>Link</label>
                    <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
                </div>

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
                    <label>Comentário</label>
                    <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} />
                </div>

                <div className="modal-actions">
                    <button onClick={onClose}>Cancelar</button>
                    <button onClick={salvar}>Salvar</button>
                </div>
            </ModalPortal>
        );
    }

    // base pros contadores (respeita diaFiltro + search)
    const statsBase = useMemo(() => {
        let lista = [...obras];

        if (tab === "LISTA") {
            if (diaFiltro !== "TODOS") {
                lista = lista.filter((obra) => obra.diaLancamento === diaFiltro);
            }
        }

        if (search.trim()) {
            const norm = search.toLowerCase();
            lista = lista.filter((obra) => obra.titulo.toLowerCase().includes(norm));
        }

        return lista;
    }, [obras, tab, diaFiltro, search]);

    const stats = useMemo(() => {
        return {
            total: statsBase.length,
            favoritos: statsBase.filter((o) => o.favorito).length,
            emAndamento: statsBase.filter((o) => o.status === "EM_ANDAMENTO").length,
            emEspera: statsBase.filter((o) => o.status === "EM_ESPERA").length,
            finalizados: statsBase.filter((o) => o.status === "FINALIZADO").length,
            cancelados: statsBase.filter((o) => o.status === "CANCELADO").length,
            dropados: statsBase.filter((o) => o.status === "DROPADO").length,
        };
    }, [statsBase]);

    // filtro + busca
    const obrasFiltradas = useMemo(() => {
        let lista = [...obras];

        // ===== filtros (status/favoritos)
        if (tab === "LISTA") {
            lista = lista.filter((obra) => {
                switch (filtro) {
                    case "FAVORITOS":
                        return obra.favorito;
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

            // filtro por dia
            if (diaFiltro !== "TODOS") {
                lista = lista.filter((obra) => obra.diaLancamento === diaFiltro);
            }

            // ===== filtro por TIPO
            if (tipoFiltro !== "TODOS") {
                lista = lista.filter((obra) => obra.tipo === tipoFiltro);
            }
        }

        // busca
        if (search.trim()) {
            const norm = search.toLowerCase();
            lista = lista.filter((obra) => obra.titulo.toLowerCase().includes(norm));
        }

        // ===== ordenação
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
    }, [obras, filtro, tab, search, diaFiltro, tipoFiltro, sortBy]);

    // ===== LAZY LOAD (infinite scroll) =====
    const PAGE_SIZE = 24; // ajuste livre (ex: 16, 24, 32)
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const loadMoreRef = useRef<HTMLDivElement | null>(null);

    // sempre que a lista "muda" (filtros/busca/ordem/tab), reseta para o começo
    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [tab, filtro, tipoFiltro, sortBy, diaFiltro, search]);

    // observer: quando chegar perto do fim, carrega mais
    useEffect(() => {
        if (tab !== "LISTA") return;
        const el = loadMoreRef.current;
        if (!el) return;

        const obs = new IntersectionObserver(
            (entries) => {
                if (!entries[0]?.isIntersecting) return;
                setVisibleCount((v) => Math.min(v + PAGE_SIZE, obrasFiltradas.length));
            },
            {
                root: null,
                // carrega antes de chegar no final (melhor sensação)
                rootMargin: "700px 0px",
                threshold: 0,
            }
        );

        obs.observe(el);
        return () => obs.disconnect();
    }, [tab, obrasFiltradas.length]);

    const obrasVisiveis = useMemo(() => {
        return obrasFiltradas.slice(0, visibleCount);
    }, [obrasFiltradas, visibleCount]);

    const pageTitle = tab === "BACKUP" ? "Backup" : "Minhas Obras";

    return (
        <div className="app-root">
            {/* Navbar principal */}
            <header className="topbar">
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
                    {/* BACKUP */}
                    <button
                        className="topbar-backup"
                        type="button"
                        onClick={() => setTab("BACKUP")}
                        title="Backup"
                        aria-label="Backup"
                    >
                        <img src={backupIcon} alt="" />
                        <span>Backup</span>
                    </button>

                    {/* ADICIONAR (MODAL) */}
                    <button
                        className="topbar-add"
                        type="button"
                        onClick={() => setShowAddModal(true)}
                        title="Adicionar"
                        aria-label="Adicionar"
                    >
                        <img src={adicionar} alt="" />
                        <span>Adicionar</span>
                    </button>

                    {/* SAIR */}
                    <button
                        className="topbar-logout"
                        onClick={handleLogout}
                        type="button"
                        title="Sair"
                        aria-label="Sair"
                    >
                        <img src={sair} alt="" />
                        <span>Sair</span>
                    </button>
                </div>
            </header>

            <div className="dashboard-container">
                <section className="search-row">
                    <h2 className="page-title">{pageTitle}</h2>
                </section>

                {tab === "BACKUP" && (
                    <>
                        <section className="dashboard-actions">
                            <button onClick={handleSalvarBackup} disabled={loadingBackup}>
                                {loadingBackup ? "Salvando backup..." : "Salvar backup na nuvem"}
                            </button>
                            <button onClick={handleRestaurarBackup} disabled={loadingBackup}>
                                {loadingBackup ? "Restaurando..." : "Restaurar backup da nuvem"}
                            </button>
                        </section>

                        <section className="dashboard-actions">
                            <button type="button" onClick={handleExportJson}>
                                Exportar backup (arquivo JSON)
                            </button>
                            <button type="button" onClick={handleClickImportFile}>
                                Importar backup (arquivo JSON)
                            </button>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="application/json"
                                style={{ display: "none" }}
                                onChange={handleFileChange}
                            />
                        </section>
                    </>
                )}

                {message && <div className="info-box">{message}</div>}
                {error && <div className="error-box">{error}</div>}

                {tab === "LISTA" && (
                    <>
                        {/* Contadores */}
                        <section className="stats-row" ref={statsRowRef as React.RefObject<HTMLElement>}>
                            <div
                                className={"stat-card stat-total " + (filtro === "TODOS" ? "is-active" : "")}
                                role="button"
                                tabIndex={0}
                                onClick={() => setFiltro("TODOS")}
                                onKeyDown={(e) => e.key === "Enter" && setFiltro("TODOS")}
                                title="Mostrar todos"
                            >
                                <div className="stat-number">{stats.total}</div>
                                <div className="stat-label">Total</div>
                            </div>

                            <div
                                className={"stat-card stat-em_andamento " + (filtro === "EM_ANDAMENTO" ? "is-active" : "")}
                                role="button"
                                tabIndex={0}
                                onClick={() => setFiltro("EM_ANDAMENTO")}
                                onKeyDown={(e) => e.key === "Enter" && setFiltro("EM_ANDAMENTO")}
                                title="Filtrar: Em andamento"
                            >
                                <div className="stat-number">{stats.emAndamento}</div>
                                <div className="stat-label">Em andamento</div>
                            </div>

                            <div
                                className={"stat-card stat-em_espera " + (filtro === "EM_ESPERA" ? "is-active" : "")}
                                role="button"
                                tabIndex={0}
                                onClick={() => setFiltro("EM_ESPERA")}
                                onKeyDown={(e) => e.key === "Enter" && setFiltro("EM_ESPERA")}
                                title="Filtrar: Em espera"
                            >
                                <div className="stat-number">{stats.emEspera}</div>
                                <div className="stat-label">Em espera</div>
                            </div>

                            <div
                                className={"stat-card stat-finalizado " + (filtro === "FINALIZADOS" ? "is-active" : "")}
                                role="button"
                                tabIndex={0}
                                onClick={() => setFiltro("FINALIZADOS")}
                                onKeyDown={(e) => e.key === "Enter" && setFiltro("FINALIZADOS")}
                                title="Filtrar: Finalizados"
                            >
                                <div className="stat-number">{stats.finalizados}</div>
                                <div className="stat-label">Finalizados</div>
                            </div>

                            <div
                                className={"stat-card stat-cancelado " + (filtro === "CANCELADOS" ? "is-active" : "")}
                                role="button"
                                tabIndex={0}
                                onClick={() => setFiltro("CANCELADOS")}
                                onKeyDown={(e) => e.key === "Enter" && setFiltro("CANCELADOS")}
                                title="Filtrar: Cancelados"
                            >
                                <div className="stat-number">{stats.cancelados}</div>
                                <div className="stat-label">Cancelados</div>
                            </div>

                            <div
                                className={"stat-card stat-dropado " + (filtro === "DROPADOS" ? "is-active" : "")}
                                role="button"
                                tabIndex={0}
                                onClick={() => setFiltro("DROPADOS")}
                                onKeyDown={(e) => e.key === "Enter" && setFiltro("DROPADOS")}
                                title="Filtrar: Dropados"
                            >
                                <div className="stat-number">{stats.dropados}</div>
                                <div className="stat-label">Dropados</div>
                            </div>
                        </section>

                        {/* filtros + dia + busca */}
                        <section className="filtros-row">
                            <div className="filters-grid">
                                {/* BLOCO 1 — FILTROS */}
                                <div className="filters-block">
                                    <span className="filters-label">Filtros:</span>

                                    <select
                                        className={"dia-select " + (diaFiltro !== "TODOS" ? "filter-active" : "")}
                                        value={diaFiltro}
                                        onChange={(e) => setDiaFiltro(e.target.value)}
                                    >
                                        <option value="TODOS">Todos os dias</option>
                                        <option value="SEGUNDA">Segunda</option>
                                        <option value="TERCA">Terça</option>
                                        <option value="QUARTA">Quarta</option>
                                        <option value="QUINTA">Quinta</option>
                                        <option value="SEXTA">Sexta</option>
                                        <option value="SABADO">Sábado</option>
                                        <option value="DOMINGO">Domingo</option>
                                    </select>

                                    <select
                                        className={"tipo-select " + (tipoFiltro !== "TODOS" ? "filter-active" : "")}
                                        value={tipoFiltro}
                                        onChange={(e) => setTipoFiltro(e.target.value as any)}
                                    >
                                        <option value="TODOS">Todos os tipos</option>
                                        <option value="ANIME">Anime</option>
                                        <option value="MANGA">Mangá</option>
                                        <option value="MANHUA">Manhua</option>
                                        <option value="SERIE">Série</option>
                                        <option value="FILME">Filme</option>
                                        <option value="NOVEL">Novel</option>
                                        <option value="OUTRO">Outro</option>
                                    </select>
                                </div>

                                {/* BLOCO 2 — ORDEM */}
                                <div className="filters-block">
                                    <span className="filters-label">Ordem:</span>

                                    <select
                                        className={"sort-select " + (sortBy !== "FAV_FIRST" ? "filter-active" : "")}
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                                    >
                                        <option value="FAV_FIRST">por Favoritos</option>
                                        <option value="ADICAO_ASC">por Primeiros</option>
                                        <option value="ADICAO_DESC">por Últimos</option>
                                        <option value="NOTA_DESC">por Nota Maior</option>
                                        <option value="NOTA_ASC">por Nota Menor</option>
                                        <option value="STATUS_ORDER">por Status</option>
                                    </select>
                                </div>

                                {/* BLOCO 3 — BUSCA */}
                                <div className="filters-block filters-block--search">
                                    <div className={"search-wrap " + (search.trim() ? "filter-active" : "")}>
                                        <input
                                            type="text"
                                            placeholder="Pesquisar..."
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Lista */}
                        <main>
                            {obrasFiltradas.length === 0 ? (
                                <p className="empty-text">Nenhuma obra encontrada neste filtro.</p>
                            ) : (
                                <>
                                    <ul className="obras-list">
                                        {obrasVisiveis.map((obra) => (
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

                                                    {/* STATUS topo-esquerda */}
                                                    <div className="obra-status-area">
                                                        <button
                                                            type="button"
                                                            className={`obra-status-pill status-${obra.status.toLowerCase()}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setObraStatusMenuId((atual) => (atual === obra.id ? null : obra.id));
                                                            }}
                                                        >
                                                            {statusLabels[obra.status]}
                                                        </button>

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
                                                        <img src={obra.favorito ? favIconOn : favIconOff} alt="Favorito" />
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
                                                                <img src={viewIcon} alt="" loading="lazy" decoding="async" />
                                                                <span>Ler</span>
                                                            </a>
                                                        )}

                                                        <button className="btn-action" type="button" onClick={() => abrirEdicao(obra)} title="Editar">
                                                            <img src={editIcon} alt="" loading="lazy" decoding="async" />
                                                        </button>

                                                        <button
                                                            className="btn-action btn-danger"
                                                            type="button"
                                                            onClick={() => removerObra(obra.id)}
                                                            title="Deletar"
                                                        >
                                                            <img src={deleteIcon} alt="Deletar" loading="lazy" decoding="async" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>

                                    {/* Sentinela do lazy load */}
                                    <div ref={loadMoreRef} style={{ height: 1 }} />

                                    {/* Indicador opcional */}
                                    {visibleCount < obrasFiltradas.length && (
                                        <div style={{ textAlign: "center", opacity: 0.75, fontSize: 12, margin: "14px 0 6px" }}>
                                            Carregando mais...
                                        </div>
                                    )}
                                </>
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

            <footer className="app-footer">
                <div className="footer-content">
                    <div className="footer-left">
                        <strong>Lethal Hub</strong>
                        <span>• Gerenciador de obras</span>
                    </div>

                    <div className="footer-center">
                        <span>
                            Criado por <strong>Gedes</strong> © 2025
                        </span>
                    </div>

                    <div className="footer-right">
                        <a href="https://discord.gg/jNnF9kEE7X" target="_blank" rel="noreferrer">
                            Documentação
                        </a>

                        <a href="https://discord.gg/jNnF9kEE7X" target="_blank" rel="noreferrer">
                            Créditos
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
