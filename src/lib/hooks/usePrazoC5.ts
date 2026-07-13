// Hook do painel físico declarado da aba C.5 (dialeto SBSO) — painel + curva 4 linhas + disciplinas.
import { useQuery } from "@tanstack/react-query";
import { type PrazoC5, getPrazoC5 } from "@/lib/supabase/prazoC5";

export function usePrazoC5(contractId: string) {
  return useQuery<PrazoC5 | null>({
    queryKey: ["prazo-c5", contractId],
    queryFn: () => getPrazoC5(contractId),
    staleTime: 30_000,
  });
}
