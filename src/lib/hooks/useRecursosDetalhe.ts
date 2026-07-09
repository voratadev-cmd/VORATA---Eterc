// Hook do detalhamento por função/equipamento dos Recursos (C.4) — lê as abas-detalhe via read-model.
import { useQuery } from "@tanstack/react-query";
import { type RecursosDetalhe, getRecursosDetalhe } from "@/lib/supabase/recursosDetalhe";

export function useRecursosDetalhe(contractId: string) {
  return useQuery<RecursosDetalhe | null>({
    queryKey: ["recursos-detalhe", contractId],
    queryFn: () => getRecursosDetalhe(contractId),
    staleTime: 30_000,
  });
}
