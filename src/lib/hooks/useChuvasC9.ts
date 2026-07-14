// Hook da C.9 no dialeto SBSO (chuva mensal mm × histórico INMET × RDO).
import { useQuery } from "@tanstack/react-query";
import { type ChuvasC9, getChuvasC9 } from "@/lib/supabase/chuvasC9";

export function useChuvasC9(contractId: string) {
  return useQuery<ChuvasC9 | null>({
    queryKey: ["chuvas-c9", contractId],
    queryFn: () => getChuvasC9(contractId),
    staleTime: 30_000,
  });
}
