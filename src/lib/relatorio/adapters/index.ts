// Registry de adapters por aba do RMA. Cada adapter coleta os DADOS reais (read-models) daquela aba
// no formato RelatorioDados, com PARIDADE com a tela. O onGerar usa coletarDados(aba) → POST
// /relatorios/gerar. Aba sem dado real → adapter devolve null → empty state honesto.

import type { RelatorioDados } from "@/lib/relatorio/schema";
import { dadosChuvas } from "./chuvas";
import { dadosCondutas } from "./condutas";
import { dadosCurvas } from "./curvas";
import { dadosFaturamento } from "./faturamento";
import { dadosIndicadores } from "./indicadores";
import { dadosInsumos } from "./insumos";
import { dadosPanorama } from "./panorama";
import { dadosPlanoAcao } from "./plano-acao";
import { dadosPrazo } from "./prazo";
import { dadosProdutividade } from "./produtividade";
import { dadosRecursos } from "./recursos";
import { dadosResponsabilidade } from "./responsabilidade";
import { dadosRmaGeral } from "./rma-geral";
import { dadosVisaoGeral } from "./visao-geral";

export const ADAPTERS: Record<string, (contractId: string) => Promise<RelatorioDados | null>> = {
  "rma-geral": dadosRmaGeral,
  "visao-geral": dadosVisaoGeral,
  indicadores: dadosIndicadores,
  faturamento: dadosFaturamento,
  recursos: dadosRecursos,
  produtividade: dadosProdutividade,
  prazo: dadosPrazo,
  insumos: dadosInsumos,
  curvas: dadosCurvas,
  chuvas: dadosChuvas,
  panorama: dadosPanorama,
  "plano-acao": dadosPlanoAcao,
  responsabilidade: dadosResponsabilidade,
  condutas: dadosCondutas,
};

/** Coleta os dados da aba para o relatório (null se a aba não tem adapter ou não tem dado real). */
export async function coletarDados(
  aba: string,
  contractId: string,
): Promise<RelatorioDados | null> {
  const fn = ADAPTERS[aba];
  return fn ? fn(contractId) : null;
}
