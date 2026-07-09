// Hook de leitura do take-off físico de insumos normalizado (Camada A) · React Query.

import { useQuery } from "@tanstack/react-query";

import { getInsumos } from "@/lib/supabase/insumos";

/** Take-off físico de insumos de uma obra (quantidades por insumo + por unidade). */
export function useInsumos(contractId: string) {
  return useQuery({
    queryKey: ["insumos", contractId],
    queryFn: () => getInsumos(contractId),
    staleTime: 30_000,
  });
}
