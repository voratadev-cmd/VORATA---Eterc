// Adapter do RMA COMPLETO (escopo "RMA inteiro") — a visão CONSOLIDADA do contrato. Compõe os
// adapters de todas as abas: o placar de farol por bloco + os KPIs executivos (hero da Visão Geral) +
// a curva de faturamento. A IA escreve a síntese estratégica (do Diretor) ancorada neste consolidado.
// Paridade: cada bloco reusa o MESMO adapter da sua aba → os números batem com cada tela.

import { farolLabel } from "@/lib/mocks/contracts";
import type { RelatorioDados, RelatorioFarol } from "@/lib/relatorio/schema";
import { dadosChuvas } from "./chuvas";
import { dadosCurvas } from "./curvas";
import { dadosFaturamento } from "./faturamento";
import { dadosInsumos } from "./insumos";
import { dadosPanorama } from "./panorama";
import { dadosPlanoAcao } from "./plano-acao";
import { dadosPrazo } from "./prazo";
import { dadosProdutividade } from "./produtividade";
import { dadosRecursos } from "./recursos";
import { dadosVisaoGeral } from "./visao-geral";

const BLOCOS: Array<[string, (id: string) => Promise<RelatorioDados | null>]> = [
  ["Faturamento", dadosFaturamento],
  ["Recursos", dadosRecursos],
  ["Produtividade", dadosProdutividade],
  ["Prazo", dadosPrazo],
  ["Insumos", dadosInsumos],
  ["Curvas", dadosCurvas],
  ["Chuvas", dadosChuvas],
  ["Panorama", dadosPanorama],
  ["Plano de Ação", dadosPlanoAcao],
];
const ORD: Record<RelatorioFarol, number> = { critico: 0, risco: 1, observacao: 2, conforme: 3 };

/** Consolidado do RMA inteiro (null se a obra não tem nenhum bloco com dado real). */
export async function dadosRmaGeral(contractId: string): Promise<RelatorioDados | null> {
  const [vg, blocos] = await Promise.all([
    dadosVisaoGeral(contractId),
    Promise.all(
      BLOCOS.map(async ([nome, fn]) => {
        try {
          const d = await fn(contractId);
          if (!d) return null;
          // leitura = TODOS os KPIs do bloco c/ hints (placar informativo + ancora os números reais
          // do bloco no dado consolidado, p/ a IA poder citá-los na síntese).
          const leitura = d.indicadores
            .map((i) => `${i.label} ${i.valor}${i.hint ? ` (${i.hint})` : ""}`)
            .join(" · ");
          return { nome, farol: d.farol, leitura };
        } catch {
          return null;
        }
      }),
    ),
  ]);
  const validos = blocos.filter(Boolean) as Array<{
    nome: string;
    farol: RelatorioFarol;
    leitura: string;
  }>;
  if (!validos.length && !vg) return null;

  // Farol geral = o PIOR entre os blocos avaliados (regra de farol do projeto).
  const farol = validos.reduce<RelatorioFarol>(
    (pior, b) => (ORD[b.farol] < ORD[pior] ? b.farol : pior),
    "conforme",
  );

  // Indicadores executivos = os KPIs hero da Visão Geral (desequilíbrio, faturamento, prazo, situação).
  const indicadores = vg?.indicadores ?? [];

  // Placar de TODOS os blocos: bloco × indicador-chave × farol.
  const detalhamento = validos.length
    ? {
        titulo: "Placar dos blocos do RMA",
        colunas: ["Bloco", "Leitura", "Farol"],
        linhas: validos.map((b) => [b.nome, b.leitura || "—", farolLabel[b.farol]]),
      }
    : null;

  return {
    titulo: "RMA — Visão Consolidada",
    farol,
    indicadores,
    grafico: vg?.grafico ?? null, // curva de faturamento como retrato financeiro central
    detalhamento,
  };
}
