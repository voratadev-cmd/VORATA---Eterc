// D.3 · Encargos Sociais (M3) — compara a alíquota Proposta × Real (MOD e MOI), encargo a encargo, do
// dado REAL das seções obra_secoes D.3. O desequilíbrio de encargos só aparece quando a alíquota real
// muda (tipicamente mudança legislativa · reoneração Lei 14.973/24); hoje Real = Proposta → R$ 0
// (Aderente · Conforme). A folha-base × Δ alíquota = desequilíbrio; a simulação ao lado projeta um
// cenário de reoneração. Nada de alíquota fabricada — a composição vem normalizada da D.3.
//
// Gráficos = plotagem de séries JÁ CALCULADAS pelo read-model, com GUARD de reconciliação:
//  · Composição por grupo (A/B/D + total): subtotais = Σ das rubricas do grupo (agregação de exibição);
//    só plota se Σ subtotais == total canônico (modTotal*/moiTotal*) do read-model — senão empty honesto.
//    O TOTAL usa o campo do método, nunca a soma das barras.
//  · Folha MOD mensal: série já ÷ (1+alíquota) no read-model (Σ == modFolhaHist, guard); a sobreposição
//    de reoneração é SIMULAÇÃO (what-if do slider), NUNCA desequilíbrio apurado, e não alimenta a D.0.

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createFileRoute } from "@tanstack/react-router";
import {
  Badge,
  Button,
  Card,
  CHART_SERIE_COR,
  ChartLegend,
  type ChartLegendItem,
  ChartTooltip,
  EmptyState,
  ErroCard,
  FarolCard,
  FilterChip,
  I,
  Segmented,
  Skeleton,
} from "@/components/ds";
import { RmaParamBar } from "@/components/RmaParamBar/RmaParamBar";
import { ColToolbar, ColVazio, normTxt, useColecao } from "@/lib/rma/colecao";
import { useEncargos } from "@/lib/hooks/useEncargos";
import type { EncargoRubrica, Encargos } from "@/lib/supabase/encargos";
import { farolLabel, farolToBadge } from "@/lib/mocks/contracts";
import { formatBRL, formatBRLCompact } from "@/lib/format";
import "./encargos.css";

export const Route = createFileRoute("/_app/contracts/$contractId/desequilibrio/encargos")({
  component: EncargosPage,
  head: () => ({ meta: [{ title: "D.3 Encargos Sociais — RDM IA" }] }),
});

// Reconciliação de alíquotas em FRAÇÃO: < 0,05 p.p. — muito acima do ruído de arredondamento por
// rubrica, muito abaixo de uma rubrica faltante (≥ 0,5 p.p.). R$ segue a regra M3 (< 1 centavo).
const TOL_ALIQ = 5e-4;
const TOL_RS = 0.01;

const fmtPct = (frac: number | null, d = 2) =>
  frac != null
    ? `${(frac * 100).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })}%`
    : "—";
const ppLabel = (frac: number) =>
  `${(frac * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} p.p.`;

/** Grupo (A/B/D) + as rubricas que pertencem a ele — pertença é POSICIONAL (rubrica pertence ao
 * último cabeçalho isGrupo acima dela). Usado pelo gráfico (subtotais) e pela tabela (cabeçalhos). */
type Grupo = { grupo: EncargoRubrica; filhas: EncargoRubrica[] };
function deriveGrupos(comp: EncargoRubrica[]): Grupo[] {
  const grupos: Grupo[] = [];
  let cur: Grupo | null = null;
  for (const r of comp) {
    if (r.isGrupo) {
      cur = { grupo: r, filhas: [] };
      grupos.push(cur);
    } else if (cur) {
      cur.filhas.push(r);
    } else {
      // rubrica antes de qualquer cabeçalho de grupo — bucket sintético (defensivo)
      cur = {
        grupo: {
          cod: "",
          descricao: "Sem grupo",
          isGrupo: true,
          modProposta: null,
          modReal: null,
          moiProposta: null,
          moiReal: null,
          divergente: false,
        },
        filhas: [r],
      };
      grupos.push(cur);
    }
  }
  return grupos;
}

