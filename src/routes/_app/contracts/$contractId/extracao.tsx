import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  I,
  IconButton,
  PageHeader,
  ProgressRing,
  Segmented,
  Skeleton,
  Stepper,
  Tabs,
  type BadgeTone,
  type DataTableColumn,
} from "@/components/ds";
import { useObraArquivos } from "@/lib/hooks/useObraArquivos";
import { useObraContextos } from "@/lib/hooks/useContextos";
import { useObraRealtime } from "@/lib/hooks/useObraRealtime";
import {
  agentRunsKey,
  extracoesKey,
  useApproveExtraction,
  useObraAgentRuns,
  useObraExtracoes,
  useRequestReExtraction,
  useRequestReExtractionBatch,
  useRequestReNormalization,
} from "@/lib/hooks/useObraExtracoes";
import { getFileTypeMeta } from "@/lib/files/fileTypes";
import { DOC_TYPE_REGISTRY_LABELS } from "@/lib/rma/documentTypes";
import { getDisplayName, type ObraArquivo } from "@/lib/supabase/obraArquivos";
import type { ObraArquivoContexto } from "@/lib/supabase/contextos";
import {
  countLinhas,
  fmtCell,
  type AgentRun,
  type Envelope,
  type EnvelopeSecao,
  type ObraArquivoExtracao,
} from "@/lib/supabase/extracoes";
import "./extracao.css";

export const Route = createFileRoute("/_app/contracts/$contractId/extracao")({
  component: ExtracaoPage,
  head: () => ({ meta: [{ title: "Extração de dados — RDM IA" }] }),
});

// ── Meta visual por status ───────────────────────────────────────────
type StatusMeta = { label: string; tone: BadgeTone; pulse: boolean };
const STATUS_META: Record<string, StatusMeta> = {
  mapped: { label: "Aguardando validação", tone: "neutral", pulse: false },
  ready_to_extract: { label: "Na fila", tone: "info", pulse: false },
  extracting: { label: "Extraindo…", tone: "info", pulse: true },
  extracted: { label: "Extraído", tone: "success", pulse: false },
  verified: { label: "Validado", tone: "success", pulse: false },
  needs_review: { label: "Revisar", tone: "warning", pulse: false },
  extraction_error: { label: "Falhou", tone: "danger", pulse: false },
};
function statusMeta(s: string): StatusMeta {
  return STATUS_META[s] ?? { label: s, tone: "neutral", pulse: false };
}

const EXTRACTION_PHASE = new Set([
  "ready_to_extract",
  "extracting",
  "extracted",
  "verified",
  "needs_review",
  "extraction_error",
  // doc que já avançou pra normalização também FOI extraído — conta como concluído na
  // fase de extração (senão o hero mostra "0 de N" depois que a normalização roda).
  "normalized",
]);

// Status que já passaram pela extração (têm payload ou falharam) e PODEM ser re-extraídos
// em lote — usado pelo botão "Re-extrair toda a obra". NÃO inclui ready_to_extract/extracting
// (já em voo) nem os estados pré-extração (staged/raw/mapping…). Reprocessar um 'extracted' é
// tão válido quanto um 'needs_review': o veredito veio de regras de sanity que podem ter mudado.
const RE_EXTRACTABLE_STATUSES = new Set([
  "extracted",
  "verified",
  "needs_review",
  "extraction_error",
  "normalized",
]);

// Só os agentes da FASE de extração contam pra observabilidade desta tela — os
// runs de mapeamento (router/mapper) ficam de fora pra não inflar custo/tempo.
const EXTRACTION_AGENTS = new Set(["extractor", "verifier", "reconciler"]);
function isExtractionRun(r: AgentRun): boolean {
  return EXTRACTION_AGENTS.has(r.agent_name);
}

// Ordem de exibição na fila — ativos primeiro, depois pendências, depois prontos.
const STATUS_ORDER: Record<string, number> = {
  extracting: 0,
  ready_to_extract: 1,
  needs_review: 2,
  extraction_error: 3,
  extracted: 4,
  verified: 5,
  mapped: 6,
};

// ── Filtros (a "fila" como recortes navegáveis) ───────────────────────
type FilterKey = "todos" | "fila" | "extraido" | "revisar" | "erro" | "aguardando";
const FILTERS: { key: FilterKey; label: string; match: (s: string) => boolean }[] = [
  { key: "todos", label: "Todos", match: () => true },
  { key: "fila", label: "Na fila", match: (s) => s === "ready_to_extract" || s === "extracting" },
  { key: "extraido", label: "Extraídos", match: (s) => s === "extracted" || s === "verified" },
  { key: "revisar", label: "Revisar", match: (s) => s === "needs_review" },
  { key: "erro", label: "Erros", match: (s) => s === "extraction_error" },
  { key: "aguardando", label: "Aguardando", match: (s) => s === "mapped" },
];

