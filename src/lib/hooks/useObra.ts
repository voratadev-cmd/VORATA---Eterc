// Hook do shell do RMA · lê a obra real (nome, contratante…) do banco. undefined enquanto
// carrega; null se a obra não existe. Usado pelo layout do RMA para não depender do mock.

import { useQuery } from "@tanstack/react-query";

import { getObraById, type Obra } from "@/lib/supabase/obras";

/** Metadados reais de uma obra (ou null se não existe). */
export function useObra(contractId: string) {
  return useQuery<Obra | null>({
    queryKey: ["obra", contractId],
    queryFn: () => getObraById(contractId),
    staleTime: 60_000,
  });
}
