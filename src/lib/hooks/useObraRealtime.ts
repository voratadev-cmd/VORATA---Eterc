// Supabase Realtime do pipeline · assina mudanças em `obra_arquivos` da obra e
// invalida os caches (arquivos/contextos/extrações/runs) NA HORA. Substitui o
// polling agressivo (4s) — que vira só um fallback de intervalo longo.
//
// Por que só obra_arquivos: a tabela tem `obra_id` (dá pra filtrar por obra) e o
// pipeline atualiza o `status` dela em CADA transição (mapping→mapped, ready→
// extracting→extracted…). Os contextos/extrações são gravados logo antes do
// status mudar, então invalidar no evento de status já traz o estado fresco —
// sem precisar de obra_id nas tabelas-filhas. Degrada seguro: se o Realtime não
// estiver disponível, o fallback de polling cobre.

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import { obraArquivosKey } from "./useObraArquivos";
import { contextosKey } from "./useContextos";
import { extracoesKey, agentRunsKey } from "./useObraExtracoes";

export function useObraRealtime(obraId: string, enabled = true): void {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled || !obraId) return;
    let supabase: ReturnType<typeof getSupabase>;
    try {
      supabase = getSupabase();
    } catch {
      return; // Storage/Realtime não configurado em dev → o polling assume.
    }

    const invalidate = () => {
      qc.invalidateQueries({ queryKey: obraArquivosKey(obraId) });
      qc.invalidateQueries({ queryKey: contextosKey(obraId) });
      qc.invalidateQueries({ queryKey: extracoesKey(obraId) });
      qc.invalidateQueries({ queryKey: agentRunsKey(obraId) });
    };

    const channel = supabase
      .channel(`obra-pipeline-${obraId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "obra_arquivos", filter: `obra_id=eq.${obraId}` },
        invalidate,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [obraId, enabled, qc]);
}
