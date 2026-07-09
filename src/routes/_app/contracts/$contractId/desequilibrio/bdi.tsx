// D.2 — BDI (Bonificação e Despesas Indiretas) · desequilíbrio do BDI NÃO REMUNERADO. Tudo do dado
// REAL normalizado pelo workbook-motor: obra_bdi_deseq (params/KPIs) + obra_bdi_rubrica_tempo (6
// rubricas de tempo) + obra_bdi_perda_mensal (curva 46 meses). As rubricas tempo-dependentes (Adm
// Central, Lucro, garantias, seguros) incorrem ao custo mensal cheio, mas a medição — baixa no início
// — remunera o BDI proporcional ao avanço físico → gap = desequilíbrio (recuperável quando o
// faturamento acelera). Conservação tripla conferida pelo gate. Tokens-only; farol canônico.

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarRange, TrendingDown } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Badge,
  Card,
  CHART_SERIE_COR,
  ChartLegend,
  type ChartLegendItem,
  ChartTooltip,
  EmptyState,
  ErroCard,
  I,
  Skeleton,
} from "@/components/ds";
import { useBdiD2 } from "@/lib/hooks/useBdiD2";
import { farolLabel, farolToBadge } from "@/lib/mocks/contracts";
import type { BdiRubricaTempo } from "@/lib/supabase/bdiDeseq";
import { normalizarFarol } from "@/lib/supabase/faturamentoDisciplinaResumo";
import "./bdi.css";

export const Route = createFileRoute("/_app/contracts/$contractId/desequilibrio/bdi")({
  component: BdiRoute,
  head: () => ({ meta: [{ title: "D.2 BDI — RDM IA" }] }),
});

// ── Formatadores ─────────────────────────────────────────────────────────────
const fmtBRL = (n: number) =>
  Number.isFinite(n) ? `R$ ${Math.round(n).toLocaleString("pt-BR")}` : "—";
const fmtMi = (n: number) =>
  Number.isFinite(n)
    ? `R$ ${(n / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`
    : "—";
const fmtPct = (frac: number | null, d = 2) =>
  frac == null
    ? "—"
    : `${(frac * 100).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })}%`;

function BdiRoute() {
  const { contractId } = Route.useParams();
  const { data, isLoading, isError, error, refetch } = useBdiD2(contractId);

  if (isLoading) {
    return (
      <div className="d2-page">
        <Skeleton style={{ height: 28, width: 360, marginBottom: 12 }} />
        <Skeleton style={{ height: 88, marginBottom: 16 }} />
        <Skeleton style={{ height: 320 }} />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="d2-page">
        <ErroCard mensagem={error?.message} onRetry={() => refetch()} />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="d2-page">
        <EmptyState
          icon={I.wallet({ size: 40 })}
          title="BDI ainda não disponível"
          text="O desequilíbrio do BDI (D.2) ainda não foi normalizado para esta obra. Assim que o workbook for processado, a análise aparece aqui."
          framed
        />
      </div>
    );
  }
  return <BdiView view={data} />;
}

type View = NonNullable<ReturnType<typeof useBdiD2>["data"]>;

