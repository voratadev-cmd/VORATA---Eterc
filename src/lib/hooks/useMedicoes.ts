// Hooks de leitura do dado NORMALIZADO (Camada C) · React Query sobre o read-model.

import { useQuery } from "@tanstack/react-query";

import { getFaturamentoReal, getMedicaoItens, listMedicoesByObra } from "@/lib/supabase/medicoes";

/** Faturamento REAL de uma obra (curva S + KPIs) a partir do dado normalizado no banco. */
export function useFaturamentoReal(contractId: string) {
  return useQuery({
    queryKey: ["faturamento-real", contractId],
    queryFn: () => getFaturamentoReal(contractId),
    staleTime: 30_000,
  });
}

/** Medições normalizadas de uma obra (fila de acompanhamento). */
export function useMedicoesByObra(contractId: string) {
  return useQuery({
    queryKey: ["medicoes-obra", contractId],
    queryFn: () => listMedicoesByObra(contractId),
    staleTime: 30_000,
  });
}

/** Itens canônicos de uma medição (o detalhe). Só busca quando há `medicaoId`. */
export function useMedicaoItens(medicaoId: string | null) {
  return useQuery({
    queryKey: ["medicao-itens", medicaoId],
    queryFn: () => getMedicaoItens(medicaoId as string),
    enabled: !!medicaoId,
    staleTime: 30_000,
  });
}