function EncargosPage() {
  const { contractId } = Route.useParams();
  const { data, isLoading, isError, error, refetch } = useEncargos(contractId);

  return (
    <main className="enc-main">
      <EncHeader data={data} />
      {isLoading ? (
        <EncSkeleton />
      ) : isError ? (
        <ErroCard mensagem={error?.message} onRetry={() => refetch()} />
      ) : !data ? (
        <EmptyState
          framed
          title="Composição de encargos ainda não normalizada"
          text="A alíquota Proposta × Real (MOD/MOI) desta obra aparecerá aqui quando a seção D.3 for normalizada."
          hint="Aguardando normalização (M3)"
        />
      ) : (
        <EncConteudo v={data} />
      )}
    </main>
  );
}

// ── Header ───────────────────────────────────────────────────────────
function EncHeader({ data }: { data: Encargos | null | undefined }) {
  const b = data?.farol ? { tone: farolToBadge[data.farol], label: farolLabel[data.farol] } : null;
  return (
    <header className="enc-head">
      <div>
        <h2 className="enc-titulo">D.3 — Encargos Sociais</h2>
        <p className="enc-sub">
          Alíquota <b>Proposta × Real</b> (MOD e MOI), encargo a encargo
          {data?.nome ? ` · ${data.nome}` : ""}.
        </p>
      </div>
      {b ? <Badge tone={b.tone}>{b.label}</Badge> : null}
    </header>
  );
}

// ── Conteúdo (dado real) ─────────────────────────────────────────────
function EncConteudo({ v }: { v: Encargos }) {
  const deseqPendente = v.desequilibrioRs == null; // PENDENTE ≠ 0: total não normalizado ≠ R$ 0 medido
  const temDeseq = (v.desequilibrioRs ?? 0) > 0;
  // Seletor de base da MOD (Histograma/CPU). Espelha o setB do mockup: atualiza o KPI Folha-base, o
  // card de folha, a barra de parâmetros e a simulação — por isso o estado vive aqui e desce.
  const temSplit = v.modFolhaHist != null && v.modFolhaCpu != null && v.moiFolha != null;
  const [baseCpu, setBaseCpu] = useState(false); // false = Histograma (default gravado na D.3)
  const modBase = baseCpu ? v.modFolhaCpu : v.modFolhaHist;
  const folhaTotal =
    temSplit && modBase != null && v.moiFolha != null ? modBase + v.moiFolha : v.baseFolhaRs;
  const baseLabel = temSplit
    ? baseCpu
      ? "CPU"
      : "Histograma"
    : (v.baseModSeletor ?? "Histograma");
  const farol = v.farol ?? undefined;

  return (
    <>
      <RmaParamBar
        items={[
          { label: "Regime", valor: v.regime ?? "—", title: "INSS sobre a folha" },
          {
            label: "Base de MOD",
            valor: baseLabel,
            title:
              "Base da folha MOD · Histograma = recursos mobilizados · CPU = precificada no contrato",
          },
          {
            label: "Δ alíquota vigente",
            valor: v.deltaAliquotaMod != null ? ppLabel(v.deltaAliquotaMod) : "—",
            title: "Real − Proposta (pontos percentuais)",
          },
          { label: "Aderência", valor: v.statusLabel ?? "—", title: "Proposta × Real" },
        ]}
      />

      <div className="enc-kpis">
        <FarolCard
          label="DESEQUILÍBRIO DE ENCARGOS"
          icon="trending"
          value={v.desequilibrioRs != null ? formatBRL(v.desequilibrioRs) : "—"}
          info={
            deseqPendente
              ? "ainda não totalizado"
              : temDeseq
                ? "variação de alíquota medida"
                : "Real = Proposta no momento"
          }
          farol={farol}
          accent={temDeseq ? "warning" : "neutral"}
        />
        <FarolCard
          label="% SOBRE O PV"
          icon="trending"
          value={fmtPct(v.pctSobrePV)}
          info={
            v.valorContratado != null
              ? `sobre ${formatBRLCompact(v.valorContratado)}`
              : "PV pendente"
          }
          accent="neutral"
        />
        <FarolCard
          label="FOLHA-BASE (MOD + MOI)"
          icon="wallet"
          value={folhaTotal != null ? formatBRL(folhaTotal) : "—"}
          info={temSplit ? `sem encargos · base ${baseLabel}` : "sem encargos · contrato cheio"}
          accent="ink"
        />
      </div>

      <ComposicaoChart v={v} />

      <ComposicaoTabela v={v} />

      <FolhaSimulacao
        v={v}
        baseCpu={baseCpu}
        setBaseCpu={setBaseCpu}
        modBase={modBase}
        folhaTotal={folhaTotal}
        temSplit={temSplit}
        baseLabel={baseLabel}
        temDeseq={temDeseq}
        deseqPendente={deseqPendente}
      />

      <section className="enc-notebox">
        {I.shield({ size: 16 })}
        <p>
          <b>Lei 14.973/24 — reoneração progressiva da folha:</b> a contribuição patronal volta de
          forma escalonada até 2028. Se o regime de encargos mudar entre Proposta e execução, a
          diferença de alíquota × folha-base vira desequilíbrio pleiteável (mudança legislativa =
          fato do príncipe).
          {v.cprbCronograma ? (
            <>
              {" "}
              Cronograma CPRB: <span className="tabular">{v.cprbCronograma}</span>.
            </>
          ) : null}
        </p>
      </section>

      <section className="enc-ia">
        <div className="enc-ia-tag">{I.note({ size: 12 })} LEITURA DA D.3 · ADM CONTRATUAL IA</div>
        <p className="enc-ia-texto">
          {deseqPendente ? (
            <>
              A composição de encargos está normalizada (alíquota Proposta × Real), mas o
              desequilíbrio total (folha × Δ alíquota) ainda <b>não foi totalizado</b> para esta
              obra.
            </>
          ) : !temDeseq ? (
            <>
              Sem desequilíbrio de encargos no período: a alíquota real (
              <b>
                MOD {fmtPct(v.modTotalReal)} / MOI {fmtPct(v.moiTotalReal)}
              </b>
              ) é idêntica à da proposta, em regime {v.regime?.toLowerCase() ?? "onerado"}.{" "}
              <b>Aderente</b>. O ponto de atenção é prospectivo — a reoneração da Lei 14.973/24,
              simulável acima.
            </>
          ) : (
            <>
              Há variação de alíquota: o desequilíbrio de encargos mede{" "}
              <b>{formatBRL(v.desequilibrioRs ?? 0)}</b> sobre a folha-base de{" "}
              {v.baseFolhaRs != null ? formatBRLCompact(v.baseFolhaRs) : "—"}.
            </>
          )}
        </p>
      </section>
    </>
  );
}

