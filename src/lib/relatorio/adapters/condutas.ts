// Adapter Condutas → RelatorioDados. Mapeia o read-model REAL da aba (getCondutas · C.11 ·
// obra_condutas) para os DADOS do relatório — garante paridade com a CondutasRealView (mesmos
// números: total de ações, urgentes, aceitas, categorias e a mesma tabela do catálogo).
// A IA só escreve a narrativa em cima destes números (ancorada).

import { normTxt as normRaw } from "@/lib/rma/colecao";
import { getCondutas } from "@/lib/supabase/condutas";
import type { RelatorioDados, RelatorioFarol } from "@/lib/relatorio/schema";

const normTxt = (s: string | null | undefined) => normRaw(s ?? "");

const PRIORIDADE_PESO: Record<string, number> = { urgente: 0, importante: 1, preventiva: 2 };
const fmtData = (iso: string | null) => {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return a && m && d ? `${d}/${m}/${a}` : iso;
};

/** DADOS reais da aba Condutas p/ o relatório (null = obra sem catálogo C.11 normalizado). */
export async function dadosCondutas(contractId: string): Promise<RelatorioDados | null> {
  const lista = await getCondutas(contractId);
  if (!lista.length) return null;

  // Mesmos agregados que a CondutasRealView mostra no cabeçalho (FarolCards).
  const urgentes = lista.filter((c) => normTxt(c.prioridade) === "urgente").length;
  const importantes = lista.filter((c) => normTxt(c.prioridade) === "importante").length;
  const aceitas = lista.filter((c) => normTxt(c.status) === "aceita").length;
  const categorias = new Set(lista.map((c) => c.categoria).filter(Boolean)).size;

  // Farol oficial da aba: a CondutasRealView sinaliza danger quando há urgentes (FarolCard URGENTES).
  // Mapeio para o sistema de 4 níveis: urgente aberta → Crítico; só importantes → Risco;
  // nenhuma das duas → Observação (há ações preventivas pendentes a tratar).
  const farol: RelatorioFarol = urgentes > 0 ? "critico" : importantes > 0 ? "risco" : "observacao";

  const indicadores = [
    {
      label: "Condutas sugeridas",
      valor: `${lista.length} ${lista.length === 1 ? "ação" : "ações"}`,
      hint: "catálogo do Adm Contratual IA (C.11)",
    },
    {
      label: "Urgentes",
      valor: String(urgentes),
      hint: urgentes > 0 ? "tratar nesta semana" : "nenhuma pendência urgente",
    },
    {
      label: "Aceitas",
      valor: `${aceitas} de ${lista.length}`,
      hint: "condutas já acatadas pela gestão",
    },
    {
      label: "Categorias",
      valor: String(categorias),
      hint: "tipos de gatilho contratual (do banco)",
    },
  ];

  // Condutas é um catálogo de ações, não uma curva temporal: sem série natural.
  const grafico = null;

  // Detalhamento: o mesmo catálogo da tabela da aba, ordenado por prioridade (urgente 1º),
  // com fallback para a ordem do catálogo — espelha a ordenação padrão da CondutasRealView.
  const linhas = [...lista]
    .sort(
      (a, b) =>
        (PRIORIDADE_PESO[normTxt(a.prioridade)] ?? 9) -
          (PRIORIDADE_PESO[normTxt(b.prioridade)] ?? 9) || a.ordem - b.ordem,
    )
    .map((c) => [
      c.gatilho,
      c.categoria ?? "—",
      c.clausula ?? "—",
      c.documento ?? "—",
      c.prioridade ?? "—",
      c.status ?? "—",
      fmtData(c.dataSugerida),
      c.diasAberto != null ? String(c.diasAberto) : "—",
    ]);

  const detalhamento = {
    titulo: "Catálogo de condutas (C.11)",
    colunas: [
      "Conduta sugerida",
      "Categoria",
      "Cláusula",
      "Documento",
      "Prioridade",
      "Estágio",
      "Sugerida em",
      "Dias em aberto",
    ],
    linhas,
  };

  return { titulo: "Condutas", farol, indicadores, grafico, detalhamento };
}
