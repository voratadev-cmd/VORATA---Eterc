// Aba "Faturamento" (RMA · C.3) — PÁGINA ÚNICA (caderno do idealizador, jun/2026): header (título +
// eco do farol oficial + RmaParamBar) → Deck 1 (6 cards de acumulado) → grid [Curva S | Resumo BM a
// BM] → Deck 2 (farol HERÓI + 5 cards de período/projeção + alerta) → drill Disciplina × Frente
// (toggle + coleção) → análise IA. Substitui as antigas sub-tabs por um scroll único. FAROL OFICIAL =
// ADERÊNCIA acum. (90/85/70); a C.2 (Indicadores) segue com o desvio em p.p. — distintas de propósito.

import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  ErroCard,
  Badge,
  Button,
  CHART_SERIE_COR,
  ChartLegend,
  type ChartLegendItem,
  ChartTooltip,
  EmptyState,
  FarolCard,
  I,
  Segmented,
  Select,
  Skeleton,
  TrendIndicator,
  type TrendDirection,
} from "@/components/ds";
import { ChevronDown, ChevronRight } from "lucide-react";
import { RmaParamBar } from "@/components/RmaParamBar/RmaParamBar";
import { ColPag, ColToolbar, ColVazio, normTxt, useColecao } from "@/lib/rma/colecao";
import { type BmSnapshot, type FaturamentoBM, type PeriodoFat } from "@/lib/mocks/obras";
import { farolLabel, farolToBadge, type FarolLevel } from "@/lib/mocks/contracts";
import { classificarPorRegra, type FarolRegra } from "@/lib/rma/farol";
import { useFaturamentoBm } from "@/lib/hooks/useFaturamentoBm";
import { useRmaCorte } from "@/lib/hooks/useRmaCorte";
import { useFaturamentoDisciplinaResumo } from "@/lib/hooks/useFaturamentoDisciplinaResumo";
import { useFaturamentoFrenteMacro } from "@/lib/hooks/useFaturamentoFrenteMacro";
import { useFaturamentoSerieMes } from "@/lib/hooks/useFaturamentoSerieMes";
import { useFaturamentoCruzamento } from "@/lib/hooks/useFaturamentoCruzamento";
import type { CruzItem } from "@/lib/supabase/faturamentoCruzamento";
import "./faturamento.css";

export const Route = createFileRoute("/_app/contracts/$contractId/rma/faturamento")({
  component: FaturamentoAba,
});

function FaturamentoAba() {
  const { contractId } = Route.useParams();
  // Override do seletor de período (?bm) — ausente = comportamento de hoje (corte = último mês medido).
  const { data, isLoading, isError, refetch } = useFaturamentoBm(contractId, useRmaCorte());

  return (
    <main className="fat-main">
      <FatHeader fat={data?.fat} bmLabel={data?.bmLabel} />
      {isLoading ? (
        <FatSkeleton />
      ) : isError ? (
        <ErroCard
          titulo="Não foi possível carregar o faturamento"
          mensagem="Erro ao ler os dados normalizados desta obra."
          onRetry={() => void refetch()}
        />
      ) : !data ? (
        <EmptyState
          framed
          title="Faturamento ainda não normalizado"
          text="Esta obra não tem medições (BM) normalizadas no banco ainda."
          hint="Aguardando normalização da Curva S"
        />
      ) : (
        <FatConteudo
          fat={data.fat}
          bmLabel={data.bmLabel}
          contractId={contractId}
          regras={data.regras}
        />
      )}
    </main>
  );
}

// Página única (sem sub-tabs): header c/ RmaParamBar + Deck 1 + grid curva/resumo + Deck 2 (farol herói) + drill + IA.
function FatConteudo({
  fat,
  bmLabel,
  contractId,
  regras,
}: {
  fat: FaturamentoBM;
  bmLabel: string;
  contractId: string;
  regras?: Record<string, FarolRegra>;
}) {
  const bm = { numero: bmLabel };
  return (
    <>
      <FatKpis fat={fat} bm={bm} />
      <div className="fat-grow">
        <CurvaSCard fat={fat} bm={bm} contractId={contractId} />
        <ResumoBmCard curvaS={fat.curvaS} bmLabel={bmLabel} regras={regras} />
      </div>
      {fat.periodo && <FatProjecaoDeck periodo={fat.periodo} fat={fat} bmLabel={bmLabel} />}
      <DrillSection contractId={contractId} regras={regras} />
      <AnaliseTextualCard texto={fat.analiseTextual} />
    </>
  );
}

// Skeleton com a FORMA da página (regra nº4): 6 KPIs → grid [curva | resumo] → deck de 6 → drill.
function FatSkeleton() {
  return (
    <div style={{ display: "grid", gap: "var(--s-4)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "var(--s-3)" }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} style={{ height: 88 }} />
        ))}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.9fr) minmax(0, 1fr)",
          gap: "var(--s-4)",
        }}
      >
        <Skeleton style={{ height: 340 }} />
        <Skeleton style={{ height: 340 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "var(--s-3)" }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} style={{ height: 72 }} />
        ))}
      </div>
      <Skeleton style={{ height: 360 }} />
    </div>
  );
}

// ── Header local (título + eco do farol oficial + barra de parâmetros) ─
// O farol oficial da tela (aderência acum.) ecoa AO LADO do título — o veredito aparece no primeiro
// pixel, sem esperar o scroll até o deck de projeção. Badge canônico puro (sem glifo "●").
// A barra de parâmetros (BM corrente · Data de corte · Horizonte) usa o RmaParamBar compartilhado
// no slot direito (mesmo padrão da C.2), em vez da fat-param-bar bespoke.

