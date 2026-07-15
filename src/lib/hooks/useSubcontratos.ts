import { useQuery } from "@tanstack/react-query";
import { getSubcontratos } from "@/lib/supabase/subcontratos";

/** Central de Subcontratos (tela nova · abaixo do RMA). null → obra sem as seções S. */
export function useSubcontratos(contractId: string) {
  return useQuery({
    queryKey: ["subcontratos", contractId],
    queryFn: () => getSubcontratos(contractId),
    staleTime: 30_000,
  });
}
