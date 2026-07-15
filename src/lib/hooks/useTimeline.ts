// Hook da tela C.13 Timeline do Contrato (Gantt contratado × real) · agrega as 3 entidades
// normalizadas do workbook-motor (tarefas/eventos/params) + o nome da obra. Null quando a C.13
// ainda não foi normalizada (a tela cai em EmptyState). HONESTIDADE: o eixo real vem do banco —
// quando a obra está em pré-execução, as barras reais ficam vazias ("real a iniciar").

import { getPrazoC5 } from "@/lib/supabase/prazoC5";
import { useQuery } from "@tanstack/react-query";
import { getObraById } from "@/lib/supabase/obras";
import {
  getTarefasImpacto,
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
  /** painel físico da C.5 (cards do topo: impacto crítico/tendência/avanço). */
  painel: import("@/lib/supabase/prazoC5").PrazoC5Painel | null;
  /** prazo contratual declarado (540 na SBSO · premissas oficiais da obra). */
  prazoDias: number | null;
};

export function useTimeline(contractId: string) {
  return useQuery<TimelineView | null>({
    queryKey: ["timeline-c13", contractId],
    staleTime: 30_000,
    queryFn: async () => {
      const [tarefasCrono, eventos, params, projecao, obra, tarefasImpacto, c5] = await Promise.all(
        [
          getTimelineTarefas(contractId),
          getEventosPrazo(contractId),
          getTimelineParams(contractId),
          getTimelineProjecao(contractId),
          getObraById(contractId),
          getTarefasImpacto(contractId),
          getPrazoC5(contractId),
        ],
      );
      // Dialeto SBSO (spec C.13): o Gantt lê SOMENTE a tabela de impacto por disciplina;
      // sem ela (BR-101) → cronograma FF como sempre. Nunca combina as duas.
      const tarefas = tarefasImpacto ?? tarefasCrono;
      if (!tarefas) return null; // sem Gantt normalizado → tela mostra EmptyState
      // Windows (spec): lê SOMENTE o "PAINEL DE PRAZO FÍSICO" + a premissa declarada da obra.
      let paramsFinal = params;
      const pn = c5?.painel;
      if (pn) {
        const r = pn.resumo;
        const premissas = (
          obra as { premissas?: { caminho_critico?: string; fonte?: string } } | null
        )?.premissas;
        const obs: string[] = [];
        if (premissas?.caminho_critico && premissas.fonte)
          obs.push(`Caminho crítico: ${premissas.fonte}.`);
        if (r)
          obs.push(
            `Marcos: ${r.atrasados} atrasados · ${r.emRisco} em risco · ${r.noPrazo} no prazo` +
              (r.cumpridos ? ` · ${r.cumpridos} cumpridos` : "") +
              " (definição de 'marcos em risco' em validação com o idealizador).",
          );
        paramsFinal = {
          ...(params ?? {
            osReal: null,
            osOriginal: null,
            terminoContratual: null,
            inicioExecucao: null,
            terminoPrevisto: null,
            totalEventos: null,
            eventosClimaticos: null,
            marcosEmRisco: null,
            marcosCumpridos: null,
            marcosTotal: null,
            criticosImpactoFisico: null,
            caminhoCriticoDias: null,
            mesCorteIndice: null,
            avancoFisicoPrevistoPp: null,
            deltaImpactoFisicoPp: null,
            windowsObs: null,
            status: "ok",
            avancoFisicoRealPp: null,
            caminhoCritico: null,
          }),
          mesCorteIndice: pn.bmCorrente ?? params?.mesCorteIndice ?? null,
          avancoFisicoPrevistoPp: pn.fisicoPrevistoPct,
          avancoFisicoRealPp: pn.fisicoRealPct,
          deltaImpactoFisicoPp: pn.atrasoAcumPp != null ? -pn.atrasoAcumPp : null,
          marcosEmRisco: r ? r.atrasados + r.emRisco : (params?.marcosEmRisco ?? null),
          marcosTotal: r
            ? r.atrasados + r.emRisco + r.noPrazo + r.cumpridos
            : (params?.marcosTotal ?? null),
          caminhoCritico: premissas?.caminho_critico ?? null,
          windowsObs: obs.length ? obs.join(" ") : (params?.windowsObs ?? null),
        };
      }
      const prazoDias =
        (obra as { premissas?: { datas_oficiais?: { prazo_dias?: number } } } | null)?.premissas
          ?.datas_oficiais?.prazo_dias ?? null;
      return {
        nome: obra?.nome_interno ?? null,
        tarefas,
        eventos: eventos ?? [],
        params: paramsFinal ?? null,
        projecao: projecao ?? [],
        painel: c5?.painel ?? null,
        prazoDias,
      };
    },
  });
}
