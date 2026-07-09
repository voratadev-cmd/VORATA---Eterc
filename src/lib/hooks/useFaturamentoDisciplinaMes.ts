// Hook da matriz disciplina×mês (C.3) · lê obra_faturamento_disciplina_mes via read-model.
import { useQuery } from "@tanstack/react-query";
import {
  type FaturamentoDisciplinaMes,
  getFaturamentoDisciplinaMes,
} from "@/lib/supabase/faturamentoDisciplinaMes";

export function useFaturamentoDisciplinaMes(contractId: string) {
  return useQuery<FaturamentoDisciplinaMes | null>({
    queryKey: ["faturamento-disciplina-mes", contractId],
    queryFn: () => getFaturamentoDisciplinaMes(contractId),
    staleTime: 30_000,
  });
}
