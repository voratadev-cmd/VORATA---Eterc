// Hook do modelo único C.6/D.5 Insumos v53 (30 insumos FD × fontes + reequilíbrio + IPCA) · React Query.

import { useQuery } from "@tanstack/react-query";

import { getInsumosFd } from "@/lib/supabase/insumosFd";

/** Insumos de faturamento direto (v53) — backend compartilhado das telas C.6 e D.5. */
export function useInsumosFd(contractId: string) {
  return useQuery({
    queryKey: ["insumos-fd", contractId],
    queryFn: () => getInsumosFd(contractId),
    staleTime: 30_000,
  });
}
