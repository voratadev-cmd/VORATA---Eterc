// Hook direto do D.1 Indiretos (M3) · lê obra_indiretos_base + _metodos via getIndiretos.
import { useQuery } from "@tanstack/react-query";
import { getIndiretos, type Indiretos } from "@/lib/supabase/indiretos";

export function useIndiretos(contractId: string) {
  return useQuery<Indiretos | null>({
    queryKey: ["indiretos", contractId],
    queryFn: () => getIndiretos(contractId),
    staleTime: 30_000,
  });
}
