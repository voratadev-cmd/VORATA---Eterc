// Aba "Análise de Responsabilidade" (RMA · 5.3.8).
// Classifica eventos negativos por responsável · base para construção de pleitos.
//
// REAL-TOLERANTE (sem notFound 404): obra do registry de demonstração → view completa
// (dataset rico); obra real do banco → RespRealView — estrutura da aba + EmptyState
// honesto ("matriz aguardando normalização") + eventos de prazo já normalizados
// (obra_eventos_prazo · C.13), quando existirem. Pendente ≠ zero: valores não
// classificados aparecem como "—", nunca como 0.

import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  EmptyState,
  ErroCard,
  FarolCard,
  FilterChip,
  I,
  Select,
  Skeleton,
  type FarolCardAccent,
  type IconName,
} from "@/components/ds";
import { ColPag, ColToolbar, ColVazio, useColecao } from "@/lib/rma/colecao";
import {
  type AnaliseRespBM,
  type BmSnapshot,
  type RespEvento,
  type RespTipoImpacto,
  type ResponsavelTipo,
  type VisaoGeralData,
  getBm,
  getVisaoGeral,
} from "@/lib/mocks/obras";
import { getEventosPrazo, type TimelineEvento } from "@/lib/supabase/timeline";
import "./responsabilidade.css";

type RespSearch = { bm?: string };

export const Route = createFileRoute("/_app/contracts/$contractId/rma/responsabilidade")({
  component: ResponsabilidadeAba,
  validateSearch: (s: Record<string, unknown>): RespSearch => ({
    bm: typeof s.bm === "string" ? s.bm : undefined,
  }),
  loader: ({ params }) => {
    // Sem notFound: obra real (fora do registry de mocks) cai na RespRealView.
    const visao = getVisaoGeral(params.contractId) ?? null;
    return { visao };
  },
});

const FAROL_COLOR = {
  critico: "var(--danger)",
  risco: "var(--warning)",
  observacao: "var(--info)",
  conforme: "var(--success)",
} as const;

const RESP_COLOR: Record<ResponsavelTipo, string> = {
  contratante: "var(--danger)",
  contratada: "var(--warning)",
  terceiro: "var(--info)",
  forcaMaior: "var(--text-3)",
};

const RESP_LABEL: Record<ResponsavelTipo, string> = {
  contratante: "CONTRATANTE",
  contratada: "CONTRATADA",
  terceiro: "TERCEIRO",
  forcaMaior: "F. MAIOR",
};

const RESP_LABEL_LONG: Record<ResponsavelTipo, string> = {
  contratante: "CONTRATANTE",
  contratada: "CONTRATADA",
  terceiro: "TERCEIRO",
  forcaMaior: "FORÇA MAIOR",
};

const RESP_ICON: Record<ResponsavelTipo, IconName> = {
  contratante: "flag",
  contratada: "users",
  terceiro: "link",
  forcaMaior: "shield",
};

const MES_ABREV = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

function eventosLabel(n: number): string {
  return `${n} ${n === 1 ? "evento" : "eventos"}`;
}

function ResponsabilidadeAba() {
  const { visao } = Route.useLoaderData();
  const { contractId } = Route.useParams();
  const search = Route.useSearch();
  if (visao) return <RespMockView visao={visao} bmParam={search.bm} />;
  return <RespRealView contractId={contractId} />;
}

// ── View da obra de demonstração (dataset completo) ──────────────────

function RespMockView({ visao, bmParam }: { visao: VisaoGeralData; bmParam?: string }) {
  const navigate = Route.useNavigate();
  const bm = getBm(visao, bmParam);
  const a = bm.analiseResp;

  const bmSelector =
    visao.bms.length > 1 ? (
      <Select
        size="sm"
        align="end"
        aria-label="Selecionar BM"
        value={bm.numero}
        items={visao.bms.map((b) => ({
          value: b.numero,
          label: `${b.numero} · ${MES_ABREV[b.mes - 1]}/${String(b.ano).slice(-2)}`,
        }))}
        onChange={(v) => navigate({ search: (prev) => ({ ...prev, bm: v }), replace: true })}
      />
    ) : undefined;

  return (
    <main className="rsp-main">
      <RespHeader bm={bm} actions={bmSelector} />
      <KpisHero a={a} />
      <DistribuicaoCard a={a} bm={bm} />
      <div className="rsp-grid">
        <MatrizCard a={a} bm={bm} />
        <div className="rsp-col-dir">
          <InterpretacaoCard texto={a.interpretacao} chatQuote={a.chatQuote} />
          <QuantTipoCard a={a} />
        </div>
      </div>
    </main>
  );
}

