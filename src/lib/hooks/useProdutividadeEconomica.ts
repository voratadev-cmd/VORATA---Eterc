// Hook da Produtividade econômica (R$/HH · workbook-motor C.7) · direct-hook no read-model
// obra_produtividade_economica (estilo Recursos/Insumos · sem bridge). null = obra sem essa
// normalização (ex.: obra Sorriso com produtividade só física) → a aba cai no estado vazio.

import { useQuery } from "@tanstack/react-query";

import {
  getProdutividadeEconomica,
  type ProdutividadeEconomica,
} from "@/lib/supabase/produtividadeEconomica";

/** Produtividade econômica de uma obra (ou null se não normalizada). */
export function useProdutividadeEconomica(contractId: string) {
  return useQuery<ProdutividadeEconomica | null>({
    queryKey: ["produtividade-economica", contractId],
    queryFn: () => getProdutividadeEconomica(contractId),
    staleTime: 30_000,
  });
}
