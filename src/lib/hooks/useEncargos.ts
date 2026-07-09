// Hook da tela D.3 Encargos Sociais — lê a composição de encargos (alíquota Proposta × Real) e os
// totais/desequilíbrio das seções obra_secoes D.3 via getEncargos.
import { useQuery } from "@tanstack/react-query";
import { type Encargos, getEncargos } from "@/lib/supabase/encargos";

export function useEncargos(contractId: string) {
  return useQuery<Encargos | null>({
    queryKey: ["encargos", contractId],
    queryFn: () => getEncargos(contractId),
    staleTime: 30_000,
  });
}
