import { useQuery } from "@tanstack/react-query";
import { getPrazoMarcos, type PrazoMarco } from "@/lib/supabase/prazoMarcos";

export function usePrazoMarcos(contractId: string) {
  return useQuery<PrazoMarco[]>({
    queryKey: ["prazo-marcos", contractId],
    queryFn: () => getPrazoMarcos(contractId),
    staleTime: 30_000,
  });
}
