// Aba "Indicadores e Farol" (RMA · C.2) — dashboard-farol de CONSOLIDAÇÃO. Header (título +
// RmaParamBar à direita) → banner consolidado (pior bloco) → 4 cards de bloco (valor + farol) →
// 3 painéis (Curva de Faturamento · Alocação de Recursos · Prazo) → Análise de Insumos (ABC) →
// Análise IA (pendente). Tudo do dado REAL normalizado.
//
// PERÍODO: a aba responde ao seletor de período do RMA (?bm, via useRmaCorte) — o corte rebobina o
// bridge de faturamento (curva/BM/mesCorte) E o cálculo da Camada B (desvio, acumulados, faróis).
// Recursos acumula "até o BM" pelo mesmo mesCorte. Prazo/Insumos seguem os read-models próprios
// (ainda sem override de corte — ver nota no painel).
//
// FAROL desta tela = DESVIO em p.p. do contrato total (real − previsto): Conforme ≥ −1 · Observação
// −3 a −1 · Risco −8 a −3 · Crítico < −8. DISTINTO da C.3 (aderência 90/85/70) — de propósito.
// Régua computada localmente (a bridge usa réguas diferentes; ver SPEC-C02). Farol via Badge/dot —
// NUNCA borda colorida (vetado no CLAUDE.md). PENDENTE ≠ 0 (sem medida → "—"). ERRO ≠ PENDÊNCIA:
// falha de fetch → ErroCard com retry; pendência = dado ainda não normalizado.

import { type ReactNode, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { createFileRoute } from "@tanstack/react-router";
import {
  Badge,
  Button,
  CHART_SERIE_COR,
  ChartLegend,
  type ChartLegendItem,
  ChartTooltip,
  DataTable,
  EmptyState,
  ErroCard,
  I,
  type IconName,
  ProgressRing,
  Segmented,
  Skeleton,
} from "@/components/ds";
import { type FarolLevel, farolLabel, farolToBadge } from "@/lib/mocks/contracts";
import { RmaParamBar } from "@/components/RmaParamBar/RmaParamBar";
import { type CorteBm, useRmaCorte } from "@/lib/hooks/useRmaCorte";
import { useFaturamentoBm } from "@/lib/hooks/useFaturamentoBm";
import { useRecursos } from "@/lib/hooks/useRecursos";
import { usePrazoBm } from "@/lib/hooks/usePrazoBm";
import { useInsumos } from "@/lib/hooks/useInsumos";
import { useInsumoExcedente } from "@/lib/hooks/useInsumoExcedente";
import { getFaturamentoCurva, realizadoAcumDe } from "@/lib/supabase/faturamentoCurva";
import { getFaturamentoReal } from "@/lib/supabase/medicoes";
import { getObraById } from "@/lib/supabase/obras";
import { calcularFaturamento, type FaturamentoCalc } from "@/lib/rma/calcFaturamento";
import { farolOverridesDe, mesclarRegras } from "@/lib/rma/farol";
import {
  ColPag,
  ColToolbar,
  ColVazio,
  normTxt,
  type Ordenacao,
  useColecao,
} from "@/lib/rma/colecao";
import "./indicadores.css";

export const Route = createFileRoute("/_app/contracts/$contractId/rma/indicadores")({
  component: IndicadoresAba,
});

// ── Helpers de formato (PT-BR · tabular · minus U+2212 como no DS) ─────

const fmtPct1 = (v: number | null | undefined) =>
  v != null
    ? `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
    : "—";

/** percent com sinal explícito (− para negativo). Ex.: -1.4 → "−1,4%". */
const fmtPct1Signed = (v: number | null | undefined) => {
  if (v == null) return "—";
  const sign = v < 0 ? "−" : v > 0 ? "+" : "";
  return `${sign}${Math.abs(v).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
};

/** desvio em pontos percentuais, sempre com sinal. Ex.: -2.49 → "−2,5 p.p.". */
const fmtPp = (v: number | null | undefined) => {
  if (v == null) return "—";
  const sign = v < 0 ? "−" : v > 0 ? "+" : "";
  return `${sign}${Math.abs(v).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} p.p.`;
};

const fmtInt = (v: number | null | undefined) =>
  v != null ? v.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "—";

/** R$ em milhões com 2 casas (a partir de reais brutos). Ex.: 78_636_026 → "R$ 78,64 mi". */
const fmtMi2 = (reais: number | null | undefined) =>
  reais != null
    ? `R$ ${(reais / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`
    : "—";

/** Valor JÁ em milhões → "R$ x,xx mi"; null → "—" (mês sem real). */
const fmtMiVal = (mi: number | null | undefined) =>
  mi != null
    ? `R$ ${mi.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`
    : "—";

/** R$ inteiro PT-BR. Ex.: 114654.68 → "R$ 114.655". */
const fmtBRL0 = (reais: number | null | undefined) =>
  reais != null ? `R$ ${Math.round(reais).toLocaleString("pt-BR")}` : "—";

/** meses com sinal (Δ projeção). Ex.: 96 → "+96 meses"; 1 → "+1 mês". */
const fmtMeses = (n: number | null | undefined, signed = false) => {
  if (n == null) return "—";
  const unidade = Math.abs(Math.round(n)) === 1 ? "mês" : "meses";
  const sign = signed ? (n > 0 ? "+" : n < 0 ? "−" : "") : "";
  return `${sign}${Math.abs(Math.round(n)).toLocaleString("pt-BR")} ${unidade}`;
};

// ── Régua C.2 (desvio em p.p. do contrato) ────────────────────────────

function farolPorDesvioPp(d: number): FarolLevel {
  if (d >= -1) return "conforme";
  if (d >= -3) return "observacao";
  if (d >= -8) return "risco";
  return "critico";
}
const SEV: Record<FarolLevel, number> = { conforme: 0, observacao: 1, risco: 2, critico: 3 };

/** Farol de Insumos — regra ÚNICA da tela (card do topo E bloco ABC usam este helper; antes o
 *  bloco tinha "Conforme" hardcoded e contradizia o card). Excedente ao IPCA aciona repasse
 *  (cl. 8.8) → Observação; senão Conforme. null = pendente (sem insumos normalizados). */
function nivelInsumos(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  insumos: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  excedente: any,
): FarolLevel | null {
  if (!insumos || !excedente) return null; // pendente ≠ Conforme: sem excedente carregado não há farol
  return (excedente.acimaTeto?.length ?? 0) > 0 ? "observacao" : "conforme";
}

// ── Dot de farol (8px · currentColor) — substitui o "●" textual ───────

function FarolDot() {
  return <span className="ind-dot" aria-hidden />;
}

// ── Cálculo de Faturamento corte-aware (Camada B) ─────────────────────
// Réplica local do fetchFaturamentoCalc + opts.corteBmOverride (calcularFaturamento JÁ suporta o
// override; o hook compartilhado useFaturamentoCalc ainda não o aceita — quando aceitar, este hook
// local colapsa numa chamada com o parâmetro). Sem ?bm (corte=null) o resultado é idêntico ao de hoje.

function useFaturamentoCalcCorte(contractId: string, corte: CorteBm | null) {
  return useQuery<FaturamentoCalc | null>({
    queryKey: corte
      ? ["faturamento-calc-c2", contractId, corte.ano, corte.mes]
      : ["faturamento-calc-c2", contractId],
    queryFn: async () => {
      const [curva, realMed, obra] = await Promise.all([
        getFaturamentoCurva(contractId),
        getFaturamentoReal(contractId),
        getObraById(contractId),
      ]);
      return calcularFaturamento(curva, {
        realizadoAcum: realizadoAcumDe(realMed, curva),
        regras: mesclarRegras(farolOverridesDe(obra?.farol_regras)),
        corteBmOverride: corte,
      });
    },
    staleTime: 30_000,
  });
}

// ── Route gate (loading → error → empty → conteúdo) ───────────────────

function IndicadoresAba() {
  const { contractId } = Route.useParams();
  // Corte do seletor de período do RMA (?bm). null = obra inteira (corte = último mês medido).
  const corte = useRmaCorte();
  // Âncora: o faturamento gateia a tela (mesma normalização das demais). Os outros hooks carregam em
  // paralelo; cada bloco distingue pendência (null) de ERRO (isError → ErroCard com retry).
  const fatBm = useFaturamentoBm(contractId, corte);

  return (
    <main className="ind-main">
      {fatBm.isLoading ? (
        <>
          <IndHeader />
          <IndSkeleton />
        </>
      ) : fatBm.isError ? (
        <>
          <IndHeader />
          <ErroCard
            titulo="Não foi possível carregar os indicadores"
            mensagem="Erro ao ler os dados normalizados desta obra."
            onRetry={() => void fatBm.refetch()}
          />
        </>
      ) : !fatBm.data ? (
        <>
          <IndHeader />
          <EmptyState
            framed
            title="Indicadores ainda não normalizados"
            text="Esta obra não tem medições (BM) normalizadas no banco ainda."
            hint="Aguardando normalização da Camada A"
          />
        </>
      ) : (
        <IndConteudo
          contractId={contractId}
          corte={corte}
          fat={fatBm.data.fat}
          bmLabel={fatBm.data.bmLabel}
          mesCorte={fatBm.data.mesCorte}
        />
      )}
    </main>
  );
}

/** Header local. `params` = RmaParamBar no slot direito (mesma linha do título — o farol
 *  consolidado sobe uma faixa em vez de a barra gastar uma linha inteira). */
function IndHeader({ params }: { params?: ReactNode }) {
  return (
    <header className="ind-head">
      <div>
        <h2 className="ind-titulo">Indicadores e Farol</h2>
        <p className="ind-sub">
          Faróis por bloco · curva de faturamento, alocação de recursos e prazo · análise de insumos
        </p>
      </div>
      {params}
    </header>
  );
}

function IndSkeleton() {
  return (
    <div style={{ display: "grid", gap: "var(--s-4)" }}>
      <Skeleton style={{ height: 64 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--s-3)" }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} style={{ height: 120 }} />
        ))}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.6fr 1fr 1fr",
          gap: "var(--s-4)",
        }}
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} style={{ height: 320 }} />
        ))}
      </div>
      <Skeleton style={{ height: 280 }} />
    </div>
  );
}