// ── Header ───────────────────────────────────────────────────────────

function RespHeader({ bm, actions }: { bm?: BmSnapshot; actions?: ReactNode }) {
  return (
    <header className="rsp-head">
      <div>
        <h2 className="rsp-titulo">
          RMA · Análise de Responsabilidade{bm ? ` · ${bm.numero}` : ""}
        </h2>
        <p className="rsp-sub">
          Classificação dos eventos negativos por responsável · base para construção de pleitos ·
          fundamento documental por evento
        </p>
      </div>
      {actions ? <div className="rsp-head-actions">{actions}</div> : null}
    </header>
  );
}

// ── 4 KPIs (cores fixas por responsável — não-farol) ────────────────
// Contratante=danger (mais alto = pior pra Contratada), Contratada=warning,
// Terceiro=info, Força Maior=neutral.

const RESP_ACCENT: Record<ResponsavelTipo, FarolCardAccent> = {
  contratante: "danger",
  contratada: "warning",
  terceiro: "info",
  forcaMaior: "neutral",
};

const RESP_ORDEM: ResponsavelTipo[] = ["contratante", "contratada", "terceiro", "forcaMaior"];

function KpisHero({ a }: { a: AnaliseRespBM }) {
  return (
    <div className="rsp-kpis">
      {RESP_ORDEM.map((key) => {
        const r = a[key];
        return (
          <FarolCard
            key={key}
            label={RESP_LABEL_LONG[key]}
            icon={RESP_ICON[key]}
            value={r.valorLabel}
            info={r.nota}
            hint={eventosLabel(r.eventos)}
            accent={RESP_ACCENT[key]}
          />
        );
      })}
    </div>
  );
}

// ── Distribuição (barra empilhada CSS + legenda) ─────────────────────

