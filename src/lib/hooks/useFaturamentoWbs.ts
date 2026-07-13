// Hook do drill WBS Disciplina × Frente (dialeto SBSO · auxiliar_C.3 com Nível/Folha).
import { useQuery } from "@tanstack/react-query";
import { type FaturamentoWbs, getFaturamentoWbs } from "@/lib/supabase/faturamentoWbs";

export function useFaturamentoWbs(contractId: string) {
  return useQuery<FaturamentoWbs | null>({
    queryKey: ["faturamento-wbs", contractId],
    queryFn: () => getFaturamentoWbs(contractId),
    staleTime: 30_000,
  });
}
