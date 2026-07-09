// Adapter Insumos (RMA · C.6 + D.5) → RelatorioDados. Mapeia os read-models REAIS da aba
// (getInsumos = take-off + Curva ABC por valor · getInsumoExcedente = excedente ao IPCA cl. 8.8)
// para os DADOS do relatório — paridade com a tela (mesmos números). A IA só escreve a narrativa
// ancorada nestes números.
//
// FOCO: Curva ABC (onde o valor concentra), excedente vs. teto IPCA (cl. 6.2 → 8.8) e o impacto
// financeiro repassável. DOMÍNIO: variação de PREÇO de material; até o IPCA é risco da Contratada,
// só o excedente é faturado direto (sem reequilíbrio). PENDENTE ≠ 0: preço/índice não persistido = "—".

import { getInsumos } from "@/lib/supabase/insumos";
import { getInsumoExcedente } from "@/lib/supabase/insumoExcedente";
import { getFaturamentoCurva } from "@/lib/supabase/faturamentoCurva";
import { formatBRLAbbreviated } from "@/lib/mocks/contracts";
import { normTxt } from "@/lib/rma/colecao";
import type { InsumoValorAbc } from "@/lib/supabase/insumos";
import type { InsumoExcedente } from "@/lib/supabase/insumoExcedente";
import type { RelatorioDados, RelatorioFarol } from "@/lib/relatorio/schema";

// ── Formatadores (PT-BR, tabular) — espelham a aba ──────────────────────────────
const fmtRs = (v: number | null | undefined) =>
  v != null
    ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
    : "—";
const fmtPreco = (v: number | null | undefined) =>
  v != null
    ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 })
    : "—";
