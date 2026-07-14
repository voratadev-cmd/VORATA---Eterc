// Aba "Chuvas" (RMA · C.9) — dias improdutivos por chuva >5 mm: baseline contratual (proposta) × real
// (RDO), método SEM compensar déficit entre meses → "dias a cobrar". O real de dias>5mm vive nas
// seções obra_secoes C.9/auxiliar_D.6 (não em obra_chuvas_meses) → lido via useChuvasPainel.
// Ordem de leitura = JTBD (excedeu? → quanto custa? → prova → referência): KPIs → Gráfico A →
// Apuração (o dinheiro: excedente, MOD+EQP, HH ociosas) → Evidência mm → baseline C/D (dados de
// contrato, imutáveis). Meses futuros = só baseline (aguardando RDO) — PENDENTE ≠ 0: real null não
// desenha, nunca fabrica 0.

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Badge,
  Card,
  CHART_SERIE_COR,
  ChartLegend,
  ChartTooltip,
  EmptyState,
  ErroCard,
  FarolCard,
  I,
  Segmented,
  Skeleton,
} from "@/components/ds";
import { useChuvasC9 } from "@/lib/hooks/useChuvasC9";
import { useChuvasPainel } from "@/lib/hooks/useChuvasPainel";
import type { ChuvasC9 } from "@/lib/supabase/chuvasC9";
import { type FarolLevel, farolLabel, farolToBadge } from "@/lib/mocks/contracts";
import { ColPag, ColToolbar, ColVazio, useColecao } from "@/lib/rma/colecao";
import type { ChuvaApuracaoMes, ChuvasPainel, ChuvaSerieMes } from "@/lib/supabase/chuvasPainel";
import "./chuvas.css";

export const Route = createFileRoute("/_app/contracts/$contractId/rma/chuvas")({
  component: ChuvasAba,
});

type Tone = "success" | "info" | "warning" | "danger";
function farolTone(farol: string | null): Tone | null {
  const s = (farol ?? "").toLowerCase();
  if (!s) return null;
  if (s.includes("crític") || s.includes("critic")) return "danger";
  if (s.includes("atenç") || s.includes("aten") || s.includes("risco")) return "warning";
  if (s.includes("conform")) return "success";
  return "info";
}
const TONE_VAR: Record<Tone, string> = {
  success: "var(--success)",
  info: "var(--info)",
  warning: "var(--warning)",
  danger: "var(--danger)",
};
const fmtMm = (v: number | null) =>
  v != null ? `${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mm` : "—";
const fmtRs = (v: number | null) =>
  v != null
    ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";
const fmtInt = (v: number | null) => (v != null ? v.toLocaleString("pt-BR") : "—");
const fmtDiasTip = (v: number) => `${v.toLocaleString("pt-BR")} ${v === 1 ? "dia" : "dias"}`;
const anoDe = (mesAno: string) => "20" + (mesAno.split("/")[1] ?? "").trim();
const mesDe = (mesAno: string) => (mesAno.split("/")[0] ?? "").trim();
const MESES_CAL = [
  "JAN",
  "FEV",
  "MAR",
  "ABR",
  "MAI",
  "JUN",
  "JUL",
  "AGO",
  "SET",
  "OUT",
  "NOV",
  "DEZ",
];

