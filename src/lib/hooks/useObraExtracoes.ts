// Hooks React Query pra leitura de obra_arquivo_extracoes + agent_runs.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveExtraction,
  listAgentRunsByObra,
  listLatestExtracoesByObra,
  requestReExtraction,
  requestReExtractionBatch,
  requestReNormalization,
  type AgentRun,
  type ObraArquivoExtracao,
} from "@/lib/supabase/extracoes";
import { obraArquivosKey } from "./useObraArquivos";

export const extracoesKey = (obraId: string) => ["obra_extracoes", obraId] as const;
export const agentRunsKey = (obraId: string) => ["obra_agent_runs", obraId] as const;

/**
 * Mapa { arquivo_id → última extração } da obra.
 * Refetch a cada 4s quando `refetchActive` (worker extraindo) — feedback ao vivo.
 */
export function useObraExtracoes(obraId: string, refetchActive = false) {
  return useQuery<Map<string, ObraArquivoExtracao>, Error>({
    queryKey: extracoesKey(obraId),
    queryFn: () => listLatestExtracoesByObra(obraId),
    enabled: Boolean(obraId),
    staleTime: 8_000,
    refetchInterval: refetchActive ? 15_000 : false, // fallback · Realtime é o primário
  });
}

/** Mapa { arquivo_id → runs[] } da obra (observabilidade). */
export function useObraAgentRuns(obraId: string, refetchActive = false) {
  return useQuery<Map<string, AgentRun[]>, Error>({
    queryKey: agentRunsKey(obraId),
    queryFn: () => listAgentRunsByObra(obraId),
    enabled: Boolean(obraId),
    staleTime: 8_000,
    refetchInterval: refetchActive ? 15_000 : false, // fallback · Realtime é o primário
  });
}

/** Re-dispara a extração de um arquivo e invalida o cache. */
export function useRequestReExtraction(obraId: string) {
  const qc = useQueryClient();
  return useMutation<{ ok: true }, Error, string>({
    mutationFn: async (arquivoId) => {
      const r = await requestReExtraction(arquivoId);
      if (!r.ok) throw new Error(r.error);
      return r;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: obraArquivosKey(obraId) });
      qc.invalidateQueries({ queryKey: extracoesKey(obraId) });
    },
  });
}

/** Re-extração em LOTE (ex.: só os `needs_review`). Recebe a lista de IDs; retorna a contagem. */
export function useRequestReExtractionBatch(obraId: string) {
  const qc = useQueryClient();
  return useMutation<number, Error, string[]>({
    mutationFn: async (arquivoIds) => {
      const r = await requestReExtractionBatch(arquivoIds);
      if (!r.ok) throw new Error(r.error);
      return r.affected;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: obraArquivosKey(obraId) });
      qc.invalidateQueries({ queryKey: extracoesKey(obraId) });
    },
  });
}

/** Aprovação humana: needs_review → extracted (a normalização pega na sequência). */
export function useApproveExtraction(obraId: string) {
  const qc = useQueryClient();
  return useMutation<{ ok: true }, Error, string>({
    mutationFn: async (arquivoId) => {
      const r = await approveExtraction(arquivoId);
      if (!r.ok) throw new Error(r.error);
      return r;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: obraArquivosKey(obraId) });
      qc.invalidateQueries({ queryKey: extracoesKey(obraId) });
    },
  });
}

/** Re-normalização: normalized → extracted (motor novo re-roda; upserts substituem limpo). */
export function useRequestReNormalization(obraId: string) {
  const qc = useQueryClient();
  return useMutation<{ ok: true }, Error, string>({
    mutationFn: async (arquivoId) => {
      const r = await requestReNormalization(arquivoId);
      if (!r.ok) throw new Error(r.error);
      return r;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: obraArquivosKey(obraId) });
      qc.invalidateQueries({ queryKey: extracoesKey(obraId) });
    },
  });
}
