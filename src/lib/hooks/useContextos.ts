// Hooks React Query pra leitura/mutação de obra_arquivo_contextos.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  advanceAllMappedToReadyExtraction,
  cancelMapping,
  listLatestContextosByObra,
  requestReMapping,
  resumeMapping,
  type ObraArquivoContexto,
} from "@/lib/supabase/contextos";
import { obraArquivosKey } from "./useObraArquivos";

export const contextosKey = (obraId: string) => ["obra_contextos", obraId] as const;

/**
 * Mapa { arquivo_id → último contexto } da obra.
 * Refetch a cada 5s enquanto houver arquivos em status mapping/raw (worker está trabalhando).
 */
export function useObraContextos(obraId: string, refetchActive = false) {
  return useQuery<Map<string, ObraArquivoContexto>, Error>({
    queryKey: contextosKey(obraId),
    queryFn: () => listLatestContextosByObra(obraId),
    enabled: Boolean(obraId),
    staleTime: 10_000,
    refetchInterval: refetchActive ? 15_000 : false, // fallback · Realtime é o primário
  });
}

/** Dispara re-mapping de um arquivo e invalida cache. */
export function useRequestReMapping(obraId: string) {
  const qc = useQueryClient();
  return useMutation<{ ok: true }, Error, string>({
    mutationFn: async (arquivoId) => {
      const r = await requestReMapping(arquivoId);
      if (!r.ok) throw new Error(r.error);
      return r;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: obraArquivosKey(obraId) });
      qc.invalidateQueries({ queryKey: contextosKey(obraId) });
    },
  });
}

/** Move todos os mapeados pra ready_to_extract. */
export function useAdvanceMappedToExtraction(obraId: string) {
  const qc = useQueryClient();
  return useMutation<{ affected: number }, Error, void>({
    mutationFn: async () => {
      const r = await advanceAllMappedToReadyExtraction(obraId);
      if (!r.ok) throw new Error(r.error);
      return { affected: r.affected };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: obraArquivosKey(obraId) });
      qc.invalidateQueries({ queryKey: contextosKey(obraId) });
    },
  });
}

/** Para o mapeamento · cancela os arquivos pendentes. */
export function useCancelMapping(obraId: string) {
  const qc = useQueryClient();
  return useMutation<{ affected: number }, Error, void>({
    mutationFn: async () => {
      const r = await cancelMapping(obraId);
      if (!r.ok) throw new Error(r.error);
      return { affected: r.affected };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: obraArquivosKey(obraId) });
      qc.invalidateQueries({ queryKey: contextosKey(obraId) });
    },
  });
}

/** Retoma o mapeamento · devolve cancelados pra fila. */
export function useResumeMapping(obraId: string) {
  const qc = useQueryClient();
  return useMutation<{ affected: number }, Error, void>({
    mutationFn: async () => {
      const r = await resumeMapping(obraId);
      if (!r.ok) throw new Error(r.error);
      return { affected: r.affected };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: obraArquivosKey(obraId) });
      qc.invalidateQueries({ queryKey: contextosKey(obraId) });
    },
  });
}
