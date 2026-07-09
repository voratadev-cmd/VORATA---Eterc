// D.1 — Custos Indiretos (Administração Local) · under-recovery.
// Dado REAL de obra_indiretos_base/_metodos/_itens via useIndiretosView. O número da D.1 é o
// MÉTODO ATIVO (M2.2 = gasto − medido), reconcilia ao centavo com a categoria D.1 do painel D.0.
// Clique no método (barra ou linha) → memória de cálculo abaixo (M2 abre os 29 grupos da Adm Local).
// Cenários (extensão/redução) = alimentam o pleito D.10, NÃO somam à D.1 (strip no rodapé).

import { createFileRoute } from "@tanstack/react-router";
import {
  Banknote,
  CalendarClock,
  ChevronRight,
  Link2,
  type LucideIcon,
  MousePointerClick,
  Percent,
  PieChart,
  Scale,
  Sparkles,
  Target,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHART_SERIE_COR,
  ChartLegend,
  ChartTooltip,
  EmptyState,
  ErroCard,
  Skeleton,
} from "@/components/ds";
import { type IndiretosView, useIndiretosView } from "@/lib/hooks/useIndiretosView";
import {
  ColPag,
  ColToolbar,
  ColVazio,
  type Ordenacao,
  normTxt,
  useColecao,
} from "@/lib/rma/colecao";
import type { IndiretoItem, IndiretoMetodo } from "@/lib/supabase/indiretos";
import "./indiretos.css";

export const Route = createFileRoute("/_app/contracts/$contractId/desequilibrio/indiretos")({
  component: IndiretosPage,
  head: () => ({ meta: [{ title: "D.1 Custos Indiretos — RDM IA" }] }),
});

// ── formatadores (tabular, pt-BR) ────────────────────────────────────────────
const fmtBRL = (n: number | null | undefined) =>
  n == null ? "—" : `R$ ${Math.round(n).toLocaleString("pt-BR")}`;
const fmtMi = (n: number | null | undefined) =>
  n == null
    ? "—"
    : `R$ ${(n / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`;
const fmtPct = (frac: number | null | undefined, d = 2) =>
  frac == null
    ? "—"
    : `${(frac * 100).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })}%`;
const fmtInt = (n: number | null | undefined) =>
  n == null ? "—" : Math.round(n).toLocaleString("pt-BR");
