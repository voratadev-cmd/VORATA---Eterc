// Adapter Responsabilidade → RelatorioDados. Mapeia o read-model REAL da aba (analiseResp do BM corrente,
// via getVisaoGeral/getBm) para os DADOS do relatório — garante paridade com a tela. A IA só escreve a
// narrativa ancorada nesses números.
//
// HONESTIDADE: a aba "Análise de Responsabilidade" (§5.3.8 · eventos negativos classificados por responsável)
// NÃO tem read-model normalizado — é alimentada exclusivamente pelo registry de mocks por obra
// (OBRAS_BY_ID em src/lib/mocks/obras), hoje vazio. Não há tabela no banco, getter em src/lib/supabase/
// nem hook. Portanto, para qualquer obra sem visaoGeral.analiseResp populado, o adapter retorna null
// (→ empty state honesto). Quando uma obra real expuser visaoGeral.bms[].analiseResp, o mapeamento abaixo
// produz os mesmos números da tela (4 KPIs por responsável + matriz de eventos + quantificação por tipo).

import type { FarolLevel } from "@/lib/mocks/contracts";
import { type AnaliseRespBM, getBm, getVisaoGeral } from "@/lib/mocks/obras";
import type { RelatorioDados, RelatorioFarol } from "@/lib/relatorio/schema";

const fmtPct = (v: number | null | undefined): string =>
  v != null ? `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—";

// Ordem de severidade do farol (pior → melhor). A aba não tem farol único de cabeçalho — as cores dos 4
// KPIs são fixas por responsável (não-farol). O farol OFICIAL do relatório é derivado: o pior farol entre
// os tipos de impacto quantificados. Sem tipos → "observacao" (há análise, mas sem severidade marcada).
const SEVERIDADE: Record<FarolLevel, number> = { critico: 3, risco: 2, observacao: 1, conforme: 0 };

function farolDaAnalise(a: AnaliseRespBM): RelatorioFarol {
  if (a.tiposImpacto.length === 0) return "observacao";
  return a.tiposImpacto.reduce<FarolLevel>(
    (pior, t) => (SEVERIDADE[t.farol] > SEVERIDADE[pior] ? t.farol : pior),
    "conforme",
  );
}

/** DADOS reais da aba Responsabilidade p/ o relatório (null = obra sem análise de responsabilidade normalizada). */
export async function dadosResponsabilidade(contractId: string): Promise<RelatorioDados | null> {
  const visao = getVisaoGeral(contractId);
  if (!visao) return null;
  const bm = getBm(visao);
  const a = bm.analiseResp;
  if (!a) return null;

  const farol = farolDaAnalise(a);

  // 4 KPIs do cabeçalho: impacto por responsável (rótulo e nota EXATOS da tela). Cores na tela são fixas
  // por responsável (não-farol); aqui o hint carrega a participação % + nº de eventos.
  const indicadores = [
    {
      label: "Contratante",
      valor: a.contratante.valorLabel,
      hint: a.contratante.nota || `${fmtPct(a.contratante.pct)} · ${a.contratante.eventos} eventos`,
    },
    {
      label: "Contratada",
      valor: a.contratada.valorLabel,
      hint: a.contratada.nota || `${fmtPct(a.contratada.pct)} · ${a.contratada.eventos} eventos`,
    },
    {
      label: "Terceiro",
      valor: a.terceiro.valorLabel,
      hint: a.terceiro.nota || `${fmtPct(a.terceiro.pct)} · ${a.terceiro.eventos} eventos`,
    },
    {
      label: "Força Maior",
      valor: a.forcaMaior.valorLabel,
      hint: a.forcaMaior.nota || `${fmtPct(a.forcaMaior.pct)} · ${a.forcaMaior.eventos} eventos`,
    },
  ];

  // Sem curva natural nesta aba (distribuição por responsável é categórica, não série temporal).
  const grafico = null;

  // Detalhamento: a matriz de eventos × responsabilidade (a tabela natural da aba).
  const RESP_LABEL: Record<string, string> = {
    contratante: "Contratante",
    contratada: "Contratada",
    terceiro: "Terceiro",
    forcaMaior: "Força Maior",
  };
  const detalhamento = a.eventos.length
    ? {
        titulo: `Matriz de eventos × responsabilidade · ${bm.numero}`,
        colunas: ["ID", "Evento", "Data", "Impacto", "Responsável", "Docs"],
        linhas: a.eventos.map((e) => [
          e.id,
          e.evento,
          e.dataLabel,
          e.impactoLabel,
          RESP_LABEL[e.responsavel] ?? e.responsavel,
          `${e.docs} ${e.docs === 1 ? "doc" : "docs"}`,
        ]),
      }
    : null;

  return { titulo: "Análise de Responsabilidade", farol, indicadores, grafico, detalhamento };
}
