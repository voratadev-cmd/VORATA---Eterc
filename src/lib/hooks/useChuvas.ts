// Hook direto do C.9 Chuvas · lê obra_chuvas + obra_chuvas_meses via getChuvas.
import { useQuery } from "@tanstack/react-query";
import { getChuvas, type Chuvas } from "@/lib/supabase/chuvas";

export function useChuvas(contractId: string) {
  return useQuery<Chuvas | null>({
    queryKey: ["chuvas", contractId],
    queryFn: () => getChuvas(contractId),
    staleTime: 30_000,
  });
}
