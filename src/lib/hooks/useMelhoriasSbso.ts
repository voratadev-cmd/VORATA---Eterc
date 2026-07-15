import { useQuery } from "@tanstack/react-query";
import { getMelhoriasSbso } from "@/lib/supabase/melhoriasSbso";

/** C.15 Melhorias Documentais no dialeto SBSO. null → fluxo narrativo BR-101. */
export function useMelhoriasSbso(contractId: string) {
  return useQuery({
    queryKey: ["melhorias-sbso", contractId],
    queryFn: () => getMelhoriasSbso(contractId),
    staleTime: 30_000,
  });
}
