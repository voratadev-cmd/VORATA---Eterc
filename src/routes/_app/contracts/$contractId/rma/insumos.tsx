// C.6 — Insumos de faturamento direto · base por insumo (v53 · cláusulas 6.2/8.8).
// SUBSTITUIÇÃO COMPLETA (Prompt_Devs_C06_D05_Insumos §0): reconstruída sobre o modelo único
// obra_insumos_fd/fontes/reeq (mesmo backend da D.5). Layout/UX 1:1 com o mockup
// C06_Insumos_Seletor_BR101.html; números do Excel v53 (§9: FD 96.818.470,96 · 30 acima do
// IPCA · repasse 10.246,94 · potencial 977.825,00). Presets e totais recalculam em tempo real
// via o motor puro (insumosFd.ts) — o MESMO que os probes de paridade conferem.
// Adaptações mandatórias do DS: lucide (sem emoji), KPI com chip (sem tarja), cores por token.

import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  ChevronDown,
  Info,
  LineChart as LineChartIcon,
  Pencil,
  ZoomIn,
} from "lucide-react";

import { ChartLegend, ChartTooltip, EmptyState, ErroCard, Skeleton } from "@/components/ds";
import { RmaParamBar } from "@/components/RmaParamBar/RmaParamBar";
import {
  CardsInsumosFd,
  PresetsInsumosFd,
  TabelaMultifonte,
  ValorLive,
  fmtBRL0,
  fmtBRL2,
  fmtDataBrIso,
  fmtMi2,
  fmtPotencial,
  listaCap,
  listaPt,
  nomeCurtoInsumo,
  mesCurtoIso,
  mesLongoIso,
  useSelecaoInsumosFd,
} from "@/components/InsumosFd/InsumosFdShared";
import { useInsumosFd } from "@/lib/hooks/useInsumosFd";
import { useObra } from "@/lib/hooks/useObra";
import { useSinteseContrato } from "@/lib/hooks/useSinteseContrato";
import {
  LIMIAR_EXCEDENTE,
  fonteSelecionada,
  linhaCalc,
  type InsumosFd,
} from "@/lib/supabase/insumosFd";

import "./insumos.css";

export const Route = createFileRoute("/_app/contracts/$contractId/rma/insumos")({
  component: InsumosC6Aba,
});

// ── helpers locais ────────────────────────────────────────────────────────────
const fmtPct3 = (frac: number) =>
  `${(frac * 100).toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}%`;
