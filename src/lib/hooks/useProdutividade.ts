// Hook da tela C.7 Produtividade (refactor) · combina o dado REAL normalizado:
//   - getProdutividadeEconomica (série mensal R$/HH · faturado/HH/aderência)
//   - getProdutividadeParams (cards + benchmarks + META REAL + ponte)
//   - getProdutividadeFisica (tracker serviço×trecho) + Detalhe (cálculo por equip) + Impedimentos
// Null quando o C.7 não foi normalizado. A meta/benchmark/câmbio vêm do dado (não mais do config).

import { useQuery } from "@tanstack/react-query";
import { getObraById } from "@/lib/supabase/obras";
import {
  type ProdutividadeEconomica,
  getProdutividadeEconomica,
} from "@/lib/supabase/produtividadeEconomica";
import {
  type ProdFisica,
  type ProdFisicaDetalhe,
  type ProdImpedimento,
  type ProdParams,
  getProdutividadeDetalhe,
  getProdutividadeFisica,
  getProdutividadeImpedimentos,
  getProdutividadeParams,
} from "@/lib/supabase/produtividadeFisica";

export type ProdutividadeView = {
  nome: string | null;
  serie: ProdutividadeEconomica | null;
  params: ProdParams | null;
  fisica: ProdFisica[];
  detalhe: ProdFisicaDetalhe[];
  impedimentos: ProdImpedimento[];
};

export function useProdutividade(contractId: string) {
  return useQuery<ProdutividadeView | null>({
    queryKey: ["produtividade-c7", contractId],
    staleTime: 30_000,
    queryFn: async () => {
      const [serie, params, fisica, detalhe, impedimentos, obra] = await Promise.all([
        getProdutividadeEconomica(contractId),
        getProdutividadeParams(contractId),
        getProdutividadeFisica(contractId),
        getProdutividadeDetalhe(contractId),
        getProdutividadeImpedimentos(contractId),
        getObraById(contractId),
      ]);
      if (!serie && !params) return null;
      return {
        nome: obra?.nome_interno ?? null,
        serie,
        params,
        fisica: fisica ?? [],
        detalhe: detalhe ?? [],
        impedimentos: impedimentos ?? [],
      };
    },
  });
}
