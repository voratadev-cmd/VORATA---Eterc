// Hook da tela C.13 Timeline do Contrato (Gantt contratado × real) · agrega as 3 entidades
// normalizadas do workbook-motor (tarefas/eventos/params) + o nome da obra. Null quando a C.13
// ainda não foi normalizada (a tela cai em EmptyState). HONESTIDADE: o eixo real vem do banco —
// quando a obra está em pré-execução, as barras reais ficam vazias ("real a iniciar").

import { useQuery } from "@tanstack/react-query";
import { getObraById } from "@/lib/supabase/obras";
import {
  type TimelineEvento,
  type TimelineParams,
  type TimelineProjecao,
  type TimelineTarefa,
  getEventosPrazo,
  getTimelineParams,
  getTimelineProjecao,
  getTimelineTarefas,
} from "@/lib/supabase/timeline";

export type TimelineView = {
  nome: string | null;
  tarefas: TimelineTarefa[];
  eventos: TimelineEvento[];
  params: TimelineParams | null;
  projecao: TimelineProjecao[];
};

export function useTimeline(contractId: string) {
  return useQuery<TimelineView | null>({
    queryKey: ["timeline-c13", contractId],
    staleTime: 30_000,
    queryFn: async () => {
      const [tarefas, eventos, params, projecao, obra] = await Promise.all([
        getTimelineTarefas(contractId),
        getEventosPrazo(contractId),
        getTimelineParams(contractId),
        getTimelineProjecao(contractId),
        getObraById(contractId),
      ]);
      if (!tarefas) return null; // sem Gantt normalizado → tela mostra EmptyState
      return {
        nome: obra?.nome_interno ?? null,
        tarefas,
        eventos: eventos ?? [],
        params: params ?? null,
        projecao: projecao ?? [],
      };
    },
  });
}