const fmtPct1 = (v: number) =>
  `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const nomeCurto = (s: string) => (s.length > 24 ? `${s.slice(0, 23)}…` : s);
// ticks legíveis (fontSize 10) pedem truncagem mais curta — o nome completo vive no tooltip
const nome18 = (s: string) => (s.length > 18 ? `${s.slice(0, 17)}…` : s);

// ── gráfico 1 · Curva ABC (Pareto · top 14 + barra agregada dos demais) ───────
type LinhaAbc = {
  nome: string;
  nomeFull: string;
  valor: number;
  pct: number;
  acum: number;
  classe: string;
};

function GraficoAbc({ dados }: { dados: InsumosFd }) {
  const linhas = useMemo<LinhaAbc[]>(() => {
    const arr = [...dados.insumos].sort((a, b) => b.valorContratoBdi - a.valorContratoBdi);
    const tot = arr.reduce((s, x) => s + x.valorContratoBdi, 0);
    const top = arr.slice(0, 14);
    const resto = arr.slice(14);
    let ac = 0;
    const rows: LinhaAbc[] = top.map((x) => {
      const pct = tot > 0 ? (x.valorContratoBdi / tot) * 100 : 0;
      ac += pct;
      return {
        nome: nome18(x.nome),
        nomeFull: x.nome,
        valor: x.valorContratoBdi,
        pct: Number(pct.toFixed(2)),
        acum: Number(ac.toFixed(2)),
        classe: x.classe,
      };
    });
    // barra agregada: os insumos fora do top-14 não somem em silêncio — o acumulado fecha em 100%
    if (resto.length > 0) {
      const v = resto.reduce((s, x) => s + x.valorContratoBdi, 0);
      const classes = [...new Set(resto.map((x) => x.classe))].join("/");
      rows.push({
        nome: `+${resto.length} demais (${classes})`,
        nomeFull: `Demais ${resto.length} insumos (classe ${classes})`,
        valor: v,
        pct: Number((tot > 0 ? (v / tot) * 100 : 0).toFixed(2)),
        acum: 100,
        classe: resto[0]?.classe ?? "C",
      });
    }
    return rows;
  }, [dados]);
  const corClasse = (c: string) =>
    c === "A" ? "var(--c6-navy)" : c === "B" ? "var(--warning)" : "var(--text-4)";
  return (
    <div style={{ width: "100%", height: 340 }}>
      <ResponsiveContainer>
        <ComposedChart data={linhas} margin={{ top: 8, right: 12, bottom: 62, left: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="nome"
            angle={-45}
            textAnchor="end"
            interval={0}
            tick={{ fontSize: 10, fill: "var(--text-3)" }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            yAxisId="pct"
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 9, fill: "var(--text-3)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="acum"
            orientation="right"
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 9, fill: "var(--text-3)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={
              <ChartTooltip
                titulo={(_, p) => {
                  const row = p[0]?.payload as LinhaAbc | undefined;
                  return row ? `${row.nomeFull} — ${fmtMi2(row.valor)}` : null;
                }}
                formatter={{
                  pct: (v) => `${fmtPct1(v)} do FD`,
                  acum: (v) => fmtPct1(v),
                }}
              />
            }
          />
          <Bar yAxisId="pct" dataKey="pct" name="% do custo" radius={[3, 3, 0, 0]}>
            {linhas.map((l) => (
              <Cell key={l.nome} fill={corClasse(l.classe)} />
            ))}
          </Bar>
          <Line
            yAxisId="acum"
            dataKey="acum"
            name="% acumulado"
            stroke="var(--info)"
            strokeWidth={2}
            dot={{ r: 2.5, fill: "var(--info)" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── gráfico 2 · evolução dos índices por família (base 100 = OS mar/26) ───────
type IdxViewId = "setoriais" | "diesel" | "cbuq" | "concreto" | "aco" | "agregados";
/** Séries por família: (rótulo, ordem ABC do insumo, fonte_id, token de cor) — espelho do IDX do mockup. */
const IDX_VIEWS: Record<
  IdxViewId,
  { nome: string; series: Array<[string, number, string, string]> }
> = {
  setoriais: {
    nome: "Setoriais DNIT",
    series: [
      ["DNIT Pavimentação", 1, "pav", "var(--c6-navy)"],
      ["DNIT CAP", 1, "cap", "var(--danger)"],
      ["DNIT OAE", 3, "dnit", "var(--info)"],
      ["DNIT Aço OAE", 5, "dnit", "var(--vault)"],
      ["DNIT Drenagem", 13, "dnit", "var(--success)"],
    ],
  },
  diesel: {
    nome: "Diesel",
    series: [
      ["ANP", 2, "anp", "var(--success)"],
      ["SINAPI", 2, "sinapi", "var(--info)"],
      ["SBC", 2, "sbc", "var(--vault)"],
      ["EMOP", 2, "emop", "var(--brand)"],
      ["SCO", 2, "sco", "var(--warning)"],
    ],
  },
  cbuq: {
    nome: "CBUQ (asfalto)",
    series: [
      ["SINAPI", 1, "sinapi_3045", "var(--info)"],
      ["SBC", 1, "sbc_3045", "var(--vault)"],
      ["DNIT Pavim.", 1, "pav", "var(--c6-navy)"],
      ["DNIT CAP", 1, "cap", "var(--danger)"],
    ],
  },
  concreto: {
    nome: "Concreto",
    series: [
      ["SINAPI", 3, "mercado", "var(--info)"],
      ["DNIT", 3, "dnit", "var(--c6-navy)"],
      ["SBC", 3, "sbc", "var(--vault)"],
      ["EMOP", 3, "emop", "var(--brand)"],
    ],
  },
  aco: {
    nome: "Aço",
    series: [
      ["SINAPI", 5, "mercado", "var(--info)"],
      ["DNIT", 5, "dnit", "var(--c6-navy)"],
      ["SBC", 5, "sbc", "var(--vault)"],
      ["EMOP", 5, "emop", "var(--brand)"],
    ],
  },
  agregados: {
    nome: "Agregados",
    series: [
      ["SINAPI", 8, "mercado", "var(--info)"],
      ["DNIT Pavim.", 8, "dnit", "var(--c6-navy)"],
      ["SBC", 8, "sbc", "var(--vault)"],
      ["EMOP", 8, "emop", "var(--brand)"],
    ],
  },
};
// Intro qualitativa por família (sem números — os números da narrativa são DERIVADOS do dado
// carregado logo abaixo, pra não mentir na próxima obra/BM · quick win 4 do refino).
const IDX_INTRO: Record<IdxViewId, string> = {
  setoriais: "Cinco índices setoriais DNIT (cada um uma cesta de material+MO+equip.).",
  diesel: "Fontes de diesel — a escolha da fonte muda o tamanho do repasse.",
  cbuq: "Fontes do CBUQ. O DNIT CAP acompanha só o ligante — é a escolha que domina o reequilíbrio.",
  concreto: "Fontes do concreto — pela fonte, o insumo gera repasse ou é absorvido.",
  aco: "Fontes do aço.",
  agregados: "Fontes dos agregados (brita/bica/pó).",
};
const fmtDeltaPts = (d: number) =>
  `${d > 0 ? "+" : ""}${d.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

function GraficoIndices({ dados }: { dados: InsumosFd }) {
  const [view, setView] = useState<IdxViewId>("diesel");
  const [zoom, setZoom] = useState(false);
  // meses do marco (OS) e do corte derivados do read-model (reeq) — nada de "2026-03" chumbado.
  const mesOs = dados.reeq.dataOs?.slice(0, 7) ?? null;
  const mesAtual = dados.reeq.dataVerificacao?.slice(0, 7) ?? null;
  // eixo X = TODOS os meses da série IPCA entre a OS e o corte (a "linha divisória" deixa de ser
  // uma reta artificial de 2 pontos — o abr/26 que já está carregado entra no gráfico).
  const eixo = useMemo<Array<{ mes: string | null; rotulo: string }>>(() => {
    if (!mesOs || !mesAtual) {
      return [
        { mes: mesOs, rotulo: mesCurtoIso(mesOs) ?? "OS" },
        { mes: mesAtual, rotulo: mesCurtoIso(mesAtual) ?? "atual" },
      ];
    }
    const set = new Set<string>([mesOs, mesAtual]);
    for (const s of dados.serieIpca) if (s.mes > mesOs && s.mes < mesAtual) set.add(s.mes);
    return [...set].sort().map((m) => ({ mes: m, rotulo: mesCurtoIso(m) ?? m }));
  }, [dados, mesOs, mesAtual]);
  // IPCA normalizado a 100 na OS, mês a mês (a série mensal inteira já vem do read-model)
  const ipcaPorMes = useMemo<Record<string, number> | null>(() => {
    if (!mesOs) return null;
    const i0 = dados.serieIpca.find((s) => s.mes === mesOs)?.indice;
    if (!i0) return null;
    const porMes: Record<string, number> = {};
    for (const s of dados.serieIpca) {
      if (s.mes >= mesOs && (!mesAtual || s.mes <= mesAtual) && s.indice > 0) {
        porMes[s.mes] = (s.indice / i0) * 100;
      }
    }
    return porMes;
  }, [dados, mesOs, mesAtual]);
  const ipcaPts = useMemo(() => {
    const i1 = mesAtual && ipcaPorMes ? (ipcaPorMes[mesAtual] ?? null) : null;
    return i1 != null ? ([100, i1] as const) : null;
  }, [ipcaPorMes, mesAtual]);
  const seriesAll = useMemo(() => {
    const out: Array<{
      nome: string;
      cor: string;
      dash?: string;
      pts: readonly [number, number];
      /** série mensal completa (só o IPCA tem — fontes cotam apenas OS e corte). */
      porMes?: Record<string, number>;
    }> = [];
    for (const [nome, ordem, fonteId, cor] of IDX_VIEWS[view].series) {
      const insumo = dados.insumos.find((x) => x.ordemAbc === ordem);
      const f = insumo?.opcoes.find((o) => o.id === fonteId);
      if (!f || f.valorOs == null || f.valorAtual == null || f.valorOs === 0) continue;
      out.push({ nome, cor, pts: [100, (f.valorAtual / f.valorOs) * 100] });
    }
    if (ipcaPts) {
      out.push({
        nome: "IPCA (IBGE)",
        cor: "var(--text)",
        dash: "2 3",
        pts: ipcaPts,
        porMes: ipcaPorMes ?? undefined,
      });
    }
    return out;
  }, [dados, view, ipcaPts, ipcaPorMes]);
  const series = useMemo(
    () => (zoom ? seriesAll.filter((s) => Math.max(...s.pts) <= 103) : seriesAll),
    [seriesAll, zoom],
  );
  // narrativa derivada do dado (maior/menor variação + quantas superam o IPCA) — pré-zoom.
  const stats = useMemo(() => {
    const fontes = seriesAll
      .filter((s) => !s.dash)
      .map((s) => ({ nome: s.nome, d: s.pts[1] - 100 }));
    if (fontes.length === 0) return null;
    const max = fontes.reduce((a, b) => (b.d > a.d ? b : a));
    const min = fontes.reduce((a, b) => (b.d < a.d ? b : a));
    const ipcaD = ipcaPts ? ipcaPts[1] - 100 : null;
    const nAcima = ipcaD != null ? fontes.filter((x) => x.d > ipcaD).length : null;
    return { max, min, ipcaD, nAcima, total: fontes.length };
  }, [seriesAll, ipcaPts]);
  // fontes só têm valor na OS e no corte (pontos nas pontas, connectNulls liga);
  // o IPCA plota mês a mês — a linha divisória já é a trajetória real desde a OS.
  const linhas = useMemo(() => {
    const last = eixo.length - 1;
    return eixo.map((e, i) => {
      const row: Record<string, string | number | null> = { mes: e.rotulo };
      for (const s of series) {
        if (s.porMes) {
          const v = e.mes != null ? s.porMes[e.mes] : undefined;
          row[s.nome] = v != null ? Number(v.toFixed(3)) : null;
        } else {
          row[s.nome] =
            i === 0 ? Number(s.pts[0].toFixed(3)) : i === last ? Number(s.pts[1].toFixed(3)) : null;
        }
      }
      return row;
    });
  }, [series, eixo]);
  return (
    <>
      <div className="ifd-viewtoggle" style={{ marginBottom: 6, flexWrap: "wrap" }} role="tablist">
        {(Object.keys(IDX_VIEWS) as IdxViewId[]).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            className={`ifd-vbtn${view === v ? " on" : ""}`}
            onClick={() => setView(v)}
          >
            {IDX_VIEWS[v].nome}
          </button>
        ))}
      </div>
      <div className="ifd-viewtoggle" style={{ marginBottom: 8 }}>
        <button
          type="button"
          className={`ifd-vbtn${!zoom ? " on" : ""}`}
          onClick={() => setZoom(false)}
        >
          <LineChartIcon size={13} /> Escala cheia
        </button>
        <button
          type="button"
          className={`ifd-vbtn${zoom ? " on" : ""}`}
          onClick={() => setZoom(true)}
        >
          <ZoomIn size={13} /> Aproximar
        </button>
      </div>
      <div className="ifd-hint" style={{ margin: "0 0 8px" }}>
        {IDX_INTRO[view]}
        {stats ? (
          <>
            {" "}
            Maior variação:{" "}
            <b>
              {stats.max.nome} {fmtDeltaPts(stats.max.d)}
            </b>
            {stats.total > 1 ? (
              <>
                ; menor:{" "}
                <b>
                  {stats.min.nome} {fmtDeltaPts(stats.min.d)}
                </b>
              </>
            ) : null}
            .
            {stats.nAcima != null && stats.ipcaD != null ? (
              <>
                {" "}
                {stats.nAcima === 0
                  ? `Nenhuma das ${stats.total} fontes supera`
                  : `${stats.nAcima} de ${stats.total} fontes ${stats.nAcima === 1 ? "supera" : "superam"}`}{" "}
                o IPCA do período ({fmtDeltaPts(stats.ipcaD)}) — acima da linha sustentam repasse
                (8.8); abaixo, a contratada absorve.
              </>
            ) : null}
          </>
        ) : null}
        {zoom && <b> · zoom 98,5–103: fontes acima de 103 saem de escala.</b>}
      </div>
      <div style={{ width: "100%", height: 380 }}>
        <ResponsiveContainer>
          <LineChart data={linhas} margin={{ top: 8, right: 18, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 11, fill: "var(--text-3)" }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
            />
            <YAxis
              domain={zoom ? [98.5, 103] : ["auto", "auto"]}
              tick={{ fontSize: 10, fill: "var(--text-3)" }}
              axisLine={false}
              tickLine={false}
              label={{
                value: `Índice (base 100 = ${mesCurtoIso(dados.reeq.dataOs) ?? "OS"})${zoom ? " · zoom" : ""}`,
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 10, fill: "var(--text-3)" },
              }}
            />
            <Tooltip
              content={
                <ChartTooltip
                  formatter={(v: number) =>
                    `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (base 100)`
                  }
                  ocultarNulos
                />
              }
            />
            {series.map((s) => (
              <Line
                key={s.nome}
                dataKey={s.nome}
                stroke={s.cor}
                strokeWidth={s.nome.startsWith("IPCA") ? 2.4 : 2.2}
                strokeDasharray={s.dash}
                dot={{ r: 3.5, fill: s.cor }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend
        className="c6-chartlegend"
        items={series.map((s) => ({
          label: s.nome,
          tipo: s.dash ? ("tracejada" as const) : ("linha" as const),
          cor: s.cor,
        }))}
      />
    </>
  );
}

// ── gráfico 3 · Δ% por insumo × linha divisória do IPCA ───────────────────────
type LinhaExc = {
  nome: string;
  nomeFull: string;
  delta: number;
  /** excedente sobre o IPCA em p.p. (null quando a fonte não cota o período). */
  excedentePp: number | null;
  potencial: number;
  /** null = sem medição até o corte (pendente ≠ zero). */
  repasseReal: number | null;
  excede: boolean;
};
const fmtPp2 = (v: number) =>
  `${v > 0 ? "+" : ""}${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} p.p.`;
const fmtPct2Sinal = (v: number) =>
  `${v > 0 ? "+" : ""}${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

function GraficoExcedente({
  dados,
  selecao,
}: {
  dados: InsumosFd;
  selecao: Record<number, string>;
}) {
  const ipcaPct = dados.reeq.ipcaPeriodo * 100;
  const linhas = useMemo(() => {
    const rows: LinhaExc[] = [];
    for (const x of dados.insumos) {
      // linhaCalc = o MESMO cálculo da tabela — o hover responde "quanto vale esta barra em R$"
      const calc = linhaCalc(x, selecao);
      if (!calc.fonte || calc.delta == null) continue;
      rows.push({
        nome: nomeCurto(x.nome),
        nomeFull: x.nome,
        delta: Number((calc.delta * 100).toFixed(2)),
        excedentePp: calc.excedente != null ? calc.excedente * 100 : null,
        potencial: calc.potencial,
        repasseReal: calc.repasseReal,
        excede: calc.excedente != null && calc.excedente > LIMIAR_EXCEDENTE,
      });
    }
    rows.sort((a, b) => b.delta - a.delta);
    return rows;
  }, [dados, selecao]);
  // altura derivada do nº de barras (~26px por linha + eixo) — 640 fixos espremiam 30 barras
  const altura = linhas.length * 26 + 60;
  return (
    <div style={{ width: "100%", height: altura }}>
      <ResponsiveContainer>
        <ComposedChart
          data={linhas}
          layout="vertical"
          margin={{ top: 4, right: 44, bottom: 18, left: 8 }}
        >
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v}%`}
            tick={{ fontSize: 10, fill: "var(--text-3)" }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
            label={{
              value: `linha tracejada = IPCA período (${fmtPct3(dados.reeq.ipcaPeriodo)})`,
              position: "insideBottom",
              offset: -10,
              style: { fontSize: 10, fill: "var(--text-3)" },
            }}
          />
          <YAxis
            type="category"
            dataKey="nome"
            width={168}
            tick={{ fontSize: 10.5, fill: "var(--text-2)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              const row = payload?.[0]?.payload as LinhaExc | undefined;
              if (!active || !row) return null;
              // payload sintético: Δ%, excedente e R$ da linha (mesmos números da tabela)
              const entries = [
                {
                  dataKey: "delta",
                  name: "Δ% real",
                  value: row.delta,
                  color: row.excede ? "var(--danger)" : "var(--success)",
                },
                ...(row.excedentePp != null
                  ? [
                      {
                        dataKey: "exc",
                        name: "Excedente (Δ − IPCA)",
                        value: row.excedentePp,
                        color: "var(--text-4)",
                      },
                    ]
                  : []),
                {
                  dataKey: "pot",
                  name: "Potencial (contrato)",
                  value: row.potencial,
                  color: "var(--warning)",
                },
                ...(row.repasseReal != null
                  ? [
                      {
                        dataKey: "rep",
                        name: "Repasse real (medido)",
                        value: row.repasseReal,
                        color: "var(--vault)",
                      },
                    ]
                  : []),
              ];
              return (
                <ChartTooltip
                  active
                  label={label}
                  titulo={row.nomeFull}
                  payload={entries}
                  formatter={{
                    delta: fmtPct2Sinal,
                    exc: fmtPp2,
                    pot: (v) => (v > 0 ? fmtBRL0(v) : "R$ 0 (absorvido)"),
                    rep: fmtBRL2,
                  }}
                />
              );
            }}
          />
          <ReferenceLine
            x={ipcaPct}
            stroke="var(--c6-navy)"
            strokeDasharray="5 4"
            strokeWidth={1.5}
            label={{
              value: `IPCA ${fmtPct3(dados.reeq.ipcaPeriodo)}`,
              position: "top",
              style: { fontSize: 10, fill: "var(--c6-navy)", fontWeight: 600 },
            }}
          />
          <Bar dataKey="delta" name="Δ% real" barSize={12} radius={[0, 3, 3, 0]}>
            {linhas.map((l) => (
              <Cell key={l.nome} fill={l.excede ? "var(--danger)" : "var(--success)"} />
            ))}
            <LabelList
              dataKey="delta"
              position="right"
              formatter={(v: number) => `${v > 0 ? "+" : ""}${v.toLocaleString("pt-BR")}%`}
              style={{ fontSize: 10, fill: "var(--text-3)" }}
            />
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── tela ──────────────────────────────────────────────────────────────────────
function InsumosC6Aba() {
  const { contractId } = Route.useParams();
  const q = useInsumosFd(contractId);
  const sel = useSelecaoInsumosFd(q.data);
  // identificação do contrato derivada dos read-models (era literal da BR-101, que mentia em
  // qualquer outra obra): Nº do Contrato + nº interno vêm da captura da C.1 (obra_secoes);
  // fallback honesto = nome interno da obra (useObra, já em cache pelo shell do RMA).
  const { data: obra } = useObra(contractId);
  const { data: sintese } = useSinteseContrato(contractId);
  const contratoLabel =
    [sintese?.identificacaoLegal?.["Nº do Contrato"], sintese?.documentos?.contratoInterno]
      .filter(Boolean)
      .join(" · ") ||
    obra?.nome_interno ||
    "—";

  if (q.isLoading) {
    // Skeleton com a FORMA da tela (regra nº4): título/sub → param bar → 4 KPIs → presets →
    // painel ABC → painel índices → bloco alto da tabela.
    return (
      <div className="c6-wrap">
        <Skeleton style={{ height: 28, width: 460, marginBottom: 10 }} />
        <Skeleton style={{ height: 18, width: 380, marginBottom: 14 }} />
        <Skeleton style={{ height: 44, marginBottom: 14 }} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "var(--s-3)",
            marginBottom: 16,
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 88 }} />
          ))}
        </div>
        <div style={{ display: "flex", gap: "var(--s-2)", marginBottom: 20 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 34, width: 132 }} />
          ))}
        </div>
        <Skeleton style={{ height: 340, marginBottom: 16 }} />
        <Skeleton style={{ height: 380, marginBottom: 16 }} />
        <Skeleton style={{ height: 520 }} />
      </div>
    );
  }
  if (q.isError) {
    // ERRO ≠ pendência: falha de leitura mostra Badge danger + retry (ErroCard do DS)
    return (
      <ErroCard
        titulo="Não foi possível carregar os insumos"
        mensagem={String((q.error as Error)?.message ?? "Falha de leitura")}
        onRetry={() => void q.refetch()}
      />
    );
  }
  const dados = q.data;
  if (!dados) {
    return (
      <EmptyState
        framed
        title="Insumos v53 ainda não normalizados"
        text="As tabelas obra_insumos_fd desta obra estão vazias — rode a normalização do workbook v53."
      />
    );
  }

  // insumos com medição no BM (deriva as narrativas "só brita e bica…" do dado carregado)
  const medidos = dados.insumos.filter((x) => x.valorMedidoBdi > 0).map((x) => x.nome);
  // top-2 da ABC derivado (era "CBUQ e diesel ... metade" chumbado da BR-101)
  const abcTop2 = [...dados.insumos]
    .sort((a, b) => b.valorContratoBdi - a.valorContratoBdi)
    .slice(0, 2);
  const abcTop2Pct =
    dados.totalFdBdi > 0
      ? (abcTop2.reduce((t, x) => t + x.valorContratoBdi, 0) / dados.totalFdBdi) * 100
      : 0;
  const top2Hint =
    abcTop2.length === 2 ? (
      <>
        {" "}
        — {nomeCurtoInsumo(abcTop2[0].nome)} e {nomeCurtoInsumo(abcTop2[1].nome)} sozinhos{" "}
        {abcTop2Pct >= 50
          ? "já passam de metade"
          : `somam ${abcTop2Pct.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`}
      </>
    ) : null;
  // insumo que domina o potencial de repasse nas bases selecionadas (narrativa derivada)
  let topPotencial: { nome: string; v: number } | null = null;
  for (const x of dados.insumos) {
    const o = fonteSelecionada(x, sel.selecao);
    const p =
      o?.excedente != null && o.excedente > LIMIAR_EXCEDENTE ? o.excedente * x.valorContratoBdi : 0;
    if (p > 0 && (topPotencial == null || p > topPotencial.v))
      topPotencial = { nome: x.nome, v: p };
  }

  return (
    <div className="c6-wrap">
      <h2 className="c6-titulo">Insumos de faturamento direto — base por insumo</h2>
      <div className="c6-sub">
        Contrato: <b>{contratoLabel}</b> &nbsp;·&nbsp; Corte:{" "}
        <b>{fmtDataBrIso(dados.reeq.dataVerificacao) ?? "—"}</b> &nbsp;·&nbsp; BM do corte:{" "}
        {/* TODO(refino): exibir o Nº do BM quando o read-model insumosFd expor bm_corrente —
            chumbá-lo mentia em qualquer outra obra/mês. */}
        <b>{mesLongoIso(dados.reeq.dataVerificacao) ?? "—"}</b> &nbsp;
        <span className="c6-pill">
          <span className="c6-pill-dot" aria-hidden /> valores c/ BDI
        </span>
      </div>
      {/* barra de parâmetros canônica das abas RMA (a ifd-pbar bespoke virou RmaParamBar) */}
      <RmaParamBar
        className="c6-pbar"
        items={[
          {
            label: "Marco reequilíbrio",
            valor: `OS (${mesLongoIso(dados.reeq.dataOs) ?? "—"})`,
          },
          { label: "Fonte", valor: "PQ (Anexo C.04) + BM" },
          {
            label: "IPCA período",
            valor: (
              <>
                <span className="c6-hot">{fmtPct3(dados.reeq.ipcaPeriodo)}</span> · linha divisória
                (8.8)
              </>
            ),
            title:
              "Variação do IPCA entre a OS e o corte — o que a fonte varia acima disso é repassável (cláusula 8.8)",
          },
        ]}
      />

      {/* snapshot no topo: os números que respondem o JTBD antes de qualquer texto (refino UX) */}
      <CardsInsumosFd
        totalFdBdi={dados.totalFdBdi}
        totais={sel.totais}
        repasseTitulo="Repasse real (medido)"
        potencialTitulo="Potencial (se tudo medido)"
        nInsumos={dados.insumos.length}
        repasseSub={
          medidos.length > 0 ? `${listaCap(medidos)} · c/ BDI` : "sem medição até o corte"
        }
      />

      <div className="ifd-secttl">Escolha a base de cada insumo</div>
      <PresetsInsumosFd
        hintIntro={
          <>
            Para cada insumo você escolhe o índice mais <b>defensável</b>. O DNIT (cesta setorial) é
            estável; o mercado (SINAPI/ANP) capta o preço do insumo isolado. Os{" "}
            <b>cards acima recalculam em tempo real</b>. <span className="ifd-recdot" /> = sugestão
            da IA.
          </>
        }
        presetAtivo={sel.presetAtivo}
        onPreset={sel.aplicar}
      />

      {/* contexto metodológico condensado: uma linha que expande — nada do texto foi removido */}
      <details className="ifd-srcinfo c6-srcinfo">
        <summary>
          <Info size={13} aria-hidden />
          <b>Valores com BDI, conforme o contrato</b>
          <span className="c6-srcinfo-mais">· como os números são formados</span>
          <ChevronDown size={14} className="c6-srcinfo-chev" aria-hidden />
        </summary>
        <p>
          Os {dados.insumos.length} insumos de faturamento direto vêm da{" "}
          <b>PQ oficial (Anexo C.04)</b> — quantidade e preço unitário — e as quantidades/valores
          medidos do <b>Boletim de Medição</b>. O somatório fecha com a PQ:{" "}
          <b>{fmtBRL2(dados.totalFdBdi)}</b>.
        </p>
      </details>

      <div className="ifd-secttl">
        Curva ABC — concentração do custo por insumo (faturamento direto)
      </div>
      <div className="ifd-panel">
        <div className="ifd-hint" style={{ margin: "0 0 8px" }}>
          Pareto dos {dados.insumos.length} insumos por valor de contrato (c/ BDI). Barras =
          participação de cada insumo no custo; linha azul = acumulado. <b>Classe A</b> (navy)
          concentra o essencial{top2Hint}. É onde a variação de índice mais pesa no reequilíbrio.
        </div>
        <GraficoAbc dados={dados} />
        <ChartLegend
          className="c6-chartlegend"
          items={[
            { label: "Classe A", tipo: "barra", cor: "var(--c6-navy)" },
            { label: "Classe B", tipo: "barra", cor: "var(--warning)" },
            { label: "Classe C", tipo: "barra", cor: "var(--text-4)" },
            { label: "% acumulado", tipo: "linha", cor: "var(--info)" },
          ]}
        />
      </div>

      <div className="ifd-secttl">
        Evolução dos índices desde o marco (base 100 = OS {mesCurtoIso(dados.reeq.dataOs) ?? "—"})
      </div>
      <div className="ifd-panel">
        <div className="ifd-hint" style={{ margin: "0 0 8px" }}>
          Escolha um <b>insumo</b> e veja <b>todas as fontes</b> que o cotam, normalizadas a{" "}
          <b>100 no marco da OS ({mesCurtoIso(dados.reeq.dataOs) ?? "—"})</b>. A linha preta
          pontilhada é o <b>IPCA</b>: fonte acima dela superou a inflação e sustenta repasse (8.8);
          abaixo, a contratada absorve. Cor fixa por fonte. O <b>IPCA já aparece mês a mês</b>; as
          fontes têm cotação na OS e no corte (
          <b>
            {mesCurtoIso(dados.reeq.dataOs) ?? "OS"} →{" "}
            {mesCurtoIso(dados.reeq.dataVerificacao) ?? "corte"}
          </b>
          , reta entre as pontas) — ao receber os demais meses, a trajetória delas se completa.
        </div>
        <GraficoIndices dados={dados} />
      </div>

      <div className="ifd-secttl">Reequilíbrio — Δ% por insumo × linha divisória do IPCA (8.8)</div>
      <div className="ifd-panel">
        <div className="ifd-hint" style={{ margin: "0 0 8px" }}>
          Cada barra = variação do insumo desde o marco (OS {mesCurtoIso(dados.reeq.dataOs) ?? "—"}{" "}
          → {mesCurtoIso(dados.reeq.dataVerificacao) ?? "—"}), pela <b>base selecionada</b> na
          tabela. A linha vertical tracejada é o{" "}
          <b>IPCA do período ({fmtPct3(dados.reeq.ipcaPeriodo)})</b>: quem a <b>ultrapassa</b>{" "}
          (vermelho) gera excedente repassável (8.8); quem fica <b>aquém</b> (verde) é absorvido
          pela contratada. Reordena e recolore ao trocar a base ou aplicar um preset.
        </div>
        <GraficoExcedente dados={dados} selecao={sel.selecao} />
        <ChartLegend
          className="c6-chartlegend"
          items={[
            { label: "excede o IPCA — gera repasse (8.8)", tipo: "barra", cor: "var(--danger)" },
            { label: "absorvido pela contratada", tipo: "barra", cor: "var(--success)" },
            {
              label: `IPCA período (${fmtPct3(dados.reeq.ipcaPeriodo)})`,
              tipo: "tracejada",
              cor: "var(--c6-navy)",
            },
          ]}
        />
      </div>

      <div className="ifd-secttl">Tabela — quantidades, base e valores por insumo (c/ BDI)</div>
      <TabelaMultifonte
        dados={dados}
        selecao={sel.selecao}
        totais={sel.totais}
        onTrocarFonte={sel.trocarFonte}
        colunaOsLabel={mesCurtoIso(dados.reeq.dataOs) ?? "OS"}
        colunaAtualLabel={mesCurtoIso(dados.reeq.dataVerificacao) ?? "atual"}
        nota={
          <>
            <b>Qtd PQ</b> e <b>R$ unit</b> são do Anexo C.04 (preço já com BDI);{" "}
            <b>Valor contrato</b> = Qtd PQ × R$ unit. <b>Qtd medida</b> e <b>Valor medido</b> vêm do
            BM{" "}
            {medidos.length > 0
              ? `(até o corte, só ${listaCap(medidos)})`
              : "(nenhum insumo medido até o corte)"}
            . <b>Repasse real</b> = excedente × valor medido; <b>Potencial</b> = excedente × valor
            contratado. <b>Excedente</b> = Δ% − IPCA ({fmtPct3(dados.reeq.ipcaPeriodo)}). O{" "}
            <b>total</b> (rodapé) fecha com a PQ.
          </>
        }
      />

      <div className="c6-linkbox">
        <div className="lt">
          O <b>repasse real</b> (com quantidades medidas) vira lançamento na tela <b>D.5</b>
        </div>
        <div className="lv">
          <div className="it">
            <div className="il">Repasse real</div>
            <div className="iv">
              <ValorLive>{fmtBRL2(sel.totais.repasseReal)}</ValorLive>
            </div>
          </div>
          <div className="it">
            <div className="il">Potencial total</div>
            <div className="iv amb">
              <ValorLive>{fmtPotencial(sel.totais.potencial)}</ValorLive>
            </div>
          </div>
          <Link
            to="/contracts/$contractId/desequilibrio/insumos"
            params={{ contractId }}
            className="go"
          >
            Abrir D.5 <ArrowRight size={13} aria-hidden />
          </Link>
        </div>
      </div>

      <div className="c6-chat">
        <div className="ch">
          <div className="ia">
            <span className="badge">IA · Adm Contratual</span>
            <b>Análise (fonte PQ + BM, c/ BDI)</b>
          </div>
          <span className="edit">
            <Pencil size={12} /> editar
          </span>
        </div>
        <p>
          {dados.insumos.length} insumos de faturamento direto da <b>PQ oficial</b>, com quantidade,
          preço unitário e valor medido de cada, totalizando <b>{fmtMi2(dados.totalFdBdi)}</b> —
          bate com o contrato. Alterne a tabela entre a <b>ordem da PQ</b> (agrupada por categoria)
          e a <b>curva ABC</b> (por valor). O <b>total medido</b> até o corte é{" "}
          {fmtBRL2(dados.totalMedidoBdi)}
          {medidos.length > 0 ? ` (${listaPt(medidos)})` : " (nenhum insumo medido)"}
          {topPotencial ? (
            <>
              ; o <b>potencial</b> é dominado por {topPotencial.nome}.
            </>
          ) : (
            <>
              ; nas bases escolhidas, <b>nenhum insumo</b> gera potencial de repasse.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
