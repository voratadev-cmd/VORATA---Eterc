import { useQuery } from "@tanstack/react-query";
import { getRecursosCardsQtde } from "@/lib/supabase/recursosCardsQtde";

/** Cards oficiais em QTD da C.4 (seção "Cards por categoria (quantidade)") — eixo dos cards SBSO. */
export function useRecursosCardsQtde(contractId: string) {
  return useQuery({
    queryKey: ["recursos-cards-qtde", contractId],
    queryFn: () => getRecursosCardsQtde(contractId),
    staleTime: 30_000,
  });
}
