// Hook do Faturamento por Frente (C.3) · lê obra_faturamento_frentes via getFaturamentoFrentes.
import { useQuery } from "@tanstack/react-query";
import { getFaturamentoFrentes, type FaturamentoFrentes } from "@/lib/supabase/faturamentoFrentes";

export function useFaturamentoFrentes(contractId: string) {
  return useQuery<FaturamentoFrentes | null>({
    queryKey: ["faturamento-frentes", contractId],
    queryFn: () => getFaturamentoFrentes(contractId),
    staleTime: 30_000,
  });
}
