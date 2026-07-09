// Read-model da Normalização (Camada C) · C.13 Timeline do Contrato (Gantt contratado × real).
// Lê 3 entidades normalizadas do workbook-motor:
//  - obra_cronograma_tarefas → tarefas do MS Project (contratado + real + nível/grupo p/ a árvore)
//  - obra_eventos_prazo       → eventos datados que impactam o prazo
//  - obra_timeline_params     → header/cards/Windows Analysis (1 linha)
// Só leitura (anon SELECT liberado na migration 20260618000001). Null quando não normalizado.

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

/** Tarefa do Gantt. `nivel`: 0 = grupo/trecho (nó pai) · 1 = disciplina/folha. O eixo REAL
 *  (datas reais, %, desvio) vem null enquanto a obra está em pré-execução. */
export type TimelineTarefa = {
  ordem: number;
  numeroItem: string | null;
  codigo: string | null;
  nivel: number;
  nome: string;
  duracaoDias: number | null;
  dataInicio: string | null;
  dataTermino: string | null;
  dataInicioReal: string | null;
  dataTerminoReal: string | null;
  desvioDias: number | null;
  pctConcluido: number | null;
  ehMarco: boolean;
};

export type TimelineEvento = {
  ordem: number;
  evId: string | null;
  titulo: string;
  categoria: string | null;
  dataInicio: string | null;
  dataFim: string | null;
  frenteTrecho: string | null;
  critico: boolean | null;
  clausulas: string | null;
  statusAnalise: string | null;
  crossMatriz: string | null;
  impacta: boolean | null;
  /** Dias de atraso atribuídos ao evento (v46). null = sem atraso medido. */
  diasAtraso: number | null;
  /** Origem documental (ex.: "RDO 14/05 (ATERPA)"). */
  fonte: string | null;
  janelaInicio: string | null;
  janelaFim: string | null;
};

export type TimelineParams = {
  osReal: string | null;
  osOriginal: string | null;
  terminoContratual: string | null;
  inicioExecucao: string | null;
  terminoPrevisto: string | null;
  totalEventos: number | null;
  eventosClimaticos: number | null;
  marcosEmRisco: number | null;
  marcosCumpridos: number | null;
  marcosTotal: number | null;
  criticosImpactoFisico: number | null;
  caminhoCriticoDias: number | null;
  mesCorteIndice: number | null;
  avancoFisicoPrevistoPp: number | null;
  deltaImpactoFisicoPp: number | null;
  windowsObs: string | null;
  status: string;
};

/** Tarefas do Gantt C.13 (ordenadas). Null se ainda não normalizado. */
export async function getTimelineTarefas(contractId: string): Promise<TimelineTarefa[] | null> {
  const { data, error } = await untypedTable("obra_cronograma_tarefas")
    .select(
      "ordem, numero_item, codigo, nivel, nome, duracao_dias, data_inicio, data_termino, data_inicio_real, data_termino_real, desvio_dias, pct_concluido, eh_marco",
    )
    .eq("contrato_id", contractId)
    .order("ordem", { ascending: true });
  if (error) throw error;
  if (!data || data.length === 0) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((r: any) => ({
    ordem: r.ordem,
    numeroItem: r.numero_item ?? null,
    codigo: r.codigo ?? null,
    nivel: r.nivel ?? 1,
    nome: r.nome,
    duracaoDias: r.duracao_dias ?? null,
    dataInicio: r.data_inicio ?? null,
    dataTermino: r.data_termino ?? null,
    dataInicioReal: r.data_inicio_real ?? null,
    dataTerminoReal: r.data_termino_real ?? null,
    desvioDias: r.desvio_dias ?? null,
    pctConcluido: r.pct_concluido ?? null,
    ehMarco: !!r.eh_marco,
  }));
}

