// Hook das condutas sugeridas (C.11 · obra_condutas).
import { useQuery } from "@tanstack/react-query";
import { type Conduta, getCondutas } from "@/lib/supabase/condutas";

export function useCondutas(contractId: string) {
  return useQuery<Conduta[]>({
    queryKey: ["condutas", contractId],
    queryFn: () => getCondutas(contractId),
    staleTime: 30_000,
  });
}
