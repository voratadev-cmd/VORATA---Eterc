// Hook da série mensal por disciplina/frente (C.3) · lê obra_faturamento_serie_mes (select da Curva S).
import { useQuery } from "@tanstack/react-query";
import {
  getFaturamentoSerieMes,
  type FaturamentoSerieMes,
} from "@/lib/supabase/faturamentoSerieMes";

export function useFaturamentoSerieMes(contractId: string) {
  return useQuery<FaturamentoSerieMes | null>({
    queryKey: ["faturamento-serie-mes", contractId],
    queryFn: () => getFaturamentoSerieMes(contractId),
    staleTime: 30_000,
  });
}