function BdiView({ view }: { view: View }) {
  const { params: p, rubricas, perda, curvaPerda } = view;
  const farolNivel = normalizarFarol(p.farol);
  // farolToBadge só produz success/info/warning/danger — narrow p/ o tom do Kpc (que inclui neutral).
  const farolTom = (farolNivel ? farolToBadge[farolNivel] : "info") as
    | "success"
    | "danger"
    | "warning"
    | "info"
    | "neutral";
  const admRub = rubricas.find((r) => /administra/i.test(r.rubrica));
  const lucroRub = rubricas.find((r) => /lucro|bonifica/i.test(r.rubrica));

  // Reconciliação (guard) — Σ Incorrido/mês das rubricas deve bater, por construção, com o KPI
  // "Custo mensal (tempo)" (p.custoMensalTempoRs = SUM(E22:E27) na fonte). Comparação em valores
  // BRUTOS com tolerância < R$ 1 (regra D.2); o canônico é o KPI — nunca substituído pela soma.
  const incorridoCompleto = rubricas.length > 0 && rubricas.every((r) => r.incorridoMesRs != null);
  const sumIncorridoRaw = rubricas.reduce((a, r) => a + (r.incorridoMesRs ?? 0), 0);
  const kpiCustoMensalRaw = p.custoMensalTempoRs;
  const incorridoDeltaRaw =
    kpiCustoMensalRaw != null ? Math.abs(sumIncorridoRaw - kpiCustoMensalRaw) : null;
  const incorridoReconcilia =
    incorridoCompleto && incorridoDeltaRaw != null && incorridoDeltaRaw < 1;

  return (
    <div className="d2-page">
      {/* ── Cabeçalho ───────────────────────────────────────────────── */}
      <header className="d2-head">
        <div>
          <h1 className="d2-title">D.2 — BDI (Bonificação e Despesas Indiretas)</h1>
          <p className="d2-sub">
            Desequilíbrio do <b>BDI não remunerado</b>: as rubricas tempo-dependentes (Adm Central,
            Lucro, garantias, seguros) incorrem ao custo mensal cheio, mas a medição — baixa no
            início — remunera o BDI proporcional ao avanço físico.
          </p>
        </div>
        {farolNivel && <Badge tone={farolToBadge[farolNivel]}>{farolLabel[farolNivel]}</Badge>}
      </header>

      {/* ── Resumo (KPIs + base) ────────────────────────────────────── */}
      <h2 className="d2-sec">Resumo</h2>
      <div className="d2-kpis">
        <Kpc
          tone={farolTom}
          label="Desequilíbrio BDI acumulado"
          value={p.desequilibrioRs != null ? fmtBRL(p.desequilibrioRs) : "—"}
          sub={`não remunerado até o BM${p.bmCorrente ?? "—"} (pico)`}
        />
        <Kpc
          tone="neutral"
          label="% sobre o PV"
          value={fmtPct(p.pctSobrePv)}
          sub={p.pvRs != null ? `${fmtMi(p.pvRs)} de contrato` : ""}
        />
        <Kpc
          tone="neutral"
          label="Custo mensal (tempo)"
          value={p.custoMensalTempoRs != null ? fmtBRL(p.custoMensalTempoRs) : "—"}
          sub="rubricas tempo-dependentes/mês"
        />
        <Kpc
          tone="info"
          label="+ projeção (extensão)"
          value={p.projecaoExtensaoRs != null ? fmtBRL(p.projecaoExtensaoRs) : "—"}
          sub={`${p.mesesExtensao ?? 0} ${p.mesesExtensao === 1 ? "mês" : "meses"} de extensão`}
        />
        <Kpc
          tone="neutral"
          label="Meses decorridos"
          value={
            p.bmCorrente != null && p.mesesContratuais != null
              ? `${p.bmCorrente} / ${p.mesesContratuais}`
              : "—"
          }
          sub="do prazo contratual"
        />
      </div>

      <div className="d2-basebar">
        <BaseItem label="Preço de Venda (PV)" value={p.pvRs != null ? fmtBRL(p.pvRs) : "—"} />
        <BaseItem label="BDI declarado" value={fmtPct(p.bdiDeclarado)} />
        <BaseItem
          label="Custo Direto (CD)"
          value={p.custoDiretoRs != null ? fmtBRL(p.custoDiretoRs) : "—"}
        />
        <BaseItem
          label="Custo Indireto (CI)"
          value={p.custoIndiretoRs != null ? fmtBRL(p.custoIndiretoRs) : "—"}
        />
        <BaseItem
          label="Medição acum. até BM"
          value={p.medicaoAcumRs != null ? fmtBRL(p.medicaoAcumRs) : "—"}
        />
      </div>

      {/* ── Rubricas ────────────────────────────────────────────────── */}
      <h2 className="d2-sec">Rubricas do BDI não remunerado (tempo-dependentes)</h2>
      <Card className="d2-card">
        <RubricasTable rubricas={rubricas} params={p} />
      </Card>
      {incorridoReconcilia && kpiCustoMensalRaw != null && (
        <p className="d2-recon">
          <I.check size={13} aria-hidden /> Σ <b>Incorrido/mês</b> das rubricas ={" "}
          <b>{fmtBRL(kpiCustoMensalRaw)}</b> — reconcilia com o KPI <b>Custo mensal (tempo)</b>{" "}
          (conservação conferida).
        </p>
      )}
      {incorridoCompleto && !incorridoReconcilia && incorridoDeltaRaw != null && (
        <p className="d2-recon d2-recon-warn">
          <I.flag size={13} aria-hidden /> Σ Incorrido/mês diverge do KPI Custo mensal (tempo) em{" "}
          <b>{fmtBRL(incorridoDeltaRaw)}</b> — o valor exibido no KPI permanece o canônico.
        </p>
      )}
      <p className="d2-note">
        Riscos/Eventuais, Correção Inflacionária e Impostos não entram aqui — são remunerados
        proporcionalmente à medição, sem gap de tempo (reajuste vai à D.6).
      </p>

      {/* ── Curva de perda ──────────────────────────────────────────── */}
      <h2 className="d2-sec">Curva de perda do BDI (real × régua de equilíbrio, acumulado)</h2>
      <Card className="d2-card">
        {curvaPerda ? (
          <>
            <div className="d2-basebar d2-triade">
              <BaseItem
                label={`Desequilíbrio no BM${p.bmCorrente ?? "—"} (pico)`}
                value={p.desequilibrioRs != null ? fmtBRL(p.desequilibrioRs) : "—"}
              />
              <BaseItem
                label="Recuperável (ao acelerar o faturamento)"
                value={
                  p.desequilibrioRs != null
                    ? fmtBRL(p.desequilibrioRs - curvaPerda.perdaRealFinalRs)
                    : "—"
                }
              />
              <BaseItem
                label="Não recuperado (estável) — imputável à Contratante"
                value={fmtBRL(curvaPerda.perdaRealFinalRs)}
              />
            </div>
            <CurvaPerdaDupla curva={curvaPerda} bmCorrente={p.bmCorrente} />
            <p className="d2-note">
              A <b>régua de equilíbrio</b> (linha tracejada) usa sempre o previsto e{" "}
              <b>zera no fim</b>: faturando 100% do previsto, o BDI não remunerado seria só
              temporal. A <b>curva real</b> (linha cheia) carrega o sub-faturamento do início — o
              pico no BM corrente é o desequilíbrio realizado; parte se recupera quando o
              faturamento acelera e o saldo <b>estabiliza</b> como <b>BDI não recuperado</b>,
              imputável à Contratante pelo sub-faturamento inicial (valores acima). O traço vertical
              marca o <b>BM{p.bmCorrente}</b> corrente; à direita dele a curva real vira{" "}
              <b>projeção</b> (tracejada na mesma cor).
            </p>
          </>
        ) : (
          <>
            <PerdaChart perda={perda} bmCorrente={p.bmCorrente} desequilibrio={p.desequilibrioRs} />
            <p className="d2-note">
              A perda do BDI é <b>front-loaded</b>: acumula no início (medição baixa) e{" "}
              <b>recupera</b> a partir do meio do contrato, quando o faturamento acelera e passa a
              remunerar o BDI. O ponto vermelho marca o BM corrente.
            </p>
          </>
        )}
      </Card>

      {/* ── Calculadora ─────────────────────────────────────────────── */}
      <h2 className="d2-sec">
        Calculadora de cenários{" "}
        <span className="d2-exhint">— valores de exemplo, edite os campos</span>
      </h2>
      <Calculadora params={p} rubricas={rubricas} />

      {/* ── IA ──────────────────────────────────────────────────────── */}
      <Card className="d2-ia">
        <div className="d2-ia-h">
          <span className="d2-ia-badge">IA</span>
          <span className="d2-pt">Leitura da D.2</span>
        </div>
        <p>
          O BDI não remunerado soma{" "}
          <b>{p.desequilibrioRs != null ? fmtBRL(p.desequilibrioRs) : "—"}</b> no BM{p.bmCorrente} (
          {fmtPct(p.pctSobrePv)} do PV). Concentra-se nas maiores rubricas de tempo —{" "}
          <b>Administração Central</b>
          {admRub?.desequilibrioRs != null && <> ({fmtMi(admRub.desequilibrioRs)})</>} e{" "}
          <b>Lucro / Bonificação</b>
          {lucroRub?.desequilibrioRs != null && <> ({fmtMi(lucroRub.desequilibrioRs)})</>}.
        </p>
        <p>
          A <b>régua teórica</b> zera no fim do contrato — em tese é recuperável faturando 100% do
          previsto. Mas a <b>curva real</b> estabiliza em{" "}
          <b>{curvaPerda != null ? fmtBRL(curvaPerda.perdaRealFinalRs) : "—"}</b>: o sub-faturamento
          do início vira <b>BDI não recuperado</b>, imputável à Contratante. O risco cresce ainda
          com <b>extensão de prazo</b> (cada mês adicional custa{" "}
          <b>{p.overheadMesRs != null ? fmtBRL(p.overheadMesRs) : "—"}</b> de overhead de tempo, sem
          Lucro) — simulável na calculadora acima.
        </p>
      </Card>
    </div>
  );
}

