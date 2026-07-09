// Hook de leitura do Orçamento normalizado (Camada C) · React Query.

import { useQuery } from "@tanstack/react-query";

import { getOrcamento } from "@/lib/supabase/orcamento";

/** Orçamento (resumo + BDI) de uma obra, a partir do dado normalizado. */
export function useOrcamento(contractId: string) {
  return useQuery({
    queryKey: ["orcamento", contractId],
    queryFn: () => getOrcamento(contractId),
    staleTime: 30_000,
  });
}