// ── Tipo da Curva S (já em R$ milhões) ────────────────────────────────

type CurvaPonto = {
  bm: string;
  contratado: number;
  real: number | null;
  projecao: number | null;
  previstoMes: number | null;
  realMes: number | null;
};

type MesCorte = { ano: number; mes: number };

// ── Conteúdo ──────────────────────────────────────────────────────────

function IndConteudo({
  contractId,
  corte,
  fat,
  bmLabel,
  mesCorte,
}: {
  contractId: string;
  corte: CorteBm | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- shape do bridge de faturamento
  fat: any;
  bmLabel: string;
  mesCorte: MesCorte;
}) {
  const calcQ = useFaturamentoCalcCorte(contractId, corte);
  const recursosQ = useRecursos(contractId);
  const prazoQ = usePrazoBm(contractId);
  const insumosQ = useInsumos(contractId);
  const excedenteQ = useInsumoExcedente(contractId);

  const calc = calcQ.data ?? null;
  const recursos = recursosQ.data ?? null;
  const prazo = prazoQ.data?.prazo ?? null;
  const insumos = insumosQ.data ?? null;
  const excedente = excedenteQ.data ?? null;

  // ERRO ≠ PENDÊNCIA: hook que FALHOU não vira "ainda não normalizado" — cada bloco/painel
  // recebe o flag e renderiza ErroCard com retry.
  const calcErro = calcQ.isError;
  const recursosErro = recursosQ.isError;
  const prazoErro = prazoQ.isError;
  const insumosErro = insumosQ.isError || excedenteQ.isError;
  const erros = useMemo(
    () => ({ calc: calcErro, recursos: recursosErro, prazo: prazoErro, insumos: insumosErro }),
    [calcErro, recursosErro, prazoErro, insumosErro],
  );

  // Desvio em p.p. do contrato (real − previsto, mesma base = custo total). É o eixo do farol C.2.
  const desvioFatPp =
    calc?.avancoRealizadoPct != null && calc?.avancoContratadoPct != null
      ? calc.avancoRealizadoPct - calc.avancoContratadoPct
      : null;

  const blocos = useMemo(
    () =>
      computeBlocos({ calc, recursos, prazo, insumos, excedente, desvioFatPp, mesCorte, erros }),
    [calc, recursos, prazo, insumos, excedente, desvioFatPp, mesCorte, erros],
  );
  const consolidado = useMemo(() => computeConsolidado(blocos), [blocos]);

  const horizonte: number | null = fat.curvaS?.length ?? null;

  return (
    <>
      <IndHeader
        params={
          <RmaParamBar
            items={[
              {
                label: "Data de corte",
                valor: fimDoMesBR(mesCorte),
                title: "Fim do mês do BM de corte — segue o seletor de período do RMA",
              },
              { label: "BM", valor: bmLabel },
              { label: "Horizonte", valor: horizonte != null ? `${horizonte} BMs` : "—" },
            ]}
          />
        }
      />
      {corte != null && (
        <p className="ind-nota ind-nota-corte">
          Período rebobinado ({bmLabel}): Faturamento e Recursos refletem o corte selecionado; Prazo
          e Insumos mostram a obra inteira (não rebobinam).
        </p>
      )}
      <BannerConsolidado consolidado={consolidado} />

      <section>
        <h3 className="ind-sec">Indicadores por bloco — valor + farol</h3>
        <div className="ind-cards">
          {blocos.map((b) => (
            <BlocoCard key={b.key} bloco={b} />
          ))}
        </div>
        <p className="ind-nota">
          Faróis pelo desvio em pontos percentuais do contrato total (real − previsto). Régua:
          Conforme ≥ −1 p.p. · Observação −3 a −1 · Risco −8 a −3 · Crítico {"<"} −8. Consolidado =
          pior bloco.
        </p>
      </section>

      <section>
        <h3 className="ind-sec">Painéis</h3>
        <div className="ind-paineis">
          <CurvaPanel
            fat={fat}
            bmLabel={bmLabel}
            desvioFatPp={desvioFatPp}
            custoTotal={calc?.custoTotal ?? null}
            realAcum={calc?.realizadoAcum ?? null}
            contratadoAcum={calc?.contratadoAcum ?? null}
            calcErro={erros.calc}
            onRetryCalc={() => void calcQ.refetch()}
          />
          <RecursosPanel
            recursos={recursos}
            mesCorte={mesCorte}
            erro={erros.recursos}
            onRetry={() => void recursosQ.refetch()}
          />
          <PrazoPanel
            prazo={prazo}
            calc={calc}
            periodo={fat.periodo}
            erro={erros.prazo}
            onRetry={() => void prazoQ.refetch()}
          />
        </div>
      </section>

      <InsumosBlock
        insumos={insumos}
        excedente={excedente}
        erro={erros.insumos}
        onRetry={() => {
          void insumosQ.refetch();
          void excedenteQ.refetch();
        }}
      />
      <AnaliseIaBlock />
    </>
  );
}

