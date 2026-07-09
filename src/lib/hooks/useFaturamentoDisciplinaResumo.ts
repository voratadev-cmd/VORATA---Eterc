// Hook do Faturamento por Disciplina · resumo (C.3, com real + farol) · lê
// obra_faturamento_disciplina_resumo.
import { useQuery } from "@tanstack/react-query";
import {
  getFaturamentoDisciplinaResumo,
  type FaturamentoDisciplinaResumo,
} from "@/lib/supabase/faturamentoDisciplinaResumo";

export function useFaturamentoDisciplinaResumo(contractId: string) {
  return useQuery<FaturamentoDisciplinaResumo | null>({
    queryKey: ["faturamento-disciplina-resumo", contractId],
    queryFn: () => getFaturamentoDisciplinaResumo(contractId),
    staleTime: 30_000,
  });
}
