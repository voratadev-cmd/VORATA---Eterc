// Hook da série mensal das curvas (C.8 × C.3) · lê obra_curvas_serie_mes via read-model.
import { useQuery } from "@tanstack/react-query";
import { type CurvasSerie, getCurvasSerieMes } from "@/lib/supabase/curvasSerieMes";

export function useCurvasSerieMes(contractId: string) {
  return useQuery<CurvasSerie | null>({
    queryKey: ["curvas-serie-mes", contractId],
    queryFn: () => getCurvasSerieMes(contractId),
    staleTime: 30_000,
  });
}
