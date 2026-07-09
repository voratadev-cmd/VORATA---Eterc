// Hook da tela-mãe D.0 Painel de Desequilíbrio — composição/total + resumo, cenários, Quitação
// Trimestral, memo de insumos e leitura IA. Só leitura. null = M3 não normalizado (empty state).
import { useQuery } from "@tanstack/react-query";
import {
  type DesequilibrioPainel,
  getDesequilibrioPainel,
} from "@/lib/supabase/desequilibrioPainel";

export function useDesequilibrioPainel(contractId: string) {
  return useQuery<DesequilibrioPainel | null>({
    queryKey: ["desequilibrio-painel", contractId],
    queryFn: () => getDesequilibrioPainel(contractId),
    staleTime: 30_000,
  });
}