// ── KPI card (tingido pelo tom do índice) ────────────────────────────────────
function Kpc({
  tone,
  label,
  value,
  sub,
}: {
  tone: "success" | "danger" | "warning" | "info" | "neutral";
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className={`d2-kpc d2-kpc-${tone}`}>
      <div className="d2-kpc-l">{label}</div>
      <div className="d2-kpc-v">{value}</div>
      <div className="d2-kpc-s">{sub}</div>
    </div>
  );
}

function BaseItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="d2-base-it">
      <span className="d2-base-l">{label}</span>
      <span className="d2-base-v">{value}</span>
    </div>
  );
}

// ── Tabela de rubricas ───────────────────────────────────────────────────────
function RubricasTable({
  rubricas,
  params,
}: {
  rubricas: BdiRubricaTempo[];
  params: View["params"];
}) {
  const totV = rubricas.reduce((a, r) => a + (r.valorContratoRs ?? 0), 0);
  const totG = rubricas.reduce((a, r) => a + (r.gastoTeoricoAcumRs ?? 0), 0);
  const totR = rubricas.reduce((a, r) => a + (r.remuneradoAcumRs ?? 0), 0);
  const totD = rubricas.reduce((a, r) => a + (r.desequilibrioRs ?? 0), 0);
  // Incorrido/mês = decomposição por rubrica do KPI "Custo mensal (tempo)" (SUM(E22:E27) na
  // fonte). Só afirma o TOTAL quando todas as rubricas trazem o valor (pendente ≠ zero).
  const incorridoCompleto = rubricas.length > 0 && rubricas.every((r) => r.incorridoMesRs != null);
  const totI = rubricas.reduce((a, r) => a + (r.incorridoMesRs ?? 0), 0);
  return (
    <div className="d2-tscroll">
      <table className="d2-t">
        <thead>
          <tr>
            <th>Rubrica</th>
            <th className="r">% do PV</th>
            <th className="r">Valor no contrato</th>
            <th className="r">Incorrido/mês</th>
            <th className="r">Gasto teórico acum.</th>
            <th className="r">Remunerado acum.</th>
            <th className="r">Desequilíbrio</th>
          </tr>
        </thead>
        <tbody>
          {rubricas.map((r) => (
            <tr key={r.ordem}>
              <td>{r.rubrica}</td>
              <td className="r">{fmtPct(r.pctRubrica)}</td>
              <td className="r">{r.valorContratoRs != null ? fmtBRL(r.valorContratoRs) : "—"}</td>
              <td className="r">{r.incorridoMesRs != null ? fmtBRL(r.incorridoMesRs) : "—"}</td>
              <td className="r">
                {r.gastoTeoricoAcumRs != null ? fmtBRL(r.gastoTeoricoAcumRs) : "—"}
              </td>
              <td className="r">{r.remuneradoAcumRs != null ? fmtBRL(r.remuneradoAcumRs) : "—"}</td>
              <td className="r d2-deq">
                {r.desequilibrioRs != null ? fmtBRL(r.desequilibrioRs) : "—"}
              </td>
            </tr>
          ))}
          <tr className="d2-tot">
            <td>TOTAL — BDI não remunerado</td>
            <td className="r" />
            <td className="r">{fmtBRL(params.valorTotalContratoRs ?? totV)}</td>
            <td className="r">
              {incorridoCompleto ? fmtBRL(params.custoMensalTempoRs ?? totI) : "—"}
            </td>
            <td className="r">{fmtBRL(params.gastoTeoricoAcumRs ?? totG)}</td>
            <td className="r">{fmtBRL(params.remuneradoAcumRs ?? totR)}</td>
            <td className="r">{fmtBRL(params.desequilibrioRs ?? totD)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Curva de perda (Recharts) ────────────────────────────────────────────────
function PerdaChart({
  perda,
  bmCorrente,
  desequilibrio,
}: {
  perda: View["perda"];
  bmCorrente: number | null;
  desequilibrio: number | null;
}) {
  const dados = perda.map((m) => ({ mes: m.mesLabel ?? "", acum: (m.perdaAcumRs ?? 0) / 1e6 }));
  const bmRow = perda.find((m) => m.bm === bmCorrente);
  const bmPonto = bmRow
    ? { mes: bmRow.mesLabel ?? "", acum: (bmRow.perdaAcumRs ?? 0) / 1e6 }
    : null;
  if (!dados.length) {
    return (
      <EmptyState title="Curva indisponível" text="A perda mensal do BDI não foi normalizada." />
    );
  }
  return (
    <div className="d2-chartbox">
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={dados} margin={{ top: 18, right: 16, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="mes"
            tick={{ fontSize: 10, fill: "var(--text-3)" }}
            interval={2}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--text-3)" }}
            tickFormatter={(v: number) =>
              `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}`
            }
            tickLine={false}
            axisLine={false}
            width={36}
            label={{
              value: "R$ mi",
              position: "insideTopLeft",
              fontSize: 9,
              fill: "var(--text-4)",
              dy: -14,
            }}
          />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)" }}
            content={
              <ChartTooltip
                formatter={(v: number) => fmtMi(v * 1e6)}
                nomes={{ acum: "Perda acum." }}
              />
            }
          />
          <ReferenceLine y={0} stroke="var(--text-4)" strokeDasharray="3 3" />
          <Area
            type="monotone"
            dataKey="acum"
            baseValue={0}
            stroke="var(--ink)"
            strokeWidth={2.2}
            fill="var(--warning-bg)"
            fillOpacity={0.7}
            dot={false}
          />
          {bmPonto && (
            <ReferenceDot
              x={bmPonto.mes}
              y={bmPonto.acum}
              r={5}
              fill="var(--danger)"
              stroke="var(--on-accent)"
              strokeWidth={1.5}
              label={{
                value: `BM${bmCorrente} · ${bmPonto.acum.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`,
                position: "top",
                fontSize: 9.5,
                fontWeight: 700,
                fill: "var(--danger)",
              }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Curva de perda · DUAS curvas (BLOCO 6: real × régua teórica) ──────────────────────────────────
// A série real é dividida em MEDIDO (sólido, até o BM corrente) e PROJETADO (tracejado, pós-BM) —
// duplicando o ponto de junção p/ continuidade. A régua teórica é sempre referência (tracejada).
type CurvaPt = {
  mes: string;
  bm: number;
  realMedido: number | null; // R$ mi — até o BM corrente (linha cheia)
  realProjetado: number | null; // R$ mi — do BM corrente em diante (tracejada)
  teorica: number; // R$ mi — régua de equilíbrio (referência)
  gastoMes: number;
  remReal: number;
  medido: boolean;
};

function CurvaPerdaDupla({
  curva,
  bmCorrente,
}: {
  curva: NonNullable<View["curvaPerda"]>;
  bmCorrente: number | null;
}) {
  // Fronteira medido/projetado = último ponto com `medido` (flag já computada no read-model). O
  // ponto de junção entra em AMBAS as séries p/ o sólido e o tracejado se emendarem sem quebra.
  let lastMedidoIdx = -1;
  curva.pontos.forEach((pt, i) => {
    if (pt.medido) lastMedidoIdx = i;
  });
  const dados: CurvaPt[] = curva.pontos.map((pt, i) => {
    const real = pt.perdaRealAcumRs / 1e6;
    return {
      mes: pt.mesLabel,
      bm: pt.bm,
      realMedido: i <= lastMedidoIdx ? real : null,
      realProjetado: i >= lastMedidoIdx ? real : null,
      teorica: pt.perdaTeoricaAcumRs / 1e6,
      gastoMes: pt.gastoMesRs,
      remReal: pt.remRealMesRs,
      medido: pt.medido,
    };
  });
  const corte = bmCorrente ?? curva.bmCorrente;
  const corteRow = curva.pontos.find((pt) => pt.bm === corte);
  const temProjecao = lastMedidoIdx >= 0 && lastMedidoIdx < curva.pontos.length - 1;

  const legendItems: ChartLegendItem[] = [
    {
      label: (
        <>
          Perda real <b>{fmtMi(curva.perdaRealFinalRs)}</b>
        </>
      ),
      tipo: "linha",
      cor: CHART_SERIE_COR.real,
    },
  ];
  if (temProjecao) {
    legendItems.push({ label: "Projeção (pós-BM)", tipo: "tracejada", cor: CHART_SERIE_COR.real });
  }
  legendItems.push({
    label: (
      <>
        Régua de equilíbrio <b>→ R$ 0</b>
      </>
    ),
    tipo: "tracejada",
    cor: CHART_SERIE_COR.meta,
  });

  return (
    <div className="d2-chartbox">
      <ChartLegend className="d2-chartleg" items={legendItems} />
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={dados} margin={{ top: 18, right: 18, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="mes"
            tick={{ fontSize: 10, fill: "var(--text-3)" }}
            interval={3}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--text-3)" }}
            tickFormatter={(v: number) =>
              `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}`
            }
            tickLine={false}
            axisLine={false}
            width={36}
            label={{
              value: "R$ mi",
              position: "insideTopLeft",
              fontSize: 9,
              fill: "var(--text-4)",
              dy: -14,
            }}
          />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)" }}
            content={
              <ChartTooltip
                ocultarNulos
                formatter={(v: number) => fmtMi(v * 1e6)}
                nomes={{
                  realMedido: "Perda real acum.",
                  realProjetado: "Perda real acum. (projeção)",
                  teorica: "Régua de equilíbrio",
                }}
                titulo={(label, payload) => {
                  const pt = payload?.[0]?.payload as unknown as CurvaPt | undefined;
                  if (!pt) return label;
                  return (
                    <>
                      {pt.mes} · BM{pt.bm}
                      {pt.medido ? "" : " · projeção"}
                      <span className="d2-tip-ctx">
                        Gasto/mês {fmtBRL(pt.gastoMes)} · Remunerado/mês {fmtBRL(pt.remReal)}
                      </span>
                    </>
                  );
                }}
              />
            }
          />
          <ReferenceLine y={0} stroke="var(--text-4)" strokeDasharray="3 3" />
          {corteRow && (
            <ReferenceLine
              x={corteRow.mesLabel}
              stroke="var(--text-4)"
              strokeDasharray="2 4"
              label={{ value: `BM${corte}`, position: "top", fontSize: 9, fill: "var(--text-4)" }}
            />
          )}
          <Line
            type="monotone"
            dataKey="teorica"
            name="Régua de equilíbrio"
            stroke={CHART_SERIE_COR.meta}
            strokeWidth={1.8}
            strokeDasharray="6 4"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="realMedido"
            name="Perda real acum."
            stroke={CHART_SERIE_COR.real}
            strokeWidth={2.4}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="realProjetado"
            name="Perda real acum. (projeção)"
            stroke={CHART_SERIE_COR.real}
            strokeWidth={2.4}
            strokeDasharray="5 4"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Calculadora de cenários ──────────────────────────────────────────────────
const pn = (s: string) => {
  const neg = s.includes("-");
  const v = parseFloat(s.replace(/[^0-9,]/g, "").replace(",", "."));
  return isNaN(v) ? 0 : neg ? -v : v;
};

function Calculadora({
  params: p,
  rubricas,
}: {
  params: View["params"];
  rubricas: BdiRubricaTempo[];
}) {
  const PV = p.pvRs ?? 0;
  const BDI = p.bdiDeclarado ?? 0;
  const adm = rubricas.find((r) => /administra/i.test(r.rubrica));
  const admPctCD =
    adm?.valorContratoRs && p.custoDiretoRs ? adm.valorContratoRs / p.custoDiretoRs : 0;
  const ohMes = p.overheadMesRs ?? 0;

  const fmtInput = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  // Default honesto (sem inventar % do PV): parte do cenário de redução normalizado pelo workbook
  // (PV − deltaReducaoRs) quando existe; senão do próprio PV (ΔPV = 0 → tudo zero, editável).
  const reducaoDefault =
    p.deltaReducaoRs != null && p.deltaReducaoRs > 0 && p.deltaReducaoRs < PV
      ? PV - p.deltaReducaoRs
      : PV;
  const [rfinal, setRfinal] = useState(fmtInput(reducaoDefault));
  const [emeses, setEmeses] = useState(p.mesesExtensao != null ? String(p.mesesExtensao) : "6");
  const [efinal, setEfinal] = useState(fmtInput(PV));

  const red = useMemo(() => {
    const dpv = PV - pn(rfinal);
    const dcd = dpv / (1 + BDI);
    return { dpv, dcd, dbdi: admPctCD * dcd };
  }, [rfinal, PV, BDI, admPctCD]);

  const ext = useMemo(() => {
    const oh = ohMes * pn(emeses);
    const dpv = pn(efinal) - PV;
    let escopo: { label: string; value: number; rem: boolean } | null = null;
    if (Math.abs(dpv) >= 1) {
      if (dpv > 0)
        escopo = {
          label: "Serviços adicionais → BDI remunerado (preço novo)",
          value: dpv * (BDI / (1 + BDI)),
          rem: true,
        };
      else
        escopo = {
          label: "Escopo reduzido → Δ BDI não remunerado",
          value: admPctCD * (-dpv / (1 + BDI)),
          rem: false,
        };
    }
    return { oh, escopo };
  }, [emeses, efinal, PV, BDI, admPctCD, ohMes]);

  return (
    <div className="d2-calcwrap">
      <Card className="d2-calc">
        <h4>
          <TrendingDown size={15} aria-hidden /> Redução de escopo
        </h4>
        <label className="d2-fld">
          <span>Valor final do contrato (R$)</span>
          <input value={rfinal} onChange={(e) => setRfinal(e.target.value)} inputMode="numeric" />
        </label>
        <div className="d2-out">
          <div className="d2-ln">
            <span>Redução (ΔPV = PV − final)</span>
            <span>{fmtBRL(red.dpv)}</span>
          </div>
          <div className="d2-ln">
            <span>
              Custo Direto suprimido (ΔCD = ΔPV ÷{" "}
              {(1 + BDI).toLocaleString("pt-BR", { maximumFractionDigits: 4 })})
            </span>
            <span>{fmtBRL(red.dcd)}</span>
          </div>
          <div className="d2-ln d2-big">
            <span>Δ BDI não remunerado</span>
            <span>{fmtBRL(red.dbdi)}</span>
          </div>
        </div>
        <p className="d2-chint">
          Só a Adm Central (fixa s/ CD) fica descoberta; as rubricas variáveis (Lucro, impostos,
          financeiras…) escalam com o escopo, sem perda.
        </p>
      </Card>

      <Card className="d2-calc">
        <h4>
          <CalendarRange size={15} aria-hidden /> Extensão de prazo
        </h4>
        <label className="d2-fld">
          <span>Extensão (meses)</span>
          <input value={emeses} onChange={(e) => setEmeses(e.target.value)} inputMode="numeric" />
        </label>
        <label className="d2-fld">
          <span>Valor final do contrato (R$) — take-off</span>
          <input value={efinal} onChange={(e) => setEfinal(e.target.value)} inputMode="numeric" />
        </label>
        <div className="d2-out">
          <div className="d2-ln">
            <span>Overhead/mês (sem Lucro)</span>
            <span>{fmtBRL(ohMes)}</span>
          </div>
          <div className="d2-ln d2-big">
            <span>Overhead da extensão</span>
            <span>{fmtBRL(ext.oh)}</span>
          </div>
          {ext.escopo && (
            <div className={`d2-ln ${ext.escopo.rem ? "d2-rem" : "d2-big"}`}>
              <span>{ext.escopo.label}</span>
              <span>{fmtBRL(ext.escopo.value)}</span>
            </div>
          )}
        </div>
        <p className="d2-chint">
          Cada mês de obra estendida mantém Adm Central + garantias + seguros + financeiras sem nova
          receita. Se o valor final aumentar (escopo adicional), entra remunerado à parte como preço
          novo.
        </p>
      </Card>
    </div>
  );
}
