// Aba "Visão Geral" do RMA (Geralzão). Antes era a tela inteira do /rma —
// agora vive como aba dentro do layout pai (que provê Breadcrumb + PageHeader +
// BmSeletor + RmaTabs). Sem sub-sidebar — navegação é via tabs horizontais.

import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight } from "lucide-react";
import { type CSSProperties, useState } from "react";
import {
  CHART_SERIE_COR,
  Badge,
  Button,
  ChartTooltip,
  EmptyState,
  I,
  type IconName,
  Skeleton,
  Tabs,
} from "@/components/ds";
import { farolLabel, farolToBadge } from "@/lib/mocks/contracts";
import type { DiagnosticoIA, DiagnosticoTom } from "@/lib/supabase/sinteses";
import { type BlocoFarol, type EntregavelAtalho, type EventoIA } from "@/lib/mocks/obras";
import { type VisaoGeralViewExt, useVisaoGeralView } from "@/lib/hooks/useVisaoGeralView";
import type { VgViewBm, VgViewMeta } from "@/lib/rma/bridgeVisaoGeral";
import type { DesequilibrioPainel } from "@/lib/supabase/desequilibrioPainel";
import type { PrazoMarco } from "@/lib/supabase/prazoMarcos";
import type { Conduta } from "@/lib/supabase/condutas";
import type { CurvasC8 } from "@/lib/supabase/curvasC8";
import { MARCO_STATUS_LABEL, type MarcoStatus, statusMarco } from "@/lib/rma/marcoFarol";
import "./visao-geral.css";

export const Route = createFileRoute("/_app/contracts/$contractId/rma/visao-geral")({
  component: VisaoGeralAba,
});

const FAROL_COLOR = {
  critico: "var(--danger)",
  risco: "var(--warning)",
  observacao: "var(--info)",
  conforme: "var(--success)",
} as const;
// Labels de nível: SEMPRE farolLabel (canônico, 4 nomes fixos) — nunca abreviar ("OBS" é vetado).
// Onde o design pede UPPERCASE (ex.: .vg-bloco-nivel), o CSS resolve via text-transform.

// Ordenador de severidade (pior → melhor); pendente vai pro fim (área cega, não "ok").
const FAROL_RANK: Record<string, number> = { critico: 0, risco: 1, observacao: 2, conforme: 3 };
const blocoRank = (b: BlocoFarol): number => (b.pendente ? 5 : (FAROL_RANK[b.nivel] ?? 4));

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
// Datas do Postgres são "YYYY-MM-DD" (sem hora): new Date() as interpreta como meia-noite UTC e
// o formato em fuso BRT (UTC-3) exibiria o dia ANTERIOR. Ancorar no meio-dia UTC elimina o shift.
const fmtDate = (iso: string) =>
  DATE_FMT.format(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : new Date(iso));

const fmtBRLmi = (v: number) =>
  `R$ ${(v / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`;
