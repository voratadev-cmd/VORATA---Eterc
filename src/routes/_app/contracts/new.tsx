import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Button,
  Card,
  CardHeader,
  CardSub,
  CardTitle,
  FieldRow,
  FileDropzone,
  I,
  Input,
  Modal,
  PageHeader,
  ProgressBar,
  Select,
} from "@/components/ds";
import { getFileTypeMeta } from "@/lib/files/fileTypes";
import { ALL_RMA_ACCEPT } from "@/lib/rma/documentTypes";
import {
  ContractIdentificationSchema,
  EMPTY_CONTRACT_DRAFT,
  type ContractDraft,
  parseBRLInput,
} from "@/lib/schemas/contract";
import { deleteObra, findObraByNomeInterno } from "@/lib/supabase/obras";
import {
  createObraArquivo,
  deleteObraArquivo,
  getObraFileSignedUrl,
  listObraArquivos,
  promoteObraFilesToRaw,
  type ObraArquivo,
} from "@/lib/supabase/obraArquivos";
import { removeObraTree, uploadObraRawFile } from "@/lib/supabase/uploadObraRawFile";
import { useCreateObra } from "@/lib/hooks/useObras";
import { RequireCapability } from "@/components/RequireCapability";
import "./new.css";

export const Route = createFileRoute("/_app/contracts/new")({
  // Cadastrar obra é capacidade de admin/master — regular não entra.
  component: () => (
    <RequireCapability cap="registerObras">
      <NewContractPage />
    </RequireCapability>
  ),
  head: () => ({ meta: [{ title: "Cadastrar nova obra — RDM IA" }] }),
});

// ── Estado de arquivos da obra (flat · sem categorização) ───────────

/**
 * Arquivo bruto da obra. Sobe pro Storage em `{obraId}/raw/` e ganha um
 * `arquivoId` (PK da row em `obra_arquivos`) quando persiste.
 */
export type ObraRawFile = {
  /** ID local pra dedup/key na lista enquanto pending. */
  id: string;
  /** Nome de exibição · do File (upload novo) ou do nome_original (retomada do DB). */
  name: string;
  /** Tamanho em bytes · do File ou da row do DB. */
  size: number;
  /** Presente só quando há um File local a subir (pending/uploading/error). Ausente na retomada. */
  file?: File;
  status: "pending" | "uploading" | "uploaded" | "error";
  /** Path no Storage quando uploaded. */
  uploadedPath?: string;
  /** PK em `obra_arquivos` quando persistido no DB. */
  arquivoId?: string;
  /** Timestamp (ISO) quando o upload terminou com sucesso. */
  uploadedAt?: string;
  /** Timestamp (ms) quando o arquivo foi adicionado à lista · pra animação. */
  addedAt: number;
  progress?: number;
  errorMsg?: string;
};

const STORAGE_KEY = "contract-draft-v1";
type StoredDraft = {
  draft: ContractDraft;
  savedAtISO: string;
  /** obra-em-montagem · gravado quando o upload já criou a row stub no DB. */
  obraId?: string;
  /** true = já existe row de obra no DB → ao retomar, submit faz UPDATE (sem bater na trava de nome). */
  stubCreated?: boolean;
};

