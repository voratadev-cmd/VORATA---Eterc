// Hooks do painel de Normalização · contagens por tabela (RPC) + seções do workbook.
import { useQuery } from "@tanstack/react-query";
import {
  type ContagemTabela,
  type SecaoWorkbook,
  getNormalizacaoContagens,
  getObraSecoes,
} from "@/lib/supabase/normalizacao";

export function useNormalizacaoContagens(contractId: string) {
  return useQuery<ContagemTabela[]>({
    queryKey: ["normalizacao-contagens", contractId],
    queryFn: () => getNormalizacaoContagens(contractId),
    staleTime: 30_000,
  });
}

export function useObraSecoes(contractId: string) {
  return useQuery<SecaoWorkbook[]>({
    queryKey: ["obra-secoes", contractId],
    queryFn: () => getObraSecoes(contractId),
    staleTime: 30_000,
  });
}