const fmtBRLfull = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtPct1 = (frac: number | null) =>
  frac == null ? "—" : `${(frac * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

function VisaoGeralAba() {
  const { contractId } = Route.useParams();
  const { data, isLoading, isError, refetch } = useVisaoGeralView(contractId);

  return (
    <main className="vg-main">
      {isLoading ? (
        <VgSkeleton />
      ) : isError ? (
        <EmptyState
          framed
          title="Não foi possível carregar a visão geral"
          text="Erro ao ler os dados normalizados desta obra."
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Tentar de novo
            </Button>
          }
        />
      ) : !data ? (
        <EmptyState
          framed
          title="Visão geral ainda não normalizada"
          text="Esta obra não tem dado normalizado no banco ainda."
          hint="Aguardando normalização da Camada A"
        />
      ) : (
        <VgConteudo view={data} />
      )}
    </main>
  );
}

function VgConteudo({ view }: { view: VisaoGeralViewExt }) {
  const { bm, visao, diagnosticoIA: diagnostico, painelDeseq, marcos, condutas, curvasC8 } = view;
  const [tab, setTab] = useState<VgTab>("desempenho");
  // Contadores nos labels das sub-tabs: o risco não pode dormir atrás de um clique — a tab avisa
  // o que guarda (marcos atrasados/em risco + condutas urgentes; eventos críticos). Badge só
  // quando >0 — nunca badge verde decorativa.
  const { emRisco } = marcosComStatus(marcos, view.corteISO);
  const { nUrgentes } = condutasPriorizadas(condutas);
  const nAlertasMarcos = emRisco + nUrgentes;
  const nEventosCriticos = bm.ultimosEventos.filter((e) => e.nivel === "critico").length;
  return (
    <>
      {/* Jornada da decisão: veredito (hero) → foco (faróis) → magnitude (composição) → ação (IA) → detalhe. */}
      <HeroStrip visao={visao} bm={bm} />
      <BlocoFarolGrid bm={bm} />
      <ComposicaoDesequilibrioPanel painel={painelDeseq} />
      <DiagnosticoCard bm={bm} diagnostico={diagnostico} />
      <section className="vg-det">
        <div className="vg-det-tabs">
          <Tabs<VgTab>
            value={tab}
            onChange={setTab}
            aria-label="Detalhe da visão geral"
            items={[
              { value: "desempenho", label: "Desempenho" },
              {
                value: "marcos",
                label: (
                  <span className="vg-tab-label">
                    Marcos &amp; Ações
                    {nAlertasMarcos > 0 && (
                      <Badge tone="danger" className="vg-tab-count">
                        {nAlertasMarcos}
                      </Badge>
                    )}
                  </span>
                ),
              },
              { value: "sintese", label: "Síntese do Contrato" },
              {
                value: "eventos",
                label: (
                  <span className="vg-tab-label">
                    Eventos &amp; Entregáveis
                    {nEventosCriticos > 0 && (
                      <Badge tone="danger" className="vg-tab-count">
                        {nEventosCriticos}
                      </Badge>
                    )}
                  </span>
                ),
              },
            ]}
          />
        </div>
        <div className="vg-det-body">
          {tab === "desempenho" ? (
            <BlocoGraficosGrid bm={bm} curvasC8={curvasC8} />
          ) : tab === "marcos" ? (
            <MarcosAcoesTab marcos={marcos} condutas={condutas} corteISO={view.corteISO} />
          ) : tab === "sintese" ? (
            <SinteseTab sintese={visao.sinteseResumida} />
          ) : (
            <EventosEntregaveisTab
              eventos={bm.ultimosEventos}
              bm={bm}
              entregaveis={visao.entregaveis}
            />
          )}
        </div>
      </section>
    </>
  );
}

type VgTab = "desempenho" | "marcos" | "sintese" | "eventos";

/* Skeleton fiel à FORMA do conteúdo real (hero → 5 blocos farol → composição →
 * diagnóstico → detalhe em abas). Mesma ORDEM e alturas/colunas do VgConteudo,
 * então o swap skeleton→conteúdo não dá salto de layout — só um fade suave. */
function VgSkeleton() {
  return (
    <div className="vg-sk" aria-hidden>
      <Skeleton className="vg-sk-card" style={{ height: 92 }} />
      <div className="vg-sk-blocos">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="vg-sk-card" style={{ height: 160 }} />
        ))}
      </div>
      <Skeleton className="vg-sk-card" style={{ height: 184 }} />
      <Skeleton className="vg-sk-card" style={{ height: 130 }} />
      <Skeleton className="vg-sk-card" style={{ height: 300 }} />
    </div>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────

function HeroStrip({ visao, bm }: { visao: VgViewMeta; bm: VgViewBm }) {
  const formatBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  // Veredito (1ª leitura): a Situação Geral consolidada + quantas frentes estão críticas.
  const blocos = [
    bm.blocoFaturamento,
    bm.blocoRecursos,
    bm.blocoProdutividade,
    bm.blocoPrazo,
    bm.blocoDesequilibrio,
  ];
  const avaliados = blocos.filter((b) => !b.pendente);
  const nCriticas = avaliados.filter((b) => b.nivel === "critico").length;
  const deseq = bm.desequilibrioAcumulado;

  // consolidado pendente (cobertura insuficiente) NÃO ganha farol — dot/tint só com farol real.
  const heroFarol = bm.situacaoPendente ? "" : ` vg-hero-${bm.situacao}`;
  return (
    <section className={`vg-hero${heroFarol}`}>
      <div className="vg-hero-verdict">
        <div className="vg-hero-verdict-label">Situação Geral · {bm.numero}</div>
        {/* Farol no veredito (sem tarja): dot 8px + tint via .vg-hero-<nivel> no CSS — um
            contrato Crítico e um Conforme não podem abrir visualmente idênticos. */}
        <div className="vg-hero-verdict-value">
          {!bm.situacaoPendente && <span className="vg-hero-verdict-dot" aria-hidden />}
          {bm.situacaoLabel}
        </div>
        <div className="vg-hero-verdict-sub">
          {nCriticas > 0
            ? `${nCriticas} de ${avaliados.length} frentes em estado crítico`
            : `${avaliados.length} de ${blocos.length} frentes avaliadas`}
        </div>
      </div>

      <div className="vg-hero-ctx">
        {/* PENDENTE ≠ ZERO: o headline é o VALOR (M3/D.0); =0 vira "—" + "Pendente" (não R$ 0). */}
        <div className="vg-hero-metric">
          <span className="vg-hero-metric-label">Desequilíbrio acumulado</span>
          <span className={`vg-hero-metric-value${deseq > 0 ? "" : " vg-hero-metric-pend"}`}>
            {deseq > 0 ? formatBRL(deseq) : "—"}
          </span>
          <span className="vg-hero-metric-sub">
            {deseq > 0
              ? `${bm.desequilibrioPctValor.toLocaleString("pt-BR")}% do valor · D.0`
              : "Pendente — M3 não quantificado"}
          </span>
        </div>

        <div className="vg-hero-metric">
          <span className="vg-hero-metric-label">Faturamento do período</span>
          <span
            className={`vg-hero-metric-value${bm.faturamentoPct != null ? "" : " vg-hero-metric-pend"}`}
          >
            {bm.faturamentoPct != null ? `${bm.faturamentoPct.toLocaleString("pt-BR")}%` : "—"}
          </span>
          <span className="vg-hero-metric-sub">
            {bm.faturamentoContratadoPct != null
              ? `contratado ${bm.faturamentoContratadoPct.toLocaleString("pt-BR")}% no corte`
              : "Pendente — sem valor contratado"}
          </span>
        </div>

        <div className="vg-hero-metric">
          <span className="vg-hero-metric-label">Prazo decorrido</span>
          <span className="vg-hero-metric-value">
            {bm.prazoDecorridoDias} / {visao.prazoTotalDias} d
          </span>
          <span className="vg-hero-metric-sub">
            térm. previsto {fmtDate(visao.terminoPrevistoISO)}
          </span>
        </div>
      </div>
    </section>
  );
}

// ── Diagnóstico ──────────────────────────────────────────────────────

const TOM_TONE: Record<DiagnosticoTom, "success" | "warning" | "danger"> = {
  positivo: "success",
  atencao: "warning",
  critico: "danger",
};

function DiagnosticoCard({ bm, diagnostico }: { bm: VgViewBm; diagnostico: DiagnosticoIA | null }) {
  return (
    <section className={`vg-diag${diagnostico ? "" : " vg-diag-slim"}`}>
      <div className="vg-diag-head">
        <span className="vg-diag-icon" aria-hidden>
          {I.note({ size: 14 })}
        </span>
        <span className="vg-diag-tag">DIAGNÓSTICO DO ADM CONTRATUAL IA · {bm.numero}</span>
        {diagnostico?.status === "needs_review" && <Badge tone="warning">números a revisar</Badge>}
      </div>
      {diagnostico ? (
        <>
          <p className="vg-diag-text">{diagnostico.situacaoGeral}</p>
          {diagnostico.pontos.length > 0 && (
            <ul className="vg-diag-pontos">
              {diagnostico.pontos.map((p, i) => (
                <li key={i} className="vg-diag-ponto">
                  <Badge tone={TOM_TONE[p.tom]}>{p.titulo}</Badge>
                  <span className="vg-diag-ponto-txt">{p.texto}</span>
                </li>
              ))}
            </ul>
          )}
          {diagnostico.recomendacao && (
            <p className="vg-diag-rec">
              <strong>Recomendação:</strong> {diagnostico.recomendacao}
            </p>
          )}
        </>
      ) : (
        <p className="vg-diag-text">
          <FormattedText text={bm.diagnostico} />
        </p>
      )}
    </section>
  );
}

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

// ── 5 cards de farol ─────────────────────────────────────────────────

const BLOCO_ICONS: Record<string, IconName> = {
  faturamento: "wallet",
  recursos: "users",
  produtividade: "trending",
  prazo: "clock",
  desequilibrio: "trending",
};

function BlocoFarolGrid({ bm }: { bm: VgViewBm }) {
  const blocos: Array<{ key: string; titulo: string; bloco: BlocoFarol }> = [
    { key: "faturamento", titulo: "Faturamento", bloco: bm.blocoFaturamento },
    { key: "recursos", titulo: "Recursos", bloco: bm.blocoRecursos },
    { key: "produtividade", titulo: "Produtividade", bloco: bm.blocoProdutividade },
    { key: "prazo", titulo: "Prazo", bloco: bm.blocoPrazo },
    { key: "desequilibrio", titulo: "Desequilíbrio", bloco: bm.blocoDesequilibrio },
  ];
  // Foco: o pior primeiro (o gerente lê da esquerda — o crítico tem que estar lá).
  const ordenados = [...blocos].sort((a, b) => blocoRank(a.bloco) - blocoRank(b.bloco));
  return (
    <div className="vg-blocos">
      {ordenados.map(({ key, titulo, bloco }) => {
        const cor = bloco.pendente ? "var(--text-3)" : FAROL_COLOR[bloco.nivel];
        return (
          <article
            key={key}
            className="vg-bloco"
            data-nivel={bloco.pendente ? "pendente" : bloco.nivel}
            style={{ "--farol": cor } as CSSProperties}
          >
            <header className="vg-bloco-head">
              <span className="vg-bloco-icon" aria-hidden>
                {I[BLOCO_ICONS[key] ?? "doc"]({ size: 15 })}
              </span>
              <span className="vg-bloco-titulo">{titulo}</span>
              <span className="vg-bloco-nivel">
                {bloco.pendente ? "Pendente" : farolLabel[bloco.nivel]}
              </span>
            </header>
            <div className="vg-bloco-valor">{bloco.valor}</div>
            <div className="vg-bloco-desc">{bloco.descricao}</div>
            <div className="vg-bloco-nota">{bloco.nota}</div>
          </article>
        );
      })}
    </div>
  );
}

// ── Composição do Desequilíbrio (D.0 · M3) ────────────────────────────────
// Transforma o número solto do hero na sua composição real: ranqueia as categorias (D.1..D.6) do
// painel D.0 com R$ + % do total + barra, e mostra a recuperação provável (D.11) → resultado provável.

// Cada tela D.x tem rota viva no Painel de Desequilíbrio — o chip vira atalho (1 clique, sem menu).
const TELA_ROTA = {
  "D.1": "/contracts/$contractId/desequilibrio/indiretos",
  "D.2": "/contracts/$contractId/desequilibrio/bdi",
  "D.3": "/contracts/$contractId/desequilibrio/encargos",
  "D.4": "/contracts/$contractId/desequilibrio/valor-agregado",
  "D.5": "/contracts/$contractId/desequilibrio/insumos",
  "D.6": "/contracts/$contractId/desequilibrio/pontuais",
} as const;

function TelaChip({ tela }: { tela: string | null }) {
  const { contractId } = Route.useParams();
  const rota = tela ? TELA_ROTA[tela as keyof typeof TELA_ROTA] : undefined;
  if (!rota) return <span className="vg-comp-bar-tela">{tela ?? "—"}</span>;
  return (
    <Link
      to={rota}
      params={{ contractId }}
      className="vg-comp-bar-tela vg-comp-bar-tela-link"
      title={`Abrir tela ${tela}`}
    >
      {tela}
    </Link>
  );
}

function ComposicaoDesequilibrioPanel({ painel }: { painel: DesequilibrioPainel | null }) {
  const { contractId } = Route.useParams();
  if (!painel || painel.resumo.totalRs <= 0) return null; // sem M3 → o bloco de farol já diz "Pendente"
  const { resumo, composicao } = painel;
  const comValor = composicao
    .filter((c) => (c.valorRs ?? 0) > 0)
    .sort((a, b) => (b.valorRs ?? 0) - (a.valorRs ?? 0));
  const zeradas = composicao.filter((c) => (c.valorRs ?? 0) <= 0);
  const maxVal = Math.max(...comValor.map((c) => c.valorRs ?? 0), 1);
  return (
    <section className="vg-comp">
      <header className="vg-comp-head">
        <div>
          <h3 className="vg-comp-title" id="vg-comp-titulo">
            Composição do Desequilíbrio
          </h3>
          <p className="vg-comp-sub">
            Painel D.0 · M3 — de onde vem o desequilíbrio econômico-financeiro
          </p>
          <Link
            to="/contracts/$contractId/desequilibrio"
            params={{ contractId }}
            className="vg-comp-link"
          >
            Abrir painel D.0
            <ArrowRight size={12} aria-hidden />
          </Link>
        </div>
        <div className="vg-comp-kpis">
          <div className="vg-comp-kpi">
            <span className="vg-comp-kpi-v">{fmtBRLmi(resumo.totalRs)}</span>
            <span className="vg-comp-kpi-l">
              total acumulado
              {resumo.pctValorContratual != null
                ? ` · ${fmtPct1(resumo.pctValorContratual)} do contrato`
                : ""}
            </span>
            <span className="vg-comp-kpi-vq">
              vigente {fmtBRLmi(resumo.vigenteRs)} · quitado {fmtBRLmi(resumo.quitadoRs)}
            </span>
          </div>
          {resumo.resultadoProvavelRs != null && (
            <div className="vg-comp-kpi vg-comp-kpi-r">
              <span className="vg-comp-kpi-v vg-comp-kpi-prov">
                {fmtBRLmi(resumo.resultadoProvavelRs)}
              </span>
              <span className="vg-comp-kpi-l">
                resultado provável · {fmtPct1(resumo.pctRecuperacao)} recup. (D.11)
              </span>
            </div>
          )}
        </div>
      </header>
      <ul className="vg-comp-bars" aria-labelledby="vg-comp-titulo">
        {comValor.map((c) => (
          <li key={c.tela ?? c.categoria} className="vg-comp-bar-row">
            <TelaChip tela={c.tela} />
            <span className="vg-comp-bar-cat" title={c.categoria}>
              {c.categoria}
            </span>
            <div className="vg-comp-bar-track" aria-hidden>
              <div
                className="vg-comp-bar-fill"
                style={{ width: `${((c.valorRs ?? 0) / maxVal) * 100}%` }}
              />
            </div>
            <span className="vg-comp-bar-val">{fmtBRLfull(c.valorRs ?? 0)}</span>
            <span className="vg-comp-bar-pct">{fmtPct1(c.pctDoTotal)}</span>
          </li>
        ))}
      </ul>
      {zeradas.length > 0 && (
        <p className="vg-comp-zeros">
          Sem desequilíbrio apurado:{" "}
          {zeradas.map((c) => `${c.tela ?? ""} ${c.categoria}`.trim()).join(" · ")}
        </p>
      )}
    </section>
  );
}

// ── Mini-charts logo abaixo dos blocos (Faturamento · Recursos · Prazo · Liberação) ───

function BlocoGraficosGrid({ bm, curvasC8 }: { bm: VgViewBm; curvasC8: CurvasC8 | null }) {
  return (
    <div className="vg-graficos">
      <MiniFaturamentoChart bm={bm} />
      <MiniRecursosChart bm={bm} />
      <MiniPrazoChart bm={bm} />
      <MiniLiberacaoChart c8={curvasC8} />
    </div>
  );
}

const fmtMiTick = (v: number) =>
  v >= 1000
    ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} bi`
    : `${Math.round(v)}`;

