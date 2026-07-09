// M3.4 · D.4 — PERDA DE PRODUTIVIDADE. Três métodos em paralelo do dado REAL da obra:
//  • Total Cost (ATIVO · alimenta a D.0) = Real alocado − Contratado total × avanço de serviços
//  • Valor Agregado (AACE 25R-03) = Real alocado − VA necessário (CPU × quantidades executadas)
//  • Milha Aferida = aguarda baseline produtivo (mob. mín. 70% · só 3 meses de mobilização)
// Núcleo via useValorAgregado: `perda` (Total Cost + Milha), `d4` (Valor Agregado first-class),
// `valorContratado` (PV), `totalCostFuncoes` (detalhe por função, com gate de conservação interno).
// Os 2 cards de detalhe expandem (estado React). Nada de número fabricado — erro = milhões.

import { type ReactNode, useState } from "react";
import { ArrowRight, ChevronDown, ChevronRight, Hourglass } from "lucide-react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Badge,
  CHART_SERIE_COR,
  ChartLegend,
  ChartTooltip,
  EmptyState,
  ErroCard,
  I,
  Skeleton,
} from "@/components/ds";
import { type ValorAgregadoView, useValorAgregado } from "@/lib/hooks/useValorAgregado";
import { farolLabel, farolToBadge } from "@/lib/mocks/contracts";
import { normalizarFarol } from "@/lib/supabase/faturamentoDisciplinaResumo";
import type { TotalCostFuncoes } from "@/lib/supabase/totalCostFuncoes";
import type { ValorAgregadoResumo } from "@/lib/supabase/valorAgregado";
import type { PerdaProdutividade } from "@/lib/supabase/perdaProdutividade";
import { formatBRL, formatNum } from "@/lib/format";
import "./valor-agregado.css";

export const Route = createFileRoute("/_app/contracts/$contractId/desequilibrio/valor-agregado")({
  component: ValorAgregadoPage,
  head: () => ({ meta: [{ title: "3.4 Perda de Produtividade — RDM IA" }] }),
});

