// Hooks React Query pra leitura da tabela `obra_arquivos`. Mutations de
// upload/save acontecem direto no submit (não cabe wrappar em useMutation
// porque envolve upload de Storage + INSERT no DB encadeados).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  dismissNameSuggestion,
  listObraArquivos,
  renameObraArquivo,
  type ObraArquivo,
} from "@/lib/supabase/obraArquivos";

export const obraArquivosKey = (obraId: string) => ["obra_arquivos", obraId] as const;

export type UseObraArquivosOptions = {
  enabled?: boolean;
  /** Quando true, polling automático a cada 4s ENQUANTO houver arquivos
   *  com status `raw|queued|mapping|extracting` (worker está trabalhando).
   *  Para sozinho quando todos os arquivos chegam num estado terminal. */
  autoPoll?: boolean;
};

const ACTIVE_STATUSES = new Set(["raw", "queued", "mapping", "extracting", "processing"]);

export function useObraArquivos(obraId: string, options: UseObraArquivosOptions = {}) {
  const { enabled = true, autoPoll = false } = options;
  return useQuery<ObraArquivo[], Error>({
    queryKey: obraArquivosKey(obraId),
    queryFn: () => listObraArquivos(obraId),
    enabled: enabled && Boolean(obraId),
    staleTime: 10_000,
    // Fallback de polling (12s) · o Realtime (useObraRealtime) é o sinal primário;
    // isto cobre desconexão do Realtime e o progresso intra-doc. Para sozinho
    // quando nenhum arquivo está em estado ativo.
    refetchInterval: autoPoll
      ? (query) => {
          const data = query.state.data;
          if (!data || data.length === 0) return false;
          const hasActive = data.some((a) => ACTIVE_STATUSES.has(a.status));
          return hasActive ? 12_000 : false;
        }
      : false,
    // refetchOnWindowFocus default true · garante atualização ao voltar pra aba.
  });
}

/** Invalida cache dos arquivos de uma obra · útil após inserts/deletes manuais. */
export function useInvalidateObraArquivos() {
  const qc = useQueryClient();
  return (obraId: string) => qc.invalidateQueries({ queryKey: obraArquivosKey(obraId) });
}

/** Renomeia (apelido) um arquivo · grava metadata.display_name e invalida o cache. */
export function useRenameObraArquivo(obraId: string) {
  const qc = useQueryClient();
  return useMutation<
    { ok: true },
    Error,
    { arquivoId: string; displayName: string; metadata: Record<string, unknown> | null }
  >({
    mutationFn: async ({ arquivoId, displayName, metadata }) => {
      const r = await renameObraArquivo(arquivoId, displayName, metadata);
      if (!r.ok) throw new Error(r.error);
      return r;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: obraArquivosKey(obraId) }),
  });
}

/** Dispensa a sugestão de nome do mapeador (grava na metadata) e invalida o cache. */
export function useDismissNameSuggestion(obraId: string) {
  const qc = useQueryClient();
  return useMutation<
    { ok: true },
    Error,
    { arquivoId: string; suggestion: string; metadata: Record<string, unknown> | null }
  >({
    mutationFn: async ({ arquivoId, suggestion, metadata }) => {
      const r = await dismissNameSuggestion(arquivoId, suggestion, metadata);
      if (!r.ok) throw new Error(r.error);
      return r;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: obraArquivosKey(obraId) }),
  });
}
