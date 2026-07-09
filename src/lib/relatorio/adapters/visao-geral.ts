// Adapter Visão Geral → RelatorioDados. Mapeia o read-model REAL da aba (VisaoGeralBridge, via
// fetchVisaoGeralView) para os DADOS do relatório — paridade exata com a tela (mesmos números). A
// aba é o overview executivo: hero (desequilíbrio · faturamento · prazo · situação) + 5 blocos de
// farol consolidados (faturamento · recursos · produtividade · prazo · desequilíbrio). A IA escreve
// só a narrativa do diagnóstico executivo ancorada nestes números.

import { fetchVisaoGeralView } from "@/lib/hooks/useVisaoGeralView";
import { farolLabel } from "@/lib/mocks/contracts";
import type { BlocoFarol } from "@/lib/mocks/obras";
import type { RelatorioDados, RelatorioFarol } from "@/lib/relatorio/schema";

const fmtBRL0 = (v: number): string =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtPct = (v: number | null | undefined): string =>
  v != null ? `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—";

/** Rótulo do bloco de farol p/ a tabela: "Pendente" (área cega) ou o nível canônico PT-BR. */
const blocoNivelLabel = (b: BlocoFarol): string => (b.pendente ? "Pendente" : farolLabel[b.nivel]);

/** DADOS reais da aba Visão Geral p/ o relatório (null = obra sem o núcleo normalizado). */
export async function dadosVisaoGeral(contractId: string): Promise<RelatorioDados | null> {
  const view = await fetchVisaoGeralView(contractId);
  if (!view) return null;
  const { bm, visao } = view;

  // Farol OFICIAL da aba = a Situação Geral consolidada (ind.farolGeral). Neutra (observacao) com
  // cobertura parcial — nunca verde sobre área cega (mesma regra da aba).
  const farol: RelatorioFarol = bm.situacao;

  const indicadores = [
    {
      // PENDENTE ≠ ZERO: desequilíbrio (M3/D.0) só vira headline se quantificado (>0); senão "—".
      label: "Desequilíbrio acumulado",
      valor: bm.desequilibrioAcumulado > 0 ? fmtBRL0(bm.desequilibrioAcumulado) : "—",
      hint:
        bm.desequilibrioAcumulado > 0
          ? `${bm.desequilibrioPctValor.toLocaleString("pt-BR")}% do valor contratual · composição D.0`
          : "pendente — M3 não quantificado",
    },
    {
      // % físico-financeiro realizado; null quando a curva não tem custo total ⇒ "—" (não 0% fabricado).
      label: "Faturamento (avanço)",
      valor: bm.faturamentoPct != null ? `${bm.faturamentoPct.toLocaleString("pt-BR")}%` : "—",
      hint:
        bm.faturamentoContratadoPct != null
          ? `contratado ${bm.faturamentoContratadoPct.toLocaleString("pt-BR")}% no ${bm.numero}`
          : "pendente — curva sem valor contratado total",
    },
    {
      label: "Prazo decorrido",
      valor: `${bm.prazoDecorridoDias} / ${visao.prazoTotalDias} d`,
      hint: `${bm.prazo.decorridoPct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% decorrido`,
    },
    {
      label: "Situação geral",
      valor: bm.situacaoLabel,
      hint: `farol ${farolLabel[bm.situacao]} · corte ${bm.numero}`,
    },
  ];

  // Curva natural da aba = Curva de Faturamento (contratado × real acumulado, R$ mi) — o mesmo
  // mini-gráfico do bloco "Desempenho". real para após o corte (null = gap).
  const serie = bm.faturamento.curvaS.map((p) => ({
    m: p.bm,
    previsto: p.contratado,
    real: p.real,
  }));
  const grafico =
    serie.length > 0
      ? {
          tipo: "curva" as const,
          unidade: "R$ mi",
          legenda: "Curva de Faturamento — contratado × realizado acumulado, em R$ milhões.",
          serie,
        }
      : null;

  // Detalhamento natural = os 5 blocos de farol consolidados (cada bloco com valor + situação).
  // É o "placar" executivo da aba — o que a IA narra como diagnóstico consolidado.
  const blocos: Array<{ titulo: string; bloco: BlocoFarol }> = [
    { titulo: "Faturamento", bloco: bm.blocoFaturamento },
    { titulo: "Recursos", bloco: bm.blocoRecursos },
    { titulo: "Produtividade", bloco: bm.blocoProdutividade },
    { titulo: "Prazo", bloco: bm.blocoPrazo },
    { titulo: "Desequilíbrio", bloco: bm.blocoDesequilibrio },
  ];
  const detalhamento = {
    titulo: "Blocos de análise — situação consolidada",
    colunas: ["Bloco", "Valor", "Situação", "Leitura"],
    linhas: blocos.map(({ titulo, bloco }) => [
      titulo,
      bloco.valor,
      blocoNivelLabel(bloco),
      bloco.descricao,
    ]),
  };

  return { titulo: "Visão Geral", farol, indicadores, grafico, detalhamento };
}