function ChuvasAba() {
  const { contractId } = Route.useParams();
  const { data, isLoading, error, refetch } = useChuvasPainel(contractId);
  // Dialeto SBSO: análise MENSAL em mm (baseline INMET × real INMET × RDO) — quando a obra
  // declara a seção C.9 nesse regime, ela substitui o modo rodoviário "dias >5 mm" inteiro.
  const c9q = useChuvasC9(contractId);

  if (isLoading || c9q.isLoading) {
    // skeleton com a FORMA real da página (KPIs → Gráfico A → apuração → evidência → grid C+D)
    return (
      <main className="chv-main">
        <div className="chv-kpis">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 92 }} />
          ))}
        </div>
        <Skeleton style={{ height: 340 }} />
        <Skeleton style={{ height: 300 }} />
        <Skeleton style={{ height: 320 }} />
        <div className="chv-grow">
          <Skeleton style={{ height: 300 }} />
          <Skeleton style={{ height: 300 }} />
        </div>
      </main>
    );
  }
  if (c9q.data) return <ChuvasSbso c9={c9q.data} />;
  if (error) {
    // ERRO ≠ PENDÊNCIA: falha de leitura ganha Badge danger + retry, nunca vira "aguardando".
    return (
      <main className="chv-main">
        <ErroCard
          titulo="Não foi possível carregar as chuvas (C.9)"
          mensagem={
            error instanceof Error
              ? error.message
              : "Erro ao ler os dados normalizados desta obra — não é pendência de normalização."
          }
          onRetry={() => refetch()}
        />
      </main>
    );
  }
  if (!data) {
    return (
      <main className="chv-main">
        <Card>
          <EmptyState
            framed
            icon={I.flag({ size: 42 })}
            title="Chuvas ainda não normalizadas"
            text="A análise de dias >5 mm (proposta × real RDO) aparece aqui quando a seção C.9 for normalizada."
            hint={<Badge tone="info">Aguardando normalização</Badge>}
          />
        </Card>
      </main>
    );
  }

  const k = data.kpis;
  const farolGeral: FarolLevel = k.diasACobrar > 0 ? "risco" : "conforme";
  return (
    <main className="chv-main">
      <header className="chv-head">
        <div>
          <h2 className="chv-titulo">Análise de Chuvas · C.9</h2>
          <p className="chv-sub">
            Dias improdutivos por chuva &gt;5 mm · baseline contratual × real (RDO) · método sem
            compensar déficit entre meses
          </p>
        </div>
        <Badge tone={farolToBadge[farolGeral]}>{farolLabel[farolGeral]}</Badge>
      </header>

      <div className="chv-kpis">
        <FarolCard
          label="DIAS >5MM — PROPOSTA (ACUM)"
          value={k.diasPropostaAcum.toLocaleString("pt-BR")}
          info={`baseline contratual · ${k.nMesesReais} ${k.nMesesReais === 1 ? "mês" : "meses"} medidos`}
          accent="neutral"
        />
        <FarolCard
          label="DIAS >5MM — REAL / RDO (ACUM)"
          value={k.diasRealAcum.toLocaleString("pt-BR")}
          info={data.sintese?.realVsProposta ?? "evidência diária (RDO)"}
          accent="neutral"
        />
        <FarolCard
          label="Δ ACUMULADO (NET)"
          value={`${k.deltaNet > 0 ? "+" : ""}${k.deltaNet.toLocaleString("pt-BR")} dias`}
          info={
            data.sintese?.deltaNet ?? (k.deltaNet === 0 ? "sem excesso líquido" : "real − proposta")
          }
          farol={k.deltaNet <= 0 ? "conforme" : "critico"}
        />
        <FarolCard
          label="DIAS A COBRAR (Σ EXCESSOS)"
          value={`${k.diasACobrar.toLocaleString("pt-BR")} dias`}
          info={
            k.pleiteavelRs != null
              ? `pleiteável ${fmtRs(k.pleiteavelRs)} · sem compensar`
              : "método sem compensar"
          }
          farol={k.diasACobrar > 0 ? "risco" : "conforme"}
        />
      </div>

      {/* Ordem = JTBD: excedeu? (A) → quanto custa? (apuração) → prova (mm) → referência (C+D). */}
      <GraficoDiasAno serie={data.serieMensal} sintese={data.sintese} ok={k.diasACobrar === 0} />
      <ApuracaoCard data={data} />
      <CriteriosFarol />
      <GraficoEvidencia serie={data.serieMensal} baseline={data.baselineMm} />
      <div className="chv-group-head">
        <span className="chv-group-title">Referência do baseline · proposta contratual</span>
        <span className="chv-group-sub">
          dados de contrato — não mudam com o RDO do acompanhamento
        </span>
      </div>
      <div className="chv-grow">
        <GraficoDiasChuva dias={data.diasChuva} />
        <GraficoCalendarios dias={data.diasChuva} totais={data.calTotais} />
      </div>
      {data.leituraIA && <LeituraIA texto={data.leituraIA} />}
    </main>
  );
}