/** Data de corte = fim do mês do corte (ex.: {2026,5} → "31/05/2026"). */
function fimDoMesBR(mc: MesCorte): string {
  const dia = new Date(mc.ano, mc.mes, 0).getDate();
  return `${String(dia).padStart(2, "0")}/${String(mc.mes).padStart(2, "0")}/${mc.ano}`;
}

// ── Banner consolidado (pior bloco) ───────────────────────────────────

type Consolidado = { nivel: FarolLevel; titulo: string; mensagem: string };

function BannerConsolidado({ consolidado }: { consolidado: Consolidado | null }) {
  if (!consolidado) return null;
  const tone = farolToBadge[consolidado.nivel];
  return (
    <aside className={`ind-banner tone-${tone}`} role="status">
      <span className="ind-banner-icon" aria-hidden>
        {I.flag({ size: 18 })}
      </span>
      <div className="ind-banner-body">
        <div className="ind-banner-titulo">
          <FarolDot />
          {consolidado.titulo}
        </div>
        <p className="ind-banner-texto">{consolidado.mensagem}</p>
      </div>
    </aside>
  );
}

// ── 4 cards de bloco (valor + farol pill) ─────────────────────────────

type BlocoValor =
  | { kind: "texto"; texto: string }
  | { kind: "mini"; itens: Array<{ rotulo: string; valor: string }> };

type Bloco = {
  key: string;
  titulo: string;
  icon: IconName;
  valor: BlocoValor;
  footer: string;
  /** Tooltip do footer (ex.: proveniência do desvio financeiro no card Prazo). */
  footTitle?: string;
  nivel: FarolLevel | null; // null = pendente (sem medida)
  /** true = o hook que alimenta o bloco FALHOU (erro ≠ pendência; retry no painel). */
  erro?: boolean;
};

function BlocoCard({ bloco }: { bloco: Bloco }) {
  const erro = bloco.erro === true;
  const tone = erro ? "danger" : bloco.nivel ? farolToBadge[bloco.nivel] : "neutral";
  const label = erro ? "Erro" : bloco.nivel ? farolLabel[bloco.nivel] : "Pendente";
  return (
    <article className={`ind-card tone-${tone}`}>
      <div className="ind-card-top">
        <span className="ind-card-nm">
          <span className="ind-card-ic" aria-hidden>
            {I[bloco.icon]?.({ size: 15 })}
          </span>
          {bloco.titulo}
        </span>
        <Badge tone={tone} className="ind-card-pill">
          <FarolDot />
          {label}
        </Badge>
      </div>
      {bloco.valor.kind === "texto" ? (
        <div className={`ind-card-big${bloco.valor.texto.length > 7 ? " ind-card-big-text" : ""}`}>
          {bloco.valor.texto}
        </div>
      ) : (
        <div className="ind-card-mini">
          {bloco.valor.itens.map((it) => (
            <div className="ind-card-mini-row" key={it.rotulo}>
              <span>{it.rotulo}</span>
              <b>{it.valor}</b>
            </div>
          ))}
        </div>
      )}
      <div className="ind-card-foot" title={bloco.footTitle}>
        {bloco.footer}
      </div>
    </article>
  );
}

// ── Painel 1 · Curva de Faturamento (ComposedChart + tooltip + footer fixo) ─

const CATS = ["MOD", "MOI", "EQP"] as const;

type JanelaCurva = "12" | "24" | "tudo";

