import { useQuery } from "@tanstack/react-query";
import { getRecursos } from "@/lib/supabase/recursos";

/** Plano de recursos (MOD/MOI/EQP) de uma obra: contratado por função + histograma mensal. */
export function useRecursos(contractId: string) {
  return useQuery({
    queryKey: ["recursos", contractId],
    queryFn: () => getRecursos(contractId),
    staleTime: 30_000,
  });
}