// ── utils ────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const min = Math.floor(Math.max(0, Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}
function fmtUSD(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "USD" }).replace("US$", "$");
}
function fmtInt(n: number): string {
  return n.toLocaleString("pt-BR");
}
function fmtDur(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  return `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;
}
function docTypeLabel(extracao: ObraArquivoExtracao | null, env?: Envelope): string | null {
  if (extracao && extracao.doc_type in DOC_TYPE_REGISTRY_LABELS)
    return DOC_TYPE_REGISTRY_LABELS[extracao.doc_type];
  return env?.tipo_documento ?? extracao?.doc_type ?? null;
}

type SortKey = "recente" | "nome" | "linhas" | "status";
const SORT_ITEMS = [
  { value: "recente" as const, label: "Recente" },
  { value: "nome" as const, label: "Nome" },
  { value: "linhas" as const, label: "Dados" },
  { value: "status" as const, label: "Status" },
];

// ── Página ───────────────────────────────────────────────────────────
function ExtracaoPage() {
  const navigate = useNavigate();
  const { contractId } = Route.useParams();

  const { data: arquivos, isLoading, error } = useObraArquivos(contractId, { autoPoll: true });
  const active = useMemo(
    () => (arquivos ?? []).some((a) => ["ready_to_extract", "extracting"].includes(a.status)),
    [arquivos],
  );
  const { data: extracoes } = useObraExtracoes(contractId, active);
  const { data: runsByArquivo } = useObraAgentRuns(contractId, active);
  const { data: contextos } = useObraContextos(contractId, active);
  useObraRealtime(contractId); // atualização instantânea via Supabase Realtime

  // Quando a última extração TERMINA, `active` cai → o polling para. Sem isto, o
  // envelope/runs finais só apareciam no próximo foco da aba. Busca uma vez na borda.
  const qc = useQueryClient();
  const wasActive = useRef(active);
  useEffect(() => {
    if (wasActive.current && !active) {
      qc.invalidateQueries({ queryKey: extracoesKey(contractId) });
      qc.invalidateQueries({ queryKey: agentRunsKey(contractId) });
    }
    wasActive.current = active;
  }, [active, contractId, qc]);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("status");
  const [filter, setFilter] = useState<FilterKey>("todos");
  const [selected, setSelected] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const reExtractBatch = useRequestReExtractionBatch(contractId);

  const summary = useMemo(() => {
    const list = arquivos ?? [];
    const count = (...s: string[]) => list.filter((a) => s.includes(a.status)).length;
    const inPhase = list.filter((a) => EXTRACTION_PHASE.has(a.status)).length;
    const extracted = count("extracted", "verified", "normalized");
    const extracting = count("extracting");
    const queued = count("ready_to_extract");
    const review = count("needs_review");
    const failed = count("extraction_error");
    const pct = inPhase <= 0 ? 0 : Math.round((extracted / inPhase) * 100);

    let tokens = 0;
    let cost = 0;
    let latency = 0;
    let runCount = 0;
    for (const runs of (runsByArquivo ?? new Map()).values()) {
      for (const r of runs as AgentRun[]) {
        if (!isExtractionRun(r)) continue;
        tokens += (r.output_tokens ?? 0) + (r.input_tokens ?? 0);
        cost += r.cost_usd ?? 0;
        latency += r.latency_ms ?? 0;
        runCount += 1;
      }
    }
    return {
      inPhase,
      extracted,
      extracting,
      queued,
      review,
      failed,
      pct,
      tokens,
      cost,
      latency,
      runCount,
    };
  }, [arquivos, runsByArquivo]);

  // Contadores por filtro (mostra só recortes não-vazios + "Todos").
  const filterCounts = useMemo(() => {
    const list = arquivos ?? [];
    const out = {} as Record<FilterKey, number>;
    for (const f of FILTERS) out[f.key] = list.filter((a) => f.match(a.status)).length;
    return out;
  }, [arquivos]);

  // Posição na fila (entre os ready_to_extract, por ordem de upload).
  const queuePos = useMemo(() => {
    const map = new Map<string, number>();
    (arquivos ?? [])
      .filter((a) => a.status === "ready_to_extract")
      .sort((a, b) => new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime())
      .forEach((a, i) => map.set(a.id, i + 1));
    return map;
  }, [arquivos]);

  // Ids de TODOS os docs já-extraídos/falhos — alvo do "Re-extrair toda a obra".
  const reExtractableIds = useMemo(
    () => (arquivos ?? []).filter((a) => RE_EXTRACTABLE_STATUSES.has(a.status)).map((a) => a.id),
    [arquivos],
  );

  const visible = useMemo(() => {
    let list = (arquivos ?? []).slice();
    const f = FILTERS.find((x) => x.key === filter);
    if (f) list = list.filter((a) => f.match(a.status));
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((a) => {
        const ex = extracoes?.get(a.id) ?? null;
        return (
          getDisplayName(a).toLowerCase().includes(q) ||
          a.nome_original.toLowerCase().includes(q) ||
          (ex?.doc_type ?? "").toLowerCase().includes(q) ||
          (ex?.payload?.tipo_documento ?? "").toLowerCase().includes(q)
        );
      });
    }
    list.sort((a, b) => {
      if (sort === "nome") return getDisplayName(a).localeCompare(getDisplayName(b), "pt-BR");
      if (sort === "linhas")
        return (
          countLinhas(extracoes?.get(b.id)?.payload) - countLinhas(extracoes?.get(a.id)?.payload)
        );
      if (sort === "status") return (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
      return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
    });
    return list;
  }, [arquivos, extracoes, query, sort, filter]);

  // Auto-seleciona o doc mais relevante no desktop (não no mobile, p/ não pular pro detalhe).
  // Também reconcilia seleção órfã: se o doc selecionado sumiu da lista, limpa pra re-selecionar.
  useEffect(() => {
    const list = arquivos ?? [];
    if (!list.length) return;
    if (selected) {
      if (list.some((a) => a.id === selected)) return; // seleção ainda válida
      setSelected(null); // órfã → limpa; o efeito roda de novo e re-seleciona
      return;
    }
    if (typeof window !== "undefined" && !window.matchMedia("(min-width: 1100px)").matches) return;
    const pick =
      list.find((a) => a.status === "extracting") ??
      list.find((a) => a.status === "ready_to_extract") ??
      list
        .filter((a) => extracoes?.has(a.id))
        .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())[0] ??
      list[0];
    if (pick) setSelected(pick.id);
  }, [arquivos, extracoes, selected]);

  const steps = useMemo(
    () => [
      { id: "cadastro", label: "Cadastro", hint: "concluído", status: "done" as const },
      { id: "mapeamento", label: "Mapeamento", hint: "concluído", status: "done" as const },
      {
        id: "extracao",
        label: "Extração",
        hint:
          summary.extracting > 0 || summary.queued > 0
            ? "em andamento"
            : summary.inPhase > 0
              ? "concluída"
              : "aguardando",
        status: "current" as const,
      },
      {
        id: "normalizacao",
        label: "Normalização",
        hint: summary.extracted > 0 ? "pronta" : "aguardando",
        status: "upcoming" as const,
      },
    ],
    [summary.extracting, summary.queued, summary.inPhase, summary.extracted],
  );

  if (error) {
    return (
      <>
        <PageHeader
          title="Extração"
          subtitle="Falha ao carregar."
          back={{
            label: "Mapeamento",
            onClick: () =>
              navigate({ to: "/contracts/$contractId/mapeamento", params: { contractId } }),
          }}
        />
        <EmptyState
          framed
          icon={I.close({ size: 44 })}
          title="Não foi possível carregar"
          text={error.message}
        />
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <PageHeader title="Extração de dados" subtitle="Carregando…" />
        <div className="ext-stepper">
          <Skeleton className="ext-stepper-skeleton" />
        </div>
        <Skeleton className="ext-hero-skeleton" />
        <div className="ext-workspace">
          <aside className="ext-rail">
            <div className="ext-rail-head">
              <Skeleton className="ext-skel-search" />
              <div className="ext-skel-filters">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="ext-skel-filter" />
                ))}
              </div>
            </div>
            <div className="ext-rail-list">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="ext-skel-row">
                  <Skeleton className="ext-skel-row-ext" />
                  <div className="ext-skel-row-main">
                    <Skeleton className="ext-skel-row-l1" />
                    <Skeleton className="ext-skel-row-l2" />
                  </div>
                  <Skeleton className="ext-skel-row-dot" />
                </div>
              ))}
            </div>
          </aside>
          <section className="ext-detail">
            <div className="ext-detail-head">
              <Skeleton className="ext-skel-row-ext" />
              <div className="ext-skel-detail-titles">
                <Skeleton className="ext-skel-detail-name" />
                <Skeleton className="ext-skel-detail-meta" />
              </div>
            </div>
            <div className="ext-detail-tabs">
              <Skeleton className="ext-skel-tabs" />
            </div>
            <div className="ext-detail-body">
              <Skeleton className="ext-skel-block" />
              <Skeleton className="ext-skel-block" />
              <Skeleton className="ext-skel-block-lg" />
            </div>
          </section>
        </div>
      </>
    );
  }

  const selectedArquivo = selected
    ? ((arquivos ?? []).find((a) => a.id === selected) ?? null)
    : null;
  const selectedExtracao = selected ? (extracoes?.get(selected) ?? null) : null;
  const selectedContexto = selected ? (contextos?.get(selected) ?? null) : null;

  return (
    <>
      <PageHeader
        title="Extração de dados"
        subtitle="A IA lê cada documento inteiro (guiada pelo texto-mapa) e estrutura todos os dados num envelope fiel — números exatos, tabelas, totais e alertas."
        back={{
          label: "Mapeamento",
          onClick: () =>
            navigate({ to: "/contracts/$contractId/mapeamento", params: { contractId } }),
        }}
      />

      <div className="ext-stepper">
        <Stepper
          steps={steps}
          onStepClick={(id) => {
            if (id === "mapeamento")
              navigate({ to: "/contracts/$contractId/mapeamento", params: { contractId } });
            if (id === "normalizacao")
              navigate({ to: "/contracts/$contractId/normalizacao", params: { contractId } });
          }}
        />
      </div>

      {/* Hero · progresso + contadores + observabilidade */}
      <section className="ext-hero">
        <div className="ext-hero-ring">
          <ProgressRing
            value={summary.pct}
            max={100}
            size={88}
            stroke={8}
            color={summary.pct === 100 ? "var(--success)" : "var(--brand)"}
            label="extraído"
          />
        </div>
        <div className="ext-hero-main">
          <div className="ext-hero-headline">
            <strong>{summary.extracted}</strong> de <strong>{summary.inPhase}</strong>{" "}
            {summary.inPhase === 1 ? "documento extraído" : "documentos extraídos"}
          </div>
          <div className="ext-hero-chips">
            {summary.extracting > 0 && (
              <span className="ext-chip chip-info">
                <span className="ext-dot dot-info dot-pulse" />
                {summary.extracting} extraindo
              </span>
            )}
            {summary.queued > 0 && (
              <span className="ext-chip chip-info">
                <span className="ext-dot dot-info" />
                {summary.queued} na fila
              </span>
            )}
            {summary.review > 0 && (
              <span className="ext-chip chip-warning">
                <span className="ext-dot dot-warning" />
                {summary.review} p/ revisar
              </span>
            )}
            {summary.failed > 0 && (
              <span className="ext-chip chip-danger">
                <span className="ext-dot dot-danger" />
                {summary.failed} {summary.failed === 1 ? "erro" : "erros"}
              </span>
            )}
            {summary.inPhase === 0 && (
              <span className="ext-chip chip-neutral">
                Nenhum documento avançou pra extração ainda
              </span>
            )}
          </div>
          {reExtractableIds.length > 0 && (
            <div className="ext-hero-actions">
              <Button
                size="sm"
                variant="outline"
                disabled={reExtractBatch.isPending}
                onClick={() => {
                  if (reExtractableIds.length === 0) return;
                  if (
                    !window.confirm(
                      `Re-extrair TODA a obra — ${reExtractableIds.length} documento(s) já processado(s) ` +
                        "(extraídos, a revisar e com erro) voltam para a fila e o worker reprocessa cada um com o " +
                        "código atual. Use depois de corrigir o extrator, pra não deixar payload antigo no banco.",
                    )
                  )
                    return;
                  reExtractBatch.mutate(reExtractableIds);
                }}
              >
                {I.repeat({ size: 14 })}{" "}
                {reExtractBatch.isPending
                  ? "Reenfileirando…"
                  : `Re-extrair toda a obra (${reExtractableIds.length})`}
              </Button>
            </div>
          )}
        </div>
        {summary.runCount > 0 && (
          <div className="ext-hero-obs">
            <div className="ext-obs-item">
              <span className="ext-obs-val">{fmtInt(summary.tokens)}</span>
              <span className="ext-obs-lbl">tokens</span>
            </div>
            <div className="ext-obs-item">
              <span className="ext-obs-val">{fmtUSD(summary.cost)}</span>
              <span
                className="ext-obs-lbl"
                title="Custo equivalente em API; sob OAuth o gasto real é zero (assinatura)."
              >
                custo est. (API)
              </span>
            </div>
            <div className="ext-obs-item">
              <span className="ext-obs-val">{fmtDur(summary.latency)}</span>
              <span className="ext-obs-lbl">tempo de modelo</span>
            </div>
          </div>
        )}
      </section>

      {/* Workspace · fila (rail) + detalhe (painel) */}
      {(arquivos ?? []).length === 0 ? (
        <EmptyState
          framed
          icon={I.doc({ size: 40 })}
          title="Sem documentos"
          text="Volte ao mapeamento e avance os documentos pra extração."
          action={
            <Button
              onClick={() =>
                navigate({ to: "/contracts/$contractId/mapeamento", params: { contractId } })
              }
            >
              Ir pro mapeamento
            </Button>
          }
        />
      ) : (
        <div
          className={`ext-workspace${selected ? " has-selection" : ""}${focusMode ? " focus" : ""}`}
        >
          {/* ── RAIL · fila de documentos ─────────────────────────── */}
          <aside className="ext-rail">
            <div className="ext-rail-head">
              <div className="ext-search">
                {I.search({ size: 16 })}
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar documento ou tipo…"
                  aria-label="Buscar documentos"
                />
                {query && (
                  <button
                    className="ext-search-clear"
                    onClick={() => setQuery("")}
                    aria-label="Limpar busca"
                  >
                    {I.close({ size: 14 })}
                  </button>
                )}
              </div>
              <div className="ext-rail-filters">
                {FILTERS.filter(
                  (f) => f.key === "todos" || filterCounts[f.key] > 0 || f.key === filter,
                ).map((f) => (
                  <button
                    key={f.key}
                    className={`ext-filter${filter === f.key ? " active" : ""}`}
                    onClick={() => setFilter(f.key)}
                    aria-pressed={filter === f.key}
                  >
                    {f.label}
                    <span className="ext-filter-count">{filterCounts[f.key]}</span>
                  </button>
                ))}
              </div>

              {/* Filtro "Revisar" ativo · re-extrair em lote SÓ os needs_review */}
              {filter === "revisar" && filterCounts.revisar > 0 && (
                <div className="ext-rail-bulk">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={reExtractBatch.isPending}
                    onClick={() => {
                      const ids = (arquivos ?? [])
                        .filter((a) => a.status === "needs_review")
                        .map((a) => a.id);
                      if (ids.length === 0) return;
                      if (
                        !window.confirm(
                          `Re-extrair ${ids.length} documento(s) que precisam de revisão? ` +
                            "Eles voltam para a fila e o worker reprocessa cada um.",
                        )
                      )
                        return;
                      reExtractBatch.mutate(ids);
                    }}
                  >
                    {I.repeat({ size: 14 })}{" "}
                    {reExtractBatch.isPending
                      ? "Reenfileirando…"
                      : `Re-extrair os ${filterCounts.revisar} p/ revisão`}
                  </Button>
                </div>
              )}
              <div className="ext-rail-sort">
                <span className="ext-rail-sort-lbl">Ordenar</span>
                <Segmented
                  value={sort}
                  onChange={(v) => setSort(v as SortKey)}
                  items={SORT_ITEMS}
                  aria-label="Ordenar"
                />
              </div>
            </div>

            <div className="ext-rail-count">
              {query || filter !== "todos" ? (
                <span>
                  <strong>{visible.length}</strong> de {arquivos?.length ?? 0}{" "}
                  {(arquivos?.length ?? 0) === 1 ? "documento" : "documentos"}
                </span>
              ) : (
                <span>
                  <strong>{arquivos?.length ?? 0}</strong>{" "}
                  {(arquivos?.length ?? 0) === 1 ? "documento" : "documentos"}
                </span>
              )}
            </div>
            <div className="ext-rail-list">
              {visible.length === 0 ? (
                <div className="ext-rail-empty">
                  {I.search({ size: 28 })}
                  <p>Nenhum documento neste recorte.</p>
                  {(query || filter !== "todos") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setQuery("");
                        setFilter("todos");
                      }}
                    >
                      Limpar
                    </Button>
                  )}
                </div>
              ) : (
                visible.map((a) => (
                  <QueueRow
                    key={a.id}
                    arquivo={a}
                    extracao={extracoes?.get(a.id) ?? null}
                    queuePos={queuePos.get(a.id) ?? null}
                    selected={a.id === selected}
                    onSelect={() => setSelected(a.id)}
                  />
                ))
              )}
            </div>
          </aside>

          {/* ── DETALHE · doc selecionado ─────────────────────────── */}
          <section className="ext-detail">
            {selectedArquivo ? (
              <DetailPane
                key={selectedArquivo.id}
                arquivo={selectedArquivo}
                extracao={selectedExtracao}
                contexto={selectedContexto}
                runs={(runsByArquivo?.get(selectedArquivo.id) ?? []).filter(isExtractionRun)}
                obraId={contractId}
                queuePos={queuePos.get(selectedArquivo.id) ?? null}
                focusMode={focusMode}
                onToggleFocus={() => setFocusMode((v) => !v)}
                onBack={() => {
                  setSelected(null);
                  setFocusMode(false);
                }}
              />
            ) : (
              <div className="ext-detail-empty">
                <EmptyState
                  icon={I.eye({ size: 40 })}
                  title="Selecione um documento"
                  text="Escolha um item na fila à esquerda pra inspecionar os dados extraídos, o JSON e a execução."
                />
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}

// ── Linha da fila (rail) ──────────────────────────────────────────────
function QueueRow({
  arquivo,
  extracao,
  queuePos,
  selected,
  onSelect,
}: {
  arquivo: ObraArquivo;
  extracao: ObraArquivoExtracao | null;
  queuePos: number | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const fileMeta = getFileTypeMeta(arquivo.nome_original);
  const meta = statusMeta(arquivo.status);
  const env = extracao?.payload;
  const nLinhas = countLinhas(env);
  const nAlertas = env?.alertas_extracao?.length ?? 0;
  const type = docTypeLabel(extracao, env);

  // Sub-linha = UMA fonte (tipo quando extraído, senão o status) → nunca compete
  // com a métrica. A métrica vive na própria coluna (não quebra).
  const isType = Boolean(extracao && type);
  const sub = isType ? type : meta.label;

  return (
    <button
      type="button"
      className={`ext-row${selected ? " selected" : ""} status-${arquivo.status}`}
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
    >
      <span className={`ext-row-ext tone-${fileMeta.tone}`}>{fileMeta.label}</span>
      <span className="ext-row-main">
        <span className="ext-row-name" title={getDisplayName(arquivo)}>
          {getDisplayName(arquivo)}
        </span>
        <span className={`ext-row-sub${isType ? " is-type" : ""}`} title={sub ?? undefined}>
          {sub}
        </span>
      </span>
      <span className="ext-row-meta">
        {extracao ? (
          <span className="ext-row-metric">
            <span className="ext-num">{fmtInt(nLinhas)}</span> lin
            {nAlertas > 0 && (
              <span className="ext-row-alert" title={`${nAlertas} alerta(s)`}>
                {" · "}
                {I.flag({ size: 10 })}
                {nAlertas}
              </span>
            )}
          </span>
        ) : arquivo.status === "ready_to_extract" && queuePos ? (
          <span className="ext-row-metric muted">#{queuePos}</span>
        ) : null}
        <span
          className={`ext-dot dot-${meta.tone}${meta.pulse ? " dot-pulse" : ""}`}
          title={meta.label}
        />
      </span>
    </button>
  );
}

// ── Painel de detalhe ─────────────────────────────────────────────────
type DetailTab = "json" | "qa" | "exec";

function DetailPane({
  arquivo,
  extracao,
  contexto,
  runs,
  obraId,
  queuePos,
  focusMode,
  onToggleFocus,
  onBack,
}: {
  arquivo: ObraArquivo;
  extracao: ObraArquivoExtracao | null;
  contexto: ObraArquivoContexto | null;
  runs: AgentRun[];
  obraId: string;
  queuePos: number | null;
  focusMode: boolean;
  onToggleFocus: () => void;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<DetailTab>("json");
  const reExtract = useRequestReExtraction(obraId);
  const approve = useApproveExtraction(obraId);
  const reNormalize = useRequestReNormalization(obraId);
  const fileMeta = getFileTypeMeta(arquivo.nome_original);
  const meta = statusMeta(arquivo.status);
  const env = extracao?.payload;
  const type = docTypeLabel(extracao, env);
  const findings = extracao?.verifier_findings ?? [];
  const alertas = env?.alertas_extracao ?? [];
  const canReExtract = ["extracted", "verified", "needs_review", "extraction_error"].includes(
    arquivo.status,
  );
  // gate humano: a pessoa olhou o needs_review e decidiu que a extração serve assim mesmo
  const canApprove = arquivo.status === "needs_review" && !!extracao;
  // motor de normalização evoluiu → re-roda sobre a MESMA extração (substitui limpo)
  const canReNormalize = ["normalized", "normalizacao_error"].includes(arquivo.status);

  const tabItems = useMemo(() => {
    const qaCount = findings.length + alertas.length;
    return [
      { value: "json" as const, label: "JSON" },
      {
        value: "qa" as const,
        label: <>Verificação {qaCount > 0 && <span className="ext-tab-count">{qaCount}</span>}</>,
      },
      {
        value: "exec" as const,
        label: (
          <>Execução {runs.length > 0 && <span className="ext-tab-count">{runs.length}</span>}</>
        ),
      },
    ];
  }, [findings.length, alertas.length, runs.length]);

  return (
    <div className="ext-detail-inner">
      <header className="ext-detail-head">
        <button className="ext-detail-back" onClick={onBack} aria-label="Voltar à lista">
          {I.arrowLeft({ size: 16 })}
        </button>
        <span className={`ext-row-ext tone-${fileMeta.tone}`}>{fileMeta.label}</span>
        <div className="ext-detail-titles">
          <h2 className="ext-detail-name" title={getDisplayName(arquivo)}>
            {getDisplayName(arquivo)}
          </h2>
          <div className="ext-detail-meta">
            {type && <span className="ext-detail-type">{type}</span>}
            {extracao && (
              <>
                <span className="ext-detail-dot">·</span>
                <span>v{extracao.version}</span>
                <span className="ext-detail-dot">·</span>
                <Badge tone="neutral">{extracao.schema_version}</Badge>
                {extracao.doc_type_confidence != null && (
                  <>
                    <span className="ext-detail-dot">·</span>
                    <span>conf {extracao.doc_type_confidence.toFixed(2)}</span>
                  </>
                )}
                <span className="ext-detail-dot">·</span>
                <span>{timeAgo(extracao.created_at)}</span>
              </>
            )}
          </div>
        </div>
        <div className="ext-detail-actions">
          <span className={`ext-card-pill tone-${meta.tone}`}>
            <span className={`ext-dot dot-${meta.tone}${meta.pulse ? " dot-pulse" : ""}`} />
            {meta.label}
          </span>
          {canApprove && (
            <Button
              size="sm"
              variant="primary"
              disabled={approve.isPending}
              onClick={() => {
                const ok = window.confirm(
                  "Aprovar esta extração MESMO com o gate reprovado? O motivo da revisão fica " +
                    "registrado e a normalização roda em cima dela.",
                );
                if (ok) approve.mutate(arquivo.id);
              }}
            >
              {I.check({ size: 14 })} {approve.isPending ? "Aprovando…" : "Aprovar mesmo assim"}
            </Button>
          )}
          {canReNormalize && (
            <Button
              size="sm"
              variant="outline"
              disabled={reNormalize.isPending}
              onClick={() => reNormalize.mutate(arquivo.id)}
            >
              {I.repeat({ size: 14 })} {reNormalize.isPending ? "Reenfileirando…" : "Re-normalizar"}
            </Button>
          )}
          {canReExtract && (
            <Button
              size="sm"
              variant="outline"
              disabled={reExtract.isPending}
              onClick={() => reExtract.mutate(arquivo.id)}
            >
              {I.repeat({ size: 14 })} {reExtract.isPending ? "Reenfileirando…" : "Re-extrair"}
            </Button>
          )}
          <IconButton
            aria-label={focusMode ? "Mostrar a fila" : "Focar no documento"}
            size="sm"
            variant="ghost"
            className="ext-focus-btn"
            onClick={onToggleFocus}
          >
            {focusMode ? I.chevRight({ size: 16 }) : I.chevLeft({ size: 16 })}
          </IconButton>
        </div>
      </header>

      {extracao ? (
        <>
          <div className="ext-detail-tabs">
            <Tabs
              value={tab}
              onChange={(v) => setTab(v as DetailTab)}
              items={tabItems}
              aria-label="Visões do documento"
            />
          </div>
          <div className="ext-detail-body">
            {tab === "json" && (
              <JsonView name={getDisplayName(arquivo)} payload={extracao.payload} />
            )}
            {tab === "qa" && (
              <QaView arquivo={arquivo} findings={findings} alertas={alertas} extracao={extracao} />
            )}
            {tab === "exec" && <ExecView runs={runs} />}
          </div>
        </>
      ) : (
        <div className="ext-detail-body">
          <PendingPanel arquivo={arquivo} contexto={contexto} queuePos={queuePos} />
        </div>
      )}
    </div>
  );
}

// ── Aba: Estrutura (envelope renderizado) ─────────────────────────────
function EstruturaView({
  arquivo,
  extracao,
}: {
  arquivo: ObraArquivo;
  extracao: ObraArquivoExtracao;
}) {
  const env = extracao.payload ?? ({} as Envelope);
  const ident = env.identificacao ?? {};
  const totais = env.totais_declarados ?? {};
  const secoes = env.secoes ?? [];

  return (
    <div className="ext-viewer">
      {arquivo.status === "needs_review" && (
        <div className="ext-banner warn">
          {I.flag({ size: 16 })}
          <div>
            <strong>Revisão necessária.</strong>{" "}
            {arquivo.last_error ||
              "O verificador apontou pontos a conferir — veja a aba Verificação."}
          </div>
        </div>
      )}

      {env.resumo && <p className="ext-resumo">{env.resumo}</p>}

      {Object.keys(ident).length > 0 && (
        <section className="ext-block">
          <h4 className="ext-block-title">Identificação</h4>
          <KeyValueGrid data={ident} />
        </section>
      )}

      {secoes.length === 0 ? (
        <EmptyState
          icon={I.doc({ size: 32 })}
          title="Sem seções"
          text="A extração não produziu seções estruturadas."
        />
      ) : (
        secoes.map((sec, i) => <SecaoView key={i} secao={sec} />)
      )}

      {Object.keys(totais).length > 0 && (
        <section className="ext-block ext-block-totais">
          <h4 className="ext-block-title">Totais declarados</h4>
          <KeyValueGrid data={totais} highlight />
        </section>
      )}
    </div>
  );
}

// ── Aba: JSON cru ─────────────────────────────────────────────────────
function JsonView({ name, payload }: { name: string; payload: Envelope }) {
  const json = useMemo(() => JSON.stringify(payload ?? {}, null, 2), [payload]);
  const [copied, setCopied] = useState(false);
  const [wrap, setWrap] = useState(false);

  const highlighted = useMemo<ReactNode>(() => {
    if (json.length > 200_000) return json; // doc gigante → sem highlight (perf)
    return highlightJson(json);
  }, [json]);

  function copy() {
    navigator.clipboard?.writeText(json).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      },
      () => {},
    );
  }
  function download() {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(name)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const bytes = new Blob([json]).size;
  const lines = json.split("\n").length;

  return (
    <div className="ext-json">
      <div className="ext-json-bar">
        <div className="ext-json-meta">
          <span>{fmtInt(lines)} linhas</span>
          <span className="ext-detail-dot">·</span>
          <span>{fmtBytes(bytes)}</span>
        </div>
        <div className="ext-json-actions">
          <button
            className={`ext-json-toggle${wrap ? " on" : ""}`}
            onClick={() => setWrap((v) => !v)}
          >
            {I.menu({ size: 13 })} {wrap ? "Não quebrar" : "Quebrar linha"}
          </button>
          <Button size="sm" variant="outline" onClick={copy}>
            {copied ? I.check({ size: 14 }) : I.copy({ size: 14 })} {copied ? "Copiado" : "Copiar"}
          </Button>
          <Button size="sm" variant="outline" onClick={download}>
            {I.arrowDown({ size: 14 })} Baixar
          </Button>
        </div>
      </div>
      <pre
        className={`ext-json-code${wrap ? " wrap" : ""}`}
        tabIndex={0}
        role="region"
        aria-label="JSON da extração"
      >
        <code>{highlighted}</code>
      </pre>
    </div>
  );
}

// ── Aba: Verificação (QA) ─────────────────────────────────────────────
function QaView({
  arquivo,
  findings,
  alertas,
  extracao,
}: {
  arquivo: ObraArquivo;
  findings: NonNullable<ObraArquivoExtracao["verifier_findings"]>;
  alertas: string[];
  extracao: ObraArquivoExtracao;
}) {
  const conf = (extracao.field_confidence as { overall?: number } | null)?.overall;
  if (findings.length === 0 && alertas.length === 0 && arquivo.status !== "needs_review") {
    return (
      <EmptyState
        icon={I.shield({ size: 36 })}
        title="Sem apontamentos"
        text="O verificador não levantou alertas nem discrepâncias para este documento."
      />
    );
  }
  return (
    <div className="ext-viewer">
      {arquivo.status === "needs_review" && (
        <div className="ext-banner warn">
          {I.flag({ size: 16 })}
          <div>
            <strong>Revisão necessária.</strong>{" "}
            {arquivo.last_error || "Confira os pontos abaixo antes de validar."}
          </div>
        </div>
      )}
      {conf != null && (
        <div className="ext-qa-conf">
          <span className="ext-qa-conf-lbl">Confiança global do verificador</span>
          <span className="ext-qa-conf-val">{(conf * 100).toFixed(0)}%</span>
        </div>
      )}

      {alertas.length > 0 && (
        <section className="ext-block">
          <h4 className="ext-block-title">
            Alertas da extração <span className="ext-count warn">{alertas.length}</span>
          </h4>
          <ul className="ext-alertas">
            {alertas.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </section>
      )}

      {findings.length > 0 && (
        <section className="ext-block">
          <h4 className="ext-block-title">
            Achados do verificador <span className="ext-count">{findings.length}</span>
          </h4>
          <ul className="ext-findings">
            {findings.map((f, i) => (
              <li key={i}>
                <Badge
                  tone={
                    f.severity === "error" ? "danger" : f.severity === "warn" ? "warning" : "info"
                  }
                >
                  {f.severity ?? "info"}
                </Badge>
                <span>
                  {f.message}
                  {f.field ? <span className="ext-finding-field"> · {f.field}</span> : null}
                  {f.source ? <span className="ext-finding-src"> ({f.source})</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ── Aba: Execução (observabilidade) ───────────────────────────────────
function ExecView({ runs }: { runs: AgentRun[] }) {
  if (runs.length === 0) {
    return (
      <EmptyState
        icon={I.clock({ size: 36 })}
        title="Sem chamadas registradas"
        text="A observabilidade aparece aqui assim que o extrator roda este documento."
      />
    );
  }
  const totals = runs.reduce(
    (acc, r) => {
      acc.input += r.input_tokens ?? 0;
      acc.output += r.output_tokens ?? 0;
      acc.cost += r.cost_usd ?? 0;
      acc.latency += r.latency_ms ?? 0;
      return acc;
    },
    { input: 0, output: 0, cost: 0, latency: 0 },
  );
  return (
    <div className="ext-viewer">
      <div className="ext-exec-totals">
        <div className="ext-exec-total">
          <span className="ext-exec-total-val">{fmtInt(totals.input + totals.output)}</span>
          <span className="ext-exec-total-lbl">tokens totais</span>
        </div>
        <div className="ext-exec-total">
          <span className="ext-exec-total-val">{fmtUSD(totals.cost)}</span>
          <span className="ext-exec-total-lbl">custo est. (API)</span>
        </div>
        <div className="ext-exec-total">
          <span className="ext-exec-total-val">{fmtDur(totals.latency)}</span>
          <span className="ext-exec-total-lbl">tempo de modelo</span>
        </div>
        <div className="ext-exec-total">
          <span className="ext-exec-total-val">{runs.length}</span>
          <span className="ext-exec-total-lbl">{runs.length === 1 ? "chamada" : "chamadas"}</span>
        </div>
      </div>
      <RunsTable runs={runs} />
    </div>
  );
}

// ── Painel de doc pendente (na fila / extraindo / mapeado) ────────────
function PendingPanel({
  arquivo,
  contexto,
  queuePos,
}: {
  arquivo: ObraArquivo;
  contexto: ObraArquivoContexto | null;
  queuePos: number | null;
}) {
  const meta = statusMeta(arquivo.status);
  const headline =
    arquivo.status === "extracting"
      ? "Extraindo dados agora…"
      : arquivo.status === "ready_to_extract"
        ? queuePos
          ? `Na fila · posição #${queuePos}`
          : "Na fila de extração"
        : arquivo.status === "mapped"
          ? "Mapeado — aguardando validação"
          : meta.label;
  const sub =
    arquivo.status === "extracting"
      ? "A IA está lendo o documento inteiro e montando o envelope fiel. Os dados aparecem aqui assim que concluir."
      : arquivo.status === "ready_to_extract"
        ? "Assim que o extrator pegar este documento, o progresso aparece aqui em tempo real."
        : arquivo.status === "mapped"
          ? "Volte ao mapeamento e avance este documento pra extração."
          : (arquivo.last_error ?? "Aguardando o extrator.");

  return (
    <div className="ext-pending">
      <div className={`ext-pending-hero status-${arquivo.status}`}>
        <span className={`ext-pending-icon tone-${meta.tone}`}>
          {arquivo.status === "extracting" ? (
            <span className="ext-spinner" aria-hidden />
          ) : arquivo.status === "ready_to_extract" ? (
            I.clock({ size: 26 })
          ) : (
            I.doc({ size: 26 })
          )}
        </span>
        <div>
          <div className="ext-pending-headline">{headline}</div>
          <p className="ext-pending-sub">{sub}</p>
        </div>
      </div>

      {contexto?.context_md && (
        <section className="ext-block">
          <div className="ext-mapa-head">
            <h4 className="ext-block-title">
              {I.map({ size: 14 })} Texto-mapa (o que será extraído)
            </h4>
            <span className="ext-mapa-sub">
              {contexto.agent_model ?? "—"} · v{contexto.version}
              {contexto.doc_type_confidence != null
                ? ` · conf ${contexto.doc_type_confidence.toFixed(2)}`
                : ""}
            </span>
          </div>
          <pre
            className="ext-mapa-md"
            tabIndex={0}
            role="region"
            aria-label="Texto-mapa do documento"
          >
            {contexto.context_md}
          </pre>
        </section>
      )}
    </div>
  );
}