function DistribuicaoCard({ a, bm }: { a: AnaliseRespBM; bm: BmSnapshot }) {
  // Ordem visual da barra (mantida do layout original).
  const segments: Array<{ key: ResponsavelTipo; pct: number }> = [
    { key: "contratante", pct: a.contratante.pct },
    { key: "forcaMaior", pct: a.forcaMaior.pct },
    { key: "contratada", pct: a.contratada.pct },
    { key: "terceiro", pct: a.terceiro.pct },
  ];
  const total = segments.reduce((s, x) => s + x.pct, 0);
  const isEmpty = total === 0;
  // Box de observação: tom derivado — só tinge de danger quando a Contratante domina.
  const obsAlerta = a.contratante.pct >= 50;

  return (
    <section className="rsp-section">
      <header className="rsp-section-head">
        <div>
          <h3 className="rsp-section-title">
            Distribuição do Impacto por Responsável · {bm.numero}
          </h3>
          <div className="rsp-section-sub">
            Participação de cada responsável no impacto total do período · total{" "}
            {a.totalConsolidadoLabel}
          </div>
        </div>
      </header>

      {isEmpty ? (
        <div className="rsp-empty-bar">
          <span className="rsp-empty-text">Sem eventos negativos no período · cenário limpo</span>
        </div>
      ) : (
        <>
          <div className="rsp-bar-stack">
            {segments
              .filter((s) => s.pct > 0)
              .map((s) => {
                const r = a[s.key];
                const pctLabel = s.pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
                return (
                  <div
                    key={s.key}
                    className="rsp-bar-seg"
                    style={{ width: `${s.pct}%`, background: RESP_COLOR[s.key] }}
                    title={`${RESP_LABEL_LONG[s.key]} · ${r.valorLabel} · ${pctLabel}% · ${eventosLabel(r.eventos)}`}
                  >
                    {s.pct >= 10 ? <span className="rsp-bar-label">{pctLabel}%</span> : null}
                  </div>
                );
              })}
          </div>
          <ul className="rsp-bar-legend">
            {segments.map((s) => {
              const r = a[s.key];
              return (
                <li key={s.key} className="rsp-legend-item">
                  <span
                    className="rsp-legend-dot"
                    style={{ background: RESP_COLOR[s.key] }}
                    aria-hidden
                  />
                  <span className="rsp-legend-nome">{RESP_LABEL_LONG[s.key]}</span>
                  <span className="rsp-legend-valor">{r.valorLabel}</span>
                  <span className="rsp-legend-meta">
                    {s.pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% ·{" "}
                    {eventosLabel(r.eventos)}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <aside className={`rsp-obs${obsAlerta ? " rsp-obs-alerta" : ""}`}>
        <FormattedText text={a.distribuicaoObs} />
      </aside>
    </section>
  );
}

// ── Matriz de eventos (coleção: busca + filtro + ordenação + paginação) ──

type EventoItem = RespEvento & { posicao: number };

const MESES_IDX: Record<string, number> = {
  jan: 0,
  fev: 1,
  mar: 2,
  abr: 3,
  mai: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  set: 8,
  out: 9,
  nov: 10,
  dez: 11,
};

/** Chave numérica de ordenação a partir do dataLabel ("15/09/25" · "jan/26"). */
function dataKey(label: string): number {
  const dm = label.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (dm) return Date.UTC(2000 + Number(dm[3]), Number(dm[2]) - 1, Number(dm[1]));
  const mm = label.match(/^([a-zç]{3})\/(\d{2})$/i);
  if (mm) {
    const mes = MESES_IDX[mm[1].toLowerCase()];
    if (mes != null) return Date.UTC(2000 + Number(mm[2]), mes, 1);
  }
  return 0;
}

const EVENTO_ORDENACOES = [
  // Ordem original do dataset = impacto financeiro decrescente.
  {
    value: "impacto",
    label: "Impacto (maior)",
    cmp: (a: EventoItem, b: EventoItem) => a.posicao - b.posicao,
  },
  {
    value: "data",
    label: "Data (recente)",
    cmp: (a: EventoItem, b: EventoItem) => dataKey(b.dataLabel) - dataKey(a.dataLabel),
  },
  { value: "docs", label: "Docs (mais)", cmp: (a: EventoItem, b: EventoItem) => b.docs - a.docs },
];

function MatrizCard({ a, bm }: { a: AnaliseRespBM; bm: BmSnapshot }) {
  const [fResp, setFResp] = useState<ResponsavelTipo | "">("");

  const itens = useMemo<EventoItem[]>(
    () => a.eventos.map((e, i) => ({ ...e, posicao: i })),
    [a.eventos],
  );

  const contagens = useMemo(() => {
    const c: Record<ResponsavelTipo, number> = {
      contratante: 0,
      contratada: 0,
      terceiro: 0,
      forcaMaior: 0,
    };
    for (const e of a.eventos) c[e.responsavel] += 1;
    return c;
  }, [a.eventos]);

  const col = useColecao(itens, {
    busca: (e) => `${e.id} ${e.evento}`,
    ordenacoes: EVENTO_ORDENACOES,
    filtro: (e) => !fResp || e.responsavel === fResp,
    resetKey: fResp,
  });

  const chips = (
    <div className="rsp-chips">
      <FilterChip
        label="Todos"
        value={a.eventos.length}
        active={fResp === ""}
        onClick={() => setFResp("")}
      />
      {RESP_ORDEM.filter((k) => contagens[k] > 0).map((k) => (
        <FilterChip
          key={k}
          label={RESP_LABEL[k]}
          value={contagens[k]}
          active={fResp === k}
          onClick={() => setFResp(fResp === k ? "" : k)}
        />
      ))}
    </div>
  );

  return (
    <section className="rsp-section">
      <header className="rsp-section-head">
        <div>
          <h3 className="rsp-section-title">Matriz de Eventos × Responsabilidade · {bm.numero}</h3>
          <div className="rsp-section-sub">
            {a.eventosTotal} eventos negativos identificados · ordenação padrão por impacto
            financeiro
          </div>
        </div>
      </header>

      {a.eventos.length === 0 ? (
        <div className="rsp-empty-matrix">
          {I.check({ size: 32 })}
          <p>Nenhum evento negativo identificado no período.</p>
        </div>
      ) : (
        <>
          {a.eventos.length >= 5 ? (
            <ColToolbar col={col} placeholder="Buscar por evento ou ID…" extra={chips} />
          ) : null}

          {col.total === 0 ? (
            col.debounced ? (
              <ColVazio termo={col.query} rotulo="evento" onClear={() => col.setQuery("")} />
            ) : (
              <div className="col-vazia">
                Nenhum evento atribuído a {fResp ? RESP_LABEL_LONG[fResp] : "este responsável"}{" "}
                neste corte.{" "}
                <button type="button" className="col-vazia-clear" onClick={() => setFResp("")}>
                  Limpar filtro
                </button>
              </div>
            )
          ) : (
            <div className="rsp-tabela-wrap">
              <div className="rsp-tabela" role="table">
                <div className="rsp-tabela-head" role="row">
                  <div role="columnheader">ID</div>
                  <div role="columnheader">Evento</div>
                  <div role="columnheader">Data</div>
                  <div role="columnheader">Impacto R$</div>
                  <div role="columnheader">Resp.</div>
                  <div role="columnheader" className="center">
                    Docs
                  </div>
                </div>
                {col.visible.map((e) => (
                  <EventoLinha key={e.id} e={e} />
                ))}
              </div>
            </div>
          )}

          <ColPag col={col} rotulo="eventos" />

          {a.eventosMenoresRestantes > 0 && (
            <p className="rsp-tabela-foot">
              + {a.eventosMenoresRestantes} eventos de menor impacto não listados neste corte
            </p>
          )}
        </>
      )}
    </section>
  );
}

function EventoLinha({ e }: { e: RespEvento }) {
  const color = RESP_COLOR[e.responsavel];
  return (
    <div className="rsp-tabela-row" role="row">
      <div role="cell" className="rsp-cell-id">
        {e.id}
      </div>
      <div role="cell" className="rsp-cell-evento">
        {e.evento}
      </div>
      <div role="cell" className="rsp-cell-data">
        {e.dataLabel}
      </div>
      <div role="cell" className="rsp-cell-impacto tabular fw-semibold">
        {e.impactoLabel}
      </div>
      <div role="cell">
        <span
          className="rsp-pill"
          style={{ background: `color-mix(in srgb, ${color} 13%, transparent)`, color }}
        >
          {RESP_LABEL[e.responsavel]}
        </span>
      </div>
      <div role="cell" className="center rsp-cell-docs">
        {e.docs} {e.docs === 1 ? "doc" : "docs"}
      </div>
    </div>
  );
}

// ── Interpretação ────────────────────────────────────────────────────

function InterpretacaoCard({ texto, chatQuote }: { texto: string; chatQuote?: string }) {
  const paragrafos = texto.split("\n\n");
  return (
    <section className="rsp-section">
      <div className="rsp-interp-tag">{I.edit({ size: 12 })} INTERPRETAÇÃO · ADM CONTRATUAL IA</div>
      {paragrafos.map((p, i) => (
        <p key={i} className="rsp-interp-texto">
          <FormattedText text={p} />
        </p>
      ))}
      {chatQuote ? (
        <blockquote className="rsp-interp-quote">
          <span className="rsp-interp-quote-ic" aria-hidden>
            {I.chat({ size: 13 })}
          </span>
          <FormattedText text={chatQuote} />
        </blockquote>
      ) : null}
    </section>
  );
}

// ── Quantificação por tipo ──────────────────────────────────────────

function QuantTipoCard({ a }: { a: AnaliseRespBM }) {
  return (
    <section className="rsp-section">
      <header className="rsp-section-head">
        <div>
          <h3 className="rsp-section-title">Quantificação por Tipo de Impacto</h3>
          <div className="rsp-section-sub">Detalhamento dos {a.totalConsolidadoLabel}</div>
        </div>
      </header>
      {a.tiposImpacto.length === 0 ? (
        <p className="rsp-quant-empty">Sem impactos no período.</p>
      ) : (
        <ul className="rsp-quant-list">
          {a.tiposImpacto.map((t) => (
            <TipoImpactoLinha key={t.id} t={t} />
          ))}
        </ul>
      )}
    </section>
  );
}

function TipoImpactoLinha({ t }: { t: RespTipoImpacto }) {
  const color = FAROL_COLOR[t.farol];
  return (
    <li className="rsp-quant-item">
      <div className="rsp-quant-body">
        <div className="rsp-quant-cat">
          <span className="rsp-quant-dot" style={{ background: color }} aria-hidden />
          {t.categoria}
        </div>
        <div className="rsp-quant-desc">{t.descricao}</div>
      </div>
      <div className="rsp-quant-valor tabular fw-semibold" style={{ color }}>
        {t.valorLabel}
      </div>
    </li>
  );
}

// ── View da obra REAL (banco) — sem notFound ─────────────────────────
// A matriz de responsabilidade ainda não é normalizada pelo motor; a aba mostra
// a estrutura (KPIs pendentes "—" + EmptyState honesto) e, quando existem,
// os eventos de prazo já normalizados (obra_eventos_prazo · C.13).

function RespRealView({ contractId }: { contractId: string }) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["resp-eventos-prazo", contractId],
    staleTime: 30_000,
    queryFn: () => getEventosPrazo(contractId),
  });

  if (isLoading) {
    return (
      <main className="rsp-main">
        <RespHeader />
        <div className="rsp-kpis">
          {RESP_ORDEM.map((k) => (
            <Skeleton key={k} style={{ height: 108 }} />
          ))}
        </div>
        <Skeleton style={{ height: 128 }} />
        <Skeleton style={{ height: 280 }} />
      </main>
    );
  }

  if (isError) {
    return (
      <main className="rsp-main">
        <RespHeader />
        <ErroCard
          mensagem={error instanceof Error ? error.message : String(error)}
          onRetry={() => refetch()}
        />
      </main>
    );
  }

  return (
    <main className="rsp-main">
      <RespHeader />

      <div className="rsp-kpis">
        {RESP_ORDEM.map((k) => (
          <FarolCard
            key={k}
            label={RESP_LABEL_LONG[k]}
            icon={RESP_ICON[k]}
            value="—"
            info="Aguardando classificação por responsável"
            accent={RESP_ACCENT[k]}
          />
        ))}
      </div>

      <EmptyState
        framed
        icon={I.doc({ size: 40 })}
        title="Matriz de responsabilidade aguardando normalização"
        text="Os eventos negativos desta obra ainda não foram classificados por responsável (Contratante · Contratada · Terceiro · Força Maior). A matriz, a distribuição do impacto e a quantificação por tipo serão montadas quando a análise for normalizada."
        hint={
          data && data.length > 0
            ? `${eventosLabel(data.length)} de prazo já normalizados — exibidos abaixo`
            : "Nenhum evento de prazo normalizado até aqui"
        }
      />

      {data && data.length > 0 ? <EventosPrazoCard eventos={data} /> : null}
    </main>
  );
}

function fmtIsoCurta(iso: string | null): string {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1].slice(-2)}`;
}

const PRAZO_ORDENACOES = [
  {
    value: "data",
    label: "Data (recente)",
    cmp: (a: TimelineEvento, b: TimelineEvento) =>
      (b.dataInicio ?? "").localeCompare(a.dataInicio ?? ""),
  },
  {
    value: "atraso",
    label: "Atraso (maior)",
    cmp: (a: TimelineEvento, b: TimelineEvento) => (b.diasAtraso ?? -1) - (a.diasAtraso ?? -1),
  },
  {
    value: "titulo",
    label: "Evento (A–Z)",
    cmp: (a: TimelineEvento, b: TimelineEvento) => a.titulo.localeCompare(b.titulo),
  },
];

function EventosPrazoCard({ eventos }: { eventos: TimelineEvento[] }) {
  const col = useColecao(eventos, {
    busca: (e) => `${e.evId ?? ""} ${e.titulo} ${e.categoria ?? ""} ${e.fonte ?? ""}`,
    ordenacoes: PRAZO_ORDENACOES,
  });

  return (
    <section className="rsp-section">
      <header className="rsp-section-head">
        <div>
          <h3 className="rsp-section-title">Eventos de prazo normalizados · C.13</h3>
          <div className="rsp-section-sub">
            Dado real do cronograma · atribuição de responsabilidade pendente de normalização
          </div>
        </div>
      </header>

      {eventos.length >= 5 ? (
        <ColToolbar col={col} placeholder="Buscar por evento, categoria ou fonte…" />
      ) : null}

      {col.total === 0 ? (
        <ColVazio termo={col.query} rotulo="evento" onClear={() => col.setQuery("")} />
      ) : (
        <div className="rsp-tabela-wrap">
          <div className="rsp-tabela rsp-tabela-prazo" role="table">
            <div className="rsp-tabela-head" role="row">
              <div role="columnheader">EV</div>
              <div role="columnheader">Evento</div>
              <div role="columnheader">Categoria</div>
              <div role="columnheader">Período</div>
              <div role="columnheader">Atraso</div>
              <div role="columnheader">Fonte</div>
            </div>
            {col.visible.map((e) => (
              <div key={`${e.ordem}-${e.evId ?? e.titulo}`} className="rsp-tabela-row" role="row">
                <div role="cell" className="rsp-cell-id">
                  {e.evId ?? "—"}
                </div>
                <div role="cell" className="rsp-cell-evento rsp-cell-evento-prazo">
                  {e.titulo}
                  {e.critico ? <Badge tone="danger">Crítico</Badge> : null}
                </div>
                <div role="cell" className="rsp-cell-data">
                  {e.categoria ?? "—"}
                </div>
                <div role="cell" className="rsp-cell-data">
                  {fmtIsoCurta(e.dataInicio)} – {fmtIsoCurta(e.dataFim)}
                </div>
                <div role="cell" className="rsp-cell-data">
                  {e.diasAtraso != null
                    ? `${e.diasAtraso} ${e.diasAtraso === 1 ? "dia" : "dias"}`
                    : "—"}
                </div>
                <div role="cell" className="rsp-cell-fonte">
                  {e.fonte ?? "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ColPag col={col} rotulo="eventos" />
    </section>
  );
}

// ── Helper ──────────────────────────────────────────────────────────

function FormattedText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i}>{p.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
