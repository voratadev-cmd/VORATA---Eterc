// Hook do drill-down Frente×Trecho (C.3) · lê obra_faturamento_frente_trecho.
import { useQuery } from "@tanstack/react-query";
import {
  getFaturamentoFrenteTrecho,
  type FaturamentoFrenteTrecho,
} from "@/lib/supabase/faturamentoFrenteTrecho";

export function useFaturamentoFrenteTrecho(contractId: string) {
  return useQuery<FaturamentoFrenteTrecho | null>({
    queryKey: ["faturamento-frente-trecho", contractId],
    queryFn: () => getFaturamentoFrenteTrecho(contractId),
    staleTime: 30_000,
  });
}