// ── Gráfico · composição por grupo (Proposta × Real · MOD/MOI) ───────
function ComposicaoChart({ v }: { v: Encargos }) {
  const [eixo, setEixo] = useState<"mod" | "moi">("mod");
  const grupos = useMemo(() => deriveGrupos(v.composicao), [v.composicao]);
  const isMod = eixo === "mod";
  const canonProp = isMod ? v.modTotalProposta : v.moiTotalProposta;
  const canonReal = isMod ? v.modTotalReal : v.moiTotalReal;

  // Subtotal por grupo = Σ das alíquotas das rubricas do grupo no eixo selecionado (encargos são
  // aditivos: Σ rubricas = alíquota total). Agregação de EXIBIÇÃO — validada pelo guard abaixo.
  const subs = grupos.map((g) => {
    let p = 0;
    let r = 0;
    for (const rub of g.filhas) {
      p += (isMod ? rub.modProposta : rub.moiProposta) ?? 0;
      r += (isMod ? rub.modReal : rub.moiReal) ?? 0;
    }
    return { nome: g.grupo.cod || g.grupo.descricao, proposta: p, real: r };
  });

  // GUARD OBRIGATÓRIO: Σ subtotais DEVE igualar o total canônico do read-model (não a soma) — em
  // valores BRUTOS, tolerância TOL_ALIQ. Se não fechar, NÃO plota (empty honesto), nunca um nº solto.
  const sumP = subs.reduce((a, s) => a + s.proposta, 0);
  const sumR = subs.reduce((a, s) => a + s.real, 0);
  const reconcilia =
    canonProp != null &&
    canonReal != null &&
    Math.abs(sumP - canonProp) < TOL_ALIQ &&
    Math.abs(sumR - canonReal) < TOL_ALIQ;

  const chartData =
    reconcilia && canonProp != null && canonReal != null
      ? [
          ...subs.map((s) => ({
            nome: s.nome,
            proposta: s.proposta * 100,
            real: s.real * 100,
            div: s.proposta !== s.real,
          })),
          // TOTAL = campo do método (canônico), NUNCA a soma das barras.
          {
            nome: "TOTAL",
            proposta: canonProp * 100,
            real: canonReal * 100,
            div: canonProp !== canonReal,
          },
        ]
      : null;
  const temDivergencia = chartData?.some((d) => d.div) ?? false;

  return (
    <section className="enc-section">
      <header className="enc-section-head">
        <div>
          <h3 className="enc-section-title">Composição por grupo — Proposta × Real</h3>
          <p className="enc-section-sub">
            Subtotais de alíquota por grupo + total · {isMod ? "MOD" : "MOI"}
          </p>
        </div>
        <Segmented
          value={eixo}
          onChange={setEixo}
          items={[
            { value: "mod", label: "MOD" },
            { value: "moi", label: "MOI" },
          ]}
          aria-label="Eixo do gráfico de composição"
        />
      </header>
      {chartData == null ? (
        <EmptyState
          framed
          title="Subtotais por grupo não reconciliam com o total"
          text={`A soma das rubricas por grupo diverge do total ${isMod ? "MOD" : "MOI"} da composição — os subtotais não são plotados para não exibir número não-conciliado. O total ${isMod ? "MOD" : "MOI"} Real da composição permanece ${fmtPct(canonReal)}.`}
        />
      ) : (
        <>
          <ChartLegend
            items={[
              { label: "Proposta", tipo: "barra", cor: CHART_SERIE_COR.contratado },
              { label: "Real", tipo: "barra", cor: CHART_SERIE_COR.real },
              ...(temDivergencia
                ? ([
                    { label: "Real ≠ Proposta", tipo: "barra", cor: "var(--warning)" },
                  ] as ChartLegendItem[])
                : []),
            ]}
          />
          <div className="enc-chartbox">
            <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 46)}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
                barCategoryGap="22%"
              >
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: "var(--text-3)" }}
                  tickFormatter={(x: number) =>
                    `${x.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`
                  }
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                />
                <YAxis
                  type="category"
                  dataKey="nome"
                  width={64}
                  tick={{ fontSize: 11, fill: "var(--text-2)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--surface-2)" }}
                  content={
                    <ChartTooltip
                      formatter={(x: number) =>
                        `${x.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
                      }
                      nomes={{ proposta: "Proposta", real: "Real" }}
                    />
                  }
                />
                <Bar
                  dataKey="proposta"
                  fill={CHART_SERIE_COR.contratado}
                  radius={[0, 3, 3, 0]}
                  maxBarSize={16}
                  isAnimationActive={false}
                />
                <Bar dataKey="real" radius={[0, 3, 3, 0]} maxBarSize={16} isAnimationActive={false}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.div ? "var(--warning)" : CHART_SERIE_COR.real} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="enc-chart-cap">
            Σ dos subtotais por grupo = <b className="tabular">{fmtPct(canonReal)}</b> (Real) —
            reconcilia com o total {isMod ? "MOD" : "MOI"} da composição. O TOTAL usa o valor do
            read-model, não a soma das barras.
          </p>
        </>
      )}
    </section>
  );
}

// ── Composição (27 rubricas · alíquota Proposta × Real) ──────────────
function ComposicaoTabela({ v }: { v: Encargos }) {
  const grupos = useMemo(() => deriveGrupos(v.composicao), [v.composicao]);
  // Rubricas achatadas com metadados posicionais (grupo _g, ordem interna _o) para a coleção. O
  // cmp sempre ordena por _g primeiro → grupos permanecem contíguos e os cabeçalhos se reconstroem.
  const rubricas = useMemo(() => {
    const out: (EncargoRubrica & { _g: number; _o: number })[] = [];
    grupos.forEach((g, gi) => g.filhas.forEach((r, ri) => out.push({ ...r, _g: gi, _o: ri })));
    return out;
  }, [grupos]);
  const nDiv = rubricas.filter((r) => r.divergente).length;
  const [soDiv, setSoDiv] = useState(false);

  const col = useColecao(rubricas, {
    busca: (r) => `${r.cod} ${r.descricao}`,
    ordenacoes: [
      { value: "ordem", label: "Ordem da composição", cmp: (a, b) => a._g - b._g || a._o - b._o },
      {
        value: "aliquota",
        label: "Maior alíquota MOD",
        cmp: (a, b) => a._g - b._g || (b.modReal ?? 0) - (a.modReal ?? 0) || a._o - b._o,
      },
      {
        value: "az",
        label: "Descrição (A–Z)",
        cmp: (a, b) => a._g - b._g || normTxt(a.descricao).localeCompare(normTxt(b.descricao)),
      },
    ],
    filtro: soDiv ? (r) => r.divergente : undefined,
    perPage: 999, // tabela contígua — SEM paginação (a íntegra é o artefato de conferência)
    resetKey: soDiv,
  });

  const linhas = col.visible;
  const limpar = () => {
    col.setQuery("");
    setSoDiv(false);
  };

  // Reconstrói cabeçalhos de grupo: emite o header quando o grupo muda (contíguo por construção).
  const corpo: React.ReactNode[] = [];
  let lastG = -2;
  for (const r of linhas) {
    if (r._g !== lastG) {
      lastG = r._g;
      const g = grupos[r._g]?.grupo;
      if (g) {
        corpo.push(
          <div className="enc-tabela-grupo" role="row" key={`g-${r._g}`}>
            <span className="enc-cod">{g.cod}</span> {g.descricao}
          </div>,
        );
      }
    }
    corpo.push(<RubricaRow key={`${r.cod}-${r.descricao}-${r._o}`} r={r} />);
  }

  return (
    <section className="enc-section">
      <header className="enc-section-head">
        <div>
          <h3 className="enc-section-title">Composição de encargos — alíquota Proposta × Real</h3>
          <p className="enc-section-sub">
            MOD e MOI ·{" "}
            {col.total === rubricas.length
              ? `${rubricas.length} ${rubricas.length === 1 ? "rubrica" : "rubricas"}`
              : `${col.total} de ${rubricas.length} rubricas`}
          </p>
        </div>
      </header>
      <ColToolbar
        col={col}
        placeholder="Buscar por código ou descrição do encargo…"
        extra={
          <FilterChip
            label="Só divergentes"
            value={nDiv}
            active={soDiv}
            onClick={() => setSoDiv((s) => !s)}
            onClear={soDiv ? () => setSoDiv(false) : undefined}
          />
        }
      />
      <div className="enc-tabela-scroll">
        <div className="enc-tabela" role="table">
          <div className="enc-tabela-head" role="row">
            <span role="columnheader">Encargo</span>
            <span className="r" role="columnheader">
              MOD Proposta
            </span>
            <span className="r" role="columnheader">
              MOD Real
            </span>
            <span className="r" role="columnheader">
              MOI Proposta
            </span>
            <span className="r" role="columnheader">
              MOI Real
            </span>
            <span className="c" role="columnheader">
              Status
            </span>
          </div>
          {corpo}
          {/* TOTAL sempre dos campos do método (modTotal / moiTotal), fora de filtro/ordenação — invariante */}
          <div className="enc-tabela-row enc-tabela-tot" role="row">
            <span role="cell">TOTAL ENCARGOS (mensalista)</span>
            <span className="r tabular" role="cell">
              {fmtPct(v.modTotalProposta)}
            </span>
            <span className="r tabular" role="cell">
              {fmtPct(v.modTotalReal)}
            </span>
            <span className="r tabular" role="cell">
              {fmtPct(v.moiTotalProposta)}
            </span>
            <span className="r tabular" role="cell">
              {fmtPct(v.moiTotalReal)}
            </span>
            <span className="c" role="cell" />
          </div>
        </div>
      </div>
      {linhas.length === 0 ? (
        <ColVazio
          termo={col.debounced || "os filtros ativos"}
          rotulo="rubrica encontrada"
          onClear={limpar}
          artigo="Nenhuma"
        />
      ) : null}
    </section>
  );
}

function RubricaRow({ r }: { r: EncargoRubrica }) {
  return (
    <div className={`enc-tabela-row${r.divergente ? " enc-row-div" : ""}`} role="row">
      <span className="enc-cell-enc" role="cell">
        <span className="enc-cod">{r.cod}</span> {r.descricao}
      </span>
      <span className="r tabular" role="cell">
        {fmtPct(r.modProposta)}
      </span>
      <span className={`r tabular${r.modReal !== r.modProposta ? " enc-div" : ""}`} role="cell">
        {fmtPct(r.modReal)}
      </span>
      <span className="r tabular" role="cell">
        {fmtPct(r.moiProposta)}
      </span>
      <span className={`r tabular${r.moiReal !== r.moiProposta ? " enc-div" : ""}`} role="cell">
        {fmtPct(r.moiReal)}
      </span>
      <span className="c" role="cell">
        <span
          className={`enc-dot ${r.divergente ? "enc-dot-div" : "enc-dot-ok"}`}
          role="img"
          aria-label={r.divergente ? "Real ≠ Proposta" : "Aderente"}
          title={r.divergente ? "Real ≠ Proposta" : "Aderente"}
        />
      </span>
    </div>
  );
}

// ── Folha-base · desequilíbrio · simulação (cenário) ─────────────────
function FolhaSimulacao({
  v,
  baseCpu,
  setBaseCpu,
  modBase,
  folhaTotal,
  temSplit,
  baseLabel,
  temDeseq,
  deseqPendente,
}: {
  v: Encargos;
  baseCpu: boolean;
  setBaseCpu: (b: boolean) => void;
  modBase: number | null;
  folhaTotal: number | null;
  temSplit: boolean;
  baseLabel: string;
  temDeseq: boolean;
  deseqPendente: boolean;
}) {
  const [delta, setDelta] = useState("0");
  // Parse honesto: string vazia = 0 (neutro); lixo ("abc") = inválido → feedback, nunca simula em silêncio.
  const parsed = delta.trim() === "" ? 0 : Number(delta.replace(",", "."));
  const dInvalido = !Number.isFinite(parsed);
  const dNum = dInvalido ? 0 : parsed;
  // Simulação toggle-aware (espelha sim()): (modBase selecionada + MOI) × Δ p.p.
  const simBase =
    temSplit && modBase != null && v.moiFolha != null ? modBase + v.moiFolha : v.baseFolhaRs;
  const simulado = simBase != null && !dInvalido ? simBase * (dNum / 100) : null;

  // Frase-fecho DERIVADA do estado — nunca afirma "zero" quando há desequilíbrio (achado literal-chumbado).
  const fecho: React.ReactNode = deseqPendente ? (
    "Total ainda não normalizado."
  ) : temDeseq ? (
    <>
      Δ de alíquota vigente{" "}
      {v.deltaAliquotaMod != null ? <b>{ppLabel(v.deltaAliquotaMod)}</b> : null} sobre a folha-base
      → desequilíbrio acima.
    </>
  ) : (
    "Hoje Real = Proposta → desequilíbrio zero; ativa-se se a alíquota real divergir (reoneração)."
  );

  return (
    <section className="enc-section">
      <header className="enc-section-head">
        <div>
          <h3 className="enc-section-title">Folha-base, desequilíbrio e simulação</h3>
          <p className="enc-section-sub">Base de MOD: {baseLabel} · MOI = Adm Local</p>
        </div>
      </header>
      <div className="enc-deqgrid">
        <Card className="enc-deqcard">
          <h4 className="enc-deqcard-title">Folha-base e desequilíbrio (vigente)</h4>
          {temSplit ? (
            <Segmented
              className="enc-basetoggle"
              value={baseCpu ? "cpu" : "hist"}
              onChange={(val) => setBaseCpu(val === "cpu")}
              items={[
                { value: "hist", label: "MOD: Histograma" },
                { value: "cpu", label: "MOD: CPU" },
              ]}
              aria-label="Base de cálculo da MOD"
            />
          ) : null}
          {temSplit ? (
            <>
              <div className="enc-ln enc-ln-sub">
                <span>MO Direta — folha (base selecionada)</span>
                <span className="tabular">{modBase != null ? formatBRL(modBase) : "—"}</span>
              </div>
              <div className="enc-ln enc-ln-sub">
                <span>MO Indireta (Adm Local) — folha</span>
                <span className="tabular">{v.moiFolha != null ? formatBRL(v.moiFolha) : "—"}</span>
              </div>
            </>
          ) : null}
          <div className="enc-ln enc-ln-tot">
            <span>Folha-base total (MOD + MOI)</span>
            <span className="tabular">{folhaTotal != null ? formatBRL(folhaTotal) : "—"}</span>
          </div>
          <div className="enc-ln">
            <span>Δ Alíquota (Real − Proposta)</span>
            <span className="tabular">
              {v.deltaAliquotaMod != null ? ppLabel(v.deltaAliquotaMod) : "—"}
            </span>
          </div>
          <div className="enc-ln enc-ln-big">
            <span>Desequilíbrio de encargos</span>
            <span className="tabular">
              {v.desequilibrioRs != null ? formatBRL(v.desequilibrioRs) : "—"}
            </span>
          </div>
          <p className="enc-deqcard-hint">
            {temSplit ? (
              <>
                Base de MOD: Histograma = recursos mobilizados (
                {v.recursosMobMod != null ? formatBRLCompact(v.recursosMobMod) : "—"}); CPU = MOD
                precificada no contrato (
                {v.modCpuContrato != null ? formatBRLCompact(v.modCpuContrato) : "—"}) — ambos com
                encargos, convertidos para a folha-base acima. MOI = mão de obra da Adm Local.{" "}
                {fecho}
              </>
            ) : (
              <>Folha-base sem encargos (contrato cheio). {fecho}</>
            )}
          </p>
        </Card>
        <Card className="enc-deqcard">
          <h4 className="enc-deqcard-title">{I.clock({ size: 14 })} Simulação (cenário)</h4>
          <label className="enc-fld">
            <span>Variação de alíquota (reoneração, em p.p.)</span>
            <input
              type="text"
              inputMode="decimal"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              className={dInvalido ? "enc-in-erro" : undefined}
              aria-invalid={dInvalido || undefined}
            />
            {dInvalido ? <span className="enc-fld-err">Use número em p.p., ex.: 1,5</span> : null}
          </label>
          <div className="enc-presets" role="group" aria-label="Degraus de reoneração">
            {["0,5", "1", "2"].map((p) => (
              <Button key={p} variant="ghost" size="xs" onClick={() => setDelta(p)}>
                +{p} p.p.
              </Button>
            ))}
          </div>
          <div className="enc-ln enc-ln-big enc-ln-sim">
            <span>Desequilíbrio simulado</span>
            <span className="tabular">{simulado != null ? formatBRL(simulado) : "—"}</span>
          </div>
          <p className="enc-deqcard-hint">
            Desequilíbrio = folha-base total × variação de alíquota (SIMULAÇÃO · what-if).{" "}
            {temSplit && v.modFolhaHist != null && v.modFolhaCpu != null && v.moiFolha != null ? (
              <>
                Ex.: +1 p.p. ≈ {formatBRL((v.modFolhaHist + v.moiFolha) * 0.01)} (base Histograma) ·{" "}
                {formatBRL((v.modFolhaCpu + v.moiFolha) * 0.01)} (base CPU).
              </>
            ) : (
              <>Ex.: +1 p.p. ≈ {v.baseFolhaRs != null ? formatBRL(v.baseFolhaRs * 0.01) : "—"}.</>
            )}
          </p>
        </Card>
      </div>

      <FolhaModMensalChart serie={v.folhaModMensal} modFolhaHist={v.modFolhaHist} dPct={dNum} />
    </section>
  );
}

// ── Gráfico · folha-base MOD mensal (exposição da simulação no tempo) ──
function FolhaModMensalChart({
  serie,
  modFolhaHist,
  dPct,
}: {
  serie: Encargos["folhaModMensal"];
  modFolhaHist: number | null;
  dPct: number;
}) {
  if (!serie || serie.length === 0) return null; // sem série mensal → sem gráfico (honesto, não erro)
  // GUARD: Σ da folha mensal DEVE reconciliar com modFolhaHist (mesma fonte ÷ mesmo fator) — bruto, TOL_RS.
  const somaFolha = serie.reduce((a, m) => a + m.folhaBaseRs, 0);
  const reconcilia = modFolhaHist != null && Math.abs(somaFolha - modFolhaHist) < TOL_RS;
  if (!reconcilia) {
    return (
      <div className="enc-chartwrap">
        <EmptyState
          framed
          title="Exposição mensal indisponível"
          text="A folha-base MOD mensal (Histograma) não reconcilia com o total — não plotada para não exibir número não-conciliado."
        />
      </div>
    );
  }
  const sim = dPct > 0; // sobreposição de reoneração = SIMULAÇÃO; Δ=0 mostra só a folha-base
  const data = serie.map((m) => ({
    mes: m.label || "—",
    folha: m.folhaBaseRs,
    deseq: m.folhaBaseRs * (dPct / 100),
  }));
  const somaSim = somaFolha * (dPct / 100); // = modFolhaHist × Δ — agregado MOD Histograma do simulador
  const dataKey = sim ? "deseq" : "folha";
  const cor = sim ? "var(--warning)" : CHART_SERIE_COR.real;

  return (
    <div className="enc-chartwrap">
      <div className="enc-chartwrap-head">
        <h4 className="enc-chartwrap-title">
          {sim ? "Reoneração simulada por mês" : "Folha-base MOD mensal"}{" "}
          <span className="enc-chartwrap-sub">MOD · Histograma (recursos mobilizados)</span>
        </h4>
        {sim ? <Badge tone="warning">SIMULAÇÃO</Badge> : null}
      </div>
      <ChartLegend
        items={[
          {
            label: sim
              ? `Desequilíbrio simulado/mês (Δ ${ppLabel(dPct / 100)})`
              : "Folha-base MOD/mês (sem encargos)",
            tipo: "barra",
            cor,
          },
        ]}
      />
      <div className="enc-chartbox">
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 9, fill: "var(--text-3)" }}
              interval={Math.max(0, Math.floor(data.length / 12))}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--text-3)" }}
              tickFormatter={(x: number) => formatBRLCompact(x)}
              tickLine={false}
              axisLine={false}
              width={64}
            />
            <Tooltip
              cursor={{ fill: "var(--surface-2)" }}
              content={
                <ChartTooltip
                  formatter={(x: number) => formatBRL(x)}
                  nomes={{ folha: "Folha-base MOD", deseq: "Desequilíbrio simulado" }}
                  titulo={(label) => (sim ? <>{label} · SIMULAÇÃO</> : label)}
                />
              }
            />
            <Bar
              dataKey={dataKey}
              fill={cor}
              radius={[3, 3, 0, 0]}
              maxBarSize={18}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="enc-chart-cap">
        {sim ? (
          <>
            <b>SIMULAÇÃO</b> (what-if · reoneração Lei 14.973/24) — não é desequilíbrio apurado
            (apurado <b>R$ 0</b> · Real = Proposta). Σ simulado (MOD · Histograma) ={" "}
            <b className="tabular">{formatBRL(somaSim)}</b> = folha-base MOD × Δ. O card acima
            agrega MOD + MOI (e a base CPU quando selecionada).
          </>
        ) : (
          <>
            Distribuição temporal da folha-base MOD (sem encargos). Σ ={" "}
            <b className="tabular">{formatBRL(somaFolha)}</b> — reconcilia com a MOD (Histograma) da
            folha-base. Ajuste a variação acima para ver a exposição da reoneração no tempo.
          </>
        )}
      </p>
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────
function EncSkeleton() {
  return (
    <>
      <Skeleton variant="block" className="enc-sk-pbar" />
      <div className="enc-kpis">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} variant="block" className="enc-sk-kpi" />
        ))}
      </div>
      <Skeleton variant="block" className="enc-sk-section" />
      <Skeleton variant="block" className="enc-sk-section" />
    </>
  );
}