function CurvaPanel({
  fat,
  bmLabel,
  desvioFatPp,
  custoTotal,
  realAcum,
  contratadoAcum,
  calcErro,
  onRetryCalc,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fat: any;
  bmLabel: string;
  desvioFatPp: number | null;
  custoTotal: number | null;
  realAcum: number | null;
  contratadoAcum: number | null;
  calcErro: boolean;
  onRetryCalc: () => void;
}) {
  // Janela de leitura: horizonte longo (dezenas de BMs) esmaga as barras mensais — fatia
  // client-side em volta do corte. Só zoom de leitura; "Tudo" (default) mantém o dado íntegro.
  const [janela, setJanela] = useState<JanelaCurva>("tudo");
  const curva = useMemo(() => (fat.curvaS ?? []) as CurvaPonto[], [fat.curvaS]);
  const custoTotalMi = custoTotal != null ? custoTotal / 1e6 : null;
  // Rebobinado (?bm em BM antigo): os meses depois do corte são MEDIDOS — desenhá-los como
  // "Projeção" tracejada mentiria. Projeção só na foto corrente.
  const rebobinado = useRmaCorte() != null;
  const temProjecao = !rebobinado && curva.some((p) => p.projecao != null);
  const corteIdx = curva.findIndex((p) => p.bm === bmLabel);

  const data = useMemo(() => {
    if (janela === "tudo") return curva;
    const n = Number(janela);
    const anchor = corteIdx >= 0 ? corteIdx : curva.length - 1;
    // corte visível com ~3/4 de histórico e ~1/4 de futuro na janela.
    const fim = Math.min(curva.length, anchor + 1 + Math.floor(n / 4));
    const ini = Math.max(0, fim - n);
    return curva.slice(ini, Math.min(curva.length, ini + n));
  }, [curva, janela, corteIdx]);

  const mostraCorte = corteIdx >= 0 && data.some((p) => p.bm === bmLabel);

  const legenda: ChartLegendItem[] = [
    { label: "Real (acum.)", tipo: "linha", cor: CHART_SERIE_COR.real },
    { label: "Prev. (acum.)", tipo: "tracejada", cor: CHART_SERIE_COR.contratado },
  ];
  if (temProjecao)
    legenda.push({ label: "Projeção", tipo: "tracejada", cor: CHART_SERIE_COR.real });
  legenda.push(
    {
      label: "Previsto (mês)",
      tipo: "barra",
      cor: "color-mix(in srgb, var(--info) 40%, transparent)",
    },
    { label: "Real (mês)", tipo: "barra", cor: CHART_SERIE_COR.real },
  );

  return (
    <section className="ind-pan">
      <header className="ind-pan-head">
        <h4 className="ind-pan-title">Curva de Faturamento</h4>
        {curva.length > 12 ? (
          <Segmented<JanelaCurva>
            className="ind-janela"
            aria-label="Janela de BMs do gráfico"
            value={janela}
            onChange={setJanela}
            items={[
              { value: "12", label: "12 BMs" },
              { value: "24", label: "24 BMs" },
              { value: "tudo", label: "Tudo" },
            ]}
          />
        ) : null}
      </header>
      <ChartLegend className="ind-leg" items={legenda} />
      <div className="ind-chart-units" aria-hidden>
        <span>R$ mi (acum.)</span>
        <span>R$ mi (mês)</span>
      </div>
      <div className="ind-chart">
        <ResponsiveContainer width="100%" height={210}>
          <ComposedChart data={data} margin={{ top: 8, right: 6, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="bm"
              tick={{ fontSize: 11, fill: "var(--text-3)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              interval="preserveStartEnd"
              minTickGap={26}
              tickMargin={6}
            />
            <YAxis
              yAxisId="acum"
              tick={{ fontSize: 11, fill: "var(--text-3)" }}
              tickLine={false}
              axisLine={false}
              width={42}
              tickFormatter={(v) => `${v}`}
            />
            <YAxis
              yAxisId="mes"
              orientation="right"
              tick={{ fontSize: 11, fill: "var(--text-4)" }}
              tickLine={false}
              axisLine={false}
              width={26}
            />
            <Tooltip
              cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
              content={
                <ChartTooltip
                  formatter={(v: number) => fmtMiVal(v)}
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
                    const ader =
                      p.realMes != null && p.previstoMes
                        ? Math.round((p.realMes / p.previstoMes) * 100)
                        : null;
                    const gap =
                      p.real != null && custoTotalMi
                        ? ((p.real - p.contratado) / custoTotalMi) * 100
                        : null;
                    return (
                      <>
                        {label}
                        <span className="ind-tip-extra">
                          Aderência do mês {ader != null ? `${ader}%` : "—"} · GAP{" "}
                          {gap != null ? `${fmtPp(gap)} do contrato` : "—"}
                        </span>
                      </>
                    );
                  }}
                />
              }
            />
            {mostraCorte ? (
              <ReferenceLine
                yAxisId="acum"
                x={bmLabel}
                stroke="var(--border-strong)"
                strokeDasharray="3 3"
                label={{ value: "corte", position: "top", fontSize: 10, fill: "var(--text-3)" }}
              />
            ) : null}
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
            {temProjecao ? (
              <Line
                yAxisId="acum"
                type="monotone"
                dataKey="projecao"
                name="Projeção"
                stroke={CHART_SERIE_COR.real}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <CurvaFooter
        fat={fat}
        bmLabel={bmLabel}
        desvioFatPp={desvioFatPp}
        realAcum={realAcum}
        contratadoAcum={contratadoAcum}
      />
      {calcErro ? (
        <ErroCard
          framed={false}
          className="ind-pan-erro"
          titulo="Não foi possível calcular acumulados e desvio"
          mensagem="O gráfico usa a curva já carregada; GAP, acumulados e os faróis de Faturamento/Prazo dependem deste cálculo."
          onRetry={onRetryCalc}
        />
      ) : null}
    </section>
  );
}

/** Footer FIXO com o resumo do BM corrente (o detalhe por ponto vive no tooltip do gráfico —
 *  antes o hover TROCAVA este resumo, escondendo a referência enquanto o mouse passeava). */
function CurvaFooter({
  fat,
  bmLabel,
  desvioFatPp,
  realAcum,
  contratadoAcum,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fat: any;
  bmLabel: string;
  desvioFatPp: number | null;
  realAcum: number | null;
  contratadoAcum: number | null;
}) {
  const per = fat.periodo;
  return (
    <div className="ind-curva-info">
      <b>
        BM {per?.bmCorrente ?? "—"} · {bmLabel}
      </b>{" "}
      — Real no mês: {per?.faturadoMesLabel ?? "—"} · Previsto no mês:{" "}
      {per?.previstoMesLabel ?? "—"} · Aderência do mês:{" "}
      {per?.aderenciaPeriodoPct != null ? `${Math.round(per.aderenciaPeriodoPct)}%` : "—"} · Acum.
      real {fmtMi2(realAcum)} / previsto {fmtMi2(contratadoAcum)} ·{" "}
      <b>GAP {fmtPp(desvioFatPp)} do contrato</b>
    </div>
  );
}

// ── Painel 2 · Alocação de Recursos (3 categorias × 3 barras) ─────────

function RecursosPanel({
  recursos,
  mesCorte,
  erro,
  onRetry,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recursos: any;
  mesCorte: MesCorte;
  erro: boolean;
  onRetry: () => void;
}) {
  if (erro) {
    return (
      <section className="ind-pan">
        <header className="ind-pan-head">
          <h4 className="ind-pan-title">Alocação de Recursos</h4>
        </header>
        <ErroCard framed={false} titulo="Não foi possível carregar recursos" onRetry={onRetry} />
      </section>
    );
  }
  if (!recursos?.categorias) {
    return (
      <section className="ind-pan">
        <header className="ind-pan-head">
          <h4 className="ind-pan-title">Alocação de Recursos</h4>
        </header>
        <PanelPendente texto="Recursos ainda não normalizados para esta obra." />
      </section>
    );
  }
  return (
    <section className="ind-pan">
      <header className="ind-pan-head">
        <h4 className="ind-pan-title">Alocação de Recursos</h4>
      </header>
      <div className="ind-rgroups">
        {CATS.map((cat) => {
          const c = recursos.categorias[cat];
          if (!c) return null;
          const total = c.contratadoQtde ?? 0;
          const { contr: ateBm, real } = acumAteCorte(c.serieMensal ?? [], mesCorte);
          return (
            <div className="ind-rgrp" key={cat}>
              <div className="ind-rgrp-label">
                {cat} <span>{subLabel(cat)}</span>
              </div>
              <RBar k="Contr. total" pct={100} valor={fmtInt(total)} tom="total" />
              <RBar
                k="Contr. até BM"
                pct={total > 0 ? (ateBm / total) * 100 : 0}
                valor={fmtInt(ateBm)}
                tom="ate"
              />
              <RBar
                k="Real"
                pct={c.temReal && total > 0 ? (real / total) * 100 : 0}
                valor={c.temReal ? fmtInt(real) : "—"}
                tom="real"
                pendente={!c.temReal}
              />
            </div>
          );
        })}
      </div>
      <ChartLegend
        className="ind-rleg"
        items={[
          {
            label: "Contratado total",
            tipo: "barra",
            cor: "color-mix(in srgb, var(--info) 40%, transparent)",
          },
          { label: "Contratado até o BM", tipo: "barra", cor: "var(--info)" },
          { label: "Real", tipo: "barra", cor: CHART_SERIE_COR.real },
        ]}
      />
    </section>
  );
}

function subLabel(cat: (typeof CATS)[number]): string {
  return cat === "MOD"
    ? "mão de obra direta"
    : cat === "MOI"
      ? "mão de obra indireta"
      : "equipamentos";
}

function RBar({
  k,
  pct,
  valor,
  tom,
  pendente = false,
}: {
  k: string;
  pct: number;
  valor: string;
  tom: "total" | "ate" | "real";
  pendente?: boolean;
}) {
  return (
    <div className="ind-brow">
      <span className="ind-bk">{k}</span>
      <span className="ind-tk">
        {/* PENDENTE ≠ 0: real não medido → trilho vazio, sem fill sobre área cega. */}
        {pendente ? null : (
          <span className={`ind-bar ind-bar-${tom}`} style={{ width: `${Math.min(100, pct)}%` }} />
        )}
      </span>
      <span className={`ind-vv${pendente ? " ind-pend" : ""}`}>{valor}</span>
    </div>
  );
}

/** Acumula contratado E real até o corte — espelho do acumRecAteCorte da C.4. Sem isso, o card
 *  comparava real TOTAL da obra vs contratado-até-BM ao rebobinar o ?bm (desvio/farol errados,
 *  divergentes da C.4 na mesma URL). */
function acumAteCorte(
  serie: Array<{
    ano: number;
    mes: number;
    contratadoQtde: number | null;
    realQtde?: number | null;
  }>,
  corte: MesCorte,
): { contr: number; real: number } {
  let contr = 0;
  let real = 0;
  for (const m of serie) {
    if (m.ano < corte.ano || (m.ano === corte.ano && m.mes <= corte.mes)) {
      contr += m.contratadoQtde ?? 0;
      real += m.realQtde ?? 0;
    }
  }
  return { contr, real };
}

// ── Painel 3 · Prazo (donut + linhas + tabela + projeção) ─────────────

function PrazoPanel({
  prazo,
  calc,
  periodo,
  erro,
  onRetry,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prazo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  calc: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  periodo: any;
  erro: boolean;
  onRetry: () => void;
}) {
  if (erro) {
    return (
      <section className="ind-pan">
        <header className="ind-pan-head">
          <h4 className="ind-pan-title">Prazo</h4>
        </header>
        <ErroCard framed={false} titulo="Não foi possível carregar o prazo" onRetry={onRetry} />
      </section>
    );
  }
  if (!prazo) {
    return (
      <section className="ind-pan">
        <header className="ind-pan-head">
          <h4 className="ind-pan-title">Prazo</h4>
        </header>
        <PanelPendente texto="Prazo ainda não normalizado para esta obra." />
      </section>
    );
  }
  const decorridoPct = prazo.decorridoPct ?? 0;
  const restantePct = 100 - decorridoPct;
  const fisicoPendente = prazo.fisicoRealPendente === true || prazo.avancoFisicoRealPct == null;

  // Avanço físico real/prev e financeiro real/prev.
  const finReal = calc?.avancoRealizadoPct ?? null;
  const finPrev = calc?.avancoContratadoPct ?? null;

  // Projeção por ritmo (REAL — não o placeholder 47,0 do mockup). Pode ser grande na mobilização.
  const proj = periodo?.projecaoTerminoMeses ?? null;
  const delta = periodo?.deltaProjecaoMeses ?? null;
  const baseline = proj != null && delta != null ? Math.round(proj - delta) : null;
  // Tom no vocabulário do farol (4 níveis fixos): estouro do prazo → warning (Risco);
  // adiantado → success (Conforme); Δ≈0 → neutro. Sem escala inventada.
  const projTone =
    delta == null || Math.abs(delta) < 1 ? "neutral" : delta > 0 ? "warning" : "success";
  const mobilizacao =
    periodo?.bmCorrente != null && proj != null && periodo.bmCorrente / Math.max(proj, 1) < 0.15;

  return (
    <section className="ind-pan">
      <header className="ind-pan-head">
        <h4 className="ind-pan-title">Prazo</h4>
      </header>
      <div className="ind-donut-wrap">
        <ProgressRing
          value={decorridoPct}
          max={100}
          size={116}
          stroke={6}
          color="var(--info)"
          trackColor="var(--border)"
          centerText={fmtInt(prazo.decorridoDias)}
          label="dias decorridos"
        />
        <div className="ind-prz-lines">
          <div className="ind-pl">
            <span className="ind-pl-k">Prazo decorrido</span>
            <span className="ind-pl-v">{fmtPct1(decorridoPct)}</span>
            <small>· {fmtInt(prazo.decorridoDias)} dias</small>
          </div>
          <div className="ind-pl">
            <span className="ind-pl-k">Prazo restante</span>
            <span className="ind-pl-v">{fmtPct1(restantePct)}</span>
            <small>· {fmtInt(prazo.restantesDias)} dias</small>
          </div>
        </div>
      </div>

      <table className="ind-dtab">
        <tbody>
          <tr>
            <td>Avanço físico (real / prev.)</td>
            <td className="v">
              {fisicoPendente ? "— a medir" : fmtPct1(prazo.avancoFisicoRealPct)} /{" "}
              {fmtPct1(prazo.avancoFisicoPrevistoPct)}
            </td>
          </tr>
          <tr>
            <td>Avanço financeiro (real / prev.)</td>
            <td className="v">
              {fmtPct1(finReal)} / {fmtPct1(finPrev)}
            </td>
          </tr>
          <tr>
            <td>Atraso físico acumulado</td>
            <td className="v">
              {prazo.atrasoFisicoPp != null && !fisicoPendente
                ? `${Math.abs(prazo.atrasoFisicoPp).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p.`
                : "— a medir"}
            </td>
          </tr>
        </tbody>
      </table>

      {proj != null ? (
        <div className={`ind-pbox tone-${projTone}`}>
          <b>Projeção de término: {fmtMeses(proj)}</b> ({fmtMeses(delta, true)} vs prazo de{" "}
          {baseline != null ? fmtMeses(baseline) : "—"} · {fmtInt(prazo.prazoContratualDias)} dias).{" "}
          {mobilizacao
            ? "Ritmo de mobilização ainda baixo — projeção linear pouco representativa nesta fase; monitorar caminho crítico (Windows)."
            : "No ritmo atual, monitorar caminho crítico (Windows)."}
        </div>
      ) : (
        <div className="ind-pbox tone-neutral">
          <b>Projeção de término: — pendente.</b> Sem ritmo suficiente para projetar (Windows).
        </div>
      )}
    </section>
  );
}

// ── Bloco · Análise de Insumos / Materiais ────────────────────────────

type AbcRow = {
  codigo: string;
  descricao: string;
  classe: string | null;
  pct: number;
  precoOrcado: string;
  precoReal: string;
};

const ABC_ORDENACOES: Ordenacao<AbcRow>[] = [
  { value: "pct", label: "% do total", cmp: (a, b) => b.pct - a.pct },
  {
    value: "nome",
    label: "Nome (A–Z)",
    cmp: (a, b) => normTxt(a.descricao).localeCompare(normTxt(b.descricao)),
  },
  {
    value: "classe",
    label: "Classe",
    cmp: (a, b) => (a.classe ?? "Z").localeCompare(b.classe ?? "Z") || b.pct - a.pct,
  },
];

function InsumosBlock({
  insumos,
  excedente,
  erro,
  onRetry,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  insumos: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  excedente: any;
  erro: boolean;
  onRetry: () => void;
}) {
  const desvioMedio = useMemo(() => desvioMedioPonderado(excedente), [excedente]);

  // Curva ABC completa (o read-model já carrega a lista inteira; o cap top-8 é só a vista default).
  const allRows: AbcRow[] = useMemo(() => {
    if (!insumos?.curvaAbcValor) return [];
    const byCodigo = new Map<
      string,
      { classeAbc: string | null; precoOrcado: number | null; unidade: string | null }
    >();
    for (const i of insumos.insumos ?? []) {
      byCodigo.set(i.codigo, {
        classeAbc: i.classeAbc,
        precoOrcado: i.precoOrcado,
        unidade: i.unidade,
      });
    }
    return (
      insumos.curvaAbcValor as Array<{ codigo: string; descricao: string | null; pct: number }>
    ).map((a) => {
      const meta = byCodigo.get(a.codigo);
      return {
        codigo: a.codigo,
        descricao: a.descricao ?? a.codigo,
        classe: meta?.classeAbc ?? null,
        pct: a.pct,
        // preço orçado unitário + unidade (referência).
        precoOrcado:
          meta?.precoOrcado != null
            ? `R$ ${meta.precoOrcado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${meta.unidade ? ` /${normUnidade(meta.unidade)}` : ""}`
            : "—",
        // PENDENTE ≠ 0: preço real PAGO (compras) ainda não lançado → "—" (índice de mercado ≠ compra).
        precoReal: "—",
      };
    });
  }, [insumos]);

  // Top-8 por % do total (vista default) · "Mostrar todos" expande com busca/ordenação/paginação.
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const top8 = useMemo(() => [...allRows].sort((a, b) => b.pct - a.pct).slice(0, 8), [allRows]);
  const col = useColecao(allRows, {
    busca: (r) => `${r.codigo} ${r.descricao} ${r.classe ?? ""}`,
    ordenacoes: ABC_ORDENACOES,
    perPage: 8,
  });
  const maxPct = useMemo(() => allRows.reduce((m, r) => Math.max(m, r.pct), 0), [allRows]);

  if (erro) {
    return (
      <section className="ind-insu">
        <header className="ind-insu-head">
          <h3 className="ind-pan-title">Análise de Insumos / Materiais</h3>
        </header>
        <ErroCard framed={false} titulo="Não foi possível carregar os insumos" onRetry={onRetry} />
      </section>
    );
  }

  if (!insumos) {
    return (
      <section className="ind-insu">
        <header className="ind-insu-head">
          <h3 className="ind-pan-title">Análise de Insumos / Materiais</h3>
        </header>
        <PanelPendente texto="Take-off de insumos ainda não normalizado para esta obra." />
      </section>
    );
  }

  // Farol REAL do dado (mesmo helper do card do topo — nunca mais Badge hardcoded).
  const nivel = nivelInsumos(insumos, excedente);
  const tone = nivel ? farolToBadge[nivel] : "neutral";
  const label = nivel ? farolLabel[nivel] : "Pendente";
  const nAcimaIpca: number = excedente?.acimaTeto?.length ?? 0;

  const normativa = excedente?.normativa ?? "IPCA (cláusula 6.2)";
  const snapshot = excedente?.snapshotLabel ?? null;

  const rows = mostrarTodos ? col.visible : top8;
  const buscaSemMatch = mostrarTodos && col.visible.length === 0 && col.debounced.length > 0;

  return (
    <section className="ind-insu">
      <header className="ind-insu-head">
        <h3 className="ind-pan-title">Análise de Insumos / Materiais</h3>
        <Badge tone={tone} className="ind-card-pill">
          <FarolDot />
          {label}
        </Badge>
      </header>

      <div className="ind-icards">
        <IcKpi label="Insumos monitorados" valor={fmtInt(insumos.nInsumos)} />
        <IcKpi label="Valor contratado (materiais)" valor={fmtMi2(insumos.totalValor)} />
        <IcKpi label="Desvio médio ponderado" valor={fmtPct1Signed(desvioMedio)} />
        <IcKpi label="Repasse real (excedente × medido)" valor={fmtBRL0(excedente?.totalDeltaRs)} />
      </div>

      {allRows.length > 8 ? (
        <div className="ind-abc-bar">
          <span className="ind-abc-count">
            {mostrarTodos
              ? `${fmtInt(allRows.length)} materiais`
              : `Top 8 de ${fmtInt(allRows.length)} materiais por valor`}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setMostrarTodos((t) => !t)}>
            {mostrarTodos ? "Mostrar top 8" : `Mostrar todos (${fmtInt(allRows.length)})`}
          </Button>
        </div>
      ) : null}

      {mostrarTodos ? (
        <ColToolbar col={col} placeholder="Buscar material, código ou classe…" />
      ) : null}

      {buscaSemMatch ? (
        <ColVazio termo={col.debounced} rotulo="material" onClear={() => col.setQuery("")} />
      ) : (
        <DataTable<AbcRow>
          className="ind-abc"
          rows={rows}
          getRowId={(r) => r.codigo}
          emptyText="Sem materiais com valor orçado."
          columns={[
            {
              key: "descricao",
              label: "Principais materiais (Curva ABC)",
              width: "minmax(0,1.6fr)",
            },
            {
              key: "classe",
              label: "Classe",
              width: "80px",
              render: (r) =>
                r.classe ? (
                  // Classe ABC = concentração de valor, não farol — peso neutro (A destaca, sem verde).
                  <span className={`ind-abc-cls${r.classe === "A" ? " ind-abc-cls-a" : ""}`}>
                    {r.classe}
                  </span>
                ) : (
                  <span className="ind-pend">—</span>
                ),
            },
            {
              key: "pct",
              label: "% do total",
              width: "150px",
              align: "right",
              render: (r) => (
                <span className="ind-abc-pct">
                  <span className="ind-abc-pct-track" aria-hidden>
                    <span
                      className="ind-abc-pct-fill"
                      style={{
                        width: `${maxPct > 0 ? Math.min(100, (r.pct / maxPct) * 100) : 0}%`,
                      }}
                    />
                  </span>
                  {fmtPct1(r.pct)}
                </span>
              ),
            },
            { key: "precoOrcado", label: "Preço orçado", width: "150px", align: "right" },
            {
              key: "precoReal",
              label: "Preço real pago",
              width: "150px",
              align: "right",
              render: (r) =>
                r.precoReal === "—" ? <span className="ind-pend">—</span> : r.precoReal,
            },
          ]}
        />
      )}

      {mostrarTodos ? <ColPag col={col} rotulo="materiais" /> : null}

      <p className="ind-nota">
        Índice contratual: {normativa}
        {snapshot ? ` · snapshot ${snapshot}` : ""}.{" "}
        {nAcimaIpca > 0
          ? `${fmtInt(nAcimaIpca)} ${nAcimaIpca === 1 ? "item acima do IPCA aciona" : "itens acima do IPCA acionam"} repasse (cl. 8.8) — farol ${farolLabel.observacao}.`
          : `Preços reais pagos (compras) ainda não lançados — gap zero, farol ${farolLabel.conforme}. O farol acende ao lançar os preços reais.`}
      </p>
    </section>
  );
}

function IcKpi({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="ind-ic">
      <div className="ind-ic-l">{label}</div>
      <div className="ind-ic-v">{valor}</div>
    </div>
  );
}

/** Desvio médio ponderado (índice de mercado vs orçado) sobre os insumos COM índice, ponderado pelo
 *  valor orçado. deltaRealPct é fração. null se nenhum item com índice. PENDENTE ≠ 0. */
function desvioMedioPonderado(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  excedente: any,
): number | null {
  const itens = (excedente?.comIndice ?? []) as Array<{
    deltaRealPct: number | null;
    qtdOrcada: number | null;
    precoOrcadoRs: number | null;
  }>;
  let wsum = 0;
  let w = 0;
  for (const it of itens) {
    if (it.deltaRealPct == null || it.qtdOrcada == null || it.precoOrcadoRs == null) continue;
    const peso = it.qtdOrcada * it.precoOrcadoRs;
    if (peso <= 0) continue;
    wsum += it.deltaRealPct * peso;
    w += peso;
  }
  return w > 0 ? (wsum / w) * 100 : null;
}

function normUnidade(u: string): string {
  const k = u.trim().toUpperCase();
  const map: Record<string, string> = {
    M3: "m³",
    M2: "m²",
    M: "m",
    L: "l",
    KG: "kg",
    T: "t",
    UN: "un",
    H: "h",
  };
  return map[k] ?? u.toLowerCase();
}

// ── Bloco · Análise IA (pendente honesto — sem geração salva no v45) ───

function AnaliseIaBlock() {
  return (
    <section className="ind-ia">
      <header className="ind-ia-head">
        <Badge tone="info" className="ind-ia-badge">
          IA
        </Badge>
        <span className="ind-ia-title">Análise do Período — gerada pelo Adm Contratual IA</span>
      </header>
      <p className="ind-ia-pend">
        Análise ainda não gerada para este BM. Aguardando o Adm Contratual IA consolidar os blocos
        do período.
      </p>
    </section>
  );
}

// ── Pendente genérico de painel ───────────────────────────────────────

function PanelPendente({ texto }: { texto: string }) {
  return <div className="ind-panel-pend">{texto}</div>;
}

// ── Consolidação dos blocos (helper puro) ─────────────────────────────

function computeBlocos({
  calc,
  recursos,
  prazo,
  insumos,
  excedente,
  desvioFatPp,
  mesCorte,
  erros,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  calc: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recursos: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prazo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  insumos: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  excedente: any;
  desvioFatPp: number | null;
  mesCorte: MesCorte;
  erros: { calc: boolean; recursos: boolean; prazo: boolean; insumos: boolean };
}): Bloco[] {
  const out: Bloco[] = [];

  // 1 · Faturamento
  out.push({
    key: "faturamento",
    titulo: "Faturamento",
    icon: "wallet",
    valor: { kind: "texto", texto: fmtPct1(calc?.avancoRealizadoPct) },
    footer: erros.calc
      ? "erro ao carregar — tentar novamente no painel da curva"
      : calc?.realizadoAcum != null
        ? `${fmtMi2(calc.realizadoAcum)} de ${fmtMi2(calc.custoTotal)} · desvio ${fmtPp(desvioFatPp)}`
        : "pendente — sem real acumulado",
    nivel: desvioFatPp != null ? farolPorDesvioPp(desvioFatPp) : null,
    erro: erros.calc,
  });

  // 2 · Prazo (card = decorrido %; farol pelo desvio FINANCEIRO em p.p. = mesmo desvioFatPp,
  // explicitado no microcopy — o físico ainda está a medir)
  out.push({
    key: "prazo",
    titulo: "Prazo",
    icon: "clock",
    valor: { kind: "texto", texto: fmtPct1(prazo?.decorridoPct) },
    footer:
      erros.prazo || erros.calc
        ? "erro ao carregar — tentar novamente no painel"
        : prazo?.decorridoDias != null
          ? `decorrido · ${fmtInt(prazo.decorridoDias)} de ${fmtInt(prazo.prazoContratualDias)} dias · desvio fin. ${fmtPp(desvioFatPp)}`
          : "pendente — sem cronograma",
    footTitle: "Farol pelo desvio financeiro (avanço físico ainda a medir)",
    nivel: desvioFatPp != null ? farolPorDesvioPp(desvioFatPp) : null,
    erro: erros.prazo || erros.calc,
  });

  // 3 · Recursos (mini-lista alocado vs contrato; desvio próprio = (Σreal − Σaté-BM)/Σtotal)
  const rec = recursos?.categorias;
  if (rec) {
    let realT = 0;
    let ateT = 0;
    let totT = 0;
    // PENDENTE ≠ 0: só agrega (e mostra %) onde o REAL foi medido (temReal). Categoria sem real
    // alocado não vira "0,0% alocado" nem entra no desvio — senão fabricaria farol sobre área cega.
    const itens = CATS.map((cat) => {
      const c = rec[cat];
      const total = c?.contratadoQtde ?? 0;
      const acum = c ? acumAteCorte(c.serieMensal ?? [], mesCorte) : { contr: 0, real: 0 };
      if (c?.temReal) {
        realT += acum.real;
        ateT += acum.contr;
        totT += total;
      }
      return {
        rotulo: cat,
        valor: c?.temReal && total > 0 ? fmtPct1((acum.real / total) * 100) : "—",
      };
    });
    const temRealRec = recursos.temRealGlobal === true;
    const desvioRec = temRealRec && totT > 0 ? ((realT - ateT) / totT) * 100 : null;
    out.push({
      key: "recursos",
      titulo: "Recursos",
      icon: "users",
      valor: { kind: "mini", itens },
      footer: temRealRec
        ? `alocado vs contrato · desvio ${fmtPp(desvioRec)}`
        : "pendente — real (alocado) não lançado",
      nivel: desvioRec != null ? farolPorDesvioPp(desvioRec) : null,
    });
  } else {
    out.push({
      key: "recursos",
      titulo: "Recursos",
      icon: "users",
      valor: { kind: "texto", texto: "—" },
      footer: erros.recursos
        ? "erro ao carregar — tentar novamente no painel"
        : "pendente — recursos (C.4) ainda não normalizados",
      nivel: null,
      erro: erros.recursos,
    });
  }

  // 4 · Insumos (v53 multifonte) — farol pela regra da C.6/D.5 via nivelInsumos (helper ÚNICO,
  // o mesmo do bloco ABC): excedente ao IPCA aciona repasse (cl. 8.8) → Observação.
  const desvioMedio = desvioMedioPonderado(excedente);
  const nAcimaIpca = excedente?.acimaTeto?.length ?? 0;
  out.push({
    key: "insumos",
    titulo: "Insumos",
    icon: "pkg",
    valor: {
      kind: "texto",
      texto: insumos ? (nAcimaIpca > 0 ? "Acima do IPCA" : "Dentro do índice") : "—",
    },
    footer: erros.insumos
      ? "erro ao carregar — tentar novamente no bloco de insumos"
      : insumos
        ? `${fmtInt(insumos.nInsumos)} monitorados · ${fmtInt(nAcimaIpca)} acima do IPCA · desvio médio ${fmtPct1Signed(desvioMedio)}`
        : "pendente — sem insumos normalizados",
    nivel: erros.insumos ? null : nivelInsumos(insumos, excedente),
    erro: erros.insumos,
  });

  return out;
}

function computeConsolidado(blocos: Bloco[]): Consolidado | null {
  const medidos = blocos.filter((b) => b.nivel != null && b.erro !== true) as Array<
    Bloco & { nivel: FarolLevel }
  >;
  if (medidos.length === 0) return null;
  const pior = medidos.reduce((a, b) => (SEV[b.nivel] >= SEV[a.nivel] ? b : a));
  const nivel = pior.nivel;

  const semRiscoCritico = medidos.every((b) => b.nivel === "conforme" || b.nivel === "observacao");
  const piores = medidos.filter((b) => b.nivel === nivel).map((b) => b.titulo.toLowerCase());
  const nomes = joinE(piores);
  const nomesCap = nomes.charAt(0).toUpperCase() + nomes.slice(1);

  let mensagem: string;
  if (nivel === "conforme") {
    mensagem =
      "Todos os blocos dentro da régua. Faturamento, prazo, recursos e insumos conformes. Monitorar.";
  } else if (nivel === "observacao") {
    mensagem = `${semRiscoCritico ? "Nenhum bloco em Risco ou Crítico. " : ""}${nomesCap} levemente abaixo do previsto — desvios pequenos, próprios da fase de mobilização. Monitorar.`;
  } else if (nivel === "risco") {
    mensagem = `${nomesCap} em Risco — desvio relevante sobre o previsto. Priorizar ação corretiva.`;
  } else {
    mensagem = `${nomesCap} em situação Crítica — desvio severo sobre o previsto. Ação imediata.`;
  }

  return { nivel, titulo: farolLabel[nivel], mensagem };
}

/** "a", "a e b", "a, b e c" (PT-BR). */
function joinE(itens: string[]): string {
  if (itens.length === 0) return "";
  if (itens.length === 1) return itens[0];
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}