// % com 2 casas a partir de uma FRAÇÃO (0,011 → "1,10%"). "—" se nulo.
const fmtPctFrac = (frac: number | null | undefined): string =>
  frac != null
    ? `${(frac * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
    : "—";

function ValorAgregadoPage() {
  const { contractId } = Route.useParams();
  const { data, isLoading, isError, error, refetch } = useValorAgregado(contractId);

  return (
    <main className="va-main">
      <VAHeader v={data ?? null} />
      {isLoading ? (
        <VASkeleton />
      ) : isError ? (
        <ErroCard mensagem={error?.message} onRetry={() => refetch()} />
      ) : !data || (!data.perda && !data.d4) ? (
        <EmptyState
          framed
          title="Perda de Produtividade ainda não normalizada"
          text="Os três métodos (Total Cost · Valor Agregado · Milha Aferida) desta obra aparecerão aqui quando a D.4 for normalizada."
          hint="Aguardando normalização (M3)"
        />
      ) : (
        <VAConteudo v={data} />
      )}
    </main>
  );
}

// ── Header ───────────────────────────────────────────────────────────

function VAHeader({ v }: { v: ValorAgregadoView | null }) {
  const farol = v ? normalizarFarol(v.d4?.farolTotal ?? v.perda?.totalCost.farol ?? null) : null;
  return (
    <header className="va-head">
      <div className="va-head-main">
        <h2 className="va-titulo">D.4 — Perda de Produtividade</h2>
        <p className="va-sub">
          Três métodos em paralelo — <b>Total Cost</b>, <b>Valor Agregado</b> (AACE 25R-03) e{" "}
          <b>Milha Aferida</b>. O cliente pode escolher o mais favorável ou apresentar o intervalo.
          O método ativo (Total Cost <b>sem ajuste</b>, que bate com a C.4) alimenta a D.0
          {v?.nome ? ` · ${v.nome}` : ""}
        </p>
      </div>
      {farol ? <Badge tone={farolToBadge[farol]}>{farolLabel[farol]}</Badge> : null}
    </header>
  );
}

// ── Conteúdo (dado real) ─────────────────────────────────────────────

function VAConteudo({ v }: { v: ValorAgregadoView }) {
  const { perda, d4, valorContratado } = v;
  const funcoes = v.totalCostFuncoes;

  // Total Cost ATIVO = SEM ajuste (Real − Previsto no período) = 791.458 · headline desta tela D.4.
  // (A parcela D.4 do PAINEL D.0 é OUTRA: o "Total Cost do período" 736.741 da Bloco 2 — ver desequilibrio.ts.)
  // Fonte: a curva por função recomputada (reconcilia) ou o canônico da C.4.
  const tcSemRs = funcoes?.totalSem ?? perda?.semAjuste.totalRs ?? null;
  // Total Cost COM ajuste (teto conservador) = Real CHEIO − Contratado ajustado (×avanço · escopo de
  // PRODUÇÃO da Tabela de ajuste D.4) = 6.095.937 (= mockup). A tabela função-a-função fica em escopo
  // cheio (frota inteira); a diferença para esta soma é o equipamento de apoio (ressalva no detalhe).
  const tcComRs =
    funcoes != null && perda?.totalCost.contratadoAjustadoRs != null
      ? funcoes.totalReal - perda.totalCost.contratadoAjustadoRs
      : (funcoes?.totalCom ?? perda?.totalCost.totalRs ?? null);
  // % PV do método ativo = sem ajuste / PV.
  const tcPctPv =
    tcSemRs != null && valorContratado && valorContratado > 0 ? tcSemRs / valorContratado : null;

  // Valor Agregado (AACE 25R-03). O "real alocado" é o MESMO real cheio da curva por função (apoio
  // incluído) → reconcilia com o Total Cost (mesma frota) e com o KPI. perda = real − agregado.
  // Fallback: a tabela VA normalizada (que usa escopo produção e não fecha com a TOTAL).
  const vaRealTotal = funcoes?.totalReal ?? d4?.total?.realAlocadoRs ?? null;
  const vaMedidoTotal = d4?.total?.vaMedidoRs ?? null;
  const vaPerdaRs =
    vaRealTotal != null && vaMedidoTotal != null
      ? vaRealTotal - vaMedidoTotal
      : (d4?.total?.perdaRs ?? null);
  const vaPctPv =
    vaPerdaRs != null && valorContratado && valorContratado > 0
      ? vaPerdaRs / valorContratado
      : null;

  const avanco = perda?.avancoServicos ?? null;
  const milha = perda?.milha ?? null;

  return (
    <>
      <ResumoMetodos
        totalCostRs={tcSemRs}
        tcPctPv={tcPctPv}
        vaPerdaRs={vaPerdaRs}
        vaPctPv={vaPctPv}
        avanco={avanco}
      />

      <Comparativo totalCostRs={tcSemRs} vaPerdaRs={vaPerdaRs} />

      <ReconciliacaoD0
        desequilibrioVA={v.desequilibrioVA}
        tcSemRs={tcSemRs}
        vaPerdaRs={vaPerdaRs}
      />

      <EvolucaoVA d4={d4} />

      <DetalheCards perda={perda} d4={d4} funcoes={funcoes} tcSemRs={tcSemRs} tcComRs={tcComRs} />

      <MilhaBloco milha={milha} />

      <section className="va-caveat va-caveat-warn">
        <b>Leitura honesta (corte atual):</b> o avanço de serviços é de apenas{" "}
        {avanco != null ? fmtPctFrac(avanco) : "—"}. O Total Cost <b>sem ajuste</b> (ativo) aponta{" "}
        <b>{tcSemRs != null ? formatBRL(tcSemRs) : "—"}</b>, enquanto o <b>com ajuste</b> e o Valor
        Agregado chegam a ~R$ 6 mi — a diferença é a <b>mobilização</b> (recursos mobilizados antes
        da produção engrenar), não improdutividade comprovada. À medida que a obra produzir, os três
        métodos convergem e o número se estabiliza. Por isso a D.0 aplica um fator de recuperação.
      </section>

      <section className="va-ia">
        <div className="va-ia-tag">{I.note({ size: 12 })} LEITURA DA D.4 · ADM CONTRATUAL IA</div>
        <p className="va-ia-texto">
          Total Cost sem ajuste (ativo) = <b>{tcSemRs != null ? formatBRL(tcSemRs) : "—"}</b> e
          Valor Agregado = <b>{vaPerdaRs != null ? formatBRL(vaPerdaRs) : "—"}</b>; a Milha aguarda
          baseline produtivo. Os três métodos cercam a perda de produtividade por ângulos
          diferentes.
        </p>
        <p className="va-ia-texto">
          No corte atual a leitura é cautelosa: com avanço de{" "}
          {avanco != null ? fmtPctFrac(avanco) : "—"}, o número é majoritariamente mobilização. O
          valor ganha força como pleito quando houver meses produtivos para a Milha referenciar e o
          avanço sair do regime de mobilização.
        </p>
      </section>
    </>
  );
}

// ── Resumo dos três métodos · cards INTELIGENTES (cor automática por método/status) ──────
// Sem barra colorida em cima (regra do projeto): a cor vem do tom — ícone em badge tingido,
// tag e mini-barra de magnitude — preenchidos a partir do `tom`. Tudo tokens-only.

type MetodoTom = "info" | "neutral" | "brand";
type Metodo = {
  tom: MetodoTom;
  icon: ReactNode;
  label: string;
  valor: ReactNode;
  sub: ReactNode;
  tag?: string;
  /** 0..1 — largura da mini-barra (magnitude vs o maior, ou avanço). */
  barFrac?: number | null;
  pending?: boolean;
  /** Destaque de método ativo/selecionado — fundo brand leve (padrão herói /indiretos). NÃO é farol. */
  hero?: boolean;
};

function MetodoCard({ tom, icon, label, valor, sub, tag, barFrac, pending, hero }: Metodo) {
  const w = barFrac != null ? Math.max(4, Math.min(100, barFrac * 100)) : 0;
  return (
    <article className={`metodo-card metodo-${tom}${hero ? " metodo-hero" : ""}`}>
      <header className="metodo-head">
        <span className="metodo-ico" aria-hidden>
          {icon}
        </span>
        <span className="metodo-label">{label}</span>
        {tag ? <span className="metodo-tag">{tag}</span> : null}
      </header>
      <div className={`metodo-valor tabular${pending ? " metodo-valor-wait" : ""}`}>{valor}</div>
      <p className="metodo-sub tabular">{sub}</p>
      <div className={`metodo-bar${pending ? " metodo-bar-pend" : ""}`} aria-hidden>
        {pending ? null : <i style={{ width: `${w}%` }} />}
      </div>
    </article>
  );
}

function ResumoMetodos({
  totalCostRs,
  tcPctPv,
  vaPerdaRs,
  vaPctPv,
  avanco,
}: {
  totalCostRs: number | null;
  tcPctPv: number | null;
  vaPerdaRs: number | null;
  vaPctPv: number | null;
  avanco: number | null;
}) {
  // Escala comum das duas perdas em R$ (a maior = barra cheia) → comparação visual TC × VA.
  const maxRs = Math.max(totalCostRs ?? 0, vaPerdaRs ?? 0) || 1;
  const metodos: Metodo[] = [
    {
      tom: "brand",
      hero: true,
      icon: I.wallet({ size: 15 }),
      label: "Total Cost",
      tag: "ATIVO",
      valor: totalCostRs != null ? formatBRL(totalCostRs) : "—",
      sub: (
        <>
          alimenta a D.0 · {tcPctPv != null ? `${fmtPctFrac(tcPctPv)} do PV` : "% do PV pendente"}
        </>
      ),
      barFrac: totalCostRs != null ? totalCostRs / maxRs : null,
    },
    {
      tom: "info",
      icon: I.trendUp({ size: 15 }),
      label: "Valor Agregado",
      valor: vaPerdaRs != null ? formatBRL(vaPerdaRs) : "—",
      sub: (
        <>AACE 25R-03 · {vaPctPv != null ? `${fmtPctFrac(vaPctPv)} do PV` : "% do PV pendente"}</>
      ),
      barFrac: vaPerdaRs != null ? vaPerdaRs / maxRs : null,
    },
    {
      tom: "neutral",
      icon: I.flag({ size: 15 }),
      label: "Milha Aferida",
      valor: (
        <>
          <Hourglass size={13} aria-hidden /> Aguardando
        </>
      ),
      sub: "precisa de baseline produtivo",
      pending: true,
    },
    {
      tom: "brand",
      icon: I.trending({ size: 15 }),
      label: "Avanço de serviços",
      valor: avanco != null ? fmtPctFrac(avanco) : "—",
      sub: "executado até o corte atual",
      barFrac: avanco,
    },
  ];
  return (
    <section>
      <h3 className="va-sec-titulo">Resumo dos três métodos</h3>
      <div className="va-resumo">
        {metodos.map((m) => (
          <MetodoCard key={m.label} {...m} />
        ))}
      </div>
    </section>
  );
}

// ── Comparativo (tabela 4-col) ──────────────────────────────────────

function Comparativo({
  totalCostRs,
  vaPerdaRs,
}: {
  totalCostRs: number | null;
  vaPerdaRs: number | null;
}) {
  return (
    <section>
      <h3 className="va-sec-titulo">Comparativo</h3>
      <div className="va-cmp">
        <div className="va-cmp-head">
          <span>Método</span>
          <span>Como mede</span>
          <span className="right">Resultado</span>
          <span>Situação</span>
        </div>
        <div className="va-cmp-row va-cmp-ativo">
          <span className="va-cmp-met">Total Cost</span>
          <span className="va-cmp-como">
            Real alocado − previsto no período (histograma contratado até o BM)
          </span>
          <span className="right tabular va-cmp-res">
            {totalCostRs != null ? formatBRL(totalCostRs) : "—"}
          </span>
          <span className="va-cmp-sit">
            <Badge tone="brand">Ativo · alimenta a D.0</Badge>
          </span>
        </div>
        <div className="va-cmp-row">
          <span className="va-cmp-met">Valor Agregado</span>
          <span className="va-cmp-como">
            Real alocado − valor agregado (CPU × quantidades executadas)
          </span>
          <span className="right tabular va-cmp-res">
            {vaPerdaRs != null ? formatBRL(vaPerdaRs) : "—"}
          </span>
          <span className="va-cmp-sit">
            <Badge tone="info">Referência comparativa</Badge>
          </span>
        </div>
        <div className="va-cmp-row">
          <span className="va-cmp-met">Milha Aferida</span>
          <span className="va-cmp-como">
            Produtividade de cada mês × milha de referência (melhor mês)
          </span>
          <span className="right tabular va-cmp-pend">—</span>
          <span className="va-cmp-sit">
            <span className="va-cmp-wait">
              <Hourglass size={13} aria-hidden /> Aguardando
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}

// ── Reconciliação com a D.0 (âncora) ─────────────────────────────────
// A parcela D.4 do painel D.0 (desequilibrioVA · = ctx.categoriaRs("D.4")) é OUTRO número que o
// headline desta tela. Expõe a ponte VERBATIM — NUNCA um "=" entre 791.458 e 736.741: a D.0 recebe
// o "Total Cost do período" (Bloco 2); esta tela detalha o método (sem ajuste + Valor Agregado).

function ReconciliacaoD0({
  desequilibrioVA,
  tcSemRs,
  vaPerdaRs,
}: {
  desequilibrioVA: number | null;
  tcSemRs: number | null;
  vaPerdaRs: number | null;
}) {
  const { contractId } = Route.useParams();
  if (desequilibrioVA == null) return null;
  return (
    <section className="va-recon">
      <div className="va-recon-main">
        <span className="va-recon-l">Parcela D.4 no painel D.0</span>
        <span className="va-recon-v tabular">{formatBRL(desequilibrioVA)}</span>
        <Link
          to="/contracts/$contractId/desequilibrio"
          params={{ contractId }}
          className="va-recon-link"
        >
          Abrir painel D.0 <ArrowRight size={13} aria-hidden />
        </Link>
      </div>
      <p className="va-recon-txt">
        Esse é o número que a D.0 recebe — o <b>Total Cost do período</b> consolidado na Bloco 2.{" "}
        <b>Não é</b> o headline desta tela: o Total Cost <b>sem ajuste</b> (ativo) marca{" "}
        <b>{tcSemRs != null ? formatBRL(tcSemRs) : "—"}</b> e o <b>Valor Agregado</b> chega a{" "}
        <b>{vaPerdaRs != null ? formatBRL(vaPerdaRs) : "—"}</b>. São três leituras do mesmo fenômeno
        por ângulos diferentes — a D.0 aplica o fator de recuperação sobre esse intervalo.
      </p>
    </section>
  );
}

// ── Evolução — Real alocado × Valor Agregado (acumulado) ─────────────
// Plota a série mensal do read-model (vaAcumRs/realAcumRs JÁ derivados "p/ o gráfico") — NÃO recalcula
// nada. Real = navy · VA medido = info · a Perda (Real − VA, o gap) entra no tooltip com danger (ruim).
// Tudo é medido (até o BM) → linhas sólidas; a série não tem projeção (nada tracejado a fabricar).

function EvolucaoVA({ d4 }: { d4: ValorAgregadoResumo | null }) {
  if (!d4 || d4.serieMensal.length === 0) return null;
  const chart = d4.serieMensal.map((m) => ({
    bm: m.periodoLabel ?? `${m.mes}/${m.ano}`,
    real: m.realAcumRs / 1e6,
    va: m.vaAcumRs / 1e6,
    // Perda no ponto (Real − VA acum.) — o gap que dá nome à D.4, visível no tooltip.
    perda: (m.realAcumRs - m.vaAcumRs) / 1e6,
  }));
  const fmtMi = (v: number) => `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`;
  return (
    <section>
      <h3 className="va-sec-titulo">Evolução — Real alocado × Valor Agregado (acumulado)</h3>
      <div className="va-chart-card">
        <ChartLegend
          className="va-chart-legend"
          items={[
            { label: "Real alocado (acum.)", tipo: "linha", cor: CHART_SERIE_COR.real },
            { label: "Valor Agregado medido (acum.)", tipo: "linha", cor: "var(--info)" },
            { label: "Perda (Real − VA)", tipo: "dot", cor: CHART_SERIE_COR.ruim },
          ]}
        />
        <div className="va-chart">
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={chart} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="bm"
                tick={{ fontSize: 10, fill: "var(--text-3)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--text-3)" }}
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={(v) => `R$ ${Number(v).toLocaleString("pt-BR")} mi`}
              />
              <Tooltip
                cursor={{ stroke: "var(--border-strong)" }}
                content={<ChartTooltip formatter={fmtMi} />}
              />
              {/* Real / Executado alocado = navy canônico. */}
              <Line
                type="monotone"
                dataKey="real"
                name="Real alocado (acum.)"
                stroke={CHART_SERIE_COR.real}
                strokeWidth={2.5}
                dot={{ r: 2.5 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="va"
                name="Valor Agregado medido (acum.)"
                stroke="var(--info)"
                strokeWidth={2.5}
                dot={{ r: 2.5 }}
                isAnimationActive={false}
              />
              {/* Série invisível: injeta a Perda (Real − VA) no tooltip sem desenhar — swatch danger
                  (o gap é semanticamente ruim; o farol da perda continua no header). */}
              <Line
                type="monotone"
                dataKey="perda"
                name="Perda (Real − VA)"
                stroke={CHART_SERIE_COR.ruim}
                strokeWidth={0}
                dot={false}
                activeDot={false}
                legendType="none"
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

// ── Detalhe — 2 cards expansíveis ───────────────────────────────────

function DetalheCards({
  perda,
  d4,
  funcoes,
  tcSemRs,
  tcComRs,
}: {
  perda: PerdaProdutividade | null;
  d4: ValorAgregadoResumo | null;
  funcoes: TotalCostFuncoes | null;
  tcSemRs: number | null;
  tcComRs: number | null;
}) {
  const [openTC, setOpenTC] = useState(false);
  const [openVA, setOpenVA] = useState(false);
  const [tcMode, setTcMode] = useState<"sem" | "com">("sem");
  const sem = tcMode === "sem";

  const avanco = funcoes?.avanco ?? perda?.avancoServicos ?? 0;
  const gMod = funcoes?.grupos.find((g) => g.categoria === "MOD") ?? null;
  const gEqp = funcoes?.grupos.find((g) => g.categoria === "EQP") ?? null;

  type Lin = {
    rec: string;
    real: number | null;
    meio: number | null;
    fim: number | null;
    tot?: boolean;
  };
  // contratado ajustado (×avanço · escopo PRODUÇÃO) da Tabela de ajuste D.4, por categoria.
  const ajCat = (cat: string) =>
    perda?.totalCost.categorias.find((c) => c.categoria === cat)?.contratadoAjustadoRs ?? null;
  const grpLin = (rec: string, g: typeof gMod): Lin => {
    const aj = ajCat(rec);
    return {
      rec,
      real: g?.subtotalReal ?? null,
      meio: sem ? (g?.subtotalPeriodo ?? null) : (aj ?? (g ? g.subtotalCheio * avanco : null)),
      fim: sem
        ? (g?.subtotalSem ?? null)
        : g?.subtotalReal != null && aj != null
          ? g.subtotalReal - aj
          : (g?.subtotalCom ?? null),
    };
  };
  const linhas: Lin[] = funcoes
    ? [
        grpLin("MOD", gMod),
        grpLin("EQP", gEqp),
        {
          rec: "TOTAL",
          tot: true,
          real: funcoes.totalReal,
          meio: sem
            ? funcoes.totalPeriodo
            : (perda?.totalCost.contratadoAjustadoRs ?? funcoes.totalCheio * avanco),
          fim: sem
            ? funcoes.totalSem
            : perda?.totalCost.contratadoAjustadoRs != null
              ? funcoes.totalReal - perda.totalCost.contratadoAjustadoRs
              : funcoes.totalCom,
        },
      ]
    : [
        ...(perda?.totalCost.categorias ?? []).map((c) => ({
          rec: c.categoria,
          real: c.realRs,
          meio: c.contratadoAjustadoRs,
          fim: c.totalCostRs,
        })),
        {
          rec: "TOTAL",
          tot: true,
          real: perda?.totalCost.realTotalRs ?? null,
          meio: perda?.totalCost.contratadoAjustadoRs ?? null,
          fim: perda?.totalCost.totalRs ?? null,
        },
      ];
  const meioLabel = sem ? "Previsto no período" : "Contrat. ×avanço";

  // VA: "real alocado" = real cheio da curva por função (apoio incluído) → reconcilia com o Total
  // Cost e com a linha TOTAL; perda = real − agregado. Fallback: tabela VA normalizada (escopo produção).
  const vaRow = (
    rec: string,
    g: typeof gMod,
    dcat:
      | { realAlocadoRs: number | null; vaMedidoRs: number | null; perdaRs: number | null }
      | null
      | undefined,
    tot?: boolean,
  ): Lin => {
    const real = funcoes
      ? tot
        ? funcoes.totalReal
        : (g?.subtotalReal ?? null)
      : (dcat?.realAlocadoRs ?? null);
    const meio = dcat?.vaMedidoRs ?? null;
    const fim = real != null && meio != null ? real - meio : (dcat?.perdaRs ?? null);
    return { rec, real, meio, fim, tot };
  };
  const vaLinhas: Lin[] = [
    vaRow("MOD", gMod, d4?.mod),
    vaRow("EQP", gEqp, d4?.eqp),
    vaRow("TOTAL", null, d4?.total, true),
  ];

  return (
    <section>
      <h3 className="va-sec-titulo">Detalhe — clique para abrir</h3>
      <div className="va-detgrid">
        {/* Total Cost — com toggle sem/com ajuste */}
        <div className={`va-detcard${openTC ? " va-detcard-open" : ""}`}>
          <h4 className="va-detcard-title">
            <span>{I.wallet({ size: 14 })} Total Cost (ativo)</span>
            <button
              type="button"
              className="va-detcard-exp"
              aria-expanded={openTC}
              onClick={() => setOpenTC((o) => !o)}
            >
              {openTC ? (
                <>
                  <ChevronDown size={13} aria-hidden /> fechar
                </>
              ) : funcoes ? (
                <>
                  <ChevronRight size={13} aria-hidden /> ver por função
                </>
              ) : (
                <>
                  <ChevronRight size={13} aria-hidden /> ver por categoria
                </>
              )}
            </button>
          </h4>
          {funcoes ? (
            <div className="va-tc-toggle" role="tablist" aria-label="Ajuste do Total Cost">
              <button
                type="button"
                role="tab"
                aria-selected={sem}
                className={`va-tc-tgl${sem ? " va-tc-tgl-on va-tc-tgl-sem" : ""}`}
                onClick={() => setTcMode("sem")}
              >
                <span className="va-tc-tgl-l">Sem ajuste · ATIVO</span>
                <span className="va-tc-tgl-v tabular">
                  {tcSemRs != null ? formatBRL(tcSemRs) : "—"}
                </span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={!sem}
                className={`va-tc-tgl${!sem ? " va-tc-tgl-on va-tc-tgl-com" : ""}`}
                onClick={() => setTcMode("com")}
              >
                <span className="va-tc-tgl-l">Com ajuste</span>
                <span className="va-tc-tgl-v tabular">
                  {tcComRs != null ? formatBRL(tcComRs) : "—"}
                </span>
              </button>
            </div>
          ) : null}
          <table className="va-mini">
            <thead>
              <tr>
                <th>Recurso</th>
                <th>Real alocado</th>
                <th>{meioLabel}</th>
                <th>Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <MiniRow
                  key={l.rec}
                  rec={l.rec}
                  real={l.real}
                  meio={l.meio}
                  fim={l.fim}
                  tot={l.tot}
                />
              ))}
            </tbody>
          </table>
          <p className="va-tc-note">
            {sem
              ? "Sem ajuste: Real − previsto no período (histograma contratado nos meses decorridos). Bate com a C.4 — método ativo, reflete a improdutividade sem penalizar a mobilização."
              : "Com ajuste: Real − (contratado cheio × avanço de serviços). Penaliza a mobilização (gasto proporcional ao avanço físico). Mais conservador; útil como teto."}
          </p>
        </div>

        {/* Valor Agregado */}
        <div className={`va-detcard${openVA ? " va-detcard-open" : ""}`}>
          <h4 className="va-detcard-title">
            <span>{I.trendUp({ size: 14 })} Valor Agregado (AACE 25R-03)</span>
            <button
              type="button"
              className="va-detcard-exp"
              aria-expanded={openVA}
              onClick={() => setOpenVA((o) => !o)}
            >
              {openVA ? (
                <>
                  <ChevronDown size={13} aria-hidden /> fechar
                </>
              ) : (
                <>
                  <ChevronRight size={13} aria-hidden /> ver itens da PQ
                </>
              )}
            </button>
          </h4>
          <table className="va-mini">
            <thead>
              <tr>
                <th>Recurso</th>
                <th>Real alocado</th>
                <th>Agregado (CPU)</th>
                <th>Perda</th>
              </tr>
            </thead>
            <tbody>
              {vaLinhas.map((l) => (
                <MiniRow
                  key={l.rec}
                  rec={l.rec}
                  real={l.real}
                  meio={l.meio}
                  fim={l.fim}
                  tot={l.tot}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detalhe expandido — Total Cost por função (ou por categoria se o gate não conservar) */}
      {openTC ? (
        <DetalheTotalCost funcoes={funcoes} perda={perda} sem={sem} tcComRs={tcComRs} />
      ) : null}

      {/* Detalhe expandido — Valor Agregado · itens da PQ */}
      {openVA ? <DetalheValorAgregado d4={d4} /> : null}
    </section>
  );
}

function MiniRow({
  rec,
  real,
  meio,
  fim,
  tot,
}: {
  rec: string;
  real: number | null | undefined;
  meio: number | null | undefined;
  fim: number | null | undefined;
  tot?: boolean;
}) {
  const fmt = (n: number | null | undefined) => (n != null ? formatBRL(n) : "—");
  return (
    <tr className={tot ? "va-mini-tot" : undefined}>
      <td>{rec}</td>
      <td className="tabular">{fmt(real)}</td>
      <td className="tabular">{fmt(meio)}</td>
      <td className="tabular va-mini-deq">{fmt(fim)}</td>
    </tr>
  );
}

// Total Cost — função a função (gate conservado) OU por categoria (gate não conservou / seções ausentes).
function DetalheTotalCost({
  funcoes,
  perda,
  sem,
  tcComRs,
}: {
  funcoes: TotalCostFuncoes | null;
  perda: PerdaProdutividade | null;
  sem: boolean;
  tcComRs: number | null;
}) {
  const fmt = (n: number | null | undefined) => (n != null ? formatBRL(n) : "—");

  if (!funcoes) {
    // Fallback honesto: detalhe por categoria (o detalhe por função aguarda normalização / não conservou).
    const tc = perda?.totalCost ?? null;
    return (
      <div className="va-det">
        <h4 className="va-sec-titulo va-det-titulo">
          Total Cost — por categoria (real × contratado cheio)
        </h4>
        <table className="va-dt">
          <thead>
            <tr>
              <th>Categoria</th>
              <th>Real alocado</th>
              <th>Contratado (cheio)</th>
              <th>Total Cost</th>
            </tr>
          </thead>
          <tbody>
            {tc?.categorias.map((c) => (
              <tr key={c.categoria}>
                <td>{c.categoria}</td>
                <td className="tabular">{fmt(c.realRs)}</td>
                <td className="tabular">{fmt(c.contratadoCheioRs)}</td>
                <td className="tabular va-dt-deq">{fmt(c.totalCostRs)}</td>
              </tr>
            ))}
            <tr className="va-dt-tot">
              <td>TOTAL (MOD + EQP)</td>
              <td className="tabular">{fmt(tc?.realTotalRs)}</td>
              <td className="tabular">{fmt(tc?.contratadoTotalRs)}</td>
              <td className="tabular va-dt-deq">{fmt(tc?.totalRs)}</td>
            </tr>
          </tbody>
        </table>
        <div className="va-caveat va-caveat-info">
          O detalhe por função aguarda normalização das seções de histograma — exibindo o nível por
          categoria, que conserva contra o card acima.
        </div>
      </div>
    );
  }

  const meioLabel = sem ? "Contratado até o período" : "Contratado (cheio)";
  return (
    <div className="va-det">
      <h4 className="va-sec-titulo va-det-titulo">
        Total Cost — real × {sem ? "previsto no período" : "contratado cheio"}, função a função
      </h4>
      <table className="va-dt">
        <thead>
          <tr>
            <th>Função / Equipamento</th>
            <th>Real alocado</th>
            <th>{meioLabel}</th>
            <th>Total Cost</th>
          </tr>
        </thead>
        <tbody>
          {funcoes.grupos.map((g) => (
            <FuncaoGrupo key={g.categoria} g={g} sem={sem} />
          ))}
          <tr className="va-dt-tot">
            <td>TOTAL (MOD + EQP)</td>
            <td className="tabular">{fmt(funcoes.totalReal)}</td>
            <td className="tabular">{fmt(sem ? funcoes.totalPeriodo : funcoes.totalCheio)}</td>
            <td className="tabular va-dt-deq">{fmt(sem ? funcoes.totalSem : funcoes.totalCom)}</td>
          </tr>
        </tbody>
      </table>
      <div className="va-caveat va-caveat-warn">
        {sem
          ? "Total Cost por função = Real − Previsto no período (histograma contratado nos meses decorridos). É o método ativo, que bate com a C.4."
          : `Total Cost por função = Real − Contratado cheio × avanço de serviços (${fmtPctFrac(funcoes.avanco)}), na frota CHEIA (apoio incluído). O headline do com-ajuste (${tcComRs != null ? formatBRL(tcComRs) : "—"}) usa o contratado de PRODUÇÃO da Tabela de ajuste D.4 — a diferença para esta soma é o equipamento de apoio.`}
      </div>
    </div>
  );
}

function FuncaoGrupo({ g, sem }: { g: TotalCostFuncoes["grupos"][number]; sem: boolean }) {
  const fmt = (n: number) => formatBRL(n);
  return (
    <>
      <tr className="va-dt-grp">
        <td colSpan={4}>{g.rotulo}</td>
      </tr>
      {g.funcoes.map((f, i) => (
        <tr key={`${g.categoria}-${i}-${f.recurso}`}>
          <td>{f.recurso}</td>
          <td className="tabular">{fmt(f.realRs)}</td>
          <td className="tabular">{fmt(sem ? f.contratadoPeriodoRs : f.contratadoCheioRs)}</td>
          <td className="tabular va-dt-deq">{fmt(sem ? f.totalCostSemRs : f.totalCostComRs)}</td>
        </tr>
      ))}
      <tr className="va-dt-sub">
        <td>Subtotal {g.categoria}</td>
        <td className="tabular">{fmt(g.subtotalReal)}</td>
        <td className="tabular">{fmt(sem ? g.subtotalPeriodo : g.subtotalCheio)}</td>
        <td className="tabular va-dt-deq">{fmt(sem ? g.subtotalSem : g.subtotalCom)}</td>
      </tr>
    </>
  );
}

// Valor Agregado — itens da PQ (quantidade medida × CPU).
function DetalheValorAgregado({ d4 }: { d4: ValorAgregadoResumo | null }) {
  const servicos = (d4?.servicos ?? []).filter(
    (s) => (s.vaModRs ?? 0) !== 0 || (s.vaEqpRs ?? 0) !== 0,
  );
  const totMod = servicos.reduce((a, s) => a + (s.vaModRs ?? 0), 0);
  const totEqp = servicos.reduce((a, s) => a + (s.vaEqpRs ?? 0), 0);
  const fmt = (n: number | null | undefined) => (n != null ? formatBRL(n) : "—");
  return (
    <div className="va-det">
      <h4 className="va-sec-titulo va-det-titulo">
        Valor Agregado — itens da PQ (quantidade medida × CPU)
      </h4>
      <table className="va-dt">
        <thead>
          <tr>
            <th>Item da PQ (serviço medido)</th>
            <th>Unid.</th>
            <th>Qtd medida</th>
            <th>MOD necessário</th>
            <th>EQP necessário</th>
          </tr>
        </thead>
        <tbody>
          {servicos.map((s) => (
            <tr key={`${s.ordem}-${s.codigoCpu ?? s.servico}`}>
              <td>{s.servico}</td>
              <td>{s.unidade ?? "—"}</td>
              <td className="tabular">{s.qtdMedida != null ? formatNum(s.qtdMedida) : "—"}</td>
              <td className="tabular">{fmt(s.vaModRs)}</td>
              <td className="tabular">{fmt(s.vaEqpRs)}</td>
            </tr>
          ))}
          <tr className="va-dt-tot">
            <td colSpan={3}>TOTAL — valor agregado (necessário)</td>
            <td className="tabular va-dt-deq">{fmt(totMod)}</td>
            <td className="tabular va-dt-deq">{fmt(totEqp)}</td>
          </tr>
        </tbody>
      </table>
      <div className="va-caveat va-caveat-info">
        MOD/EQP <b>necessários</b> = quantidade medida × coeficientes da CPU. O MOD/EQP <b>gasto</b>{" "}
        (real) é por função, na tabela do Total Cost — a perda é a diferença entre o real total e
        este agregado.
      </div>
    </div>
  );
}

// ── Milha Aferida ───────────────────────────────────────────────────

function MilhaBloco({ milha }: { milha: PerdaProdutividade["milha"] | null }) {
  const fmt = (n: number | null | undefined) => (n != null ? formatBRL(n) : "—");
  return (
    <section>
      <h3 className="va-sec-titulo">Milha Aferida (Measured Mile)</h3>
      <div className="va-milha">
        <span className="va-milha-status">
          <Hourglass size={13} aria-hidden /> Aguardando baseline produtivo
        </span>
        <div className="va-milha-row">
          <div className="va-milha-it">
            <div className="va-milha-l">Milha de referência — Fat/MOD</div>
            <div className="va-milha-v tabular">{fmt(milha?.refModRs)}</div>
          </div>
          <div className="va-milha-it">
            <div className="va-milha-l">Milha de referência — Fat/EQP</div>
            <div className="va-milha-v tabular">{fmt(milha?.refEqpRs)}</div>
          </div>
          <div className="va-milha-it">
            <div className="va-milha-l">Custo adicional líquido</div>
            <div className="va-milha-v tabular">{fmt(milha?.custoAdicionalRs)}</div>
          </div>
        </div>
        <div className="va-caveat va-caveat-neutral">
          A Milha compara cada mês com o mês de melhor produtividade. Com só 3 meses de mobilização
          (mob. mín. 70%), ainda não há período elegível para fixar a milha de referência — por isso
          o método aguarda. Tende a ser o mais robusto quando a produção estabilizar.
        </div>
      </div>
    </section>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────

function VASkeleton() {
  return (
    <>
      <div className="va-resumo">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} variant="block" className="va-sk-kpi" />
        ))}
      </div>
      <Skeleton variant="block" className="va-sk-tab" />
      <Skeleton variant="block" className="va-sk-tab" />
    </>
  );
}