// ── Dialeto SBSO · chuva mensal (mm): baseline INMET 2020-2025 × real INMET × real RDO ──────────
// A conversão p/ impacto de prazo/pleito é feita à parte — aqui é volume vs histórico, mês a mês.
function ChuvasSbso({ c9 }: { c9: ChuvasC9 }) {
  const medidos = c9.meses.filter((m) => m.inmetMm != null);
  // destaque = mês medido com maior razão real/histórico (SBSO: fev/26 · 451 mm · 1,33×)
  const destaque = medidos
    .filter((m) => m.prevMm != null && m.prevMm > 0)
    .reduce<{ mesAno: string; ratio: number; mm: number } | null>((acc, m) => {
      const ratio = (m.inmetMm as number) / (m.prevMm as number);
      return !acc || ratio > acc.ratio ? { mesAno: m.mesAno, ratio, mm: m.inmetMm as number } : acc;
    }, null);
  const grafico = c9.meses.map((m) => ({
    mes: m.mesAno,
    prev: m.prevMm,
    inmet: m.inmetMm,
    rdo: m.rdoMm,
  }));
  const fmtMm = (v: number | null) =>
    v != null ? `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mm` : "—";
  const legenda = [
    { label: "Baseline INMET 2020-2025", tipo: "tracejada", cor: CHART_SERIE_COR.contratado },
    { label: "Real INMET 2026", tipo: "linha", cor: CHART_SERIE_COR.real },
    { label: "Real RDO", tipo: "linha", cor: CHART_SERIE_COR.meta },
  ] as const;
  return (
    <main className="chv-main">
      <header className="chv-head">
        <div>
          <h2 className="chv-titulo">Análise de Chuvas · C.9</h2>
          <p className="chv-sub">
            estação INMET A904 Sorriso/MT · baseline histórico 2020-2025 × real INMET 2026 ×
            registro RDO
          </p>
        </div>
        <Badge tone={(c9.deltaAcumMm ?? 0) > 0 ? "warning" : "success"}>
          {(c9.deltaAcumMm ?? 0) > 0 ? "Acima do histórico" : "Dentro do histórico"}
        </Badge>
      </header>

      <div className="chv-kpis">
        <FarolCard
          label={`CHUVA PREVISTA ACUM. (M1–M${c9.nMedidos})`}
          value={fmtMm(c9.prevAcumMm)}
          info="baseline INMET 2020-2025"
          accent="neutral"
        />
        <FarolCard
          label={`REAL INMET ACUM. (M1–M${c9.nMedidos})`}
          value={fmtMm(c9.inmetAcumMm)}
          info="estação A904 Sorriso"
          accent="neutral"
        />
        <FarolCard
          label="Δ ACUMULADO"
          value={
            c9.deltaAcumMm != null
              ? `${c9.deltaAcumMm > 0 ? "+" : ""}${fmtMm(c9.deltaAcumMm)}`
              : "—"
          }
          info={
            c9.deltaAcumPct != null
              ? `${c9.deltaAcumPct > 0 ? "+" : ""}${c9.deltaAcumPct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% real vs histórico`
              : "real vs histórico"
          }
          farol={(c9.deltaAcumMm ?? 0) > 0 ? "risco" : "conforme"}
        />
        <FarolCard
          label="MESES ACIMA DO HISTÓRICO"
          value={`${c9.mesesAcima} de ${c9.nMedidos}`}
          info="potencial base p/ pleito de chuva"
          farol={c9.mesesAcima > c9.nMedidos / 2 ? "risco" : "conforme"}
        />
      </div>

      <section className="chv-section">
        <header className="chv-section-head">
          <div>
            <h3 className="chv-section-title">
              Chuva mensal — previsto (baseline INMET) × real INMET × real RDO · mm
            </h3>
            {destaque && destaque.ratio > 1.2 ? (
              <div className="chv-section-sub">
                destaque {destaque.mesAno}: {fmtMm(destaque.mm)} ={" "}
                {destaque.ratio.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}× o histórico
              </div>
            ) : null}
          </div>
          <ChartLegend items={[...legenda]} />
        </header>
        <div className="chv-chart">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={grafico} margin={{ top: 12, right: 14, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 11, fill: "var(--text-3)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                interval="preserveStartEnd"
                minTickGap={20}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--text-3)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}`}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    formatter={(v: number) => fmtMm(v)}
                    nomes={{ prev: "Baseline 2020-2025", inmet: "Real INMET", rdo: "Real RDO" }}
                  />
                }
              />
              <Bar
                dataKey="inmet"
                name="Real INMET"
                fill={CHART_SERIE_COR.real}
                radius={[3, 3, 0, 0]}
              />
              <Bar
                dataKey="rdo"
                name="Real RDO"
                fill={CHART_SERIE_COR.meta}
                radius={[3, 3, 0, 0]}
              />
              <Line
                type="monotone"
                dataKey="prev"
                name="Baseline"
                stroke={CHART_SERIE_COR.contratado}
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="chv-section">
        <header className="chv-section-head">
          <div>
            <h3 className="chv-section-title">Mês a mês — baseline × INMET × RDO</h3>
            <div className="chv-section-sub">
              {c9.nMedidos} meses medidos · M{c9.nMedidos + 1}+ apenas baseline (futuro)
            </div>
          </div>
        </header>
        <table className="chv9-tab">
          <thead>
            <tr>
              <th>Mês obra</th>
              <th>Mês/Ano</th>
              <th className="v">Prev. (baseline)</th>
              <th className="v">Real INMET (mm)</th>
              <th className="v">Real RDO (mm)</th>
              <th className="v">Δ INMET−Prev</th>
              <th>Análise</th>
            </tr>
          </thead>
          <tbody>
            {c9.meses.map((m) => {
              const futuro = m.inmetMm == null;
              const acima = (m.deltaMm ?? 0) > 0;
              return (
                <tr key={m.mesObra || m.mesAno} className={futuro ? "chv9-futuro" : ""}>
                  <td>{m.mesObra || "—"}</td>
                  <td>{m.mesAno}</td>
                  <td className="v">
                    {m.prevMm != null
                      ? m.prevMm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })
                      : "—"}
                  </td>
                  <td className="v">
                    {m.inmetMm != null ? m.inmetMm.toLocaleString("pt-BR") : "—"}
                  </td>
                  <td className="v">{m.rdoMm != null ? m.rdoMm.toLocaleString("pt-BR") : "—"}</td>
                  <td className={`v ${!futuro && acima ? "chv9-up" : ""}`}>
                    {m.deltaMm != null
                      ? `${m.deltaMm > 0 ? "+" : ""}${m.deltaMm.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`
                      : "—"}
                  </td>
                  <td className={futuro ? "" : acima ? "chv9-up" : "chv9-down"}>
                    {futuro ? "futuro" : (m.analise ?? "—")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {c9.notas ? (
        <section className="chv-section">
          <header className="chv-section-head">
            <div>
              <h3 className="chv-section-title">Notas sobre o registro RDO</h3>
              <div className="chv-section-sub">
                num pleito, a prova é o RDO (registro contemporâneo) — priorizar a extração dos dias
                marcados nos DDOs de out/25 a mar/26
              </div>
            </div>
          </header>
          <div className="chv9-notas">{c9.notas}</div>
        </section>
      ) : null}
    </main>
  );
}

// ── Gráfico A · dias >5mm proposta × real (por ano, com chips) ───────────────────────────────────
function GraficoDiasAno({
  serie,
  sintese,
  ok,
}: {
  serie: ChuvaSerieMes[];
  sintese: ChuvasPainel["sintese"];
  ok: boolean;
}) {
  const anos = useMemo(() => [...new Set(serie.map((m) => anoDe(m.mesAno)))], [serie]);
  const [ano, setAno] = useState(anos[0] ?? "");
  const dados = serie
    .filter((m) => anoDe(m.mesAno) === ano)
    .map((m) => ({
      mes: mesDe(m.mesAno),
      prop: m.diasProp,
      real: m.diasReal,
      farol: m.farol,
      delta: m.delta,
      cobrarAcum: m.cobrarAcum,
    }));
  return (
    <section className="chv-section">
      <header className="chv-section-head">
        <div>
          <h3 className="chv-section-title">Dias &gt;5 mm — proposta × real (por ano)</h3>
          <div className="chv-section-sub">
            Proposta (baseline contratual) × real medido (RDO) · barra de real colorida pelo farol
            do mês
          </div>
        </div>
        <div className="chv-chips">
          {anos.map((a) => (
            <button
              key={a}
              type="button"
              className={`chv-chip${a === ano ? " on" : ""}`}
              onClick={() => setAno(a)}
            >
              {a}
            </button>
          ))}
        </div>
      </header>
      <div className="chv-chart">
        <ResponsiveContainer width="100%" height={290}>
          <BarChart data={dados} margin={{ top: 12, right: 12, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 11, fill: "var(--text-3)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--text-3)" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              tickFormatter={(v) => `${v} dias`}
            />
            {/* Δ do mês + "a cobrar acum" já vêm na série (workbook) — o hover conta a história
                completa do mês, não só os dois valores crus. */}
            <Tooltip
              cursor={{ fill: "var(--surface-2)", fillOpacity: 0.6 }}
              content={
                <ChartTooltip
                  formatter={fmtDiasTip}
                  titulo={(label, payload) => {
                    const p = payload?.[0]?.payload as
                      | { delta: number | null; cobrarAcum: number | null }
                      | undefined;
                    return (
                      <>
                        {label}/{ano.slice(2)}
                        {p && (p.delta != null || p.cobrarAcum != null) ? (
                          <span className="chv-tip-extra">
                            Δ mês {p.delta != null ? `${p.delta > 0 ? "+" : ""}${p.delta}` : "—"} ·
                            a cobrar (acum.) {p.cobrarAcum != null ? p.cobrarAcum : "—"}
                          </span>
                        ) : null}
                      </>
                    );
                  }}
                />
              }
            />
            <Bar
              dataKey="prop"
              name="Proposta"
              fill="var(--text-4)"
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
            <Bar dataKey="real" name="Real (RDO)" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {dados.map((d, i) => (
                <Cell key={i} fill={TONE_VAR[farolTone(d.farol) ?? "info"]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className={`chv-verd${ok ? " ok" : ""}`}>
        {I.flag({ size: 14 })}
        <span>{sintese?.veredito ?? "Acompanhamento de dias >5 mm por mês."}</span>
      </div>
      <ChartLegend
        items={[
          { label: "Proposta (baseline)", tipo: "barra", cor: "var(--text-4)" },
          { label: "Real conforme (≤ proposta)", tipo: "barra", cor: "var(--success)" },
          { label: "Real com excesso (Risco)", tipo: "barra", cor: "var(--warning)" },
        ]}
      />
    </section>
  );
}

// ── Apuração mês a mês (excedente → pleiteável) — o dinheiro da aba ──────────────────────────────
type ApuracaoItem = ChuvaApuracaoMes & { idx: number; temReal: boolean };
function ApuracaoCard({ data }: { data: ChuvasPainel }) {
  // Real apurado só nos meses com RDO medido (fonte de verdade = Acompanhamento). jun/26 vem com 0
  // na seção de Apuração (o workbook pré-preenche o futuro), mas sem RDO → pendente, não 0.
  const normMes = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const comReal = useMemo(
    () => new Set(data.serieMensal.filter((m) => m.diasReal != null).map((m) => normMes(m.mesAno))),
    [data.serieMensal],
  );
  const linhas: ApuracaoItem[] = useMemo(
    () =>
      data.apuracao
        .filter((a) => a.real != null || a.prev != null)
        .map((a, idx) => ({ ...a, idx, temReal: comReal.has(normMes(a.mes)) })),
    [data.apuracao, comReal],
  );
  // default "Meses medidos" — o workbook pré-preenche o prev de ~52 meses; sem o filtro a tabela
  // vira dezenas de linhas de "—". "Todos os meses" mantém 100% do dado a 1 clique.
  const [modo, setModo] = useState<"medidos" | "todos">("medidos");
  const excedenteDe = (x: ApuracaoItem) => (x.temReal && x.excedente != null ? x.excedente : -1);
  const col = useColecao(linhas, {
    busca: (a) => a.mes,
    filtro: (a) => modo === "todos" || a.temReal,
    ordenacoes: [
      { value: "crono", label: "Cronológico", cmp: (a, b) => a.idx - b.idx },
      {
        value: "excedente",
        label: "Maior excedente",
        cmp: (a, b) => excedenteDe(b) - excedenteDe(a),
      },
    ],
    perPage: 12,
    resetKey: modo,
  });
  const t = data.totais;
  return (
    <section className="chv-section">
      <header className="chv-section-head">
        <div>
          <h3 className="chv-section-title">Apuração mês a mês — sem compensar déficit</h3>
          <div className="chv-section-sub">
            Excesso de dias &gt;5 mm por mês (real − proposta, só positivo) → ociosidade pleiteável.
            Total: {t?.excedenteDias ?? "—"} dias · {fmtRs(t?.pleiteavelRs ?? null)}
          </div>
        </div>
        <Segmented<"medidos" | "todos">
          value={modo}
          onChange={setModo}
          aria-label="Meses exibidos na apuração"
          items={[
            { value: "medidos", label: "Meses medidos" },
            { value: "todos", label: "Todos os meses" },
          ]}
        />
      </header>
      {linhas.length === 0 ? (
        <EmptyState title="Apuração pendente" text="Aguardando o RDO do período." />
      ) : (
        <>
          {col.showToolbar ? (
            <ColToolbar col={col} placeholder="Buscar mês… (ex.: mai/26)" />
          ) : null}
          <div className="chv-tabela" role="table">
            <div className="chv-tabela-head" role="row">
              <span role="columnheader">Mês</span>
              <span className="r" role="columnheader">
                Prev. &gt;5mm
              </span>
              <span className="r" role="columnheader">
                Real &gt;5mm
              </span>
              <span className="r" role="columnheader">
                Excedente
              </span>
              <span className="r" role="columnheader">
                Pleiteável (mês)
              </span>
            </div>
            {col.visible.length === 0 ? (
              col.debounced ? (
                <ColVazio termo={col.debounced} rotulo="mês" onClear={() => col.setQuery("")} />
              ) : (
                <div className="col-vazia">
                  Nenhum mês medido ainda — o real entra com o RDO do período.
                </div>
              )
            ) : (
              col.visible.map((a) => (
                <div className="chv-tabela-row" role="row" key={a.mes}>
                  <span className="chv-cell-forte" role="cell">
                    {a.mes}
                  </span>
                  <span className="r tabular" role="cell">
                    {a.prev ?? "—"}
                  </span>
                  <span className="r tabular" role="cell">
                    {a.temReal ? (a.real ?? "—") : "—"}
                  </span>
                  <span
                    className={`r tabular ${a.temReal && (a.excedente ?? 0) > 0 ? "chv-exc" : ""}`}
                    role="cell"
                  >
                    {a.temReal && a.excedente != null
                      ? `${a.excedente > 0 ? "+" : ""}${a.excedente}`
                      : "—"}
                  </span>
                  <span className="r tabular" role="cell">
                    {a.temReal && a.total != null && a.total > 0 ? fmtRs(a.total) : "—"}
                  </span>
                </div>
              ))
            )}
            {/* Σ dos meses MEDIDOS (mesmo horizonte dos KPIs) — independe da busca/página acima. */}
            {comReal.size > 0 ? (
              <div className="chv-tabela-row chv-tabela-tot" role="row">
                <span
                  role="cell"
                  title="Soma só os meses COM medição — meses pré-preenchidos sem RDO não entram (pendente ≠ zero); por isso pode diferir da coluna acima no modo 'Todos os meses'."
                >
                  Σ meses medidos ({comReal.size})
                </span>
                <span className="r tabular" role="cell">
                  {fmtInt(data.kpis.diasPropostaAcum)}
                </span>
                <span className="r tabular" role="cell">
                  {fmtInt(data.kpis.diasRealAcum)}
                </span>
                <span
                  className={`r tabular${(t?.excedenteDias ?? data.kpis.diasACobrar) > 0 ? " chv-exc" : ""}`}
                  role="cell"
                >
                  {fmtInt(t?.excedenteDias ?? data.kpis.diasACobrar)}
                </span>
                <span className="r tabular" role="cell">
                  {fmtRs(t?.pleiteavelRs ?? null)}
                </span>
              </div>
            ) : null}
          </div>
          <ColPag col={col} rotulo="meses" />
          {/* Composição do pleiteável (auxiliar_D.6 Totais) — o argumento central do Pleito de
              ociosidade: MOD + EQP e as HH ociosas que sustentam o valor. */}
          {t ? (
            <p className="chv-tabela-comp">
              Composição do pleiteável: MOD <strong>{fmtRs(t.mod)}</strong> + EQP{" "}
              <strong>{fmtRs(t.eqp)}</strong> · HH ociosas <strong>{fmtInt(t.hhOciosas)}</strong> ·
              Σ excedente {fmtInt(t.excedenteDias)} {t.excedenteDias === 1 ? "dia" : "dias"} →{" "}
              <strong>{fmtRs(t.pleiteavelRs)}</strong>
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

// ── Gráfico B · evidência chuva real (RDO mm) × baseline histórico ───────────────────────────────
function GraficoEvidencia({
  serie,
  baseline,
}: {
  serie: ChuvaSerieMes[];
  baseline: ChuvasPainel["baselineMm"];
}) {
  const anos = useMemo(() => [...new Set(serie.map((m) => anoDe(m.mesAno)))], [serie]);
  const [ano, setAno] = useState(anos[0] ?? "");
  // real mm por mês-calendário DO ANO selecionado — sem o filtro, mar/26 e mar/27 colidiriam na
  // mesma barra (o segundo sobrescreveria o primeiro em silêncio).
  const realPorMes = new Map<string, number | null>();
  for (const m of serie) {
    if (m.chuvaMmReal == null || anoDe(m.mesAno) !== ano) continue;
    realPorMes.set(mesDe(m.mesAno).slice(0, 3).toLowerCase(), m.chuvaMmReal);
  }
  const dados = baseline.map((b, i) => ({
    mes: b.mes,
    baseline: b.mm,
    real: realPorMes.get(MESES_CAL[i].slice(0, 3).toLowerCase()) ?? null,
  }));
  // narrativa DERIVADA do dado (mês medido com maior excesso vs baseline, em TODA a série — não
  // depende do ano dos chips) — era "112 mm" chumbado do snapshot mai/26 da BR-101.
  const baseDe = new Map(baseline.map((b) => [b.mes.slice(0, 3).toLowerCase(), b.mm]));
  const piorMes = serie.reduce<{ rotulo: string; real: number; baseline: number } | null>(
    (acc, m) => {
      const base = baseDe.get(mesDe(m.mesAno).slice(0, 3).toLowerCase());
      if (m.chuvaMmReal == null || base == null || base <= 0 || m.chuvaMmReal <= base) return acc;
      return !acc || m.chuvaMmReal - base > acc.real - acc.baseline
        ? {
            rotulo: `${mesDe(m.mesAno).toUpperCase()}/${anoDe(m.mesAno).slice(2)}`,
            real: m.chuvaMmReal,
            baseline: base,
          }
        : acc;
    },
    null,
  );
  return (
    <section className="chv-section">
      <header className="chv-section-head">
        <div>
          <h3 className="chv-section-title">Evidência — chuva real (RDO) × baseline histórico</h3>
          <div className="chv-section-sub">
            Baseline = média 2020–2024 por mês (INMET Macaé A608) · barras = chuva real registrada
            no RDO (mm)
          </div>
        </div>
        <div className="chv-chips">
          {anos.map((a) => (
            <button
              key={a}
              type="button"
              className={`chv-chip${a === ano ? " on" : ""}`}
              onClick={() => setAno(a)}
            >
              {a}
            </button>
          ))}
        </div>
      </header>
      <div className="chv-chart">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={dados} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 11, fill: "var(--text-3)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--text-3)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v} mm`}
            />
            <Tooltip
              cursor={{ fill: "var(--surface-2)", fillOpacity: 0.6 }}
              content={<ChartTooltip formatter={(v: number) => fmtMm(v)} />}
            />
            <Bar
              dataKey="real"
              name="Real (RDO)"
              fill="var(--info)"
              radius={[3, 3, 0, 0]}
              maxBarSize={64}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="baseline"
              name="Baseline 2020–24"
              stroke="var(--text-3)"
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={{ r: 2.5, fill: "var(--text-3)" }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend
        items={[
          { label: `Chuva real (RDO) · ${ano}`, tipo: "barra", cor: "var(--info)" },
          { label: "Baseline · média 2020–24 (INMET)", tipo: "tracejada", cor: "var(--text-3)" },
        ]}
      />
      <p className="chv-chart-foot">
        {piorMes ? (
          <>
            {piorMes.rotulo} choveu <strong>{fmtMm(piorMes.real)}</strong> contra ~
            {fmtMm(piorMes.baseline)} de baseline (≈{" "}
            {(piorMes.real / piorMes.baseline).toLocaleString("pt-BR", {
              maximumFractionDigits: 1,
            })}
            × a média) — daí o excesso de dias &gt;5 mm.{" "}
          </>
        ) : null}
        O RDO grava a chuva diária; os dias &gt;5 mm derivam para a coluna real e o farol do mês.
      </p>
    </section>
  );
}

// ── Gráfico C · dias de chuva por mês (total × impeditivos >5mm) ─────────────────────────────────
function GraficoDiasChuva({ dias }: { dias: ChuvasPainel["diasChuva"] }) {
  const totTotal = dias.reduce((a, d) => a + (d.total ?? 0), 0);
  const totImp = dias.reduce((a, d) => a + (d.impeditivos ?? 0), 0);
  return (
    <section className="chv-section">
      <header className="chv-section-head">
        <div>
          <h3 className="chv-section-title">Dias de chuva por mês — totais × impeditivos</h3>
          <div className="chv-section-sub">
            Baseline da proposta · {totTotal} dias de chuva/ano · {totImp} impeditivos (&gt;5 mm)
          </div>
        </div>
      </header>
      <div className="chv-chart">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={dias} margin={{ top: 12, right: 8, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 10, fill: "var(--text-3)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--text-3)" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: "var(--surface-2)", fillOpacity: 0.6 }}
              content={<ChartTooltip formatter={fmtDiasTip} />}
            />
            <Bar
              dataKey="total"
              name="Dias de chuva"
              fill="var(--text-4)"
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
            />
            {/* navy canônico do ChartKit (--rma-navy) — var(--ink) direto sumia no tema escuro. */}
            <Bar
              dataKey="impeditivos"
              name="Dias >5 mm"
              fill={CHART_SERIE_COR.real}
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend
        items={[
          { label: "Dias de chuva (todos)", tipo: "barra", cor: "var(--text-4)" },
          { label: "Dias >5 mm (impeditivos)", tipo: "barra", cor: CHART_SERIE_COR.real },
        ]}
      />
    </section>
  );
}

// ── Gráfico D · dias praticáveis por calendário (CAL 1-6) ────────────────────────────────────────
// Paleta SEQUENCIAL navy escuro → claro por sensibilidade (CAL 1 = serviço mais sensível à chuva).
// Nada de tons de farol (danger/warning/success) como cor categórica: nesta tela essas cores JÁ
// significam status do mês. Vars --c9-cal* definidas no chuvas.css (color-mix; adapta no dark).
const CAL_COR = [1, 2, 3, 4, 5, 6].map((i) => `var(--c9-cal${i})`);
function GraficoCalendarios({
  dias,
  totais,
}: {
  dias: ChuvasPainel["diasChuva"];
  totais: number[];
}) {
  const dados = dias.map((d) => {
    const o: Record<string, unknown> = { mes: d.mes };
    d.cal.forEach((v, i) => (o[`cal${i + 1}`] = v));
    return o;
  });
  return (
    <section className="chv-section">
      <header className="chv-section-head">
        <div>
          <h3 className="chv-section-title">Dias praticáveis por calendário</h3>
          <div className="chv-section-sub">
            Sensibilidade à chuva por tipo de serviço (CAL 1–6) · dias úteis trabalháveis/mês ·
            linha mais escura = mais sensível
          </div>
        </div>
      </header>
      <div className="chv-chart">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={dados} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 10, fill: "var(--text-3)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--text-3)" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<ChartTooltip formatter={fmtDiasTip} />} />
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Line
                key={i}
                type="monotone"
                dataKey={`cal${i}`}
                name={`CAL ${i}`}
                stroke={CAL_COR[i - 1]}
                strokeWidth={1.8}
                strokeDasharray={i === 4 ? "5 3" : undefined}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="chv-caltot">
        {totais.map((t, i) => (
          <span key={i}>
            <span className="chv-dot" style={{ background: CAL_COR[i] }} /> CAL {i + 1}:{" "}
            <b className="tabular">{t}</b>/ano
          </span>
        ))}
      </div>
    </section>
  );
}

function CriteriosFarol() {
  return (
    <div className="chv-farol-leg">
      <span className="chv-farol-leg-titulo">Critério do farol (por mês):</span>
      <span>
        <span className="chv-dot" style={{ background: "var(--success)" }} /> Conforme · real ≤
        proposta
      </span>
      <span>
        <span className="chv-dot" style={{ background: "var(--warning)" }} /> Risco · real &gt;
        proposta (excedente a cobrar)
      </span>
      <span>
        <span className="chv-dot" style={{ background: "var(--text-4)" }} /> Sem RDO · mês ainda não
        medido
      </span>
    </div>
  );
}

function LeituraIA({ texto }: { texto: string }) {
  return (
    <section className="chv-section chv-ia">
      <div className="chv-ia-tag">{I.note({ size: 12 })} LEITURA DO PAINEL · ADM CONTRATUAL IA</div>
      <p className="chv-ia-texto">{texto}</p>
    </section>
  );
}