/** Valor com sinal explícito (− pra negativo), pra desequilíbrio por método/grupo. */
const fmtSigned = (n: number | null | undefined) => {
  if (n == null) return "—";
  const v = Math.round(n);
  return v < 0 ? `−R$ ${Math.abs(v).toLocaleString("pt-BR")}` : `R$ ${v.toLocaleString("pt-BR")}`;
};
/** Δ quantidade com sinal (+N / −N / 0), pra coluna Δ Qtd dos grupos da Adm Local. */
const fmtDeltaQtd = (n: number | null | undefined) => {
  if (n == null) return "—";
  const v = Math.round(n);
  return v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : "0";
};
/** R$ em milhões com sinal explícito (+R$ 2,5 mi / −R$ 2,2 mi) — rótulos do gráfico divergente. */
const fmtSignedMi = (n: number | null | undefined) => {
  if (n == null) return "—";
  const mi = n / 1e6;
  const abs = Math.abs(mi).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${mi < 0 ? "−" : "+"}R$ ${abs} mi`;
};

function IndiretosPage() {
  const { contractId } = Route.useParams();
  const { data, isLoading, isError, error, refetch } = useIndiretosView(contractId);

  return (
    <main className="ind-main">
      {isLoading ? (
        <IndSkeleton />
      ) : isError ? (
        <ErroCard mensagem={error?.message} onRetry={() => refetch()} />
      ) : !data ? (
        <EmptyState
          framed
          title="D.1 ainda não normalizada"
          text="Esta obra não tem o desequilíbrio de indiretos normalizado no banco ainda."
          hint="Aguardando normalização da Camada A"
        />
      ) : (
        <IndConteudo v={data} />
      )}
    </main>
  );
}

function IndConteudo({ v }: { v: IndiretosView }) {
  const ind = v.indiretos;
  const d1 = ind.desequilibrioTotal ?? 0;
  // reconciliação ao centavo com o D.0 (invariante de dinheiro).
  const recOk = v.categoriaD1Rs == null || Math.abs(d1 - v.categoriaD1Rs) < 0.01;

  const ativo = ind.metodos.find((m) => m.ativo) ?? ind.metodos.find((m) => m.codigo === "M2.2");
  const [sel, setSel] = useState<string>(ativo?.codigo ?? "M2.2");
  const metodoSel = ind.metodos.find((m) => m.codigo === sel) ?? ativo ?? ind.metodos[0];

  // % da D.1 no desequilíbrio total (D.0): numerador = parcela D.0 da D.1 (categoriaD1Rs),
  // denominador = total canônico do Painel D.0 (totalDesequilibrio). Os dois vêm do MESMO painel
  // (consistência interna, sem misturar com o método ativo). Card oculto se o D.0 não veio.
  const totalD0 = v.totalDesequilibrio;
  const pctDoTotal =
    totalD0 != null && totalD0 !== 0 && v.categoriaD1Rs != null ? v.categoriaD1Rs / totalD0 : null;

  // Cenários do pleito (D.10) — só as células com dado; strip omitida se todas nulas.
  const cenarios: Array<{ label: string; value: string }> = [];
  if (ind.reducaoEscopo != null) {
    cenarios.push({
      label: `Redução de escopo${ind.reducaoPct != null ? ` (−${fmtPct(ind.reducaoPct, 0)})` : ""}`,
      value: fmtBRL(ind.reducaoEscopo),
    });
  }
  if (ind.desequilibrioExtensao != null) {
    cenarios.push({
      label: `Extensão de prazo${ind.extensaoMeses != null ? ` (+${fmtInt(ind.extensaoMeses)} meses)` : ""}`,
      value: fmtBRL(ind.desequilibrioExtensao),
    });
  }

  return (
    <>
      <header className="ind-head">
        <div className="ind-head-row">
          <h1 className="ind-title">D.1 — Custos Indiretos (Administração Local)</h1>
        </div>
        <p className="ind-sub">
          Desequilíbrio dos indiretos por <strong>under-recovery</strong>: a Adm Local é incorrida
          ao valor cheio mensal, mas o boletim medido pela Contratante paga menos. Quatro métodos
          calculados; o <strong>ativo</strong> governa o número.
        </p>
        <div className="ind-lnks">
          {["Adm Local (detalhe)", "Canteiro", "MOI"].map((l) => (
            <span key={l} className="ind-lnk" title="Detalhamento por componente — em breve">
              <Link2 size={13} aria-hidden />
              {l}
            </span>
          ))}
        </div>
        {!recOk ? (
          <div className="ind-warn">
            <TriangleAlert size={16} aria-hidden />
            <span>
              D.1 ({fmtBRL(d1)}) não bate com a categoria de Custos Indiretos no Painel D.0 (
              {fmtBRL(v.categoriaD1Rs)}).
            </span>
          </div>
        ) : null}
      </header>

      {/* KPIs */}
      <div className="ind-sec">Resumo</div>
      <div className={`ind-kpis${pctDoTotal != null ? " ind-kpis--wide" : ""}`}>
        <Kpi
          icon={Scale}
          active
          label="Desequilíbrio (método ativo)"
          value={fmtBRL(d1)}
          sub={`${ativo?.codigo ?? "—"} — ${ativo?.metodo ?? ""}`}
        />
        <Kpi
          icon={Percent}
          label="% sobre o PV"
          value={fmtPct(ind.percentPv)}
          sub={`${fmtMi(ind.pv)} de contrato`}
        />
        <Kpi
          icon={Banknote}
          label="Adm Local mensal (cheio)"
          value={fmtBRL(ind.admLocalMensal)}
          sub="valor contratado/mês"
        />
        <Kpi
          icon={Target}
          label="Método ativo"
          value={ind.metodoAtivo ?? "—"}
          sub="driver do desequilíbrio"
        />
        <Kpi
          icon={CalendarClock}
          label="Meses decorridos"
          value={`${ind.bmCorrente ?? "—"} / ${ind.prazoMeses ?? "—"}`}
          sub="do prazo contratual"
        />
        {pctDoTotal != null ? (
          <Kpi
            icon={PieChart}
            label="% do desequilíbrio total (D.0)"
            value={fmtPct(pctDoTotal)}
            sub={`${fmtMi(totalD0)} no Painel D.0`}
          />
        ) : null}
      </div>

      {/* Basebar */}
      <div className="ind-basebar">
        <Base
          label={`Adm Local cheio (${ind.prazoMeses ?? "—"} meses)`}
          value={fmtBRL(ind.admLocalCheio)}
        />
        <Base
          label={`Gasto acum. (${ind.bmCorrente ?? "—"} meses)`}
          value={fmtBRL(ind.gastoAcum)}
        />
        <Base label="Medido pela Contratante (boletim)" value={fmtBRL(ind.medidoAcum)} />
        <Base label="Real alocado" value={fmtBRL(ind.realAcum)} />
      </div>

      {/* Métodos (clicáveis) */}
      <div className="ind-sec">Métodos de quantificação (lado a lado)</div>
      <MetodosGrafico metodos={ind.metodos} sel={sel} onSelect={setSel} />
      <div className="ind-tablewrap ind-tablewrap--narrow">
        <table className="ind-mtab">
          <thead>
            <tr>
              <th>Método</th>
              <th>Comparação</th>
              <th className="ind-r">Desequilíbrio</th>
              <th className="ind-r"></th>
            </tr>
          </thead>
          <tbody>
            {ind.metodos.map((m) => (
              <MetodoRow
                key={m.codigo ?? m.ordem}
                m={m}
                sel={sel === m.codigo}
                onClick={() => m.codigo && setSel(m.codigo)}
              />
            ))}
          </tbody>
        </table>
      </div>
      <p className="ind-hint">
        <MousePointerClick size={13} aria-hidden />
        Clique em um método para ver o cálculo detalhado abaixo.
      </p>

      {/* Detalhe do método selecionado */}
      {metodoSel ? <MetodoDetalhe m={metodoSel} itens={ind.itens} /> : null}

      {/* Leitura IA */}
      <div className="ind-ia">
        <div className="ind-ia-h">
          <span className="ind-ia-badge">
            <Sparkles size={16} aria-hidden />
          </span>
          <span className="ind-ia-t">Leitura da D.1</span>
        </div>
        <p>
          O desequilíbrio dos indiretos é de <strong>{fmtMi(d1)}</strong> pelo método ativo (
          {ativo?.codigo} — {ativo?.metodo}), ou <strong>{fmtPct(ind.percentPv)}</strong> do PV —
          descompasso entre o que a Contratada incorre de Adm Local (valor cheio mensal) e o que a
          medição da Contratante reconhece.
        </p>
        <p>
          Os métodos divergem porque comparam bases diferentes: o ativo mede gasto × medido
          (under-recovery, positivo); o histograma e o real × medido comparam o real (abaixo do
          contratado/medido, por isso negativos); o contábil (AGM) depende do razão. O detalhe por
          item (29 grupos da Adm Local) está no método de histograma.
        </p>
      </div>

      {/* Cenários que alimentam o Pleito (D.10) — NÃO somam à D.1 */}
      {cenarios.length > 0 ? (
        <>
          <div className="ind-sec">Cenários para o Pleito (D.10) — não somam à D.1</div>
          <div className="ind-basebar">
            {cenarios.map((c) => (
              <Base key={c.label} label={c.label} value={c.value} />
            ))}
          </div>
          <p className="ind-cenhint">
            Projeções que instruem o Pleito (D.10) — extensão de prazo ou redução de escopo. São
            hipóteses de negociação, à parte do desequilíbrio incorrido da D.1.
          </p>
        </>
      ) : null}
    </>
  );
}

// ── KPI / Base ───────────────────────────────────────────────────────────────
function Kpi({
  icon: IconCmp,
  label,
  value,
  sub,
  active,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  active?: boolean;
}) {
  return (
    <div className={`ind-kpc${active ? " ind-kpc-active" : ""}`}>
      <div className="ind-kpc-top">
        <span className="ind-kpc-chip">
          <IconCmp size={18} strokeWidth={2} aria-hidden />
        </span>
        <span className="ind-kpc-l">{label}</span>
      </div>
      <div className="ind-kpc-v">{value}</div>
      {sub ? <div className="ind-kpc-s">{sub}</div> : null}
    </div>
  );
}
function Base({ label, value }: { label: string; value: string }) {
  return (
    <div className="ind-base">
      <div className="ind-base-l">{label}</div>
      <div className="ind-base-v">{value}</div>
    </div>
  );
}

// ── Gráfico divergente dos métodos (barra ancorada no zero) ───────────────────
// Plota os desequilíbrios JÁ calculados (m.desequilibrioRs) — nada é recalculado. O método ATIVO
// sai em brand (destaque, NÃO farol); os comparativos em info; o pendente (M3) fica como faixa
// vazia rotulada. Clicar numa barra seleciona o método (mesmo estado da tabela/detalhe).
type BarLabelProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  value?: number | string | null;
};
function BarLabel({ x = 0, y = 0, width = 0, height = 0, value }: BarLabelProps) {
  const v = value == null ? null : Number(value);
  if (v == null || Number.isNaN(v)) return null;
  const positivo = v >= 0;
  return (
    <text
      x={positivo ? x + width + 6 : x - 6}
      y={y + height / 2}
      dy={4}
      textAnchor={positivo ? "start" : "end"}
      className="ind-bar-lbl"
    >
      {fmtSignedMi(v)}
    </text>
  );
}

function MetodosGrafico({
  metodos,
  sel,
  onSelect,
}: {
  metodos: IndiretoMetodo[];
  sel: string;
  onSelect: (codigo: string) => void;
}) {
  const dados = metodos.map((m) => ({
    codigo: m.codigo ?? String(m.ordem),
    metodo: m.metodo,
    ativo: m.ativo,
    pendente: m.pendente,
    // pendente ≠ 0: sem valor plotado (Recharts pula a barra, o tick do método permanece).
    valor: m.pendente ? null : (m.desequilibrioRs ?? 0),
  }));
  const maxAbs = Math.max(1, ...dados.map((d) => Math.abs(d.valor ?? 0)));
  // domínio simétrico com folga p/ os rótulos de valor no fim das barras (dos dois lados).
  const dominio: [number, number] = [-maxAbs * 1.5, maxAbs * 1.5];
  const pendentes = metodos
    .filter((m) => m.pendente)
    .map((m) => m.codigo)
    .filter(Boolean);

  return (
    <div className="ind-chart-card">
      <ChartLegend
        className="ind-chart-legend"
        items={[
          { label: "Método ativo (governa a D.1)", tipo: "barra", cor: "var(--brand)" },
          { label: "Métodos comparativos", tipo: "barra", cor: CHART_SERIE_COR.contratado },
        ]}
      />
      <div className="ind-chart">
        <ResponsiveContainer width="100%" height={dados.length * 46 + 28}>
          <BarChart
            data={dados}
            layout="vertical"
            margin={{ top: 6, right: 104, bottom: 6, left: 12 }}
            barCategoryGap="30%"
          >
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              domain={dominio}
              tick={{ fontSize: 10, fill: "var(--text-3)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              tickFormatter={(v) =>
                `${(Number(v) / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`
              }
            />
            <YAxis
              type="category"
              dataKey="codigo"
              tick={{ fontSize: 11, fill: "var(--text-2)", fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <ReferenceLine x={0} stroke="var(--border-strong)" />
            <Tooltip
              cursor={{ fill: "var(--surface-2)" }}
              content={
                <ChartTooltip
                  nomes={{ valor: "Desequilíbrio" }}
                  formatter={(v) => fmtSigned(v)}
                  titulo={(_l, p) => {
                    const d = p?.[0]?.payload as { codigo?: string; metodo?: string } | undefined;
                    return d ? `${d.codigo}${d.metodo ? ` — ${d.metodo}` : ""}` : undefined;
                  }}
                />
              }
            />
            <Bar
              dataKey="valor"
              radius={[3, 3, 3, 3]}
              isAnimationActive={false}
              cursor="pointer"
              onClick={(entry) => {
                const e = entry as { codigo?: string; payload?: { codigo?: string } } | undefined;
                const codigo = e?.codigo ?? e?.payload?.codigo;
                if (codigo) onSelect(codigo);
              }}
            >
              {dados.map((d) => (
                <Cell
                  key={d.codigo}
                  fill={d.ativo ? "var(--brand)" : CHART_SERIE_COR.contratado}
                  stroke={sel === d.codigo ? "var(--brand-700)" : "transparent"}
                  strokeWidth={sel === d.codigo ? 2 : 0}
                />
              ))}
              <LabelList dataKey="valor" content={<BarLabel />} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="ind-chart-cap">
        Barras à direita do zero = under-recovery (base do Pleito); à esquerda = base que não
        sustenta desequilíbrio.
        {pendentes.length > 0
          ? ` ${pendentes.join(", ")} pendente${pendentes.length > 1 ? "s" : ""} — não plotado${pendentes.length > 1 ? "s" : ""}.`
          : ""}
      </p>
    </div>
  );
}

// ── Linha de método (clicável) ───────────────────────────────────────────────
function MetodoRow({ m, sel, onClick }: { m: IndiretoMetodo; sel: boolean; onClick: () => void }) {
  return (
    <tr
      className={`ind-mrow${sel ? " sel" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <td>
        <strong>
          {m.codigo} — {m.metodo}
        </strong>
        {m.ativo ? <span className="ind-tag">ATIVO</span> : null}
      </td>
      <td className="ind-cmp">{m.comparacao}</td>
      <td className="ind-r">
        {m.pendente ? (
          <span className="ind-pend">pendente</span>
        ) : (
          <span className={`ind-mv ${(m.desequilibrioRs ?? 0) >= 0 ? "ind-pos" : "ind-neg"}`}>
            {fmtSigned(m.desequilibrioRs)}
          </span>
        )}
      </td>
      <td className="ind-r ind-ver">
        <span>
          ver <ChevronRight size={13} aria-hidden />
        </span>
      </td>
    </tr>
  );
}

// ── Detalhe do método (memória de cálculo · M2 abre os 29 grupos) ─────────────
function MetodoDetalhe({ m, itens }: { m: IndiretoMetodo; itens: IndiretoItem[] }) {
  const isHist = m.codigo === "M2";
  return (
    <div className="ind-detail">
      <div className="ind-det-h">
        Detalhe —{" "}
        <strong>
          {m.codigo} — {m.metodo}
        </strong>
        {m.ativo ? <span className="ind-tag">ATIVO</span> : null}
      </div>
      {m.pendente ? (
        <div className="ind-pendbox">
          Pendente — depende do envio dos balancetes / apropriação contábil (AGM). Quando
          disponível, este método compara o custo indireto efetivamente apropriado (contabilidade)
          com o medido.
        </div>
      ) : (
        <table className="ind-calc">
          <tbody>
            {calcRows(m).map((row, i) => (
              <tr key={i}>
                <td>
                  {i + 1}. {row.label}
                </td>
                <td className="ind-r">{fmtBRL(row.value)}</td>
              </tr>
            ))}
            <tr className="ind-calc-res">
              <td>
                3. DESEQUILÍBRIO {m.codigo} (= {m.comparacao})
              </td>
              <td className="ind-r">{fmtSigned(m.desequilibrioRs)}</td>
            </tr>
          </tbody>
        </table>
      )}
      {m.ativo ? (
        <div className="ind-detnote">Método ativo — governa o número exibido no painel (D.0).</div>
      ) : null}

      {isHist && itens.length > 0 ? <ItensTabela itens={itens} m={m} /> : null}
    </div>
  );
}
// Linhas da memória de cálculo, na ordem de exibição do mockup, com o RÓTULO casando com o VALOR.
// Convenção do banco: valorA = minuendo da comparação (real/gasto), valorB = subtraendo
// (contratado/medido), desequilíbrio = A − B. No M2 (histograma) o mockup lista o baseline
// (contratado = valorB) primeiro e o real (valorA) depois.
function calcRows(m: IndiretoMetodo): Array<{ label: string; value: number | null }> {
  if (m.codigo === "M2") {
    return [
      { label: "Adm Local contratada até o período", value: m.valorB },
      { label: "Adm Local real até o período", value: m.valorA },
    ];
  }
  if (m.codigo === "M2.2") {
    return [
      { label: "Adm Local gasto até o período", value: m.valorA },
      { label: "Adm Local medida (boletim) até o período", value: m.valorB },
    ];
  }
  return [
    { label: "Adm Local real até o período", value: m.valorA },
    { label: "Adm Local medida (boletim) até o período", value: m.valorB },
  ];
}

// ── 29 grupos da Adm Local (M2 · contratado × real) ──────────────────────────
// O TOTAL de custo vem do método M2 (valorA/valorB/desequilíbrio), a fonte autoritativa —
// reconcilia ao centavo com a memória de cálculo, o basebar e o D.0 (a soma crua dos itens tem
// ruído de ponto-flutuante em .5). Os totais de quantidade são soma direta (inteiros exatos).
// Ordenações estáveis em módulo (cmp puros, tratam null internamente). Default = |Δ Custo| desc:
// o jurista vê primeiro o grupo que mais estoura, sem escanear 29 linhas no olho.
const GRUPOS_SORTS: Ordenacao<IndiretoItem>[] = [
  {
    value: "delta-custo",
    label: "Maior |Δ Custo|",
    cmp: (a, b) => Math.abs(b.deltaCusto ?? 0) - Math.abs(a.deltaCusto ?? 0),
  },
  {
    value: "delta-qtd",
    label: "Maior |Δ Qtd|",
    cmp: (a, b) =>
      Math.abs((b.qtdReal ?? 0) - (b.qtdContr ?? 0)) -
      Math.abs((a.qtdReal ?? 0) - (a.qtdContr ?? 0)),
  },
  { value: "ordem", label: "Ordem do plano", cmp: (a, b) => a.ordem - b.ordem },
  {
    value: "az",
    label: "Grupo (A–Z)",
    cmp: (a, b) => normTxt(a.grupo).localeCompare(normTxt(b.grupo)),
  },
];

function ItensTabela({ itens, m }: { itens: IndiretoItem[]; m: IndiretoMetodo }) {
  // Totais de QUANTIDADE: soma do conjunto CHEIO (inteiros exatos) — NUNCA das linhas paginadas.
  const totQtd = useMemo(
    () =>
      itens.reduce((a, it) => ({ qc: a.qc + (it.qtdContr ?? 0), qr: a.qr + (it.qtdReal ?? 0) }), {
        qc: 0,
        qr: 0,
      }),
    [itens],
  );
  // Coleção: só os grupos VISÍVEIS entram no map; busca/ordenação/paginação não tocam o TOTAL.
  const col = useColecao(itens, {
    busca: (it) => it.grupo,
    ordenacoes: GRUPOS_SORTS,
    perPage: 10,
    resetKey: m.codigo,
  });
  // INVARIANTE DE COLEÇÃO (assert recOk): o TOTAL de custo vem do MÉTODO-ÂNCORA
  // (valorA/valorB/desequilibrioRs), nunca de reduce das linhas. Guard em valores BRUTOS com
  // tolerância <0,01 — revela divergência, não substitui o canônico.
  const ancoraRecOk =
    m.valorA == null || m.valorB == null || m.desequilibrioRs == null
      ? true
      : Math.abs(m.valorA - m.valorB - m.desequilibrioRs) < 0.01;

  return (
    <>
      <div className="ind-subh">
        Resumo por item — real × contratado ({itens.length} grupos da Adm Local)
      </div>
      {col.showToolbar ? (
        <ColToolbar col={col} placeholder="Buscar grupo (ex.: engenheiro, container, veículo)…" />
      ) : null}
      <div className="ind-tablewrap">
        <table className="ind-itab">
          <thead>
            <tr>
              <th>Item / Grupo</th>
              <th className="ind-r">Qtd Contr.</th>
              <th className="ind-r">Qtd Real</th>
              <th className="ind-r">Δ Qtd</th>
              <th className="ind-r">Custo Contr.</th>
              <th className="ind-r">Custo Real</th>
              <th className="ind-r">Δ Custo</th>
            </tr>
          </thead>
          <tbody>
            {col.visible.map((it) => (
              <tr key={it.ordem}>
                <td className="ind-grp">{it.grupo}</td>
                <td className="ind-r">{fmtInt(it.qtdContr)}</td>
                <td className="ind-r">{fmtInt(it.qtdReal)}</td>
                <td className="ind-r ind-dq">
                  {fmtDeltaQtd((it.qtdReal ?? 0) - (it.qtdContr ?? 0))}
                </td>
                <td className="ind-r">{fmtBRL(it.custoContr)}</td>
                <td className="ind-r">{fmtBRL(it.custoReal)}</td>
                <td className={`ind-r ${(it.deltaCusto ?? 0) >= 0 ? "ind-pos" : "ind-neg"}`}>
                  {fmtSigned(it.deltaCusto)}
                </td>
              </tr>
            ))}
            {/* TOTAL fixo fora de filtro/paginação — do método-âncora + Qtd do conjunto cheio. */}
            <tr className="ind-itab-tot">
              <td>TOTAL</td>
              <td className="ind-r">{fmtInt(totQtd.qc)}</td>
              <td className="ind-r">{fmtInt(totQtd.qr)}</td>
              <td className="ind-r ind-dq">{fmtDeltaQtd(totQtd.qr - totQtd.qc)}</td>
              <td className="ind-r">{fmtBRL(m.valorB)}</td>
              <td className="ind-r">{fmtBRL(m.valorA)}</td>
              <td className="ind-r">{fmtSigned(m.desequilibrioRs)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {col.total === 0 ? (
        <ColVazio
          termo={col.debounced}
          rotulo="grupo encontrado"
          onClear={() => col.setQuery("")}
        />
      ) : (
        <ColPag col={col} rotulo="grupos" />
      )}
      {!ancoraRecOk ? (
        <p className="ind-recwarn">
          <TriangleAlert size={13} aria-hidden /> TOTAL conferido contra o método-âncora:
          divergência acima da tolerância — revisar a normalização.
        </p>
      ) : null}
    </>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function IndSkeleton() {
  return (
    <div className="ind-sk">
      <Skeleton style={{ height: 64, borderRadius: "var(--r-lg)" }} />
      <div className="ind-sk-kpis">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} style={{ height: 118, borderRadius: "var(--r-lg)" }} />
        ))}
      </div>
      <Skeleton style={{ height: 72, borderRadius: "var(--r-lg)" }} />
      <Skeleton style={{ height: 220, borderRadius: "var(--r-lg)" }} />
    </div>
  );
}
