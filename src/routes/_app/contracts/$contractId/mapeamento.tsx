import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Button,
  EmptyState,
  I,
  IconButton,
  Input,
  PageHeader,
  ProgressRing,
  Skeleton,
  Stepper,
  Tabs,
} from "@/components/ds";
import {
  obraArquivosKey,
  useDismissNameSuggestion,
  useObraArquivos,
  useRenameObraArquivo,
} from "@/lib/hooks/useObraArquivos";
import { useObraRealtime } from "@/lib/hooks/useObraRealtime";
import {
  contextosKey,
  useAdvanceMappedToExtraction,
  useCancelMapping,
  useObraContextos,
  useRequestReMapping,
  useResumeMapping,
} from "@/lib/hooks/useContextos";
import { getFileTypeMeta, type FileTone } from "@/lib/files/fileTypes";
import { DOC_TYPE_REGISTRY_LABELS } from "@/lib/rma/documentTypes";
import {
  getArquivoMetadata,
  getDisplayName,
  hasCustomName,
  isNameSuggestionDismissed,
  type ObraArquivo,
} from "@/lib/supabase/obraArquivos";
import { getSuggestedName, type ObraArquivoContexto } from "@/lib/supabase/contextos";
import "./mapeamento.css";

export const Route = createFileRoute("/_app/contracts/$contractId/mapeamento")({
  component: MapeamentoPage,
  head: () => ({ meta: [{ title: "Mapeamento de documentos — RDM IA" }] }),
});

// ────────────────────────────────────────────────────────────────────
// Meta visual por status do pipeline
// ────────────────────────────────────────────────────────────────────

type StatusMeta = {
  label: string;
  dotTone: "neutral" | "info" | "success" | "warning" | "danger";
  pulse: boolean;
};

const STATUS_META: Record<string, StatusMeta> = {
  staged: { label: "Aguardando envio à IA", dotTone: "neutral", pulse: false },
  raw: { label: "Aguardando", dotTone: "neutral", pulse: false },
  queued: { label: "Na fila", dotTone: "neutral", pulse: false },
  mapping: { label: "Mapeando…", dotTone: "info", pulse: true },
  mapped: { label: "Mapeado", dotTone: "success", pulse: false },
  mapping_error: { label: "Falhou", dotTone: "danger", pulse: false },
  needs_review: { label: "Revisar", dotTone: "warning", pulse: false },
  ready_to_extract: { label: "Pronto pra extrair", dotTone: "success", pulse: false },
  extracting: { label: "Extraindo…", dotTone: "info", pulse: true },
  extracted: { label: "Extraído", dotTone: "success", pulse: false },
  verified: { label: "Validado", dotTone: "success", pulse: false },
  extraction_error: { label: "Falhou", dotTone: "danger", pulse: false },
  cancelled: { label: "Cancelado", dotTone: "neutral", pulse: false },
  processing: { label: "Processando…", dotTone: "info", pulse: true },
  error: { label: "Erro", dotTone: "danger", pulse: false },
};

function statusMeta(status: string): StatusMeta {
  return STATUS_META[status] ?? { label: status, dotTone: "neutral", pulse: false };
}

// ────────────────────────────────────────────────────────────────────
// Utilitários de exibição
// ────────────────────────────────────────────────────────────────────

function formatSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diff = Math.max(0, now - then);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} d`;
}

const TODOS = "todos";

// Tabs por FORMATO de arquivo · ordem + rótulo por tom (derivado da extensão).
const FORMAT_ORDER: FileTone[] = ["pdf", "excel", "word", "mpp", "csv", "markdown", "other"];
const FORMAT_LABEL: Record<FileTone, string> = {
  pdf: "PDF",
  excel: "Excel",
  word: "Word",
  mpp: "MS Project",
  csv: "CSV",
  markdown: "Markdown",
  other: "Outros",
};

// ────────────────────────────────────────────────────────────────────
// Página
// ────────────────────────────────────────────────────────────────────

function MapeamentoPage() {
  const navigate = useNavigate();
  const { contractId } = Route.useParams();

  const { data: arquivos, isLoading, error } = useObraArquivos(contractId, { autoPoll: true });

  const hasActive = useMemo(
    () =>
      (arquivos ?? []).some((a) => ["raw", "queued", "mapping", "extracting"].includes(a.status)),
    [arquivos],
  );
  const { data: contextos } = useObraContextos(contractId, hasActive);
  useObraRealtime(contractId); // atualização instantânea via Supabase Realtime

  // Quando o último doc ativo termina, `hasActive` cai e o polling para. Busca o
  // estado final uma vez na borda (backstop se o Realtime estiver indisponível).
  const qc = useQueryClient();
  const wasActive = useRef(hasActive);
  useEffect(() => {
    if (wasActive.current && !hasActive) {
      qc.invalidateQueries({ queryKey: contextosKey(contractId) });
      qc.invalidateQueries({ queryKey: obraArquivosKey(contractId) });
    }
    wasActive.current = hasActive;
  }, [hasActive, contractId, qc]);

  const advance = useAdvanceMappedToExtraction(contractId);
  const cancel = useCancelMapping(contractId);
  const resume = useResumeMapping(contractId);

  const [activeTab, setActiveTab] = useState<string>(TODOS);

  const summary = useMemo(() => {
    const list = arquivos ?? [];
    const total = list.length;
    const count = (...sts: string[]) => list.filter((a) => sts.includes(a.status)).length;

    const mapped = count("mapped"); // tem mapa, aguardando o gate humano
    const inProgress = count("raw", "queued", "mapping", "processing");
    const mappingFailed = count("mapping_error", "error"); // falha REAL no mapeamento
    const needsReview = count("needs_review"); // pedido de revisão (não é falha)
    const extractionFailed = count("extraction_error"); // falha na extração (downstream)
    const readyToExtract = count("ready_to_extract"); // na fila da extração
    const extracting = count("extracting"); // de fato extraindo agora
    const extracted = count("extracted", "verified"); // extração concluída
    const cancelled = count("cancelled");

    // "Tem mapa" = mapeado OU qualquer estágio adiante (inclui needs_review e
    // extraction_error — eles JÁ foram mapeados) → o anel não regride quando avançam.
    const withMap =
      mapped + readyToExtract + extracting + extracted + needsReview + extractionFailed;
    const advanced = readyToExtract + extracting + extracted; // passou do gate humano
    const stoppable = count("raw", "queued", "mapping_error");

    // Não avança o lote enquanto há doc em processamento, falha de mapeamento ou
    // item pendente de revisão. (extraction_error é downstream → não trava o gate.)
    const needsAttention = inProgress + mappingFailed + needsReview;
    const canAdvance = mapped > 0 && needsAttention === 0;
    const considered = total - cancelled;
    const pct = considered <= 0 ? 0 : Math.min(100, Math.round((withMap / considered) * 100));
    const allMapped = canAdvance;
    return {
      total,
      mapped,
      withMap,
      inProgress,
      mappingFailed,
      needsReview,
      extractionFailed,
      readyToExtract,
      extracting,
      extracted,
      cancelled,
      advanced,
      stoppable,
      canAdvance,
      allMapped,
      pct,
    };
  }, [arquivos]);

  // Agrupa por FORMATO de arquivo (PDF, Excel, Markdown, …) · vem da extensão,
  // não depende dos contextos.
  const grouped = useMemo(() => {
    const map = new Map<FileTone, ObraArquivo[]>();
    for (const a of arquivos ?? []) {
      const tone = getFileTypeMeta(a.nome_original).tone;
      const arr = map.get(tone);
      if (arr) arr.push(a);
      else map.set(tone, [a]);
    }
    return map;
  }, [arquivos]);

  // Itens das tabs · "Todos" + formatos presentes na ordem canônica.
  const tabItems = useMemo(() => {
    const present = FORMAT_ORDER.filter((k) => grouped.has(k));
    return [
      {
        value: TODOS,
        label: (
          <>
            Todos <span className="map-tab-count">{summary.total}</span>
          </>
        ),
      },
      ...present.map((k) => ({
        value: k as string,
        label: (
          <>
            {FORMAT_LABEL[k]} <span className="map-tab-count">{grouped.get(k)!.length}</span>
          </>
        ),
      })),
    ];
  }, [grouped, summary.total]);

  // Lista visível conforme a tab ativa (fallback pra "todos" se o formato sumiu).
  const visible = useMemo(() => {
    const list = arquivos ?? [];
    if (activeTab === TODOS) return list;
    return grouped.get(activeTab as FileTone) ?? list;
  }, [activeTab, arquivos, grouped]);

  const steps = useMemo(() => {
    const noneAdvanced = summary.advanced === 0;
    return [
      { id: "cadastro", label: "Cadastro", hint: "concluído", status: "done" as const },
      {
        id: "mapeamento",
        label: "Mapeamento",
        hint: noneAdvanced ? "em andamento" : "concluído",
        status: noneAdvanced ? ("current" as const) : ("done" as const),
      },
      {
        id: "extracao",
        label: "Extração",
        hint: summary.advanced > 0 ? "em andamento" : "próxima etapa",
        status: summary.advanced > 0 ? ("current" as const) : ("upcoming" as const),
      },
      {
        id: "normalizacao",
        label: "Normalização",
        hint: "aguardando",
        status: "upcoming" as const,
      },
    ];
  }, [summary.advanced]);

  // ── erros / loading / vazio ───────────────────────────────────────
  if (error) {
    return (
      <>
        <PageHeader
          title="Mapeamento"
          subtitle="Falha ao carregar arquivos."
          back={{ label: "Obras", onClick: () => navigate({ to: "/contracts" }) }}
        />
        <EmptyState
          framed
          icon={I.close({ size: 44 })}
          title="Não foi possível carregar"
          text={error.message}
          action={
            <Button variant="outline" onClick={() => window.location.reload()}>
              Tentar novamente
            </Button>
          }
        />
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <PageHeader
          title="Mapeamento de documentos"
          subtitle="Carregando..."
          back={{ label: "Obras", onClick: () => navigate({ to: "/contracts" }) }}
        />
        <Skeleton className="map-stepper-skeleton" />
        <Skeleton className="map-summary-skeleton" />
        <div className="map-cards">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="map-card-skeleton" />
          ))}
        </div>
      </>
    );
  }

  if ((arquivos ?? []).length === 0) {
    return (
      <>
        <PageHeader
          title="Mapeamento"
          subtitle="Esta obra ainda não tem documentos."
          back={{ label: "Obras", onClick: () => navigate({ to: "/contracts" }) }}
        />
        <EmptyState
          framed
          icon={I.doc({ size: 44 })}
          title="Sem documentos"
          text="Cadastre os documentos pra que a IA possa começar o mapeamento."
          action={
            <Button onClick={() => navigate({ to: "/contracts/new" })}>
              {I.arrowLeft({ size: 14 })} Voltar ao cadastro
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Mapeamento de documentos"
        subtitle="A IA lê cada documento e gera um texto-mapa descrevendo onde estão os dados. Você revisa e aprova antes da extração."
        back={{ label: "Obras", onClick: () => navigate({ to: "/contracts" }) }}
        actions={
          summary.cancelled > 0 ? (
            <Button
              variant="outline"
              size="sm"
              disabled={resume.isPending}
              onClick={() => resume.mutate()}
            >
              {resume.isPending ? "Retomando…" : `Retomar (${summary.cancelled})`}
            </Button>
          ) : summary.stoppable > 0 ? (
            <Button
              variant="danger"
              size="sm"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate()}
            >
              {cancel.isPending ? "Parando…" : "Parar mapeamento"}
            </Button>
          ) : undefined
        }
      />

      {/* Stepper · 3 fases do fluxo (clicáveis pra navegar) */}
      <div className="map-stepper">
        <Stepper
          steps={steps}
          onStepClick={(id) => {
            if (id === "cadastro") navigate({ to: "/contracts/new" });
            else if (id === "extracao")
              navigate({ to: "/contracts/$contractId/extracao", params: { contractId } });
            else if (id === "normalizacao")
              navigate({ to: "/contracts/$contractId/normalizacao", params: { contractId } });
            // "mapeamento" é a própria tela · não navega
          }}
        />
      </div>

      {/* Sumário · anel de progresso (%) + contadores + ação principal */}
      <section className="map-summary">
        <div className="map-summary-ring">
          <ProgressRing
            value={summary.pct}
            max={100}
            size={88}
            stroke={8}
            color={summary.allMapped ? "var(--success)" : "var(--brand)"}
            label="mapeado"
          />
        </div>

        <div className="map-summary-text">
          <div className="map-summary-headline">
            <strong>{summary.withMap}</strong> de <strong>{summary.total}</strong>{" "}
            {summary.total === 1 ? "documento mapeado" : "documentos mapeados"}
          </div>
          <div className="map-summary-sub">
            {summary.inProgress > 0 && (
              <span className="map-summary-chip chip-info">
                <span className="map-dot dot-info dot-pulse" />
                {summary.inProgress} em processamento
              </span>
            )}
            {summary.needsReview > 0 && (
              <span className="map-summary-chip chip-warning">
                <span className="map-dot dot-warning" />
                {summary.needsReview} p/ revisar
              </span>
            )}
            {summary.mappingFailed > 0 && (
              <span className="map-summary-chip chip-danger">
                <span className="map-dot dot-danger" />
                {summary.mappingFailed} com falha
              </span>
            )}
            {summary.readyToExtract > 0 && (
              <span className="map-summary-chip chip-info">
                <span className="map-dot dot-info" />
                {summary.readyToExtract} na fila de extração
              </span>
            )}
            {summary.extracting > 0 && (
              <span className="map-summary-chip chip-info">
                <span className="map-dot dot-info dot-pulse" />
                {summary.extracting} em extração
              </span>
            )}
            {summary.extracted > 0 && (
              <span className="map-summary-chip chip-success">
                <span className="map-dot dot-success" />
                {summary.extracted} {summary.extracted === 1 ? "extraído" : "extraídos"}
              </span>
            )}
            {summary.extractionFailed > 0 && (
              <span className="map-summary-chip chip-danger">
                <span className="map-dot dot-danger" />
                {summary.extractionFailed}{" "}
                {summary.extractionFailed === 1 ? "erro na extração" : "erros na extração"}
              </span>
            )}
            {summary.inProgress === 0 &&
              summary.mappingFailed === 0 &&
              summary.needsReview === 0 &&
              summary.advanced === 0 &&
              summary.allMapped && (
                <span className="map-summary-chip chip-success-strong">
                  Tudo mapeado · pronto pra avançar
                </span>
              )}
          </div>
        </div>

        <div className="map-summary-action">
          {summary.advanced > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                navigate({ to: "/contracts/$contractId/extracao", params: { contractId } })
              }
            >
              Acompanhar extração →
            </Button>
          )}
          <Button
            size="md"
            variant={summary.allMapped ? "primary" : "outline"}
            disabled={!summary.allMapped || advance.isPending}
            onClick={() => {
              advance.mutate(undefined, {
                onSuccess: (r) => {
                  if (r.affected > 0) {
                    navigate({ to: "/contracts/$contractId/extracao", params: { contractId } });
                  }
                },
              });
            }}
          >
            {advance.isPending
              ? "Avançando…"
              : summary.allMapped
                ? "Validar e avançar pra Extração"
                : `Aguardando ${summary.total - summary.mapped} doc${summary.total - summary.mapped === 1 ? "" : "s"}`}
          </Button>
        </div>
      </section>

      {/* Tabs por tipo de documento */}
      <div className="map-tabs">
        <Tabs
          value={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          aria-label="Filtrar por tipo de documento"
        />
      </div>

      {/* Grid de cards */}
      <div className="map-cards">
        {visible.map((arquivo) => (
          <ArquivoCard
            key={arquivo.id}
            arquivo={arquivo}
            contexto={contextos?.get(arquivo.id) ?? null}
            obraId={contractId}
          />
        ))}
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────
// Card de documento · badge + nome (renomeável) + tipo + meta + ações
// ────────────────────────────────────────────────────────────────────

function ArquivoCard({
  arquivo,
  contexto,
  obraId,
}: {
  arquivo: ObraArquivo;
  contexto: ObraArquivoContexto | null;
  obraId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");

  const fileMeta = getFileTypeMeta(arquivo.nome_original);
  const meta = statusMeta(arquivo.status);
  const displayName = getDisplayName(arquivo);
  const custom = hasCustomName(arquivo);
  const docTypeLabel =
    contexto && contexto.doc_type in DOC_TYPE_REGISTRY_LABELS
      ? DOC_TYPE_REGISTRY_LABELS[contexto.doc_type]
      : (contexto?.doc_type ?? null);

  const reMap = useRequestReMapping(obraId);
  const rename = useRenameObraArquivo(obraId);
  const dismissSuggestion = useDismissNameSuggestion(obraId);
  const hasContexto = Boolean(contexto);
  const canReMap = ["mapped", "mapping_error", "needs_review", "error"].includes(arquivo.status);

  // Sugestão de nome do mapeador · só aparece se difere do nome atual/original e
  // não foi dispensada (reaparece se um re-mapeamento gerar outra sugestão).
  const suggestion = getSuggestedName(contexto);
  const showSuggestion =
    !!suggestion &&
    suggestion !== displayName &&
    suggestion !== arquivo.nome_original &&
    !isNameSuggestionDismissed(arquivo, suggestion) &&
    !renaming;

  function startRename() {
    setDraft(custom ? displayName : "");
    setRenaming(true);
  }
  function saveRename() {
    rename.mutate(
      { arquivoId: arquivo.id, displayName: draft, metadata: getArquivoMetadata(arquivo) },
      { onSuccess: () => setRenaming(false) },
    );
  }
  function applySuggestion() {
    if (!suggestion) return;
    rename.mutate({
      arquivoId: arquivo.id,
      displayName: suggestion,
      metadata: getArquivoMetadata(arquivo),
    });
  }
  function dismissSuggestionClick() {
    if (!suggestion) return;
    dismissSuggestion.mutate({
      arquivoId: arquivo.id,
      suggestion,
      metadata: getArquivoMetadata(arquivo),
    });
  }

  return (
    <article className={`map-card map-card-status-${arquivo.status}`}>
      {/* Topo · badge de formato + status */}
      <header className="map-card-top">
        <span className={`map-item-ext tone-${fileMeta.tone}`}>{fileMeta.label}</span>
        <span className={`map-item-status-pill tone-${meta.dotTone}`}>
          <span className={`map-dot dot-${meta.dotTone}${meta.pulse ? " dot-pulse" : ""}`} />
          {meta.label}
        </span>
      </header>

      {/* Nome · renomeável */}
      {renaming ? (
        <div className="map-card-rename">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={arquivo.nome_original}
            aria-label="Apelido do documento"
            autoFocus
            disabled={rename.isPending}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveRename();
              if (e.key === "Escape") setRenaming(false);
            }}
          />
          <div className="map-card-rename-actions">
            <IconButton
              aria-label="Salvar nome"
              size="sm"
              variant="solid"
              disabled={rename.isPending}
              onClick={saveRename}
            >
              {I.check({ size: 14 })}
            </IconButton>
            <IconButton
              aria-label="Cancelar"
              size="sm"
              variant="ghost"
              disabled={rename.isPending}
              onClick={() => setRenaming(false)}
            >
              {I.close({ size: 14 })}
            </IconButton>
          </div>
        </div>
      ) : (
        <div className="map-card-name-row">
          <h3 className="map-card-name" title={displayName}>
            {displayName}
          </h3>
          <IconButton
            aria-label="Renomear documento"
            size="sm"
            variant="ghost"
            className="map-card-rename-btn"
            onClick={startRename}
          >
            {I.edit({ size: 14 })}
          </IconButton>
        </div>
      )}

      {/* Nome original (só quando há apelido custom) */}
      {custom && !renaming && (
        <div className="map-card-original" title={arquivo.nome_original}>
          {arquivo.nome_original}
        </div>
      )}

      {/* Chips · tipo detectado + confiança */}
      {(docTypeLabel || contexto?.doc_type_confidence != null) && (
        <div className="map-card-chips">
          {docTypeLabel && (
            <span className="map-card-doctype">
              {I.tag({ size: 11 })} {docTypeLabel}
            </span>
          )}
          {contexto?.doc_type_confidence != null && (
            <span className="map-card-conf">conf {contexto.doc_type_confidence.toFixed(2)}</span>
          )}
        </div>
      )}

      {/* Sugestão de nome do mapeador · aplicar (reusa rename) ou dispensar */}
      {showSuggestion && suggestion && (
        <div className="map-card-suggest">
          <span className="map-card-suggest-icon" aria-hidden>
            {I.star({ size: 13 })}
          </span>
          <div className="map-card-suggest-body">
            <span className="map-card-suggest-label">Sugestão de nome</span>
            <span className="map-card-suggest-name" title={suggestion}>
              {suggestion}
            </span>
          </div>
          <div className="map-card-suggest-actions">
            <Button
              size="sm"
              variant="primary"
              disabled={rename.isPending || dismissSuggestion.isPending}
              onClick={applySuggestion}
            >
              Aplicar
            </Button>
            <IconButton
              aria-label="Dispensar sugestão de nome"
              size="sm"
              variant="ghost"
              disabled={rename.isPending || dismissSuggestion.isPending}
              onClick={dismissSuggestionClick}
            >
              {I.close({ size: 13 })}
            </IconButton>
          </div>
        </div>
      )}

      {/* Meta · tamanho · tempo · versão */}
      <div className="map-card-meta">
        <span className="map-item-size">{formatSize(arquivo.size)}</span>
        <span className="map-item-dot" aria-hidden>
          ·
        </span>
        <span className="map-item-time">{timeAgo(arquivo.uploaded_at)}</span>
        {contexto && (
          <>
            <span className="map-item-dot" aria-hidden>
              ·
            </span>
            <span className="map-item-time">v{contexto.version}</span>
          </>
        )}
      </div>

      {arquivo.last_error && (
        <div className="map-card-err" title={arquivo.last_error}>
          {arquivo.last_error.slice(0, 90)}
          {arquivo.last_error.length > 90 ? "…" : ""}
        </div>
      )}

      {/* Rodapé · ações */}
      <footer className="map-card-foot">
        {hasContexto ? (
          <Button size="sm" variant="ghost" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Ocultar texto-mapa" : "Ver texto-mapa"}
          </Button>
        ) : (
          <span className="map-card-foot-hint">Aguardando mapa…</span>
        )}
        {canReMap && (
          <IconButton
            aria-label="Re-mapear documento"
            size="sm"
            variant="ghost"
            disabled={reMap.isPending}
            onClick={() => reMap.mutate(arquivo.id)}
          >
            {I.repeat({ size: 14 })}
          </IconButton>
        )}
      </footer>

      {expanded && contexto && (
        <div className="map-card-context">
          <div className="map-context-head">
            <span className="map-context-label">Texto-mapa gerado</span>
            <span className="map-context-sub">
              {contexto.agent_model ?? "—"} · confidence{" "}
              {contexto.doc_type_confidence?.toFixed(2) ?? "—"} · v{contexto.version}
            </span>
          </div>
          <pre className="map-context-md">{contexto.context_md}</pre>
        </div>
      )}
    </article>
  );
}