// fração (0,0157) → "+1,57%"
const fmtPctSinal = (v: number | null | undefined) =>
  v != null
    ? `${v >= 0 ? "+" : ""}${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
    : "—";
// número 0–100 → "33,9%"
const fmtPctNum = (v: number | null | undefined, d = 1) =>
  v != null ? `${v.toLocaleString("pt-BR", { maximumFractionDigits: d })}%` : "—";
// fração (0,0157) → "+1,57 pp" — pontos percentuais (espelha o fmtPp da aba para o "maior gap")
const fmtPp = (v: number | null | undefined) =>
  v != null
    ? `${v >= 0 ? "+" : ""}${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} pp`
    : "—";

// farolHeader vem como rótulo PT-BR ("Conforme", "Conforme · caiu", "Observação", "Risco",
// "Crítico"). Mapeia para o farol canônico do schema — mesma lógica do farolTone() da aba.
function headerFarol(farol: string | null | undefined): RelatorioFarol {
  if (!farol) return "conforme";
  const f = normTxt(farol);
  if (f.includes("critico")) return "critico";
  if (f.includes("risco")) return "risco";
  if (f.includes("observacao")) return "observacao";
  return "conforme";
}

/** DADOS reais da aba Insumos p/ o relatório (null = obra sem take-off de insumos normalizado). */
export async function dadosInsumos(contractId: string): Promise<RelatorioDados | null> {
  const [data, exc, curva] = await Promise.all([
    getInsumos(contractId),
    getInsumoExcedente(contractId),
    getFaturamentoCurva(contractId),
  ]);
  // Sem take-off normalizado → empty state honesto (a aba também mostra EmptyState aqui).
  if (!data) return null;

  // PV real da obra (denominador do "% sobre o PV") = Valor total do contrato (Σ contratado da
  // Curva S, gate-validado). Por obra, nunca chumbado — sem PV → null.
  const pvObra = curva?.custoTotal ?? null;

  // O farol OFICIAL da aba é o farol consolidado do excedente (header). Sem excedente normalizado
  // (D.5 pendente), a aba só mostra a Curva ABC → farol conservador "conforme".
  const farol: RelatorioFarol = headerFarol(exc?.farolHeader);

  // ── Indicadores (os 4 FarolCards do cabeçalho da aba, valores EXATOS) ──────────
  const pctPv =
    exc?.pctSobrePv ??
    (exc?.totalDeltaRs != null && pvObra != null && pvObra > 0 ? exc.totalDeltaRs / pvObra : null);

  const indicadores = [
    {
      label: "Insumos monitorados",
      valor: String(data.nInsumos),
      hint: "faturamento direto · PQ oficial (Anexo C.04)",
    },
    {
      label: "Valor contratado (materiais)",
      valor: data.totalValor != null ? formatBRLAbbreviated(data.totalValor) : "—",
      hint: "PQ oficial (Anexo C.04) · valores c/ BDI",
    },
    {
      label: "Teto contratual (IPCA)",
      valor: exc ? fmtPctSinal(exc.tetoSnapshotPct) : "—",
      hint: exc?.snapshotLabel
        ? `acum. até ${exc.snapshotLabel} · risco da Contratada (cl. 6.2.2)`
        : "snapshot 8.8 pendente",
    },
    {
      label: "Repasse real (8.8 · medido)",
      valor: exc ? fmtRs(exc.totalDeltaRs) : "—",
      hint:
        exc != null
          ? `acima do teto${pctPv != null ? ` · ${fmtPctNum(pctPv * 100, 3)} do PV` : ""}`
          : "8.8 pendente",
    },
    // Contagem de itens acima do teto IPCA (consolidado do header). null = 8.8 pendente.
    {
      label: "Itens acima do teto (IPCA)",
      valor: exc?.insumosAcimaTeto != null ? String(exc.insumosAcimaTeto) : "—",
      hint: "excederam o teto contratual (cl. 8.8)",
    },
    // Maior excedente sobre o teto (pp, igual ao card da aba) — o insumo dono vai no hint.
    {
      label: "Maior desequilíbrio",
      valor: exc?.maiorGap ? fmtPp(exc.maiorGap.excedentePct) : "—",
      hint: exc?.maiorGap ? `${exc.maiorGap.insumo} · acima do teto` : "nada acima do teto",
    },
  ];

  // ── Gráfico ───────────────────────────────────────────────────────────────────
  // A aba NÃO tem curva natural {m, previsto, real}: a Curva ABC é Pareto (não temporal) e a série
  // "Índices no tempo" é dado de REFERÊNCIA externo (mock por obra, EmptyState quando ausente),
  // não read-model normalizado. Honestidade: sem curva ancorada → null.
  const grafico = null;

  // ── Detalhamento: Curva ABC completa (impacto por insumo) — espelha AbcCompletaCard ──
  // Só faz sentido com o excedente normalizado (junção take-off↔excedente). Sem D.5 → null.
  let detalhamento: RelatorioDados["detalhamento"] = null;
  if (exc) {
    const teto = exc.tetoSnapshotPct ?? 0;
    const precoMap = new Map(data.insumos.map((i) => [i.codigo, i.precoOrcado]));
    // junção take-off↔excedente por nome normalizado: exato OU excedente cujo nome é PREFIXO do
    // nome da ABC — idêntica à da aba (sufixos "COMERCIAL"/"BOMBEADO"). Prefixo mais longo vence.
    const excKeys = exc.insumos.map((i) => ({ key: normTxt(i.insumo.split(" (")[0]), item: i }));
    const matchExc = (a: InsumoValorAbc): InsumoExcedente | undefined => {
      const abc = normTxt((a.descricao ?? a.codigo).split(" (")[0]);
      let best: { key: string; item: InsumoExcedente } | undefined;
      for (const e of excKeys) {
        if (abc === e.key) return e.item;
        if (abc.startsWith(e.key) && (!best || e.key.length > best.key.length)) best = e;
      }
      return best?.item;
    };

    const linhas = data.curvaAbcValor.map((a) => {
      const e = matchExc(a);
      const orcado = e?.precoOrcadoRs ?? precoMap.get(a.codigo) ?? null;
      const realPago = e?.precoRefRealRs ?? null;
      const varPct = e?.deltaRealPct ?? null;
      const excedentePct = e?.excedentePct ?? null;
      const acima = (excedentePct ?? 0) > 0;
      return [
        a.descricao ?? a.codigo,
        fmtRs(a.valorOrcado),
        `${a.pct.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`,
        fmtPreco(orcado),
        orcado != null ? fmtPreco(orcado * (1 + teto)) : "—",
        realPago != null ? fmtPreco(realPago) : "—",
        varPct != null ? fmtPctSinal(varPct) : "—",
        acima ? `+${fmtPctNum((excedentePct ?? 0) * 100, 2)}` : "—",
        // medido (tem Var%) → impacto real, inclusive R$ 0; não-medido → "—" (PENDENTE ≠ 0).
        varPct != null ? fmtRs(e?.deltaRs ?? 0) : "—",
      ];
    });

    detalhamento = {
      titulo: "Curva ABC completa — impacto por insumo",
      colunas: [
        "Insumo",
        "Custo total",
        "% tot",
        "Orçado",
        "Teto (reaj.)",
        "Real pago",
        "Var.%",
        "Exced.",
        "Impacto R$",
      ],
      linhas,
      colDesvio: 8, // coluna "Impacto R$" (o R$ do desequilíbrio)
    };
  }

  // 2ª tabela: distribuição por classe ABC (A/B/C/D/N do catálogo). InsumosPorClasse só tem
  // {classe, nInsumos} — sem valor por classe no read-model, então duas colunas (Classe · Itens).
  const tabelas: RelatorioDados["tabelas"] =
    data.porClasse.length > 0
      ? [
          {
            titulo: "Distribuição por classe ABC",
            colunas: ["Classe", "Itens"],
            linhas: data.porClasse.map((c) => [c.classe, String(c.nInsumos)]),
          },
        ]
      : undefined;

  return { titulo: "Insumos", farol, indicadores, grafico, detalhamento, tabelas };
}
