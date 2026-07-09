// Hook da Síntese do Contrato (C.1 · entry point) — lê os painéis C.1 da captura genérica (obra_secoes).
import { useQuery } from "@tanstack/react-query";
import { getSinteseContrato, type SinteseContrato } from "@/lib/supabase/sinteseContrato";

export function useSinteseContrato(contractId: string) {
  return useQuery<SinteseContrato | null>({
    queryKey: ["sintese-contrato", contractId],
    queryFn: () => getSinteseContrato(contractId),
    staleTime: 30_000,
  });
}
