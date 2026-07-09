// Hook do Faturamento por Frente nomeada + macro (C.3) · lê obra_faturamento_frente_macro.
import { useQuery } from "@tanstack/react-query";
import {
  getFaturamentoFrenteMacro,
  type FaturamentoFrenteMacro,
} from "@/lib/supabase/faturamentoFrenteMacro";

export function useFaturamentoFrenteMacro(contractId: string) {
  return useQuery<FaturamentoFrenteMacro | null>({
    queryKey: ["faturamento-frente-macro", contractId],
    queryFn: () => getFaturamentoFrenteMacro(contractId),
    staleTime: 30_000,
  });
}
