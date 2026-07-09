// Hook de leitura do CRONOGRAMA PREVISTO normalizado (Camada C) · React Query.

import { useQuery } from "@tanstack/react-query";

import { getCronogramaPrevisto } from "@/lib/supabase/cronograma";

/** Cronograma previsto físico de uma obra (curva de avanço) a partir do dado normalizado. */
export function useCronogramaPrevisto(contractId: string) {
  return useQuery({
    queryKey: ["cronograma-previsto", contractId],
    queryFn: () => getCronogramaPrevisto(contractId),
    staleTime: 30_000,
  });
}
