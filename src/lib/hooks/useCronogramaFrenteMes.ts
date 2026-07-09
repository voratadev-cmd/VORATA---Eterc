// Hook da matriz física por frente (C.5) · lê obra_cronograma_frente_mes via read-model.
import { useQuery } from "@tanstack/react-query";
import {
  type CronogramaFrenteMes,
  getCronogramaFrenteMes,
} from "@/lib/supabase/cronogramaFrenteMes";

export function useCronogramaFrenteMes(contractId: string) {
  return useQuery<CronogramaFrenteMes | null>({
    queryKey: ["cronograma-frente-mes", contractId],
    queryFn: () => getCronogramaFrenteMes(contractId),
    staleTime: 30_000,
  });
}