/** Eventos de prazo C.13 (ordenados). Null se ausente. */
export async function getEventosPrazo(contractId: string): Promise<TimelineEvento[] | null> {
  const { data, error } = await untypedTable("obra_eventos_prazo")
    .select(
      "ordem, ev_id, titulo, categoria, data_inicio, data_fim, frente_trecho, critico, clausulas, status_analise, cross_matriz, impacta, dias_atraso, fonte, janela_inicio, janela_fim",
    )
    .eq("contrato_id", contractId)
    .order("data_inicio", { ascending: true, nullsFirst: false });
  if (error) throw error;
  if (!data || data.length === 0) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((r: any) => ({
    ordem: r.ordem,
    evId: r.ev_id ?? null,
    titulo: r.titulo,
    categoria: r.categoria ?? null,
    dataInicio: r.data_inicio ?? null,
    dataFim: r.data_fim ?? null,
    frenteTrecho: r.frente_trecho ?? null,
    critico: r.critico ?? null,
    clausulas: r.clausulas ?? null,
    statusAnalise: r.status_analise ?? null,
    crossMatriz: r.cross_matriz ?? null,
    impacta: r.impacta ?? null,
    diasAtraso: r.dias_atraso ?? null,
    fonte: r.fonte ?? null,
    janelaInicio: r.janela_inicio ?? null,
    janelaFim: r.janela_fim ?? null,
  }));
}

/** Parâmetros da timeline C.13 (1 linha). Null se ausente. */
export async function getTimelineParams(contractId: string): Promise<TimelineParams | null> {
  const { data, error } = await untypedTable("obra_timeline_params")
    .select(
      "os_real, os_original, termino_contratual, inicio_execucao, termino_previsto, total_eventos, eventos_climaticos, marcos_em_risco, marcos_cumpridos, marcos_total, criticos_impacto_fisico, caminho_critico_dias, mes_corte_indice, avanco_fisico_previsto_pp, delta_impacto_fisico_pp, windows_obs, status",
    )
    .eq("contrato_id", contractId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = data as any;
  return {
    osReal: r.os_real ?? null,
    osOriginal: r.os_original ?? null,
    terminoContratual: r.termino_contratual ?? null,
    inicioExecucao: r.inicio_execucao ?? null,
    terminoPrevisto: r.termino_previsto ?? null,
    totalEventos: r.total_eventos ?? null,
    eventosClimaticos: r.eventos_climaticos ?? null,
    marcosEmRisco: r.marcos_em_risco ?? null,
    marcosCumpridos: r.marcos_cumpridos ?? null,
    marcosTotal: r.marcos_total ?? null,
    criticosImpactoFisico: r.criticos_impacto_fisico ?? null,
    caminhoCriticoDias: r.caminho_critico_dias ?? null,
    mesCorteIndice: r.mes_corte_indice ?? null,
    avancoFisicoPrevistoPp: r.avanco_fisico_previsto_pp ?? null,
    deltaImpactoFisicoPp: r.delta_impacto_fisico_pp ?? null,
    windowsObs: r.windows_obs ?? null,
    status: r.status ?? "ok",
  };
}

export type TimelineProjecao = {
  trecho: string;
  terminoContratual: string;
  terminoProjetado: string;
  deltaPrazo: string;
  drivers: string;
};

/** Projeção do término por trecho/contrato considerando os impactos documentados (C.13 ·
 * obra_secoes). [] se a seção não existe. */
export async function getTimelineProjecao(contractId: string): Promise<TimelineProjecao[]> {
  const { data, error } = await untypedTable("obra_secoes")
    .select("dados")
    .eq("contrato_id", contractId)
    .ilike("titulo", "%C.13%Projeção de término%")
    .maybeSingle();
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  const rows = Array.isArray(d?.dados) ? (d.dados as Array<Record<string, unknown>>) : [];
  return rows.map((r) => ({
    trecho: String(r["Trecho / marco"] ?? ""),
    terminoContratual: String(r["Término contratual"] ?? ""),
    terminoProjetado: String(r["Término projetado (impactado)"] ?? ""),
    deltaPrazo: String(r["Δ prazo"] ?? ""),
    drivers: String(r["Principais drivers"] ?? ""),
  }));
}
