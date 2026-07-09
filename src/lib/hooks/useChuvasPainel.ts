// Hook do Painel C.9 Chuvas (dias >5 mm proposta × real · "dias a cobrar") — lê as seções obra_secoes.
import { useQuery } from "@tanstack/react-query";
import { type ChuvasPainel, getChuvasPainel } from "@/lib/supabase/chuvasPainel";

export function useChuvasPainel(contractId: string) {
  return useQuery<ChuvasPainel | null>({
    queryKey: ["chuvas-painel", contractId],
    queryFn: () => getChuvasPainel(contractId),
    staleTime: 30_000,
  });
}
