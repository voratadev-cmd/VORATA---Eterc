// Hook da Tabela por Trecho (C.3 · captura genérica) · lê obra_secoes via getFaturamentoTrechos.
import { useQuery } from "@tanstack/react-query";
import { getFaturamentoTrechos, type FaturamentoTrechos } from "@/lib/supabase/faturamentoSecoes";

export function useFaturamentoTrechos(contractId: string) {
  return useQuery<FaturamentoTrechos | null>({
    queryKey: ["faturamento-trechos", contractId],
    queryFn: () => getFaturamentoTrechos(contractId),
    staleTime: 30_000,
  });
}
