// Hook do relatório de IA de uma aba (obra_relatorios via getRelatorio). null = ainda não gerado.
import { useQuery } from "@tanstack/react-query";
import { getRelatorio } from "@/lib/supabase/relatorios";
import type { RelatorioAba } from "@/lib/relatorio/schema";

export function useRelatorio(contractId: string, aba: string) {
  return useQuery<RelatorioAba | null>({
    queryKey: ["relatorio", contractId, aba],
    queryFn: () => getRelatorio(contractId, aba),
    staleTime: 30_000,
  });
}