function FatHeader({ fat, bmLabel }: { fat?: FaturamentoBM; bmLabel?: string }) {
  // O seletor de visão "Apenas serviços" (toggle de escopo Todo×Serviços, col E) e o Exportar ficam
  // p/ a Onda C: a col E "Previsto usado" ainda não é normalizada — repor o toggle sem ela seria
  // afordância morta (a curva usa só "Previsto Todo"). Volta quando o Excel-padrão trouxer a col E.
  const farol = fat?.aderenciaFarol;
  const bmNum = fat?.periodo?.bmCorrente;
  return (
    <header className="fat-head">
      <div>
        <div className="fat-titulo-row">
          <h2 className="fat-titulo">Faturamento</h2>
          {farol ? (
            <span className="fat-titulo-farol">
              <Badge tone={farolToBadge[farol]}>{farolLabel[farol]}</Badge>
              {fat?.aderenciaAcumuladoPct != null ? (
                <span className="fat-titulo-farol-sub">
                  aderência acum.{" "}
                  {fat.aderenciaAcumuladoPct.toLocaleString("pt-BR", {
                    maximumFractionDigits: 1,
                  })}
                  %
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
        <p className="fat-sub">
          Curva S contratada × realizada · aderência acumulada · análise por disciplina e
          frente/local
        </p>
      </div>
      {fat && bmLabel ? (
        <RmaParamBar
          items={[
            { label: "BM corrente", valor: bmNum != null ? `BM ${bmNum}` : bmLabel },
            { label: "Data de corte", valor: bmLabel },
            { label: "Horizonte", valor: `${fat.curvaS.length} BMs` },
          ]}
        />
      ) : null}
    </header>
  );
}

// ── Deck 1 · 6 KPIs de acumulado (E2) ────────────────────────────────
// Magnitudes (neutros): Contratado Total/Acum, Real Acum, Saldo, % Total Executado. O farol oficial
// (aderência) vive no Deck 2. EXCEÇÃO: o Desvio Acum. ganha um indicador de DIREÇÃO (↓ atrás · ↑ à
// frente · – em linha) — sinal de tendência, não o farol de criticidade.

// desvio % → estado (banda de ±2 p.p. = "estável"; abaixo = atrás/negativo; acima = à frente/bom).
function desvioEstado(pct: number | null): { dir: TrendDirection; label: string } | null {
  if (pct == null) return null;
  if (pct <= -2) return { dir: "down", label: "atrás do previsto" };
  if (pct >= 2) return { dir: "up", label: "à frente do previsto" };
  return { dir: "flat", label: "em linha com o previsto" };
}

function FatKpis({ fat, bm }: { fat: BmSnapshot["faturamento"]; bm: { numero: string } }) {
  const desv = desvioEstado(fat.desvioAcumuladoPct);
  // Ícones em chip (padrão canônico de KPI) — mesma família do deck de projeção; accent neutro.
  return (
    <div className="fat-kpis">
      <FarolCard
        icon="doc"
        label="CONTRATADO TOTAL"
        value={fat.contratadoTotalLabel}
        info={fat.contratadoTotalNota}
        accent="neutral"
      />
      <FarolCard
        icon="calendar"
        label={`CONTRATADO ACUM. ATÉ ${bm.numero}`}
        value={fat.contratadoAcumuladoLabel}
        info={fat.contratadoAcumuladoNota}
        accent="neutral"
      />
      <FarolCard
        icon="wallet"
        label={`REAL ACUM. ATÉ ${bm.numero}`}
        value={fat.realAcumuladoLabel}
        info={fat.realAcumuladoNota}
        accent="neutral"
      />
      <FarolCard
        icon="trending"
        label="DESVIO ACUMULADO"
        value={
          fat.desvioAcumuladoPct != null
            ? `${fat.desvioAcumuladoPct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
            : "—"
        }
        info={
          desv ? (
            <>
              <TrendIndicator direction={desv.dir}>{desv.label}</TrendIndicator>
              {fat.desvioValorLabel ? ` · ${fat.desvioValorLabel}` : ""}
            </>
          ) : (
            fat.desvioValorLabel
          )
        }
        accent="neutral"
      />
      <FarolCard
        icon="clock"
        label="SALDO A FATURAR"
        value={fat.saldoFaturarLabel}
        info={
          fat.saldoFaturarPct != null
            ? `${fat.saldoFaturarPct.toLocaleString("pt-BR")}% · ${fat.saldoFaturarBmsRestantes} meses restantes`
            : "pendente — sem valor contratado total"
        }
        accent="neutral"
      />
      <FarolCard
        icon="check"
        label="% TOTAL EXECUTADO"
        value={
          fat.totalExecutadoPct != null
            ? `${fat.totalExecutadoPct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`
            : "—"
        }
        info="real acum. ÷ contratado total"
        accent="neutral"
      />
    </div>
  );
}

// ── Deck 2 · 6 cards de período/projeção (E6) + alerta ───────────────
// FAROL aderência acum. (o farol oficial da tela, rotulado "até o BM N" p/ não ser lido como a obra
// inteira) abre o deck em posição de HERÓI (fundo/borda tingidos pelo tom — nunca tarja) · depois
// Faturado/Previsto do mês + Aderência do período (magnitudes) · Ritmo · Projeção POR RITMO
// (financeiro — NÃO Earned Schedule físico; não há série física). Δ no sub da projeção (cor do sinal).

/** Meses com 1 casa. `signed`: prefixa +/− (Δ). `pendente`: "— pendente" no null. */
function fmtMeses(n: number | null, opts?: { signed?: boolean; pendente?: boolean }): string {
  if (n == null) return opts?.pendente ? "— pendente" : "—";
  const unidade = Math.abs(n) === 1 ? "mês" : "meses";
  const sign = opts?.signed ? (n > 0 ? "+" : n < 0 ? "−" : "") : "";
  const abs = Math.abs(n).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return `${sign}${abs} ${unidade}`;
}

const MESES_CURTOS = [
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
];

/** Competência do "mês N" da curva ("mês 47" → "abr/2030"): soma N−1 meses ao rótulo do 1º ponto
 *  ("mai/26" etc.). Parse falhou → null e o chamador mantém só "mês N" — nunca fabrica data. */
function competenciaDoMesN(curvaS: CurvaPonto[], mesN: number): string | null {
  const m = /^([a-z]{3})\/(\d{2})$/.exec(curvaS[0]?.bm ?? "");
  if (!m) return null;
  const m0 = MESES_CURTOS.indexOf(m[1]);
  if (m0 < 0) return null;
  const total = m0 + (mesN - 1);
  if (total < 0) return null;
  const ano = 2000 + Number(m[2]) + Math.floor(total / 12);
  return `${MESES_CURTOS[total % 12]}/${ano}`;
}

function FatProjecaoDeck({
  periodo,
  fat,
  bmLabel,
}: {
  periodo: PeriodoFat;
  fat: FaturamentoBM;
  bmLabel: string;
}) {
  const delta = periodo.deltaProjecaoMeses;
  // Cor DERIVADA do sinal via token — NÃO um nível de farol fabricado: tinge o valor da projeção
  // (>0 estoura prazo = danger; <0 antecipa = success; 0/null = neutro), sem renderizar "Crítico".
  const deltaAccent = delta == null || delta === 0 ? "neutral" : delta > 0 ? "danger" : "success";
  const proj = periodo.projecaoTerminoMeses;
  const projMes = proj != null ? Math.round(proj) : null;
  // "mês 107" é abstrato — deriva a competência (~mmm/aaaa) dos rótulos da própria curva.
  const projComp = projMes != null ? competenciaDoMesN(fat.curvaS, projMes) : null;
  const aderPeriodo = periodo.aderenciaPeriodoPct;
  return (
    <>
      <div className="fat-proj-grid">
        <FarolCard
          size="sm"
          icon="flag"
          className="fat-farol-hero"
          label={`FAROL · ADERÊNCIA ACUM. ATÉ ${bmLabel}`}
          value={
            fat.aderenciaAcumuladoPct != null
              ? `${fat.aderenciaAcumuladoPct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
              : "—"
          }
          info="real ÷ previsto acum. (mesma base, até o corte) · o farol oficial da tela"
          farol={fat.aderenciaFarol}
        />
        <FarolCard
          size="sm"
          icon="wallet"
          label="FATURADO NO MÊS"
          value={periodo.faturadoMesLabel}
          info={`Real medido em ${bmLabel}`}
          accent="neutral"
        />
        <FarolCard
          size="sm"
          icon="calendar"
          label="PREVISTO P/ O MÊS"
          value={periodo.previstoMesLabel}
          info="Planejado (Previsto Todo) do mês"
          accent="neutral"
        />
        <FarolCard
          size="sm"
          icon="trending"
          label="ADERÊNCIA NO PERÍODO"
          value={
            aderPeriodo != null
              ? `${aderPeriodo.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
              : "—"
          }
          info="faturado ÷ previsto no mês"
          accent="neutral"
        />
        <FarolCard
          size="sm"
          icon="repeat"
          label="RITMO MÉDIO"
          value={periodo.ritmo3BmLabel}
          info="Faturado acumulado ÷ meses decorridos"
          accent="neutral"
        />
        <FarolCard
          size="sm"
          className="fat-delta-card"
          icon="clock"
          label="PROJEÇÃO POR RITMO"
          value={
            (periodo.projecaoTerminoMesLabel ?? projComp)
              ? `~${periodo.projecaoTerminoMesLabel ?? projComp}`
              : projMes != null
                ? `mês ${projMes.toLocaleString("pt-BR")}`
                : "— pendente"
          }
          info={
            projMes != null
              ? `mês ${projMes.toLocaleString("pt-BR")} da curva · ${fmtMeses(delta, { signed: true })} vs prazo · base financeira (não física)`
              : `${fmtMeses(delta, { signed: true })} vs prazo · base financeira (não física)`
          }
          accent={deltaAccent}
        />
      </div>
      {periodo.alertaProrrogacao && (
        <aside className="fat-proj-alerta">
          {I.flag({ size: 15 })}
          <span>Alerta de prorrogação — {periodo.alertaProrrogacao.toLowerCase()}</span>
        </aside>
      )}
    </>
  );
}

// ── Curva S (Recharts) ───────────────────────────────────────────────

/** Ponto da Curva S (já em R$ milhões). Tipo derivado do snapshot p/ tipar o tooltip sem `any`. */
type CurvaPonto = BmSnapshot["faturamento"]["curvaS"][number];

/** R$ em milhões (1 casa) — valores do gráfico já vêm em mi. null → "—". */
function fmtMiTip(v: number | null | undefined): string {
  return v != null ? `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi` : "—";
}

function CurvaSCard({
  fat,
  bm,
  contractId,
}: {
  fat: BmSnapshot["faturamento"];
  bm: { numero: string };
  contractId: string;
}) {
  // Select da curva: "Todos" (curva geral) OU uma disciplina/frente específica (série mensal própria).
  const serie = useFaturamentoSerieMes(contractId);
  const [recorte, setRecorte] = useState<"disciplina" | "frente">("disciplina");
  const [item, setItem] = useState("");
  const itens = (recorte === "disciplina" ? serie.data?.disciplina : serie.data?.frente) ?? [];
  const sel = item ? (itens.find((s) => s.item === item) ?? null) : null;
  // curva do item: previsto/real mensais (÷1e6 → mi, como a curva geral) + acumulados recompostos; o
  // real PÁRA no último mês medido (PENDENTE ≠ 0 → não estende a linha vermelha flat).
  const chartData = useMemo(() => {
    if (!sel) return fat.curvaS;
    const r2 = (v: number) => Math.round(v * 100) / 100;
    // o real da disciplina pára no último mês medido DELA, mas nunca passa do corte global escolhido
    // (?bm): corteIdx = último ponto da curvaS com real != null (o bridge já anula o real após o corte).
    const corteIdx = fat.curvaS.reduce((a, p, i) => (p.real != null ? i : a), -1);
    const ultRealCat = sel.celulas.reduce(
      (a, c, i) => (c.realRs != null && c.realRs > 0 ? i : a),
      -1,
    );
    const ultReal = corteIdx >= 0 ? Math.min(ultRealCat, corteIdx) : ultRealCat;
    let accP = 0;
    let accR = 0;
    return fat.curvaS.map((pt, i) => {
      const c = sel.celulas[i];
      const prev = c?.previstoRs ?? 0;
      const realV = c?.realRs ?? 0;
      accP += prev;
      const temReal = i <= ultReal;
      if (temReal) accR += realV;
      return {
        ...pt,
        previstoMes: r2(prev / 1e6),
        realMes: temReal && c?.realRs != null ? r2(realV / 1e6) : null,
        contratado: r2(accP / 1e6),
        real: temReal ? r2(accR / 1e6) : null,
        projecao: null,
      };
    });
  }, [sel, fat.curvaS]);
  const temProjecao = chartData.some((p) => p.projecao != null);
  const scope = sel
    ? `${recorte === "disciplina" ? "Disciplina" : "Frente"}: ${sel.item}`
    : "Todos (visão geral)";
  // Legenda com MAPA DE EIXOS: dois eixos em escalas ~60× diferentes (acumulado ~611mi × mensal
  // ~10mi) — cada série declara em qual eixo lê. Cores canônicas do ChartKit (Real = navy; danger
  // nunca é a cor fixa do Real).
  const legenda: ChartLegendItem[] = [
    { label: "Real acum. (eixo esq.)", tipo: "linha", cor: CHART_SERIE_COR.real },
    { label: "Prev. acum. (eixo esq.)", tipo: "tracejada", cor: CHART_SERIE_COR.contratado },
    ...(temProjecao
      ? [{ label: "Projeção (eixo esq.)", tipo: "tracejada", cor: CHART_SERIE_COR.real } as const]
      : []),
    {
      label: "Previsto (mês · eixo dir.)",
      tipo: "barra",
      cor: "color-mix(in srgb, var(--info) 40%, transparent)",
    },
    { label: "Real (mês · eixo dir.)", tipo: "barra", cor: CHART_SERIE_COR.real },
  ];
  return (
    <section className="fat-curvas-card">
      <header className="fat-section-head">
        <div>
          <h3 className="fat-section-title">
            Curva S · Contratado × Realizado <span className="fat-curva-scope">· {scope}</span>
          </h3>
          <div className="fat-section-sub">
            Gap entre contratado e real{temProjecao ? ` · projeção a partir do ${bm.numero}` : ""}
          </div>
        </div>
        <div className="fat-legend-wrap">
          <ChartLegend items={legenda} />
          <span className="fat-legend-hint">passe o mouse: aderência do mês + desvio acum.</span>
        </div>
      </header>

      <div className="fat-curva-ctrl">
        <Segmented<"disciplina" | "frente">
          value={recorte}
          onChange={(v) => {
            setRecorte(v);
            setItem("");
          }}
          aria-label="Recorte da curva: por disciplina ou por frente"
          items={[
            { value: "disciplina", label: "Por Disciplina" },
            { value: "frente", label: "Por Frente" },
          ]}
        />
        {/* ERRO ≠ AUSÊNCIA: enquanto a série carrega o Select diz "Carregando…"; se falhar, os 32
            recortes não somem em silêncio — nota de erro + retry (a curva geral segue de pé). */}
        <Select<string>
          value={item}
          onChange={setItem}
          disabled={serie.isLoading}
          aria-label="Item do recorte da curva"
          items={
            serie.isLoading
              ? [{ value: "", label: "Carregando recortes…" }]
              : [
                  { value: "", label: "Todos (visão geral)" },
                  ...itens.map((s) => ({ value: s.item, label: s.item })),
                ]
          }
        />
        {serie.isError ? (
          <span className="fat-curva-ctrl-erro" role="status">
            Recortes por disciplina/frente indisponíveis (erro de leitura, não pendência)
            <Button variant="ghost" size="sm" onClick={() => void serie.refetch()}>
              Tentar de novo
            </Button>
          </span>
        ) : null}
      </div>

      <div className="fat-chart">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData} margin={{ top: 20, right: 16, left: 10, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            {/* rótulos do eixo X: o Recharts afina pela largura (preserva início+fim e pula os que
                colidiriam) — com 46 meses um interval fixo empilhava "mar/26ai/26ul/26…". */}
            <XAxis
              dataKey="bm"
              tick={{ fontSize: 11, fill: "var(--text-3)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              interval="preserveStartEnd"
              minTickGap={28}
              tickMargin={8}
            />
            {/* eixo esquerdo: curvas ACUMULADAS (R$ ~600 mi) */}
            <YAxis
              yAxisId="acum"
              tick={{ fontSize: 11, fill: "var(--text-3)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `R$ ${v} mi`}
            />
            {/* eixo direito: barras MENSAIS (R$ ~10 mi) — escala própria p/ não sumirem sob o
                acumulado. Tick com unidade ("mi") — sem ela o eixo lia como número cru. */}
            <YAxis
              yAxisId="mes"
              orientation="right"
              tick={{ fontSize: 11, fill: "var(--text-4)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v} mi`}
            />
            {/* Tooltip do ChartKit; as métricas derivadas (aderência do mês + desvio acum.) entram
                na linha extra do título — nada do tooltip rico antigo se perde. */}
            <Tooltip
              cursor={{ fill: "var(--surface-2)", fillOpacity: 0.6 }}
              content={
                <ChartTooltip
                  formatter={(v: number) => fmtMiTip(v)}
                  nomes={{
                    contratado: "Prev. acum.",
                    real: "Real acum.",
                    projecao: "Projeção",
                    previstoMes: "Previsto (mês)",
                    realMes: "Real (mês)",
                  }}
                  titulo={(label, payload) => {
                    const p = payload?.[0]?.payload as CurvaPonto | undefined;
                    if (!p) return label;
                    const ad =
                      p.previstoMes != null && p.previstoMes > 0 && p.realMes != null
                        ? Math.round((p.realMes / p.previstoMes) * 100)
                        : null;
                    const dv =
                      p.contratado != null && p.contratado > 0 && p.real != null
                        ? Math.round((p.real / p.contratado - 1) * 100)
                        : null;
                    return (
                      <>
                        {label}
                        <span className="fat-tip-extra">
                          Aderência do mês {ad != null ? `${ad}%` : "—"} · Desvio acum.{" "}
                          {dv != null ? `${dv > 0 ? "+" : ""}${dv}%` : "—"}
                        </span>
                      </>
                    );
                  }}
                />
              }
            />
            <ReferenceLine
              yAxisId="acum"
              x={bm.numero}
              stroke="var(--text-3)"
              strokeDasharray="3 3"
              label={{
                value: "data de corte",
                position: "top",
                fontSize: 11,
                fill: "var(--text-3)",
              }}
            />
            {/* barras mensais (eixo direito) — convenção do ChartKit: Previsto = info claro, Real =
                navy (CHART_SERIE_COR.real). Desenhadas ANTES das linhas p/ ficarem ao fundo. */}
            <Bar
              yAxisId="mes"
              dataKey="previstoMes"
              name="Previsto (mês)"
              fill="var(--info)"
              fillOpacity={0.35}
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
            />
            <Bar
              yAxisId="mes"
              dataKey="realMes"
              name="Real (mês)"
              fill={CHART_SERIE_COR.real}
              fillOpacity={0.75}
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
            />
            {/* acumulados (eixo esquerdo): previsto = info tracejado (referência); real = navy sólido;
                projeção = tracejada na MESMA cor do real (danger nunca é a cor fixa do Real). */}
            <Line
              yAxisId="acum"
              type="monotone"
              dataKey="contratado"
              name="Prev. acum."
              stroke={CHART_SERIE_COR.contratado}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="acum"
              type="monotone"
              dataKey="real"
              name="Real acum."
              stroke={CHART_SERIE_COR.real}
              strokeWidth={2.5}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="acum"
              type="monotone"
              dataKey="projecao"
              name="Projeção"
              stroke={CHART_SERIE_COR.real}
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              connectNulls={true}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

// ── Resumo BM a BM (E5 · ao lado do gráfico) ─────────────────────────
// Todos os BMs do horizonte (scroll), BM corrente destacado. Previsto = "Previsto Todo" do mês; Real
// só até o corte (PENDENTE ≠ 0 → meses futuros em branco, não 0 fabricado); Aderência = real ÷ previsto.

function ResumoBmCard({
  curvaS,
  bmLabel,
  regras,
}: {
  curvaS: CurvaPonto[];
  bmLabel: string;
  regras?: Record<string, FarolRegra>;
}) {
  // TOTAL: Σ previsto (todos os BMs = PV) · Σ real medido · aderência = Σreal ÷ Σprevisto-até-o-corte
  // (o mesmo denominador do farol oficial, não Σreal÷PV — senão daria o "% executado", não a aderência).
  const totalPrev = curvaS.reduce((a, p) => a + (p.previstoMes ?? 0), 0);
  const totalReal = curvaS.reduce((a, p) => a + (p.realMes ?? 0), 0);
  const ultReal = curvaS.reduce((a, p, i) => (p.realMes != null && p.realMes > 0 ? i : a), -1);
  const prevCorte = curvaS.slice(0, ultReal + 1).reduce((a, p) => a + (p.previstoMes ?? 0), 0);
  const aderTotal = prevCorte > 0 ? Math.round((totalReal / prevCorte) * 100) : null;
  // Scroll inicial no BM CORRENTE (o mês que o gerente veio ver) — via scrollTop do container, sem
  // scrollIntoView (que rolaria a página inteira junto). Todos os BMs seguem acessíveis por scroll.
  const scrollRef = useRef<HTMLDivElement>(null);
  const correnteRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = scrollRef.current;
    const row = correnteRef.current;
    if (!box || !row) return;
    box.scrollTop = Math.max(0, row.offsetTop - box.clientHeight / 2 + row.clientHeight / 2);
  }, [bmLabel, curvaS.length]);
  return (
    <section className="fat-section fat-resumo-bm">
      <header className="fat-section-head">
        <div>
          <h3 className="fat-section-title">Resumo BM a BM</h3>
          <div className="fat-section-sub">
            {curvaS.length} BMs · Real medido até {bmLabel}
          </div>
        </div>
      </header>
      <div className="fat-resumo-scroll" ref={scrollRef}>
        <div className="fat-tabela fat-tabela-resumobm" role="table">
          <div className="fat-tabela-head" role="row">
            <div role="columnheader">BM</div>
            <div role="columnheader">Previsto</div>
            <div role="columnheader">Real</div>
            <div role="columnheader">Ader.</div>
          </div>
          {curvaS.map((p, i) => {
            const ader =
              p.previstoMes != null && p.previstoMes > 0 && p.realMes != null
                ? Math.round((p.realMes / p.previstoMes) * 100)
                : null;
            // Farol da linha pela MESMA régua da tela (90/85/70) — dot 8px; mês sem real fica "—"
            // sem dot (pendente ≠ zero, não classifica o que não foi medido).
            const farolMes =
              ader != null
                ? classificarPorRegra("faturamento_aderencia_acumulada", ader, regras)
                : null;
            const corrente = p.bm === bmLabel;
            return (
              <div
                key={p.bm}
                ref={corrente ? correnteRef : undefined}
                className={`fat-tabela-row ${corrente ? "corrente" : ""}`}
                role="row"
              >
                <div role="cell" className={corrente ? "fw-bold" : ""}>
                  {`BM-${String(i + 1).padStart(2, "0")} · ${p.bm}`}
                </div>
                <div role="cell" className="tabular">
                  {fmtMiTip(p.previstoMes)}
                </div>
                <div role="cell" className="tabular">
                  {p.realMes != null ? (
                    fmtMiTip(p.realMes)
                  ) : (
                    <span style={{ color: "var(--text-4)" }}>—</span>
                  )}
                </div>
                <div role="cell" className="tabular">
                  {ader != null ? (
                    <>
                      {farolMes ? (
                        <span
                          className="fat-ader-dot"
                          style={{ background: `var(--${farolToBadge[farolMes]})` }}
                          title={farolLabel[farolMes]}
                          aria-label={farolLabel[farolMes]}
                        />
                      ) : null}
                      {ader}%
                    </>
                  ) : (
                    "—"
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="fat-tabela fat-tabela-resumobm fat-resumo-total">
        <div className="fat-tabela-row" role="row">
          <div role="cell" className="fw-bold">
            TOTAL · {curvaS.length} BMs
          </div>
          <div role="cell" className="tabular">
            {fmtMiTip(totalPrev)}
          </div>
          <div role="cell" className="tabular">
            {totalReal > 0 ? (
              fmtMiTip(totalReal)
            ) : (
              <span style={{ color: "var(--text-4)" }}>—</span>
            )}
          </div>
          <div
            role="cell"
            className="tabular"
            title="Σ real ÷ Σ previsto até o corte — a mesma base do farol oficial (não Σreal ÷ PV)"
          >
            {aderTotal != null ? `${aderTotal}%` : "—"}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Análise do período (IA) — único bloco textual, ancorado nos fatos ──
// "Editável" (campo único de escrita da C.3) fica p/ quando houver backend de escrita — até lá NÃO
// promete edição (afordância honesta): exibe a análise da IA (ou pendente), sem botão "editar" morto.

function AnaliseTextualCard({ texto }: { texto: string }) {
  return (
    <section className="fat-section">
      <div className="fat-analise-tag">
        {I.sparkle({ size: 12 })} ANÁLISE DO PERÍODO · ADM CONTRATUAL IA
      </div>
      <p className="fat-analise-texto">
        <FormattedText text={texto} />
      </p>
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

// ── Drill bidirecional Disciplina × Frente (expand · igual ao mockup C.3) ──────────────────────
// Pais: Por Disciplina = disciplinaResumo (15) · Por Frente = frenteMacro (17 + macro-grupos). Filhos
// (ambos os sentidos): cruzamento Frente × Disciplina de auxiliar_C.3 (useFaturamentoCruzamento), com
// Acum.BM (previsto acum) + Real (medido acum) + farol pela aderência. Casa por nome (idêntico entre
// as fontes); sem match → não expande (nunca inventa cruzamento). Bate o oráculo ao centavo.

type DrillCel = {
  contratado: number | null;
  acum: number | null;
  real: number | null;
  // pct/farol da fonte NÃO entram: a tela recomputa aderência (aderDe) e farol (classificarPorRegra)
  // — caminho único, sem risco de reusar o farol cru da planilha.
  realPendente: boolean;
};
type DrillItem = DrillCel & { key: string; nome: string };
// `ordem` = posição no template (sequencial na montagem) — âncora da ordenação default do useColecao.
type DrillLinha = DrillItem & { ordem: number; filhos: DrillItem[] };
type DrillGrupo = { macro: string | null; linhas: DrillLinha[] };

// Nomes pai (disciplinaResumo/frenteMacro) × filho (cruzamento auxiliar_C.3) casam via o normTxt
// compartilhado da coleção (idêntico ao do read-model: lowercase + NFD sem acento + trim).
function somaPresente(xs: (number | null)[]): number | null {
  const p = xs.filter((x): x is number => x != null);
  return p.length ? Math.round(p.reduce((a, b) => a + b, 0) * 100) / 100 : null;
}

/** Aderência exibida de uma linha do drill (real ÷ contratado-acum) — null enquanto não medido. */
function aderDe(cel: DrillCel): number | null {
  return !cel.realPendente && cel.real != null && cel.acum ? cel.real / cel.acum : null;
}

function DrillSection({
  contractId,
  regras,
}: {
  contractId: string;
  regras?: Record<string, FarolRegra>;
}) {
  const [modo, setModo] = useState<"disciplina" | "frente">("disciplina");
  // O drill é snapshot pré-agregado no corte normalizado (sem série por BM) → quando um período
  // anterior é escolhido, ele NÃO recorta; sinalizamos isso em vez de mostrar número enganoso.
  const corteAtivo = !!useRmaCorte();
  return (
    <section className="fat-section fat-d2">
      <header className="fat-d2-head">
        <div>
          <h3 className="fat-section-title">Faturamento — Disciplina × Frente</h3>
          <div className="fat-section-sub">
            {modo === "disciplina"
              ? "Por Disciplina — o quê (tipo de serviço)"
              : "Por Frente — o onde (trecho/KM, pontes, dispositivos)"}
            {corteAtivo ? " · snapshot até o último BM normalizado" : ""}
          </div>
        </div>
        <Segmented<"disciplina" | "frente">
          value={modo}
          onChange={setModo}
          aria-label="Recorte: por disciplina ou por frente"
          items={[
            { value: "disciplina", label: "Por Disciplina" },
            { value: "frente", label: "Por Frente" },
          ]}
        />
      </header>
      {modo === "disciplina" ? (
        <DrillPorDisciplina contractId={contractId} regras={regras} />
      ) : (
        <DrillPorFrente contractId={contractId} regras={regras} />
      )}
      {/* Régua no VOCABULÁRIO do Farol (Conforme/Observação/Risco/Crítico) — o nome do nível carrega
          o significado; a cor (dot 8px via token) só reforça. Nada de "verde/azul/amarelo/vermelho". */}
      <p className="fat-d2-hint">
        <ChevronRight size={12} aria-hidden style={{ verticalAlign: "-2px" }} /> Clique numa linha
        (ou Enter/Espaço com foco) para abrir o nível seguinte · Aderência = real ÷ contratado-acum.
        {reguaFarol(regras).map((r) => (
          <span key={r.nivel} className="fat-regua-item">
            {" · "}
            <span
              className="fat-ader-dot"
              style={{ background: `var(--${farolToBadge[r.nivel]})` }}
              aria-hidden
            />
            {farolLabel[r.nivel]} {r.faixa}
          </span>
        ))}
      </p>
    </section>
  );
}

/** Régua da legenda derivada da régua MESCLADA da obra (default oficial 90/85/70) — a legenda
 *  nunca pode divergir da régua que classifica as linhas (obra com farol_regras custom). */
const reguaFarol = (
  regras?: Record<string, FarolRegra>,
): Array<{ nivel: FarolLevel; faixa: string }> => {
  const c = regras?.["faturamento_aderencia_acumulada"]?.cortes ?? {
    conforme: 90,
    observacao: 85,
    risco: 70,
  };
  return [
    { nivel: "conforme", faixa: `≥ ${c.conforme}%` },
    { nivel: "observacao", faixa: `≥ ${c.observacao}%` },
    { nivel: "risco", faixa: `≥ ${c.risco}%` },
    { nivel: "critico", faixa: `< ${c.risco}%` },
  ];
};

// CruzItem (auxiliar_C.3) → linha-filha do drill. Acum.BM = previsto acum · Real = medido acum · farol
// pela aderência (régua oficial). real SEMPRE medido aqui (não "a medir"); 0 vira "—" no DrillCelulas.
function cruzToItem(c: CruzItem, key: string): DrillItem {
  return {
    key,
    nome: c.nome,
    contratado: c.contratado,
    acum: c.previstoAcum,
    real: c.realAcum,
    realPendente: false,
  };
}

function DrillPorDisciplina({
  contractId,
  regras,
}: {
  contractId: string;
  regras?: Record<string, FarolRegra>;
}) {
  const disc = useFaturamentoDisciplinaResumo(contractId);
  const cruz = useFaturamentoCruzamento(contractId);
  if (disc.isLoading) return <Skeleton style={{ height: 360 }} />;
  if (disc.isError)
    return <CardErro titulo="Faturamento por Disciplina" onRetry={() => disc.refetch()} />;
  if (!disc.data) return <div className="col-vazia">Faturamento por disciplina pendente.</div>;
  const porDisc = cruz.data?.porDisciplina ?? {};
  const linhas: DrillLinha[] = disc.data.disciplinas.map((d, i) => ({
    key: `d-${d.ordem}`,
    ordem: i,
    nome: d.disciplina,
    contratado: d.contratadoTotal,
    acum: d.contratadoAcum,
    real: d.realAcum,
    realPendente: d.realPendente,
    filhos: (porDisc[normTxt(d.disciplina)] ?? []).map((c, ci) =>
      cruzToItem(c, `d-${d.ordem}-f${ci}`),
    ),
  }));
  const acum = somaPresente(linhas.map((l) => l.acum));
  const real = somaPresente(linhas.map((l) => l.real));
  const total: DrillItem = {
    key: "total",
    nome: "TOTAL",
    contratado: disc.data.somaContratadoTotal,
    acum,
    real,
    realPendente: disc.data.realPendente,
  };
  return (
    <DrillColecao
      regras={regras}
      nomeCol="Disciplina"
      grupos={[{ macro: null, linhas }]}
      total={total}
      rotulo="disciplina"
      rotuloPlural="disciplinas"
      placeholder="Buscar disciplina ou frente… (ex.: Pavimentação)"
    />
  );
}

function DrillPorFrente({
  contractId,
  regras,
}: {
  contractId: string;
  regras?: Record<string, FarolRegra>;
}) {
  const frm = useFaturamentoFrenteMacro(contractId);
  const cruz = useFaturamentoCruzamento(contractId);
  if (frm.isLoading) return <Skeleton style={{ height: 360 }} />;
  if (frm.isError)
    return <CardErro titulo="Faturamento por Frente" onRetry={() => frm.refetch()} />;
  if (!frm.data) return <div className="col-vazia">Faturamento por frente pendente.</div>;
  const porFrente = cruz.data?.porFrente ?? {};
  let seq = 0; // ordem GLOBAL do template (atravessa os macro-grupos)
  const grupos: DrillGrupo[] = frm.data.grupos.map((g) => ({
    macro: g.macro,
    linhas: g.frentes.map((f) => ({
      key: `f-${f.ordem}`,
      ordem: seq++,
      nome: f.frente,
      contratado: f.contratadoTotal,
      acum: f.contratadoAcum,
      real: f.realAcum,
      realPendente: f.realPendente,
      filhos: (porFrente[normTxt(f.frente)] ?? []).map((c, ci) =>
        cruzToItem(c, `f-${f.ordem}-d${ci}`),
      ),
    })),
  }));
  const todas = grupos.flatMap((g) => g.linhas);
  const acum = somaPresente(todas.map((l) => l.acum));
  const real = somaPresente(todas.map((l) => l.real));
  const total: DrillItem = {
    key: "total",
    nome: "TOTAL",
    contratado: frm.data.somaContratadoTotal,
    acum,
    real,
    realPendente: frm.data.realPendente,
  };
  return (
    <DrillColecao
      regras={regras}
      nomeCol="Frente"
      grupos={grupos}
      total={total}
      rotulo="frente"
      rotuloPlural="frentes"
      placeholder="Buscar frente ou disciplina… (ex.: Pontes, KM 240)"
    />
  );
}

// ── Coleção do drill (toolkit canônico useColecao + ColToolbar/ColPag/ColVazio) ──────────────────
// Busca filtra pais E filhos (pai cujo filho casa permanece e auto-expande, mostrando só os filhos
// que casam); ordenação template/contratado/pior-aderência; contador "X de N". perPage alto de
// propósito: a tabela expansível com macro-grupos e TOTAL fixo perde o sentido fatiada em páginas
// (15–17 linhas) — o ColPag entra sozinho se a coleção um dia crescer além disso.

function DrillColecao({
  nomeCol,
  grupos,
  total,
  rotulo,
  rotuloPlural,
  placeholder,
  regras,
}: {
  nomeCol: string;
  grupos: DrillGrupo[];
  total: DrillItem;
  rotulo: string;
  rotuloPlural: string;
  placeholder: string;
  regras?: Record<string, FarolRegra>;
}) {
  const linhasAll = useMemo(() => grupos.flatMap((g) => g.linhas), [grupos]);
  const col = useColecao(linhasAll, {
    busca: (l) => `${l.nome} ${l.filhos.map((f) => f.nome).join(" ")}`,
    ordenacoes: [
      { value: "template", label: "Ordem do template", cmp: (a, b) => a.ordem - b.ordem },
      {
        value: "contratado",
        label: "Maior contratado",
        cmp: (a, b) => (b.contratado ?? -1) - (a.contratado ?? -1),
      },
      {
        value: "aderencia",
        label: "Pior aderência",
        // "a medir" (null) vai pro fim — pendente não compete com medido.
        cmp: (a, b) =>
          (aderDe(a) ?? Number.POSITIVE_INFINITY) - (aderDe(b) ?? Number.POSITIVE_INFINITY),
      },
    ],
    perPage: 200,
  });
  const q = normTxt(col.debounced);
  // Reagrupa: em ordem do template preserva os macro-grupos (filtrando linhas); ordenado por valor/
  // aderência a hierarquia de macro perde o sentido → lista única na ordem escolhida.
  const visiveis = new Set(col.visible.map((l) => l.key));
  const gruposRender: DrillGrupo[] =
    col.sort === "template"
      ? grupos
          .map((g) => ({ macro: g.macro, linhas: g.linhas.filter((l) => visiveis.has(l.key)) }))
          .filter((g) => g.linhas.length > 0)
      : [{ macro: null, linhas: col.visible }];
  // Pais que só entraram porque um FILHO casou com a busca → auto-expandem (senão o match fica invisível).
  const autoAbrir = useMemo(() => {
    const s = new Set<string>();
    if (!q) return s;
    for (const l of linhasAll)
      if (!normTxt(l.nome).includes(q) && l.filhos.some((f) => normTxt(f.nome).includes(q)))
        s.add(l.key);
    return s;
  }, [linhasAll, q]);
  return (
    <>
      <ColToolbar
        col={col}
        placeholder={placeholder}
        extra={
          <span className="fat-d2-count" role="status">
            {col.total === col.nItens
              ? `${col.nItens} ${rotuloPlural}`
              : `${col.total} de ${col.nItens} ${rotuloPlural}`}
          </span>
        }
      />
      {col.total === 0 ? (
        <ColVazio
          termo={col.query}
          rotulo={rotulo}
          onClear={() => col.setQuery("")}
          artigo="Nenhuma"
        />
      ) : (
        <DrillTabela
          regras={regras}
          nomeCol={nomeCol}
          grupos={gruposRender}
          total={total}
          q={q}
          autoAbrir={autoAbrir}
          filtrado={q.length > 0}
        />
      )}
      <ColPag col={col} rotulo={rotuloPlural} />
    </>
  );
}

function DrillCelulas({ cel, regras }: { cel: DrillCel; regras?: Record<string, FarolRegra> }) {
  // aderência = real ÷ contratado-acum (como o mockup); null quando o real ainda não foi medido.
  const ader = aderDe(cel);
  // Farol pela RÉGUA de aderência (90/85/70) aplicada à aderência EXIBIDA — NÃO o farol cru da
  // planilha (que classificava alguns <70% como Risco em vez de Crítico, subestimando o risco).
  // Mantém o tom coerente com a régua que o rodapé da tela estampa.
  const farol = classificarPorRegra(
    "faturamento_aderencia_acumulada",
    ader == null ? null : ader * 100,
    regras,
  );
  return (
    <>
      <div role="cell" className="tabular">
        {fmtMi(cel.contratado)}
      </div>
      <div role="cell" className="tabular">
        {fmtMi(cel.acum)}
      </div>
      <div role="cell" className="tabular">
        {cel.realPendente ? (
          <span className="fat-d2-medir">— a medir</span>
        ) : cel.real != null && cel.real > 0 ? (
          fmtMi(cel.real)
        ) : (
          <span className="fat-d2-medir">—</span>
        )}
      </div>
      <div role="cell" className="tabular">
        {ader == null ? <span className="fat-d2-medir">—</span> : fmtPctBr(ader)}
      </div>
      <div role="cell">
        {farol ? (
          <Badge tone={farolToBadge[farol]} className="fat-d2-farol">
            {farolLabel[farol]}
          </Badge>
        ) : (
          <span className="fat-d2-medir">—</span>
        )}
      </div>
    </>
  );
}

function DrillTabela({
  nomeCol,
  grupos,
  total,
  q = "",
  autoAbrir,
  filtrado = false,
  regras,
}: {
  nomeCol: string;
  grupos: DrillGrupo[];
  total: DrillItem;
  /** Termo de busca já normalizado (filtra os filhos exibidos quando o pai não casa). */
  q?: string;
  /** Pais auto-expandidos porque um filho casou com a busca (XOR com o toggle manual). */
  autoAbrir?: Set<string>;
  /** true = busca ativa → rotula o TOTAL como "conjunto completo" (não soma do filtrado). */
  filtrado?: boolean;
  regras?: Record<string, FarolRegra>;
}) {
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setAbertas((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  return (
    <div className="fat-d2-tabela" role="table">
      <div className="fat-d2-row fat-d2-head-row" role="row">
        <div role="columnheader">{nomeCol}</div>
        <div role="columnheader" className="r">
          Contratado
        </div>
        <div role="columnheader" className="r">
          Acum. BM
        </div>
        <div role="columnheader" className="r">
          Real
        </div>
        <div role="columnheader" className="r">
          Aderência
        </div>
        <div role="columnheader">Farol</div>
      </div>
      {grupos.map((g, gi) => (
        <Fragment key={g.macro ?? `g-${gi}`}>
          {g.macro ? (
            <div className="fat-d2-macro" role="row">
              <div role="cell">{g.macro}</div>
            </div>
          ) : null}
          {g.linhas.map((l) => {
            // pai casa com a busca → todos os filhos; pai só entrou via filho → só os filhos que casam.
            const paiCasa = !q || normTxt(l.nome).includes(q);
            const filhos = paiCasa ? l.filhos : l.filhos.filter((f) => normTxt(f.nome).includes(q));
            const tem = filhos.length > 0;
            // Com busca ativa, match de filho NUNCA fica invisível (autoAbrir vence estado manual
            // anterior — edge: pai expandido antes da busca fazia o XOR fechar o match). Sem busca,
            // o toggle manual manda.
            const auto = autoAbrir?.has(l.key) ?? false;
            const aberta = q ? auto || abertas.has(l.key) : abertas.has(l.key);
            return (
              <Fragment key={l.key}>
                <div
                  className={`fat-d2-row${tem ? " clicavel" : ""}${aberta && tem ? " aberta" : ""}`}
                  role="row"
                  tabIndex={tem ? 0 : undefined}
                  aria-expanded={tem ? aberta : undefined}
                  onClick={tem ? () => toggle(l.key) : undefined}
                  onKeyDown={
                    tem
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggle(l.key);
                          }
                        }
                      : undefined
                  }
                >
                  <div role="cell" className="fat-d2-nome">
                    <span className="fat-d2-caret" aria-hidden>
                      {tem ? aberta ? <ChevronDown size={13} /> : <ChevronRight size={13} /> : null}
                    </span>
                    {l.nome}
                  </div>
                  <DrillCelulas cel={l} regras={regras} />
                </div>
                {aberta && tem
                  ? filhos.map((c) => (
                      <div key={c.key} className="fat-d2-row fat-d2-filho" role="row">
                        <div role="cell" className="fat-d2-nome fat-d2-nome-filho">
                          {c.nome}
                        </div>
                        <DrillCelulas cel={c} regras={regras} />
                      </div>
                    ))
                  : null}
              </Fragment>
            );
          })}
        </Fragment>
      ))}
      <div className="fat-d2-row fat-d2-total" role="row">
        <div role="cell" className="fat-d2-nome">
          {total.nome}
          {filtrado ? <span className="fat-d2-total-nota">conjunto completo</span> : null}
        </div>
        <DrillCelulas cel={total} regras={regras} />
      </div>
    </div>
  );
}

// ── Frentes ──────────────────────────────────────────────────────────

function fmtMi(v: number | null): string {
  return v != null
    ? `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`
    : "—";
}

// C.3 Faturamento por DISCIPLINA — Resumo (caderno SaaS · A76:G90). Vocabulário: Disciplina = o quê
// (terraplenagem, pavimentação…) × Frente = o onde/local. Contratado Total + Acum até BM por
// disciplina (Σ = PV). O REAL por disciplina é input separado: o total real (20,5M) foi medido mas
// NÃO alocado por disciplina → real pendente honesto ("—"), não 0 fabricado.

// Farol → tom/rótulo: helpers canônicos farolToBadge/farolLabel (@/lib/mocks/contracts) — Regra do
// Farol §8, sem duplicar mapas locais.

function fmtPctBr(v: number | null): string {
  return v != null ? `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—";
}

/** Erro de LEITURA ≠ pendência de normalização — os read-models falham alto e a seção precisa
 *  dizer isso (mascarar erro como "pendente" é a área cega que o projeto veta). */
function CardErro({ titulo, onRetry }: { titulo: string; onRetry: () => void }) {
  return (
    <section className="fat-section">
      <header className="fat-section-head">
        <div>
          <h3 className="fat-section-title">{titulo}</h3>
        </div>
      </header>
      <EmptyState
        title="Erro ao ler os dados desta seção"
        text="Falha de leitura no banco — não é pendência de normalização."
        action={
          <Button variant="outline" size="sm" onClick={onRetry}>
            Tentar de novo
          </Button>
        }
      />
    </section>
  );
}
