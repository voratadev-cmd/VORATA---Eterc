// Hook de leitura da Curva S financeira normalizada (Camada C) · React Query.

import { useQuery } from "@tanstack/react-query";

import { getFaturamentoCurva } from "@/lib/supabase/faturamentoCurva";

/** Curva S financeira (Contratado + Projeção) de uma obra, a partir do dado normalizado. */
export function useFaturamentoCurva(contractId: string) {
  return useQuery({
    queryKey: ["faturamento-curva", contractId],
    queryFn: () => getFaturamentoCurva(contractId),
    staleTime: 30_000,
  });
}
