// C.6 Insumos — REGIME SBSO (cláusula 7 · INCC-DI) · spec ajustes-REVISADO-v3.
// Substitui o modelo ATERPA (IPCA/8.8, bases DNIT/mercado, presets) quando a obra declara o
// regime contratual de reajuste por item (seção "C.6 Insumos — Cards"): 6 cards, tabela de
// índices do Anexo XIII, evolução base-100, curva ABC com reajuste por item e a conta do
// reequilíbrio (apurável só com preço real/NF — nenhuma compra até o corte).
import {
  CalendarCheck,
  CalendarPlus,
  Coins,
  Info,
  ReceiptText,
  Scale,
  ScanSearch,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge, Card, ChartLegend, ChartTooltip, EmptyState } from "@/components/ds";
import { RmaParamBar } from "@/components/RmaParamBar/RmaParamBar";
import { ColPag, ColToolbar, ColVazio, normTxt, useColecao } from "@/lib/rma/colecao";
import type { InsumosSbso, SbsoItem } from "@/lib/supabase/insumosSbso";
import "./InsumosSbso.css";

// ── Formatadores (regra global v3: R$ inteiro pt-BR · % com vírgula) ────────────────────────────
const fmtBRL0 = (v: number | null) =>
  v != null ? `R$ ${Math.round(v).toLocaleString("pt-BR")}` : "—";
const fmtMi = (v: number | null) =>
  v != null
    ? `R$ ${(v / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`
    : "—";