function MiniFaturamentoChart({ bm }: { bm: VgViewBm }) {
  const f = bm.faturamento;
  // contratado + real (até o corte) + projeção (do corte em diante · só quando há forecast real;
  // null no workbook-motor, então a linha tracejada não aparece — sem platô enganoso).
  const dados = f.curvaS.map((p) => ({
    bm: p.bm.replace("BM-", ""),
    contratado: p.contratado,
    real: p.real,
    projecao: p.projecao,
  }));
  const temProjecao = dados.some((d) => d.projecao != null);
  // BM corrente = último ponto com real medido (o "onde estamos"): marca a posição + valor do real.
  const ultimoReal = [...dados].reverse().find((d) => d.real != null) ?? null;
  const corte = ultimoReal?.bm ?? null;
  const realEnd = ultimoReal?.real ?? null;
  // Eixo X: ~6 ticks distribuídos (46 meses espremidos viram um borrão ilegível) + sempre o último.
  const xticks = (() => {
    if (dados.length === 0) return [] as string[];
    const step = Math.max(1, Math.ceil((dados.length - 1) / 5));
    const idx: number[] = [];
    for (let i = 0; i < dados.length; i += step) idx.push(i);
    if (idx[idx.length - 1] !== dados.length - 1) idx.push(dados.length - 1);
    return idx.map((i) => dados[i].bm);
  })();
  return (
    <article className="vg-grafico">
      <header className="vg-grafico-head">
        <span className="vg-grafico-titulo">Curva de Faturamento</span>
        <span className="vg-grafico-sub">
          acumulado contratado × real{temProjecao ? " × projeção" : ""} (R$ mi)
          {corte ? ` · BM atual ${corte}` : ""}
        </span>
      </header>
      <div className="vg-grafico-canvas">
        <ResponsiveContainer width="100%" height={150}>
          <ComposedChart data={dados} margin={{ top: 8, right: 18, bottom: 2, left: 2 }}>
            <defs>
              <linearGradient id="vgFatGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--text-2)" stopOpacity={0.16} />
                <stop offset="100%" stopColor="var(--text-2)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 4" />
            <XAxis
              dataKey="bm"
              ticks={xticks}
              tick={{ fill: "var(--text-3)", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              interval={0}
              tickMargin={6}
            />
            <YAxis
              width={34}
              tick={{ fill: "var(--text-3)", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              tickCount={4}
              tickFormatter={fmtMiTick}
            />
            <Tooltip
              content={
                <ChartTooltip
                  prefixo="R$"
                  unidade="mi"
                  casas={1}
                  titulo={(label) => label ?? null}
                />
              }
            />
            {corte != null && (
              <ReferenceLine x={corte} stroke="var(--border-strong)" strokeDasharray="3 3" />
            )}
            <Area
              type="monotone"
              dataKey="contratado"
              name="Contratado"
              stroke="var(--text-2)"
              strokeWidth={1.75}
              fill="url(#vgFatGrad)"
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="real"
              name="Real"
              stroke={CHART_SERIE_COR.real}
              strokeWidth={2.5}
              dot={{ r: 2, fill: CHART_SERIE_COR.real, strokeWidth: 0 }}
              connectNulls={false}
              isAnimationActive={false}
            />
            {temProjecao && (
              <Line
                type="monotone"
                dataKey="projecao"
                name="Projeção"
                stroke={CHART_SERIE_COR.real}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            )}
            {corte != null && realEnd != null && (
              <ReferenceDot
                x={corte}
                y={realEnd}
                r={4}
                fill={CHART_SERIE_COR.real}
                stroke="var(--surface)"
                strokeWidth={2}
                isFront
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <footer className="vg-grafico-foot">
        <span className="vg-grafico-foot-pill vg-grafico-foot-pill-c">Contratado</span>
        <span className="vg-grafico-foot-pill vg-grafico-foot-pill-r">Real</span>
        {temProjecao && (
          <span className="vg-grafico-foot-pill vg-grafico-foot-pill-p">Projeção</span>
        )}
        {/* GAP colorido pelo farol OFICIAL do bridge (mesma régua do card Faturamento acima) —
            nunca danger fixo. Sem farol → tom neutro (fallback do CSS var). */}
        <span
          className="vg-grafico-foot-gap"
          style={
            f.aderenciaFarol
              ? ({ "--farol": FAROL_COLOR[f.aderenciaFarol] } as CSSProperties)
              : undefined
          }
        >
          GAP{" "}
          <strong>
            {f.desvioAcumuladoPct != null
              ? `${f.desvioAcumuladoPct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
              : "—"}
          </strong>
        </span>
        {f.aderenciaAcumuladoPct != null && (
          <span className="vg-grafico-foot-meta">
            aderência{" "}
            {f.aderenciaAcumuladoPct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
          </span>
        )}
      </footer>
    </article>
  );
}

function MiniRecursosChart({ bm }: { bm: VgViewBm }) {
  const grupos = (["MOI", "MOD", "EQP"] as const).map((tipo) => {
    const g = bm.recursos.porGrupo[tipo];
    const ult = g.curvaAcumulada[g.curvaAcumulada.length - 1];
    return {
      tipo,
      unidade: g.unidade,
      contratado: ult?.contratado ?? 0,
      real: ult?.real ?? 0,
    };
  });
  const unidades = Object.fromEntries(grupos.map((g) => [g.tipo, g.unidade]));
  // Cor por intenção: Real em brand; danger SÓ no grupo que estourou o contratado (farol de
  // verdade via <Cell> condicional — nunca vermelho fixo em série "Real").
  const temEstouro = grupos.some((g) => g.real > g.contratado);
  return (
    <article className="vg-grafico">
      <header className="vg-grafico-head">
        <span className="vg-grafico-titulo">Alocação de Recursos</span>
        <span className="vg-grafico-sub">contratado × real acumulado até o BM · por grupo</span>
      </header>
      <div className="vg-grafico-canvas">
        <ResponsiveContainer width="100%" height={120}>
          <BarChart
            data={grupos}
            layout="vertical"
            margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
            barCategoryGap="18%"
            barGap={2}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="tipo"
              tick={{ fill: "var(--text-3)", fontSize: 10, fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip
              content={
                <ChartTooltip
                  casas={0}
                  titulo={(label) =>
                    label != null ? `${label} · acumulado (${unidades[String(label)] ?? ""})` : null
                  }
                />
              }
            />
            <Bar
              dataKey="contratado"
              name="Contratado"
              fill="var(--text-2)"
              radius={[0, 3, 3, 0]}
            />
            <Bar dataKey="real" name="Real" fill={CHART_SERIE_COR.real} radius={[0, 3, 3, 0]}>
              {grupos.map((g) => (
                <Cell
                  key={g.tipo}
                  fill={g.real > g.contratado ? "var(--danger)" : CHART_SERIE_COR.real}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <footer className="vg-grafico-foot">
        <span className="vg-grafico-foot-pill vg-grafico-foot-pill-c">Contratado</span>
        <span
          className={`vg-grafico-foot-pill ${temEstouro ? "vg-grafico-foot-pill-d" : "vg-grafico-foot-pill-r"}`}
        >
          Real
        </span>
        <span className="vg-grafico-foot-meta">MOI · MOD · EQP</span>
      </footer>
    </article>
  );
}

function MiniPrazoChart({ bm }: { bm: VgViewBm }) {
  const p = bm.prazo;
  const dados = [
    { name: "Decorrido", value: p.decorridoDias, fill: "var(--brand)" },
    { name: "Restante", value: Math.max(p.restantesDias, 0), fill: "var(--surface-2)" },
  ];
  const fmt1 = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  // O "Desvio" do título = tempo consumido vs avanço real do contrato (físico-financeiro).
  const avancoReal = bm.faturamentoPct;
  return (
    <article className="vg-grafico">
      <header className="vg-grafico-head">
        <span className="vg-grafico-titulo">Prazo Contratual e Desvio</span>
        <span className="vg-grafico-sub">{p.prazoContratualDias} dias contratuais</span>
      </header>
      <div
        className="vg-grafico-canvas vg-grafico-canvas-donut"
        role="img"
        aria-label={`Prazo: ${fmt1(p.decorridoPct)}% decorrido — ${p.decorridoDias} de ${p.prazoContratualDias} dias`}
      >
        <ResponsiveContainer width="100%" height={120}>
          <PieChart>
            <Pie
              data={dados}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={32}
              outerRadius={50}
              startAngle={90}
              endAngle={-270}
              stroke="none"
            >
              {dados.map((d) => (
                <Cell key={d.name} fill={d.fill} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="vg-grafico-donut-center">
          <span className="vg-grafico-donut-pct">
            {p.decorridoPct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
          </span>
          <span className="vg-grafico-donut-label">decorrido</span>
        </div>
      </div>
      <footer className="vg-grafico-foot">
        <span className="vg-grafico-foot-pill vg-grafico-foot-pill-r">
          {p.decorridoDias} d decorridos
        </span>
        <span className="vg-grafico-foot-pill vg-grafico-foot-pill-c">
          {Math.max(p.restantesDias, 0)} d restantes
        </span>
        {avancoReal != null && (
          <span className="vg-grafico-foot-meta">
            avanço real {fmt1(avancoReal)}% vs {fmt1(p.decorridoPct)}% do prazo
          </span>
        )}
      </footer>
    </article>
  );
}

// ── Liberação de frentes (C.8 · só o confiável: liberado/executado vs contratado · sem capacidade) ──
function MiniLiberacaoChart({ c8 }: { c8: CurvasC8 | null }) {
  if (!c8 || c8.liberacaoPct == null) {
    return (
      <article className="vg-grafico">
        <header className="vg-grafico-head">
          <span className="vg-grafico-titulo">Liberação de Frentes</span>
          <span className="vg-grafico-sub">C.8 · liberado × executado vs contratado</span>
        </header>
        <div className="vg-grafico-pendente">Pendente — curvas C.8 não normalizadas.</div>
      </article>
    );
  }
  const lib = Math.round(c8.liberacaoPct);
  const exec = c8.alocadoPct != null ? Math.round(c8.alocadoPct) : null;
  const dadosLib = [
    { name: "Liberado", value: lib, fill: "var(--success)" },
    { name: "A liberar", value: Math.max(100 - lib, 0), fill: "var(--surface-2)" },
  ];
  // Anel interno = executado (brand): o cruzamento liberado×executado que o subtítulo promete —
  // a "tesoura" (frente liberada sem produção) aparece como diferença entre os dois anéis.
  const dadosExec =
    exec != null
      ? [
          { name: "Executado", value: exec, fill: "var(--brand)" },
          { name: "A executar", value: Math.max(100 - exec, 0), fill: "var(--surface-2)" },
        ]
      : null;
  return (
    <article className="vg-grafico">
      <header className="vg-grafico-head">
        <span className="vg-grafico-titulo">Liberação de Frentes</span>
        <span className="vg-grafico-sub">
          C.8 · liberado (anel externo) × executado (interno) vs contratado
        </span>
      </header>
      <div
        className="vg-grafico-canvas vg-grafico-canvas-donut"
        role="img"
        aria-label={`Liberação de frentes: ${lib}% liberado${exec != null ? `, ${exec}% executado` : ""}`}
      >
        <ResponsiveContainer width="100%" height={120}>
          <PieChart>
            <Pie
              data={dadosLib}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={50}
              startAngle={90}
              endAngle={-270}
              stroke="none"
            >
              {dadosLib.map((d) => (
                <Cell key={d.name} fill={d.fill} />
              ))}
            </Pie>
            {dadosExec && (
              <Pie
                data={dadosExec}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={31}
                outerRadius={37}
                startAngle={90}
                endAngle={-270}
                stroke="none"
              >
                {dadosExec.map((d) => (
                  <Cell key={d.name} fill={d.fill} />
                ))}
              </Pie>
            )}
          </PieChart>
        </ResponsiveContainer>
        <div className="vg-grafico-donut-center">
          <span className="vg-grafico-donut-pct">{lib}%</span>
          <span className="vg-grafico-donut-label">liberado</span>
        </div>
      </div>
      <footer className="vg-grafico-foot">
        <span className="vg-grafico-foot-pill vg-grafico-foot-pill-ok">{lib}% liberado</span>
        {exec != null && (
          <span className="vg-grafico-foot-pill vg-grafico-foot-pill-r">{exec}% executado</span>
        )}
        {c8.maiorGapRs != null && (
          <span className="vg-grafico-foot-meta">maior gap {fmtBRLmi(c8.maiorGapRs)}</span>
        )}
      </footer>
    </article>
  );
}

// ── Marcos & Ações (C.5 marcos + C.11 condutas) ────────────────────────────
// Farol do marco DERIVADO (data-limite × corte + %) pelo helper compartilhado — a coluna `farol` baked
// é não-confiável (parte clusters). Mesma fonte/rótulo/tom da C.5 Prazo e da C.2 Indicadores.
const MARCO_STATUS_TONE: Record<MarcoStatus, "success" | "warning" | "danger" | "info"> = {
  cumprido: "info",
  atrasado: "danger",
  "em-risco": "warning",
  "no-prazo": "success",
  pendente: "info",
};
const MARCO_RISK_RANK: Record<MarcoStatus, number> = {
  atrasado: 0,
  "em-risco": 1,
  pendente: 2,
  "no-prazo": 3,
  cumprido: 4,
};
function prioTone(p: string | null): "danger" | "warning" | "info" | "neutral" {
  const x = (p ?? "").toLowerCase();
  if (x.includes("urgente")) return "danger";
  if (x.includes("import")) return "warning";
  if (x.includes("prevent")) return "info";
  return "neutral";
}

const MARCOS_VISIVEIS = 8;
const CONDUTAS_VISIVEIS = 6;

/** Marcos com status derivado (data-limite × corte + %) + sort por criticidade → data.
 *  Compartilhado entre a tab e o contador do label das sub-tabs (mesma régua nos dois). */
function marcosComStatus(marcos: PrazoMarco[], corteISO: string | null) {
  const comStatus = marcos.map((m) => ({
    m,
    status: statusMarco(m.dataLimite, corteISO, m.pctConcluido),
  }));
  comStatus.sort((a, b) => {
    const r = MARCO_RISK_RANK[a.status] - MARCO_RISK_RANK[b.status];
    if (r !== 0) return r;
    if (a.m.dataLimite && b.m.dataLimite) return a.m.dataLimite < b.m.dataLimite ? -1 : 1;
    return a.m.ordem - b.m.ordem;
  });
  const emRisco = comStatus.filter(
    (x) => x.status === "em-risco" || x.status === "atrasado",
  ).length;
  return { comStatus, emRisco };
}

const PRIO_RANK: Record<ReturnType<typeof prioTone>, number> = {
  danger: 0,
  warning: 1,
  info: 2,
  neutral: 3,
};

/** Condutas priorizadas (urgente → importante → preventiva → resto; empate = ordem do workbook). */
function condutasPriorizadas(condutas: Conduta[]) {
  const ordenadas = [...condutas].sort((a, b) => {
    const r = PRIO_RANK[prioTone(a.prioridade)] - PRIO_RANK[prioTone(b.prioridade)];
    if (r !== 0) return r;
    return a.ordem - b.ordem;
  });
  const nUrgentes = ordenadas.filter((c) => prioTone(c.prioridade) === "danger").length;
  return { ordenadas, nUrgentes };
}

function MarcosAcoesTab({
  marcos,
  condutas,
  corteISO,
}: {
  marcos: PrazoMarco[];
  condutas: Conduta[];
  corteISO: string | null;
}) {
  const { contractId } = Route.useParams();
  // status derivado por marco + ordena por criticidade (atrasado→em-risco→…) e depois por data.
  const { comStatus, emRisco } = marcosComStatus(marcos, corteISO);
  const lista = comStatus.slice(0, MARCOS_VISIVEIS);
  const ocultos = comStatus.length - lista.length;
  // condutas espelham o padrão premium dos marcos: sort por prioridade + cap + "Mostrando X de Y".
  const { ordenadas: condutasOrd, nUrgentes } = condutasPriorizadas(condutas);
  const listaCondutas = condutasOrd.slice(0, CONDUTAS_VISIVEIS);
  const condutasOcultas = condutasOrd.length - listaCondutas.length;
  return (
    <div className="vg-ee">
      <div className="vg-ee-block">
        <h4 className="vg-subhead">
          Próximos Marcos Contratuais
          <span className="vg-subhead-sub">
            {" "}
            · {marcos.length} marcos · {emRisco} em risco · C.5
          </span>
        </h4>
        {lista.length > 0 ? (
          <>
            <ul className="vg-marcos">
              {lista.map(({ m, status }) => (
                <li key={m.ordem} className="vg-marco">
                  <span className="vg-marco-data">
                    {m.dataLimite ? fmtDate(m.dataLimite) : "s/ prazo"}
                  </span>
                  <div className="vg-marco-text">
                    <div className="vg-marco-titulo">
                      {m.categoria ?? "—"}
                      {m.trecho ? <span className="vg-marco-trecho"> · {m.trecho}</span> : null}
                    </div>
                    <div className="vg-marco-meta">
                      {m.pctConcluido != null
                        ? `${Math.round(m.pctConcluido)}% concluído` /* 0–100, convenção statusMarco/C.5 */
                        : "% concluído por BM (pendente)"}
                    </div>
                  </div>
                  <Badge tone={MARCO_STATUS_TONE[status]}>{MARCO_STATUS_LABEL[status]}</Badge>
                </li>
              ))}
            </ul>
            {ocultos > 0 && (
              <p className="vg-marcos-mais">
                Mostrando {lista.length} de {marcos.length} — priorizando os de maior risco. Veja
                todos na aba{" "}
                <Link
                  to="/contracts/$contractId/rma/prazo"
                  params={{ contractId }}
                  className="vg-marcos-link"
                >
                  Prazo
                </Link>
                .
              </p>
            )}
          </>
        ) : (
          <EmptyState
            title="Marcos contratuais pendentes"
            text="Esta obra ainda não tem marcos contratuais (C.5) normalizados no banco."
          />
        )}
      </div>

      <div className="vg-ee-block">
        <h4 className="vg-subhead">
          Condutas Recomendadas
          <span className="vg-subhead-sub">
            {" "}
            · {condutas.length} condutas · {nUrgentes} {nUrgentes === 1 ? "urgente" : "urgentes"} ·
            Adm Contratual IA (C.11)
          </span>
        </h4>
        {listaCondutas.length > 0 ? (
          <>
            <ul className="vg-condutas">
              {listaCondutas.map((c) => (
                <li key={c.ordem} className="vg-conduta">
                  <Badge tone={prioTone(c.prioridade)}>{c.prioridade ?? "—"}</Badge>
                  <div className="vg-conduta-text">
                    <div className="vg-conduta-gatilho">{c.gatilho}</div>
                    <div className="vg-conduta-meta">
                      {[c.categoria, c.clausula, c.documento].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  {c.status && (
                    <Badge tone="neutral" className="vg-conduta-status">
                      {c.status}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
            {condutasOcultas > 0 && (
              <p className="vg-marcos-mais">
                Mostrando {listaCondutas.length} de {condutas.length} — priorizando urgentes. Veja
                todas na aba{" "}
                <Link
                  to="/contracts/$contractId/rma/condutas"
                  params={{ contractId }}
                  className="vg-marcos-link"
                >
                  Condutas
                </Link>
                .
              </p>
            )}
          </>
        ) : (
          <EmptyState
            title="Sem condutas recomendadas"
            text="O Adm Contratual IA não registrou condutas (C.11) para este BM."
          />
        )}
      </div>
    </div>
  );
}

// ── Síntese Resumida ─────────────────────────────────────────────────

function SinteseTab({ sintese }: { sintese: VgViewMeta["sinteseResumida"] }) {
  return (
    <>
      <p className="vg-subcap">Compartilhada com M4 Check-list · indexada para busca</p>
      <dl className="vg-sintese-grid">
        <SinteseRow label="Cliente" value={sintese.cliente} />
        <SinteseRow label="Modalidade" value={sintese.modalidade} />
        <SinteseRow label="Valor contratado" value={sintese.valorContratado} />
        <SinteseRow label="Saldo a faturar" value={sintese.saldoFaturar} />
        <SinteseRow label="Assinatura" value={fmtDate(sintese.assinaturaISO)} />
        <SinteseRow label="Término previsto" value={fmtDate(sintese.terminoPrevistoISO)} />
        <SinteseRow label="Prazo decorrido" value={sintese.prazoLabel} />
        <SinteseRow label="Reajuste" value={sintese.reajuste} />
        <SinteseRow label="Gestor da obra" value={sintese.gestorObra} />
        <SinteseRow label="Adm contratual" value={sintese.admContratual} />
        <SinteseRow
          label="Documentos indexados"
          value={sintese.documentosIndexados != null ? `${sintese.documentosIndexados} itens` : "—"}
        />
        <SinteseRow
          label="TACs"
          value={
            sintese.tacsEmNegociacao == null
              ? "— (não indexado)"
              : sintese.tacsEmNegociacao > 0
                ? `${sintese.tacsEmNegociacao} em negociação`
                : "nenhum em negociação"
          }
        />
      </dl>
    </>
  );
}

function SinteseRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="vg-sintese-row">
      <dt className="vg-sintese-label">{label}:</dt>
      <dd className="vg-sintese-value">{value}</dd>
    </div>
  );
}

// ── Últimos Eventos ──────────────────────────────────────────────────

function EventosEntregaveisTab({
  eventos,
  bm,
  entregaveis,
}: {
  eventos: EventoIA[];
  bm: VgViewBm;
  entregaveis: EntregavelAtalho[];
}) {
  return (
    <div className="vg-ee">
      <div className="vg-ee-block">
        <h4 className="vg-subhead">
          Últimos Eventos Detectados pela IA
          <span className="vg-subhead-sub"> · Alertas do {bm.numero}</span>
        </h4>
        {eventos.length > 0 ? (
          <ul className="vg-eventos">
            {eventos.map((e) => (
              <li key={e.id} className="vg-evento">
                {/* Farol canônico: Badge + helpers farolToBadge/farolLabel — sem mapa duplicado. */}
                <Badge tone={farolToBadge[e.nivel]} className="vg-evento-badge">
                  {farolLabel[e.nivel]}
                </Badge>
                <div className="vg-evento-text">
                  <div className="vg-evento-titulo">{e.titulo}</div>
                  <div className="vg-evento-meta">{e.meta}</div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Detecção de eventos pendente"
            text="O Adm Contratual IA ainda não analisou este BM em busca de eventos. Sem dado normalizado, esta área não pode ser lida como monitorada."
            hint="Aguardando camada de IA (§7)"
          />
        )}
      </div>

      <div className="vg-ee-block">
        <h4 className="vg-subhead">
          Entregáveis · Atalhos
          {entregaveis.length > 0 ? (
            <span className="vg-subhead-sub"> · gerar com 1 clique do estado atual</span>
          ) : null}
        </h4>
        {entregaveis.length > 0 ? (
          <div className="vg-entregaveis-grid">
            {entregaveis.map((e) => (
              <article key={e.id} className="vg-entregavel">
                <div className="vg-entregavel-label">{e.label}</div>
                <div className="vg-entregavel-acao">
                  <span className="vg-entregavel-icon" aria-hidden>
                    {I[e.icon]({ size: 14 })}
                  </span>
                  <span className="vg-entregavel-acao-text">{e.acao}</span>
                </div>
                <div className="vg-entregavel-desc">{e.descricao}</div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Geração de entregáveis pendente"
            text="A geração de RMA/claims/cartas a partir do estado do contrato entra com os agentes de IA (fase final). Sem atalhos disponíveis neste BM."
          />
        )}
      </div>
    </div>
  );
}