/** Lê o rascunho do localStorage (ou null se ausente/inválido). */
function readStoredDraft(): StoredDraft | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as StoredDraft;
    if (!s?.draft || !s?.savedAtISO) return null;
    return s;
  } catch {
    return null;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function currentMonthRef(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatBRLInputMask(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";
  const cents = digits.slice(-2).padStart(2, "0");
  const integer = digits.slice(0, -2) || "0";
  const intFormatted = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${intFormatted},${cents}`;
}

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function fileKey(name: string, size: number): string {
  return `${name}::${size}`;
}

/** Converte uma row de obra_arquivos (já salva) num ObraRawFile "uploaded" pra re-exibir na retomada. */
function dbRowToRawFile(row: ObraArquivo): ObraRawFile {
  return {
    id: row.id,
    name: row.nome_original,
    size: row.size ?? 0,
    status: "uploaded",
    uploadedPath: row.path,
    arquivoId: row.id,
    uploadedAt: row.uploaded_at ?? undefined,
    addedAt: Date.now(),
  };
}

function formatHHmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatRelativeDraft(iso: string): string {
  const then = new Date(iso);
  const diffMs = Date.now() - then.getTime();
  const hours = Math.floor(diffMs / 3600_000);
  if (hours < 1) return "menos de 1 hora atrás";
  if (hours < 24) return `há ${hours} hora${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `há ${days} dia${days === 1 ? "" : "s"}`;
}

// ── Componente ───────────────────────────────────────────────────────

function NewContractPage() {
  const navigate = useNavigate();
  const createObraMutation = useCreateObra();
  // obraId gerado no MOUNT — usado tanto como pasta no Storage (uploads
  // antecipados via "Salvar arquivos") quanto como id da row em `obras` no submit.
  const [obraId] = useState<string>(() => {
    const s = readStoredDraft();
    return s?.stubCreated && s.obraId ? s.obraId : crypto.randomUUID();
  });
  // true = já existe row de obra no DB (stub criado no upload OU retomada de rascunho).
  // Quando true, o submit faz UPDATE em vez de INSERT — não bate na trava de nome.
  const [obraStubCreated, setObraStubCreated] = useState<boolean>(() =>
    Boolean(readStoredDraft()?.stubCreated),
  );
  const [draft, setDraft] = useState<ContractDraft>(() => ({
    ...EMPTY_CONTRACT_DRAFT,
    mesReferenciaRMA: currentMonthRef(),
  }));
  const [obraFiles, setObraFiles] = useState<ObraRawFile[]>([]);
  const [savingFiles, setSavingFiles] = useState<boolean>(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ContractDraft, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  // Retomada de obra-em-cadastro (stub já no DB) · controla o banner "Retomando".
  const [resumedFromStub] = useState<boolean>(() => Boolean(readStoredDraft()?.stubCreated));
  // Falha ao re-buscar arquivos na retomada (≠ "obra sem arquivos") · evita o usuário
  // achar que perdeu tudo e re-enviar (duplicando) ou descartar uploads válidos.
  const [resumeError, setResumeError] = useState<string | null>(null);
  // Colisão de nome no submit → oferece abrir a obra existente em vez de travar.
  const [conflictObra, setConflictObra] = useState<{ id: string; nome: string } | null>(null);

  // ── Previne o navegador de abrir arquivos arrastados pra fora da dropzone
  // (quando o drop cai em qualquer lugar do body em vez do FileDropzone)
  useEffect(() => {
    const blockOutsideDrops = (e: DragEvent) => {
      // Só interfere se o target NÃO está dentro de uma dropzone
      const target = e.target as Element | null;
      if (target && target.closest(".dropzone")) return;
      e.preventDefault();
    };
    window.addEventListener("dragover", blockOutsideDrops);
    window.addEventListener("drop", blockOutsideDrops);
    return () => {
      window.removeEventListener("dragover", blockOutsideDrops);
      window.removeEventListener("drop", blockOutsideDrops);
    };
  }, []);

  // ── Recover de rascunho ──────────────────────────────────────────
  useEffect(() => {
    const stored = readStoredDraft();
    if (!stored) return;
    const ageHours = (Date.now() - new Date(stored.savedAtISO).getTime()) / (1000 * 60 * 60);
    if (ageHours > 168) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    setDraftSavedAt(stored.savedAtISO);

    if (stored.stubCreated && stored.obraId) {
      // Retomada: a obra já existe no DB. Restaura os campos automaticamente e
      // re-busca os arquivos já enviados — sem o banner opt-in de "continuar/descartar".
      setDraft(stored.draft);
      void (async () => {
        try {
          const rows = await listObraArquivos(stored.obraId!);
          if (rows.length > 0) setObraFiles(rows.map(dbRowToRawFile));
          setResumeError(null);
        } catch {
          // NÃO assume "vazio" — sinaliza a falha pra não duplicar/descartar.
          setResumeError(
            "Não foi possível carregar os arquivos já enviados desta obra. Recarregue a página antes de reenviar (pra não duplicar).",
          );
        }
      })();
    } else {
      // Só campos preenchidos (sem obra criada) → banner opt-in, como antes.
      setShowDraftBanner(true);
    }
  }, []);

  // ── Autosave do rascunho (debounce 800ms) ────────────────────────
  useEffect(() => {
    const isDirty = JSON.stringify(draft) !== JSON.stringify(EMPTY_CONTRACT_DRAFT);
    // Persiste também quando há obra criada (mesmo com form "vazio"), pra manter
    // o vínculo obraId↔stub recuperável após reload.
    if (!isDirty && !obraStubCreated) return;
    const timer = setTimeout(() => {
      const stored: StoredDraft = {
        draft,
        savedAtISO: new Date().toISOString(),
        obraId,
        stubCreated: obraStubCreated,
      };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
        setDraftSavedAt(stored.savedAtISO);
      } catch {
        /* quota cheia · ignora */
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [draft, obraId, obraStubCreated]);

  // ── Helpers de field ─────────────────────────────────────────────
  function setField<K extends keyof ContractDraft>(key: K, value: ContractDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const { [key]: _omit, ...rest } = prev;
        return rest;
      });
    }
    if (key === "nomeInterno" && conflictObra) setConflictObra(null);
  }

  function continueDraft() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw) as StoredDraft;
      setDraft(stored.draft);
      setShowDraftBanner(false);
      toast.success("Rascunho recuperado");
    } catch {
      toast.error("Não foi possível recuperar o rascunho");
    }
  }

  function discardDraft() {
    window.localStorage.removeItem(STORAGE_KEY);
    setShowDraftBanner(false);
    setDraftSavedAt(null);
  }

  /** Descarta uma obra retomada (stub + arquivos no DB/Storage) e recomeça do zero. */
  async function discardResumedObra() {
    try {
      await deleteObra(obraId);
    } catch {
      /* best-effort */
    }
    await removeObraTree(obraId).catch(() => {});
    window.localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  }

  // ── Files da obra (upload livre · sem categorização) ─────────────
  function addObraFiles(files: File[]) {
    setObraFiles((prev) => {
      const existingKeys = new Set(prev.map((of) => fileKey(of.name, of.size)));
      const fresh: ObraRawFile[] = files
        .filter((f) => !existingKeys.has(fileKey(f.name, f.size)))
        .map((file) => ({
          id: genId(),
          name: file.name,
          size: file.size,
          file,
          status: "pending" as const,
          addedAt: Date.now(),
        }));
      if (fresh.length === 0) return prev;
      return [...prev, ...fresh];
    });
  }

  /**
   * Remove um arquivo da lista local · se já uploaded:
   * - Tem `arquivoId` → deleteObraArquivo (DB + Storage)
   * - Sem `arquivoId` (caso raro) → só remove do estado
   */
  async function removeObraFile(fileId: string) {
    const target = obraFiles.find((of) => of.id === fileId);
    if (target?.status === "uploaded" && target.arquivoId) {
      const r = await deleteObraArquivo(target.arquivoId);
      if (!r.ok) {
        toast.error(`Falha ao remover: ${r.error}`);
        return;
      }
    }
    setObraFiles((prev) => prev.filter((of) => of.id !== fileId));
  }

  /**
   * Sobe TODOS os arquivos pending: upload no Storage + INSERT em `obra_arquivos`.
   * Paralelo limitado a 3 concorrentes.
   */
  async function saveObraFiles() {
    const pendings = obraFiles.filter((of) => of.status === "pending");
    if (pendings.length === 0) return;

    setSavingFiles(true);
    setObraFiles((prev) =>
      prev.map((of) =>
        of.status === "pending" ? { ...of, status: "uploading", progress: 0 } : of,
      ),
    );

    // Garante que a obra existe no DB antes do INSERT em obra_arquivos (FK).
    // Se ainda não existe, cria uma stub com nome temporário · será UPDATEada no submit final.
    try {
      await ensureObraStub();
    } catch (err) {
      setSavingFiles(false);
      setObraFiles((prev) =>
        prev.map((of) =>
          of.status === "uploading"
            ? { ...of, status: "error", errorMsg: (err as Error).message }
            : of,
        ),
      );
      toast.error(`Falha ao preparar obra: ${(err as Error).message}`);
      return;
    }

    const CONCURRENCY = 3;
    let cursor = 0;
    const tasks = pendings;
    let failures = 0;

    async function worker() {
      while (cursor < tasks.length) {
        const idx = cursor++;
        const t = tasks[idx]!;
        if (!t.file) continue; // retomados (uploaded) não entram aqui; guard p/ tipos
        // Retry com backoff em falha TRANSIENTE de upload (rede/storage); erros
        // determinísticos (extensão/tamanho/vazio/conteúdo) não são re-tentados.
        let up = await uploadObraRawFile(obraId, t.file);
        for (let tries = 0; !up.ok && up.error.code === "UPLOAD_FAILED" && tries < 2; tries++) {
          await new Promise((r) => setTimeout(r, 400 * (tries + 1)));
          up = await uploadObraRawFile(obraId, t.file);
        }
        if (!up.ok) {
          failures++;
          setObraFiles((prev) =>
            prev.map((of) =>
              of.id === t.id ? { ...of, status: "error", errorMsg: up.error.message } : of,
            ),
          );
          continue;
        }
        // INSERT em obra_arquivos como 'staged' — só vira 'raw' (entra na fila da
        // IA) no submit do cadastro, pra não mapear obra que foi abandonada.
        const created = await createObraArquivo({
          obra_id: obraId,
          path: up.result.path,
          nome_original: t.file.name,
          mime: t.file.type || null,
          size: t.file.size,
          status: "staged",
        });
        if (!created.ok) {
          // Storage subiu mas DB falhou · limpa o storage pra não ficar lixo
          await removeObraFileSilent(up.result.path);
          if (created.duplicate) {
            // Mesmo doc (nome+tamanho) já registrado → não é erro, marca "já enviado".
            setObraFiles((prev) =>
              prev.map((of) =>
                of.id === t.id
                  ? { ...of, status: "uploaded", progress: 100, errorMsg: "Já enviado" }
                  : of,
              ),
            );
            continue;
          }
          failures++;
          setObraFiles((prev) =>
            prev.map((of) =>
              of.id === t.id ? { ...of, status: "error", errorMsg: created.error } : of,
            ),
          );
          continue;
        }
        setObraFiles((prev) =>
          prev.map((of) =>
            of.id === t.id
              ? {
                  ...of,
                  status: "uploaded",
                  progress: 100,
                  uploadedPath: up.result.path,
                  arquivoId: created.arquivo.id,
                  uploadedAt: up.result.uploadedAt,
                }
              : of,
          ),
        );
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    setSavingFiles(false);

    if (failures === 0) {
      toast.success(
        `${pendings.length} arquivo${pendings.length === 1 ? "" : "s"} salvo${
          pendings.length === 1 ? "" : "s"
        }`,
      );
    } else {
      toast.error(
        `${failures} arquivo${failures === 1 ? "" : "s"} falhou${
          failures === 1 ? "" : "ram"
        } · clique no erro pra tentar de novo`,
      );
    }
  }

  /** Helper · remove path do storage sem propagar erro. */
  async function removeObraFileSilent(path: string): Promise<void> {
    try {
      const { removeObraStorageFile } = await import("@/lib/supabase/uploadObraRawFile");
      await removeObraStorageFile(path);
    } catch {
      /* silent */
    }
  }

  /**
   * Garante uma row `obras` para que `obra_arquivos.obra_id` (FK) seja válido.
   * Cria uma stub com apenas `nome_interno` (placeholder se vazio). No submit
   * final, a mesma row é UPDATEada com os dados completos.
   */
  async function ensureObraStub(): Promise<void> {
    if (obraStubCreated) return;
    const nome = draft.nomeInterno.trim() || `Obra ${obraId.slice(0, 8)}`;
    await createObraMutation.mutateAsync({
      obraId,
      parsed: {
        nomeInterno: nome,
        objetoContratado: "",
        cidade: "",
        uf: "",
        contratante: "",
        modalidade: "",
        valorContratual: undefined,
        dataAssinaturaISO: "",
        dataInicioISO: "",
        dataTerminoISO: "",
        gestorObra: "",
        admContratual: "",
        indiceReajuste: "",
        periodicidadeReajuste: "",
        mesReferenciaRMA: draft.mesReferenciaRMA || "",
      },
    });
    setObraStubCreated(true);
    // Persiste o vínculo obraId↔rascunho IMEDIATAMENTE · se a página recarregar
    // logo após o upload, a retomada reencontra a mesma obra (não cria duplicata).
    try {
      const stored: StoredDraft = {
        draft,
        savedAtISO: new Date().toISOString(),
        obraId,
        stubCreated: true,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      setDraftSavedAt(stored.savedAtISO);
    } catch {
      /* quota cheia · ignora */
    }
  }

  /** Abre o arquivo salvo em nova aba via signed URL (TTL curto). */
  async function previewObraFile(fileId: string) {
    const target = obraFiles.find((of) => of.id === fileId);
    if (!target?.uploadedPath) {
      toast.error("Arquivo ainda não foi salvo");
      return;
    }
    const r = await getObraFileSignedUrl(target.uploadedPath, 300);
    if (!r.ok) {
      toast.error(`Não foi possível abrir: ${r.error}`);
      return;
    }
    window.open(r.url, "_blank", "noopener,noreferrer");
  }

  /** Reenvia um arquivo individual marcado como erro. */
  async function retryObraFile(fileId: string) {
    const target = obraFiles.find((of) => of.id === fileId);
    if (!target || target.status !== "error" || !target.file) return;
    setObraFiles((prev) =>
      prev.map((of) =>
        of.id === fileId ? { ...of, status: "uploading", progress: 0, errorMsg: undefined } : of,
      ),
    );
    try {
      await ensureObraStub();
    } catch (err) {
      setObraFiles((prev) =>
        prev.map((of) =>
          of.id === fileId ? { ...of, status: "error", errorMsg: (err as Error).message } : of,
        ),
      );
      toast.error((err as Error).message);
      return;
    }
    const up = await uploadObraRawFile(obraId, target.file);
    if (!up.ok) {
      setObraFiles((prev) =>
        prev.map((of) =>
          of.id === fileId ? { ...of, status: "error", errorMsg: up.error.message } : of,
        ),
      );
      toast.error(up.error.message);
      return;
    }
    const created = await createObraArquivo({
      obra_id: obraId,
      path: up.result.path,
      nome_original: target.file.name,
      mime: target.file.type || null,
      size: target.file.size,
      status: "staged", // mesmo gate do saveObraFiles · só vira 'raw' no submit
    });
    if (!created.ok) {
      await removeObraFileSilent(up.result.path);
      setObraFiles((prev) =>
        prev.map((of) =>
          of.id === fileId ? { ...of, status: "error", errorMsg: created.error } : of,
        ),
      );
      toast.error(created.error);
      return;
    }
    setObraFiles((prev) =>
      prev.map((of) =>
        of.id === fileId
          ? {
              ...of,
              status: "uploaded",
              progress: 100,
              uploadedPath: up.result.path,
              arquivoId: created.arquivo.id,
              uploadedAt: up.result.uploadedAt,
            }
          : of,
      ),
    );
    toast.success("Arquivo enviado");
    // (variável intencionalmente sombreada — fim do escopo)
  }
  // ── Resumo · contagem global por status ─────────────────────────
  const summary = useMemo(() => {
    const filesCount = obraFiles.length;
    const uploadedCount = obraFiles.filter((of) => of.status === "uploaded").length;
    const pendingCount = obraFiles.filter((of) => of.status === "pending").length;
    const errorCount = obraFiles.filter((of) => of.status === "error").length;
    return { filesCount, uploadedCount, pendingCount, errorCount };
  }, [obraFiles]);

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(EMPTY_CONTRACT_DRAFT) || obraFiles.length > 0,
    [draft, obraFiles],
  );

  // ── Beforeunload guard ───────────────────────────────────────────
  useEffect(() => {
    if (!isDirty || submitting) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty, submitting]);

  function handleCancel() {
    if (isDirty) setShowCancelModal(true);
    else navigate({ to: "/contracts" });
  }

  async function confirmCancel() {
    setShowCancelModal(false);
    if (obraStubCreated) {
      // Já existe obra criada (stub) + arquivos → descarta tudo (DB + Storage) e
      // limpa o rascunho, pra não deixar obra órfã na lista.
      try {
        await deleteObra(obraId);
      } catch {
        /* best-effort */
      }
      await removeObraTree(obraId).catch(() => {});
      window.localStorage.removeItem(STORAGE_KEY);
    }
    navigate({ to: "/contracts" });
  }

  // ── Submit · auto-save dos pendings + INSERT atômico ────────────
  async function handleSubmit() {
    // 1. Validação Zod do form
    const valor = parseBRLInput(draft.valorContratualInput);
    const parsed = ContractIdentificationSchema.safeParse({
      ...draft,
      valorContratual: draft.valorContratualInput ? valor : undefined,
      mesReferenciaRMA: draft.mesReferenciaRMA,
    });
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof ContractDraft, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof ContractDraft | undefined;
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      const firstKey = Object.keys(fieldErrors)[0];
      if (firstKey) {
        const el = document.getElementById(`field-${firstKey}`);
        el?.focus();
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        // Hoje só nomeInterno aparece em UI — os outros campos são opcionais e
        // virão depois (aba Informações futura).
      }
      toast.error("Verifique os campos destacados");
      return;
    }

    setSubmitting(true);

    // 2. Auto-save dos pendings antes de finalizar
    if (summary.pendingCount > 0) {
      await saveObraFiles();
    }

    // 3. Verifica se sobrou algum erro de upload
    if (obraFiles.some((of) => of.status === "error")) {
      setSubmitting(false);
      toast.error("Há arquivos com falha · ajuste antes de cadastrar a obra");
      return;
    }

    // 4. Check de unicidade do nome_interno (só se ainda não criou o stub)
    if (!obraStubCreated) {
      try {
        const existing = await findObraByNomeInterno(parsed.data.nomeInterno);
        if (existing) {
          setErrors({ nomeInterno: "Já existe uma obra com esse nome" });
          setConflictObra({ id: existing.id, nome: existing.nome_interno });
          document.getElementById("field-nomeInterno")?.focus();
          document
            .getElementById("field-nomeInterno")
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
          setSubmitting(false);
          toast.error("Nome interno já está em uso");
          return;
        }
      } catch (err) {
        setSubmitting(false);
        toast.error(`Erro ao verificar nome: ${(err as Error).message}`);
        return;
      }
    }

    // 5. INSERT ou UPDATE da obra
    try {
      if (obraStubCreated) {
        // Atualiza row stub já existente com os dados completos do form
        const { updateObra } = await import("@/lib/supabase/obras");
        await updateObra(obraId, parsed.data);
      } else {
        // Cria nova row direto com dados completos
        await createObraMutation.mutateAsync({ obraId, parsed: parsed.data });
      }
    } catch (err) {
      // Rollback: limpa storage. Se já tem stub, mantém a row pra user voltar
      if (!obraStubCreated) await removeObraTree(obraId);
      setSubmitting(false);
      toast.error(`Falha ao salvar obra: ${(err as Error).message}`);
      return;
    }

    // 5b. Promove os arquivos 'staged' → 'raw' · agora (obra finalizada) a IA pode
    // mapear. Antes do submit ficavam staged e fora da fila.
    const promoted = await promoteObraFilesToRaw(obraId);
    setSubmitting(false);

    if (!promoted.ok) {
      // NÃO limpa o rascunho nem navega — os docs ficaram 'staged' (fora da fila).
      // Mantendo o vínculo obraId↔stub, o usuário clica Cadastrar de novo e re-promove.
      toast.error(
        "Obra salva, mas falhou ao enfileirar os documentos pra IA. Clique em Cadastrar de novo pra tentar.",
      );
      return;
    }

    window.localStorage.removeItem(STORAGE_KEY);
    toast.success(
      `Obra "${parsed.data.nomeInterno}" cadastrada · IA já começou a mapear os documentos`,
    );
    // Vai direto pra Tela de Mapeamento · usuário acompanha em tempo real
    // a IA lendo cada documento e gerando o texto de contexto.
    navigate({
      to: "/contracts/$contractId/mapeamento",
      params: { contractId: obraId },
    });
  }

  // ── Render ───────────────────────────────────────────────────────
  return (
    <>
      <PageHeader
        title="Cadastrar nova obra"
        subtitle="Etapa 1 de 3 · Cadastro · Após salvar, a IA mapeia os documentos (Etapa 2) e depois extrai os dados (Etapa 3)."
      />

      {resumedFromStub ? (
        <div className="new-draft-banner" role="status">
          <span className="new-draft-banner-icon" aria-hidden>
            {I.repeat({ size: 14 })}
          </span>
          <div className="new-draft-banner-text">
            <strong>Retomando obra em cadastro</strong>
            <span>
              {resumeError
                ? resumeError
                : summary.filesCount > 0
                  ? `${summary.filesCount} arquivo${summary.filesCount === 1 ? "" : "s"} já enviado${
                      summary.filesCount === 1 ? "" : "s"
                    } · finalize o cadastro ou descarte.`
                  : "Os dados já salvos foram recuperados · finalize o cadastro ou descarte."}
            </span>
          </div>
          <div className="new-draft-banner-actions">
            {resumeError ? (
              <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                Recarregar
              </Button>
            ) : (
              // Descartar fica BLOQUEADO enquanto o fetch não confirmou o conteúdo real.
              <Button variant="ghost" size="sm" onClick={discardResumedObra} disabled={savingFiles}>
                Descartar obra
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {showDraftBanner && draftSavedAt ? (
        <div className="new-draft-banner" role="status">
          <span className="new-draft-banner-icon" aria-hidden>
            {I.repeat({ size: 14 })}
          </span>
          <div className="new-draft-banner-text">
            <strong>Rascunho encontrado</strong>
            <span>Você tem dados preenchidos {formatRelativeDraft(draftSavedAt)}.</span>
          </div>
          <div className="new-draft-banner-actions">
            <Button variant="ghost" size="sm" onClick={discardDraft}>
              Descartar
            </Button>
            <Button variant="outline" size="sm" onClick={continueDraft}>
              Continuar rascunho
            </Button>
          </div>
        </div>
      ) : null}

      {/* ── Card 1 · Identificação mínima ───────────────────────── */}
      <Card className="new-id-card">
        <CardHeader>
          <div>
            <CardTitle>Identificação da obra</CardTitle>
            <CardSub>
              Apelido curto que aparece na Sidebar e no Dashboard. Os demais dados são opcionais.
            </CardSub>
          </div>
        </CardHeader>
        <div className="new-id-body">
          <FieldRow
            label={
              <>
                Nome interno da obra <Asterisk />
              </>
            }
            hint="Ex.: 'Aeroporto Sorriso', 'Hosp. Juréia'."
            htmlFor="field-nomeInterno"
          >
            <Input
              id="field-nomeInterno"
              value={draft.nomeInterno}
              onChange={(e) => setField("nomeInterno", e.target.value)}
              placeholder="Aeroporto Sorriso"
              aria-invalid={Boolean(errors.nomeInterno)}
              disabled={submitting}
              autoFocus
            />
            <FieldError msg={errors.nomeInterno} />
            {conflictObra ? (
              <div className="new-conflict" role="alert">
                <span className="new-conflict-text">
                  Já existe a obra «{conflictObra.nome}». Quer abri-la em vez de criar outra?
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    navigate({
                      to: "/contracts/$contractId/mapeamento",
                      params: { contractId: conflictObra.id },
                    })
                  }
                >
                  Abrir obra existente
                </Button>
              </div>
            ) : null}
          </FieldRow>
        </div>
      </Card>

      {/* ── Documentos da Obra ──────────────────────────────────── */}
      <div className="new-tab-content">
        <DocsTab
          files={obraFiles}
          summary={summary}
          saving={savingFiles}
          submitting={submitting}
          onAddFiles={addObraFiles}
          onRemoveFile={removeObraFile}
          onSaveFiles={saveObraFiles}
          onRetryFile={retryObraFile}
          onPreviewFile={previewObraFile}
        />
      </div>

      {/* ── Footer sticky ───────────────────────────────────────── */}
      <footer className="new-footer">
        <div className="new-footer-status">
          {draftSavedAt ? (
            <>
              <I.check size={12} /> Rascunho salvo · {formatHHmm(draftSavedAt)}
            </>
          ) : (
            <span className="new-footer-status-empty">Comece preenchendo o nome da obra</span>
          )}
        </div>
        <div className="new-footer-actions">
          <Button variant="outline" onClick={handleCancel} disabled={submitting || savingFiles}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || savingFiles || Boolean(resumeError)}
          >
            {submitting ? "Cadastrando…" : "Cadastrar e iniciar mapeamento"}
          </Button>
        </div>
      </footer>

      <Modal
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Sair sem cadastrar?"
        actions={
          <>
            <Button variant="outline" onClick={() => setShowCancelModal(false)}>
              Continuar editando
            </Button>
            <Button variant="danger" onClick={confirmCancel}>
              Sair sem salvar
            </Button>
          </>
        }
      >
        <p className="new-modal-text">
          {obraStubCreated
            ? "A obra e os arquivos já enviados serão descartados — esta ação não pode ser desfeita."
            : "Os dados preenchidos ficam salvos como rascunho neste navegador por 7 dias."}
        </p>
      </Modal>
    </>
  );
}

type Summary = {
  filesCount: number;
  uploadedCount: number;
  pendingCount: number;
  errorCount: number;
};

type DocsTabProps = {
  files: ObraRawFile[];
  summary: Summary;
  saving: boolean;
  submitting: boolean;
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (fileId: string) => void;
  onSaveFiles: () => Promise<void> | void;
  onRetryFile: (fileId: string) => Promise<void> | void;
  onPreviewFile: (fileId: string) => Promise<void> | void;
};

type DocsFilter = "all" | "uploaded" | "pending" | "error";
type DocsSort = "added" | "name" | "size" | "uploaded_at";

function DocsTab({
  files,
  summary,
  saving,
  submitting,
  onAddFiles,
  onRemoveFile,
  onSaveFiles,
  onRetryFile,
  onPreviewFile,
}: DocsTabProps) {
  const disabled = submitting || saving;
  const total = summary.filesCount;
  const showFilters = total >= 4;
  const [filter, setFilter] = useState<DocsFilter>("all");
  const [sortBy, setSortBy] = useState<DocsSort>("added");

  const displayedFiles = useMemo(() => {
    let list = files;
    if (filter === "uploaded") list = list.filter((f) => f.status === "uploaded");
    else if (filter === "pending")
      list = list.filter((f) => f.status === "pending" || f.status === "uploading");
    else if (filter === "error") list = list.filter((f) => f.status === "error");

    const sorted = [...list];
    if (sortBy === "added") {
      sorted.sort((a, b) => b.addedAt - a.addedAt);
    } else if (sortBy === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    } else if (sortBy === "size") {
      sorted.sort((a, b) => b.size - a.size);
    } else if (sortBy === "uploaded_at") {
      sorted.sort((a, b) => {
        if (!a.uploadedAt && !b.uploadedAt) return 0;
        if (!a.uploadedAt) return 1;
        if (!b.uploadedAt) return -1;
        return b.uploadedAt.localeCompare(a.uploadedAt);
      });
    }
    return sorted;
  }, [files, filter, sortBy]);

  return (
    <Card className="obra-docs-card">
      <CardHeader>
        <div>
          <CardTitle>Documentos da Obra</CardTitle>
          <CardSub>
            Suba todos os documentos que tem dessa obra. Após cadastrar, a IA lê cada documento um
            por um e gera um texto-mapa explicando onde estão os valores · você revisa e aprova
            antes da extração.
          </CardSub>
        </div>
      </CardHeader>

      <div className="obra-docs-body">
        <FileDropzone
          accept={ALL_RMA_ACCEPT}
          multiple
          onFiles={onAddFiles}
          size="lg"
          label="Arraste arquivos da obra para cá"
          hint=".pdf · .xlsx · .xls · .mpp · .csv · .doc · .docx · .md · até 50 MB"
          disabled={disabled}
        />

        {total > 0 ? (
          <>
            <div className="obra-docs-bar">
              <div className="obra-docs-bar-text">
                <strong>{total}</strong> {total === 1 ? "documento" : "documentos"}
                <span className="obra-docs-bar-meta">
                  {summary.uploadedCount > 0
                    ? ` · ${summary.uploadedCount} salvo${summary.uploadedCount === 1 ? "" : "s"}`
                    : ""}
                  {summary.pendingCount > 0
                    ? ` · ${summary.pendingCount} pendente${summary.pendingCount === 1 ? "" : "s"}`
                    : ""}
                  {summary.errorCount > 0 ? ` · ${summary.errorCount} com erro` : ""}
                </span>
              </div>
              <Button
                size="sm"
                onClick={onSaveFiles}
                disabled={disabled || summary.pendingCount === 0}
                variant="primary"
              >
                {saving
                  ? "Salvando..."
                  : summary.pendingCount === 0
                    ? "Tudo salvo"
                    : `Salvar ${summary.pendingCount} arquivo${summary.pendingCount === 1 ? "" : "s"}`}
              </Button>
            </div>

            {showFilters ? (
              <div className="obra-docs-controls">
                <div className="obra-docs-filters" role="tablist" aria-label="Filtrar arquivos">
                  <FilterPill
                    label="Todos"
                    count={total}
                    active={filter === "all"}
                    onClick={() => setFilter("all")}
                  />
                  {summary.uploadedCount > 0 ? (
                    <FilterPill
                      label="Salvos"
                      count={summary.uploadedCount}
                      tone="success"
                      active={filter === "uploaded"}
                      onClick={() => setFilter("uploaded")}
                    />
                  ) : null}
                  {summary.pendingCount > 0 ? (
                    <FilterPill
                      label="Pendentes"
                      count={summary.pendingCount}
                      tone="warning"
                      active={filter === "pending"}
                      onClick={() => setFilter("pending")}
                    />
                  ) : null}
                  {summary.errorCount > 0 ? (
                    <FilterPill
                      label="Com erro"
                      count={summary.errorCount}
                      tone="danger"
                      active={filter === "error"}
                      onClick={() => setFilter("error")}
                    />
                  ) : null}
                </div>
                <div className="obra-docs-sort">
                  <label htmlFor="obra-docs-sort-select" className="obra-docs-sort-label">
                    Ordenar por
                  </label>
                  <Select<DocsSort>
                    value={sortBy}
                    onChange={(v) => setSortBy(v)}
                    size="sm"
                    aria-label="Ordenar arquivos"
                    items={[
                      { value: "added", label: "Adicionado" },
                      { value: "name", label: "Nome (A-Z)" },
                      { value: "size", label: "Tamanho" },
                      { value: "uploaded_at", label: "Salvo em" },
                    ]}
                  />
                </div>
              </div>
            ) : null}

            <ul className="obra-docs-list">
              {displayedFiles.map((of) => (
                <ObraFileItem
                  key={of.id}
                  file={of}
                  onRemove={() => onRemoveFile(of.id)}
                  onRetry={() => onRetryFile(of.id)}
                  onPreview={() => onPreviewFile(of.id)}
                  disabled={disabled}
                />
              ))}
              {showFilters && displayedFiles.length === 0 ? (
                <li className="obra-docs-empty">Nenhum arquivo neste filtro.</li>
              ) : null}
            </ul>
          </>
        ) : null}
      </div>
    </Card>
  );
}

type ObraFileItemProps = {
  file: ObraRawFile;
  disabled: boolean;
  onRemove: () => void;
  onRetry: () => Promise<void> | void;
  onPreview: () => Promise<void> | void;
};

type FilterPillProps = {
  label: string;
  count: number;
  active: boolean;
  tone?: "success" | "warning" | "danger";
  onClick: () => void;
};

function FilterPill({ label, count, active, tone, onClick }: FilterPillProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={cnLocal("obra-docs-filter", active && "active", tone && `tone-${tone}`)}
      onClick={onClick}
    >
      <span className="obra-docs-filter-label">{label}</span>
      <span className="obra-docs-filter-count">{count}</span>
    </button>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatUploadedAt(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (sameDay) return `salvo às ${hh}:${mm}`;
  const dd = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `salvo em ${dd}/${month} às ${hh}:${mm}`;
}

function ObraFileItem({ file, disabled, onRemove, onRetry, onPreview }: ObraFileItemProps) {
  const meta = getFileTypeMeta(file.name);
  return (
    <li className={cnLocal("tab-upload-item", `status-${file.status}`)}>
      <span
        className={cnLocal("tab-upload-item-ext", `tone-${meta.tone}`)}
        aria-label={meta.label}
        title={meta.label}
      >
        {meta.label}
      </span>
      <div className="tab-upload-item-meta">
        <div className="tab-upload-item-name" title={file.name}>
          {file.name}
        </div>
        <div className="tab-upload-item-sub">
          {formatBytes(file.size)}
          {file.status === "pending" ? " · aguardando salvar" : ""}
          {file.status === "uploading" ? " · enviando..." : ""}
          {file.status === "uploaded"
            ? ` · ${file.uploadedAt ? formatUploadedAt(file.uploadedAt) : "salvo"}`
            : ""}
          {file.status === "error" && file.errorMsg ? ` · ${file.errorMsg}` : ""}
        </div>
        {file.status === "uploading" && file.progress !== undefined ? (
          <ProgressBar value={file.progress} max={100} />
        ) : null}
      </div>
      <div className="tab-upload-item-actions">
        {file.status === "uploaded" && file.uploadedPath ? (
          <button
            type="button"
            className="tab-upload-item-action"
            onClick={onPreview}
            disabled={disabled}
            aria-label="Visualizar arquivo"
            title="Visualizar"
          >
            {I.eye({ size: 14 })}
          </button>
        ) : null}
        {file.status === "error" ? (
          <button
            type="button"
            className="tab-upload-item-action"
            onClick={onRetry}
            disabled={disabled}
            aria-label="Tentar novamente"
            title="Tentar novamente"
          >
            {I.repeat({ size: 14 })}
          </button>
        ) : null}
        <button
          type="button"
          className="tab-upload-item-action"
          onClick={onRemove}
          disabled={disabled || file.status === "uploading"}
          aria-label="Remover"
          title="Remover"
        >
          {I.close({ size: 14 })}
        </button>
      </div>
    </li>
  );
}
// ── Auxiliares de UI ────────────────────────────────────────────────

function Asterisk() {
  return (
    <span className="new-asterisk" aria-hidden>
      *
    </span>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <div className="new-field-error" role="alert">
      {msg}
    </div>
  );
}

function cnLocal(...args: Array<string | false | null | undefined>) {
  return args.filter(Boolean).join(" ");
}
