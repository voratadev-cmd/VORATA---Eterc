import { useQuery } from "@tanstack/react-query";
import { getInsumosSbso } from "@/lib/supabase/insumosSbso";

/** C.6 Insumos no regime SBSO (cl. 7 · INCC-DI). null → obra segue no fluxo ATERPA. */
export function useInsumosSbso(contractId: string) {
  return useQuery({
    queryKey: ["insumos-sbso", contractId],
    queryFn: () => getInsumosSbso(contractId),
    staleTime: 30_000,
  });
}