// ── Seção (tabela / chave_valor / texto) ──────────────────────────────
function SecaoView({ secao }: { secao: EnvelopeSecao }) {
  return (
    <section className="ext-block">
      <div className="ext-secao-head">
        <h4 className="ext-block-title">{secao.titulo}</h4>
        <span className="ext-secao-tag">{secao.tipo}</span>
        {secao.fonte && <span className="ext-secao-fonte">{secao.fonte}</span>}
      </div>
      {secao.tipo === "tabela" ? (
        <SecaoTabela secao={secao} />
      ) : secao.tipo === "chave_valor" ? (
        <KeyValueGrid data={secao.dados ?? {}} />
      ) : (
        <pre
          className="ext-conteudo"
          tabIndex={0}
          role="region"
          aria-label={`Conteúdo · ${secao.titulo}`}
        >
          {secao.conteudo}
        </pre>
      )}
    </section>
  );
}

const PAGE_SIZE = 12;

function SecaoTabela({ secao }: { secao: EnvelopeSecao }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const linhas = useMemo(() => (Array.isArray(secao.linhas) ? secao.linhas : []), [secao.linhas]);

  const cols = useMemo(() => {
    if (secao.colunas && secao.colunas.length) return secao.colunas;
    const keys: string[] = [];
    for (const r of linhas)
      for (const k of Object.keys(r ?? {})) if (!keys.includes(k)) keys.push(k);
    return keys;
  }, [secao.colunas, linhas]);

  const numericCols = useMemo(() => {
    const set = new Set<string>();
    for (const c of cols) {
      let nums = 0;
      let total = 0;
      for (const r of linhas.slice(0, 30)) {
        const v = r?.[c];
        if (v != null && v !== "") {
          total += 1;
          if (typeof v === "number") nums += 1;
        }
      }
      if (total > 0 && nums / total >= 0.6) set.add(c);
    }
    return set;
  }, [cols, linhas]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return linhas;
    return linhas.filter((r) =>
      Object.values(r ?? {}).some((v) => fmtCell(v).toLowerCase().includes(s)),
    );
  }, [linhas, q]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const slice = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const columns: DataTableColumn<Record<string, unknown>>[] = cols.map((c) => ({
    key: c,
    label: c,
    width: "minmax(120px, 1fr)",
    align: numericCols.has(c) ? "right" : "left",
    render: (row) => (
      <span className={numericCols.has(c) ? "ext-num" : undefined}>{fmtCell(row[c])}</span>
    ),
  }));

  return (
    <div className="ext-tabela">
      <div className="ext-tabela-bar">
        <div className="ext-tabela-search">
          {I.search({ size: 14 })}
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder={`Filtrar ${linhas.length} linha${linhas.length === 1 ? "" : "s"}…`}
            aria-label="Filtrar linhas"
          />
          {q && (
            <button onClick={() => setQ("")} aria-label="Limpar">
              {I.close({ size: 12 })}
            </button>
          )}
        </div>
        <span className="ext-tabela-count">
          {filtered.length === 0
            ? "0 linhas"
            : `${safePage * PAGE_SIZE + 1}–${Math.min(filtered.length, safePage * PAGE_SIZE + PAGE_SIZE)} de ${filtered.length}`}
        </span>
      </div>
      <div className="ext-tabela-scroll" tabIndex={0} role="region" aria-label="Tabela de dados">
        <DataTable
          columns={columns}
          rows={slice}
          getRowId={(_r, i) => safePage * PAGE_SIZE + i}
          emptyText="Nenhuma linha bate com o filtro."
        />
      </div>
      {pages > 1 && (
        <div className="ext-pager">
          <IconButton
            aria-label="Anterior"
            size="sm"
            variant="ghost"
            disabled={safePage === 0}
            onClick={() => setPage(safePage - 1)}
          >
            {I.chevLeft({ size: 14 })}
          </IconButton>
          <span className="ext-pager-label">
            Página {safePage + 1} de {pages}
          </span>
          <IconButton
            aria-label="Próxima"
            size="sm"
            variant="ghost"
            disabled={safePage >= pages - 1}
            onClick={() => setPage(safePage + 1)}
          >
            {I.chevRight({ size: 14 })}
          </IconButton>
        </div>
      )}
    </div>
  );
}