const fmtPct2 = (fr: number | null) =>
  fr != null
    ? `${(fr * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
    : "—";
const fmtIdx = (v: number | null) =>
  v != null
    ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 3 })
    : "—";
const fmtQtd = (v: number | null) =>
  v != null ? v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "—";
const fmtDataBr = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return d ? `${d}/${m}/${y}` : iso;
};
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const fmtMesAno = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m] = iso.split("-").map(Number);
  return m ? `${MESES[m - 1]}/${String(y).slice(2)}` : "—";
};

const ORD_ITENS = [
  {
    value: "valor",
    label: "Maior custo",
    cmp: (a: SbsoItem, b: SbsoItem) => b.custoTotalRs - a.custoTotalRs,
  },
  {
    value: "nome",
    label: "Nome (A–Z)",
    cmp: (a: SbsoItem, b: SbsoItem) => normTxt(a.nome).localeCompare(normTxt(b.nome)),
  },
  {
    value: "classe",
    label: "Classe (ABC)",
    cmp: (a: SbsoItem, b: SbsoItem) =>
      (a.classe ?? "Z").localeCompare(b.classe ?? "Z") || b.custoTotalRs - a.custoTotalRs,
  },
];

export function InsumosSbsoView({
  dados,
  contratoLabel,
}: {
  dados: InsumosSbso;
  contratoLabel: string;
}) {
  const c = dados.cards;
  const col = useColecao(dados.itens, {
    busca: (x) => `${x.nome} ${x.classe ?? ""} ${x.unidade ?? ""}`,
    ordenacoes: ORD_ITENS,
    perPage: 10,
  });
  const classeARs = dados.itens
    .filter((x) => (x.classe ?? "").toUpperCase() === "A")
    .reduce((s, x) => s + x.custoTotalRs, 0);
  const classeAPct = c.baseRs > 0 ? (classeARs / c.baseRs) * 100 : null;
  const farolCritico = /crítico|critico/i.test(dados.farolFonte ?? "");

  const cards = [
    {
      icone: <ScanSearch size={15} aria-hidden />,
      label: "Insumos monitorados",
      valor: c.monitorados != null ? String(c.monitorados) : "—",
      sub: c.demaisRs != null ? `+ ${fmtBRL0(c.demaisRs)} em "demais" (Classe C)` : "curva ABC",
    },
    {
      icone: <CalendarCheck size={15} aria-hidden />,
      label: "Reajuste já concedido",
      valor: `+${fmtPct2(c.concedidoPct)} · ${fmtBRL0(c.concedidoRs)}`,
      sub: "1º reajuste · ago/2025 (I 1.216,71)",
    },
    {
      icone: <CalendarPlus size={15} aria-hidden />,
      label: "Novo reajuste (a aplicar)",
      valor: `+${(c.novoPp * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pp · ${fmtBRL0(c.novoRs)}`,
      sub: "ago/25 → mai/26 (I 1.270,695)",
    },
    {
      icone: <Coins size={15} aria-hidden />,
      label: "Reajuste total acumulado",
      valor: `+${fmtPct2(c.acumPct)} · ${fmtBRL0(c.acumRs)}`,
      sub: `desde a data-base ${fmtDataBr(dados.dataBaseISO)}`,
    },
    {
      icone: <Scale size={15} aria-hidden />,
      label: "Itens com reequilíbrio",
      valor: String(c.itensComReequilibrio),
      sub: "nenhum insumo apurado · sem compras até o corte",
    },
    {
      icone: <ReceiptText size={15} aria-hidden />,
      label: "Reequilíbrio apurável (R$)",
      valor: fmtBRL0(c.reequilibrioRs),
      sub: "sem preço real (NF) até o corte",
    },
  ];

  return (
    <div className="c6-wrap">
      <h2 className="c6-titulo">Insumos — Curva ABC + reajuste por item (cl. 7)</h2>
      <div className="c6-sub">
        reequilíbrio da variação acima do reajuste &nbsp;·&nbsp; Contrato <b>{contratoLabel}</b>{" "}
        &nbsp;·&nbsp; Data-base <b>{fmtDataBr(dados.dataBaseISO)}</b> &nbsp;
        <span className="c6-pill">
          <span className="c6-pill-dot" aria-hidden /> valores c/ BDI
        </span>
        {dados.farolFonte ? (
          <Badge tone={farolCritico ? "danger" : "info"} className="c6s-farol">
            {dados.farolFonte.replace(/^[●○◐•]\s*/u, "")}
          </Badge>
        ) : null}
      </div>
      <RmaParamBar
        className="c6-pbar"
        items={[
          {
            label: "Regime",
            valor: "reajuste + reequilíbrio (cláusula 7)",
            title:
              "7.1 reajuste em 12 meses da data-base · 7.2 parcelas além de 12 meses · 7.2.1 índice por item (Anexo XIII)",
          },
          { label: "Índice contratual", valor: "INCC-DI Todos (I 03) — materiais" },
          { label: "Corte", valor: fmtMesAno(dados.dataCorteISO) },
        ]}
      />

      {/* snapshot: os 6 números do regime antes de qualquer texto */}
      <div className="c6s-cards">
        {cards.map((k) => (
          <article key={k.label} className="c6s-card">
            <div className="c6s-card-top">
              <span className="c6s-card-chip">{k.icone}</span>
              <span className="c6s-card-label">{k.label}</span>
            </div>
            <div className="c6s-card-valor">{k.valor}</div>
            <div className="c6s-card-sub">{k.sub}</div>
          </article>
        ))}
      </div>

      {/* índices do Anexo XIII — no SBSO o índice de cada item é FIXO (não há "escolha de base") */}
      <div className="ifd-secttl">
        Índices de reajuste (INCC-DI · FGV/IBRE) — cl. 7.2.1 · Anexo XIII
      </div>
      <Card className="c6s-panel">
        <table className="c6s-idx">
          <thead>
            <tr>
              <th>Cód.</th>
              <th>Série</th>
              <th className="r">Io (ago/24)</th>
              <th className="r">I (último)</th>
              <th className="r">Reajuste</th>
              <th>Ref.</th>
            </tr>
          </thead>
          <tbody>
            {dados.indices.map((ix) => (
              <tr key={ix.codigo} className={ix.descontinuado ? "c6s-idx-desc" : ""}>
                <td className="c6s-idx-cod">{ix.codigo}</td>
                <td>{ix.serie}</td>
                <td className="r tabular">{fmtIdx(ix.io)}</td>
                <td className="r tabular">{fmtIdx(ix.iAtual)}</td>
                <td className="r tabular">{fmtPct2(ix.reajustePct)}</td>
                <td className="c6s-idx-ref">{ix.vintage ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="c6s-nota">
          <Info size={12} aria-hidden /> Materiais reajustam pelo <b>I 03</b>: Io 1.134,78
          (data-base) · 1º reajuste ago/25 I 1.216,71 = <b>+{fmtPct2(c.concedidoPct)}</b> · atual
          mai/26 I 1.270,695 = <b>+{fmtPct2(c.acumPct)}</b> · pro rata (cl. 7.2). Os índices{" "}
          <b>I 01/I 02</b> mostram o último ponto publicado na fonte (1º reajuste · ago/25); o I 04
          foi descontinuado em dez/2024 e substituído pelo I 03.
        </p>
      </Card>

      <div className="c6s-grid2">
        {/* evolução base-100 desde a data-base — pontos REAIS da fonte, sem interpolar */}
        <Card className="c6s-panel">
          <div className="c6s-panel-t">Evolução dos índices desde a data-base (base 100)</div>
          <div className="c6s-chart">
            <ResponsiveContainer width="100%" height={230}>
              <LineChart
                data={dados.serieBase100}
                margin={{ top: 8, right: 16, bottom: 0, left: -14 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="mesLabel" tick={{ fontSize: 11, fill: "var(--text-3)" }} />
                <YAxis domain={[98, 114]} tick={{ fontSize: 11, fill: "var(--text-3)" }} />
                <Tooltip
                  content={
                    <ChartTooltip
                      formatter={(v: number) =>
                        v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })
                      }
                    />
                  }
                />
                <Line
                  dataKey="i01"
                  name="I 01 · Projetos"
                  stroke="var(--info)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  dataKey="i02"
                  name="I 02 · Mão de Obra"
                  stroke="var(--warning)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  dataKey="i03"
                  name="I 03 · Materiais"
                  stroke="var(--brand)"
                  strokeWidth={2.4}
                  dot={{ r: 3.5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <ChartLegend
            items={[
              { label: "I 01 · Projetos", tipo: "linha", cor: "var(--info)" },
              { label: "I 02 · Mão de Obra", tipo: "linha", cor: "var(--warning)" },
              { label: "I 03 · Materiais", tipo: "linha", cor: "var(--brand)" },
            ]}
          />
          <p className="c6s-nota">
            Pontos publicados: data-base (ago/24), 1º reajuste (ago/25) e verificação (mai/26 — só o
            I 03).
          </p>
        </Card>

        {/* reequilíbrio por insumo (cl. 7): sem NF não há barra — honesto, não gráfico vazio */}
        <Card className="c6s-panel">
          <div className="c6s-panel-t">Reequilíbrio por insumo × reajuste do item</div>
          <EmptyState
            framed
            title="Aguardando preço real (NF)"
            text="Na cláusula 7, a barra de cada insumo é a variação REAL de preço (nota fiscal) comparada ao reajuste do item (INCC). Nenhum insumo da curva ABC foi comprado até o corte — o reequilíbrio acende quando as primeiras notas entrarem."
            hint={<Badge tone="info">0 itens com reequilíbrio</Badge>}
          />
        </Card>
      </div>

      {/* curva ABC + reajuste por item */}
      <div className="ifd-secttl">Curva ABC + reajuste por item</div>
      <Card className="c6s-panel">
        {col.showToolbar ? (
          <ColToolbar col={col} placeholder="Buscar insumo — ex.: porcelanato, aço…" />
        ) : null}
        {col.visible.length === 0 ? (
          <ColVazio termo={col.debounced} rotulo="insumo" onClear={() => col.setQuery("")} />
        ) : (
          <div className="c6s-tab-wrap">
            <table className="c6s-tab">
              <thead>
                <tr>
                  <th>Insumo</th>
                  <th>Und</th>
                  <th className="r">Qtd</th>
                  <th className="r">Custo total</th>
                  <th className="r">Reaj. concedido R$</th>
                  <th className="r">Novo reaj. R$</th>
                  <th className="r">Pç real (NF)</th>
                  <th className="r">Reequilíbrio R$</th>
                  <th>Classe (ABC)</th>
                </tr>
              </thead>
              <tbody>
                {col.visible.map((x) => (
                  <tr key={x.ordem} className={x.balde ? "c6s-tab-balde" : ""}>
                    <td className="c6s-tab-nome" title={x.nome}>
                      {x.nome}
                    </td>
                    <td>{x.balde ? "—" : (x.unidade ?? "—")}</td>
                    <td className="r tabular">{x.balde ? "—" : fmtQtd(x.qtd)}</td>
                    <td className="r tabular">{fmtBRL0(x.custoTotalRs)}</td>
                    <td className="r tabular">{fmtBRL0(x.concedidoRs)}</td>
                    <td className="r tabular">{fmtBRL0(x.novoRs)}</td>
                    <td className="r c6s-tab-pend" title="Sem nota fiscal até o corte">
                      —
                    </td>
                    <td className="r c6s-tab-pend" title="Apurável só com preço real (NF)">
                      —
                    </td>
                    <td>
                      <span className={`c6s-classe c6s-classe-${(x.classe ?? "c").toLowerCase()}`}>
                        {x.classe ?? "—"}
                      </span>
                    </td>
                  </tr>
                ))}
                <tr className="c6s-tab-total">
                  <td>TOTAL — {c.monitorados ?? dados.itens.length} itens (incl. demais)</td>
                  <td />
                  <td />
                  <td className="r tabular">{fmtBRL0(c.baseRs)}</td>
                  <td className="r tabular">{fmtBRL0(c.concedidoRs)}</td>
                  <td className="r tabular">{fmtBRL0(c.novoRs)}</td>
                  <td className="r tabular">—</td>
                  <td className="r tabular">{fmtBRL0(c.reequilibrioRs)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <ColPag col={col} rotulo="insumos" />
      </Card>

      {/* conta do reequilíbrio + leitura contratual (spec bloco 8) */}
      <div className="c6s-grid2">
        <Card className="c6s-panel">
          <div className="c6s-panel-t">Conta do reequilíbrio</div>
          <p className="c6s-texto">
            <b>Reequilíbrio = (Δ%real − Reajuste_item)⁺ × Qtde × Pç_base.</b> A variação real vem da
            nota fiscal de compra; só o que EXCEDER o reajuste do item vira reequilíbrio. Falta a
            quantidade comprada (NF) para converter % em R$ — por isso as colunas "Pç real" e
            "Reequilíbrio" aguardam as primeiras notas.
          </p>
        </Card>
        <Card className="c6s-panel">
          <div className="c6s-panel-t">Leitura contratual (cláusula 7)</div>
          <p className="c6s-texto">
            <b>7.1</b> reajuste em 12 meses da data-base · <b>7.2</b> parcelas além de 12 meses e
            sem atraso por culpa da Contratada · <b>7.2.1</b> índice de cada item (Anexo XIII):{" "}
            <b>R = V × (I − Io) / Io</b>. Como o atraso físico decorre da indisponibilidade de
            projeto (não culpa da ETERC), o direito ao reajuste se preserva.
          </p>
        </Card>
      </div>

      {/* leitura da IA — spec v3 §C.6.9, com os números do banco */}
      <Card className="c6s-ia">
        <div className="c6s-ia-tag">
          <Badge tone="info">IA</Badge> Adm Contratual · Leitura dos Insumos
        </div>
        <p className="c6s-ia-text">
          A curva ABC dos materiais reajustáveis soma <b>{fmtMi(c.baseRs)}</b> (
          {c.monitorados ?? dados.itens.length} itens + demais)
          {classeAPct != null
            ? `, Classe A ~${classeAPct.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`
            : ""}
          . Pelo I 03 (INCC-DI Todos), o reajuste já concedido (ago/2025) é{" "}
          <b>+{fmtPct2(c.concedidoPct)}</b> = <b>{fmtBRL0(c.concedidoRs)}</b> (direito
          incontroverso). O novo acumulado até mai/2026 acrescenta{" "}
          <b>
            +
            {(c.novoPp * 100).toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            pp
          </b>{" "}
          = <b>{fmtBRL0(c.novoRs)}</b>, totalizando <b>{fmtBRL0(c.acumRs)}</b> ({fmtPct2(c.acumPct)}
          ). O reequilíbrio (variação real acima do reajuste) será apurável quando os preços reais
          (NF) entrarem — sem teto, por ser reequilíbrio geral (cl. 7). Tela lê da C.6.
        </p>
      </Card>
    </div>
  );
}
