// Hook do Plano de Ação (C.12) — lê as seções C.12 da captura genérica (obra_secoes).
import { useQuery } from "@tanstack/react-query";
import { getPlanoAcao, type PlanoAcao } from "@/lib/supabase/planoAcao";

export function usePlanoAcao(contractId: string) {
  return useQuery<PlanoAcao | null>({
    queryKey: ["plano-acao", contractId],
    queryFn: () => getPlanoAcao(contractId),
    staleTime: 30_000,
  });
}
