// Hook do excedente ao IPCA (D.5 · cl. 8.8) · lê obra_insumo_excedente(+_params) via read-model.
import { useQuery } from "@tanstack/react-query";
import { type ExcedenteResumo, getInsumoExcedente } from "@/lib/supabase/insumoExcedente";

export function useInsumoExcedente(contractId: string) {
  return useQuery<ExcedenteResumo | null>({
    queryKey: ["insumo-excedente", contractId],
    queryFn: () => getInsumoExcedente(contractId),
    staleTime: 30_000,
  });
}
