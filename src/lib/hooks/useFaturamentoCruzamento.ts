// Hook do cruzamento Frente × Disciplina (C.3 · filhos do drill) — lê auxiliar_C.3 via read-model.
import { useQuery } from "@tanstack/react-query";
import {
  type FaturamentoCruzamento,
  getFaturamentoCruzamento,
} from "@/lib/supabase/faturamentoCruzamento";

export function useFaturamentoCruzamento(contractId: string) {
  return useQuery<FaturamentoCruzamento | null>({
    queryKey: ["faturamento-cruzamento", contractId],
    queryFn: () => getFaturamentoCruzamento(contractId),
    staleTime: 30_000,
  });
}