function KeyValueGrid({ data, highlight }: { data: Record<string, unknown>; highlight?: boolean }) {
  const entries = Object.entries(data ?? {});
  if (entries.length === 0) return <div className="ext-kv-empty">—</div>;
  return (
    <div className={`ext-kv ${highlight ? "highlight" : ""}`}>
      {entries.map(([k, v]) => (
        <div className="ext-kv-row" key={k}>
          <span className="ext-kv-key">{k}</span>
          <span className={`ext-kv-val ${typeof v === "number" ? "ext-num" : ""}`}>
            {v != null && typeof v === "object" ? (
              <span className="ext-kv-nested">{JSON.stringify(v)}</span>
            ) : (
              fmtCell(v)
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

function RunsTable({ runs }: { runs: AgentRun[] }) {
  return (
    <div className="ext-runs">
      <div className="ext-runs-head">
        <span>Agente</span>
        <span>Modelo</span>
        <span className="r">entrada</span>
        <span className="r">saída</span>
        <span className="r">custo est.</span>
        <span className="r">tempo</span>
        <span>status</span>
      </div>
      {runs.map((r) => (
        <div className="ext-runs-row" key={r.id}>
          <span>
            {r.agent_name}
            {r.pass > 1 ? ` ·p${r.pass}` : ""}
          </span>
          <span className="ext-runs-model">{r.model}</span>
          <span className="r ext-num">{r.input_tokens != null ? fmtInt(r.input_tokens) : "—"}</span>
          <span className="r ext-num">
            {r.output_tokens != null ? fmtInt(r.output_tokens) : "—"}
          </span>
          <span className="r ext-num">{r.cost_usd != null ? fmtUSD(r.cost_usd) : "—"}</span>
          <span className="r ext-num">{r.latency_ms != null ? fmtDur(r.latency_ms) : "—"}</span>
          <span>
            <Badge
              tone={r.status === "ok" ? "success" : r.status === "error" ? "danger" : "neutral"}
            >
              {r.status}
            </Badge>
          </span>
        </div>
      ))}
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────
function slugify(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "extracao"
  );
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Tokeniza o JSON pretty-printed em spans coloridos (tokens-only no CSS).
function highlightJson(json: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re =
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b|\b(true|false|null)\b/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(json)) !== null) {
    if (m.index > last) nodes.push(json.slice(last, m.index));
    if (m[1] != null) {
      // string — chave se seguida de ':'
      const cls = m[2] ? "json-key" : "json-str";
      nodes.push(
        <span key={key++} className={cls}>
          {m[1]}
        </span>,
      );
      if (m[2]) nodes.push(m[2]);
    } else if (m[3] != null) {
      nodes.push(
        <span key={key++} className="json-num">
          {m[3]}
        </span>,
      );
    } else if (m[4] != null) {
      nodes.push(
        <span key={key++} className="json-kw">
          {m[4]}
        </span>,
      );
    }
    last = re.lastIndex;
  }
  if (last < json.length) nodes.push(json.slice(last));
  return nodes;
}
