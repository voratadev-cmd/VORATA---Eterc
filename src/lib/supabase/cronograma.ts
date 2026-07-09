// Read-model da Normalização (Camada C) · lê o cronograma PREVISTO FÍSICO normalizado
// (obra_cronogramas + obra_cronograma_meses) e monta a curva prevista (avanço físico por mês
// + acumulado) que a aba Prazo consome. Só leitura (anon SELECT liberado na migration 0004).

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

export type CronogramaMes = {
  ano: number;
  mes: number;
  /** Fração 0..1 do avanço físico planejado no mês. */
  previstoPct: number;
  /** Fração 0..1 acumulada (S-curve física). */
  previstoPctAcumulado: number;
  /** R$ do mês, SE legível no doc (parcial · pode ser null). */
  previstoFinanceiroDeclarado: number | null;
  /** Fração 0..1 do avanço físico REAL do mês/acumulado (workbook-motor · real_pct). null quando o
   *  '% físico real (input)' não foi preenchido (físico real PENDENTE) ou no fluxo Sorriso. OPCIONAL:
   *  os mocks Sorriso de teste não setam; consumidores leem com `?? `. */
  realPct?: number | null;
  realPctAcumulado?: number | null;
};

export type CronogramaPrevisto = {
  custoTotal: number | null;
  inicioObra: string | null;
  terminoObra: string | null;
  /** 'ok' = gate Σ% == 100% passou · 'needs_review' = não fechou. */
  status: string;
  meses: CronogramaMes[];
  nMeses: number;
  /** Σ dos % físicos (deve ser ~1,0). */
  somaPct: number;
  /** Físico REAL acumulado no último mês com real > 0 (fração 0..1). null se físico real pendente.
   *  OPCIONAL pelo mesmo motivo (mocks Sorriso não setam). */
  realAcum?: number | null;
};

/** Cronograma previsto físico de uma obra (curva de avanço). Null se ainda não normalizado. */
export async function getCronogramaPrevisto(
  contractId: string,
): Promise<CronogramaPrevisto | null> {
  // Pode haver MAIS de um cronograma (ex.: um embutido num BM + o Cronograma FF standalone). Escolhe
  // o AUTORITATIVO = curva mais COMPLETA: status 'ok' > mais meses (curva que cobre o projeto todo)
  // > mais recente. Isso faz o FF PDF (18 meses, até mar/27) vencer um embutido truncado (14 meses),
  // sem depender da ordem de processamento — resolve o §4.1 (baseline físico obsoleto). O `termino_obra`
  // do header NÃO serve aqui (é o término do CONTRATO, igual nos dois); o que distingue é a EXTENSÃO da curva.
  type CronRow = {
    id: string;
    custo_total_obra: number | null;
    inicio_obra: string | null;
    termino_obra: string | null;
    status: string;
    created_at: string | null;
  };
  const candRes = await untypedTable("obra_cronogramas")
    .select("id, custo_total_obra, inicio_obra, termino_obra, status, created_at")
    .eq("contrato_id", contractId);
  // Falha de leitura não pode virar "não normalizado" silencioso — falhe alto (erro = milhões).
  if (candRes.error) throw new Error(candRes.error.message);
  const candidatos = (candRes.data ?? []) as CronRow[];
  if (candidatos.length === 0) return null;
  const comN = await Promise.all(
    candidatos.map(async (c) => {
      const { count, error: cntErr } = await untypedTable("obra_cronograma_meses")
        .select("id", { count: "exact", head: true })
        .eq("cronograma_id", c.id);
      if (cntErr) throw new Error(cntErr.message);
      return { c, n: count ?? 0 };
    }),
  );
  comN.sort((a, b) => {
    const okA = a.c.status === "ok" ? 1 : 0;
    const okB = b.c.status === "ok" ? 1 : 0;
    if (okA !== okB) return okB - okA; // 'ok' antes de 'needs_review'
    if (a.n !== b.n) return b.n - a.n; // mais meses = curva mais completa = mais autoritativa
    return (b.c.created_at ?? "").localeCompare(a.c.created_at ?? "");
  });
  const cron = comN[0].c;

  const { data: meses, error: mesesErr } = await untypedTable("obra_cronograma_meses")
    .select(
      "ano, mes, previsto_pct, previsto_pct_acumulado, previsto_financeiro_declarado, real_pct, real_pct_acumulado",
    )
    .eq("cronograma_id", cron.id)
    .order("ordem", { ascending: true });
  if (mesesErr) throw new Error(mesesErr.message);

  const ms: CronogramaMes[] = (
    (meses ?? []) as Array<{
      ano: number;
      mes: number;
      previsto_pct: number | null;
      previsto_pct_acumulado: number | null;
      previsto_financeiro_declarado: number | null;
      real_pct: number | null;
      real_pct_acumulado: number | null;
    }>
  ).map((m) => ({
    ano: m.ano,
    mes: m.mes,
    previstoPct: Number(m.previsto_pct ?? 0),
    previstoPctAcumulado: Number(m.previsto_pct_acumulado ?? 0),
    previstoFinanceiroDeclarado:
      m.previsto_financeiro_declarado != null ? Number(m.previsto_financeiro_declarado) : null,
    realPct: m.real_pct != null ? Number(m.real_pct) : null,
    realPctAcumulado: m.real_pct_acumulado != null ? Number(m.real_pct_acumulado) : null,
  }));

  // realAcum = acumulado no último mês com Real > 0 (ignora cauda; físico real pendente → null)
  let realAcum: number | null = null;
  for (const m of ms) {
    if (m.realPct != null && m.realPct > 0) realAcum = m.realPctAcumulado ?? null;
  }

  return {
    custoTotal: cron.custo_total_obra != null ? Number(cron.custo_total_obra) : null,
    inicioObra: cron.inicio_obra,
    terminoObra: cron.termino_obra,
    status: cron.status,
    meses: ms,
    nMeses: ms.length,
    somaPct: ms.reduce((a, m) => a + m.previstoPct, 0),
    realAcum,
  };
}

// ── Cronograma-fonte (tarefas/marcos do MS Project · obra_cronograma_tarefas) ──

export type MarcoTarefa = {
  /** EDT '1.1.1.1.1.1'. */
  numeroItem: string;
  nome: string;
  /** Data de término planejada (ISO 'YYYY-MM-DD'). */
  dataTerminoISO: string | null;
};

export type CronogramaTarefas = {
  /** Marcos (tarefas com duração 0 dias), ordenados por data de término. */
  marcos: MarcoTarefa[];
  /** Maior data de término do cronograma = término PLANEJADO da obra. */
  terminoPlanejadoISO: string | null;
  /** Total de tarefas do cronograma-fonte. */
  nTarefas: number;
};

/** Marcos + término planejado do cronograma-fonte de uma obra. Null se não normalizado. */
export async function getCronogramaTarefas(contractId: string): Promise<CronogramaTarefas | null> {
  const { count, error: cntErr } = await untypedTable("obra_cronograma_tarefas")
    .select("id", { count: "exact", head: true })
    .eq("contrato_id", contractId);
  if (cntErr) throw new Error(cntErr.message);
  if (!count) return null;

  const { data: marcosRaw, error: marcosErr } = await untypedTable("obra_cronograma_tarefas")
    .select("numero_item, nome, data_termino")
    .eq("contrato_id", contractId)
    .eq("eh_marco", true)
    .order("data_termino", { ascending: true });
  if (marcosErr) throw new Error(marcosErr.message);

  const { data: ult, error: ultErr } = await untypedTable("obra_cronograma_tarefas")
    .select("data_termino")
    .eq("contrato_id", contractId)
    .not("data_termino", "is", null)
    .order("data_termino", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ultErr) throw new Error(ultErr.message);

  const marcos: MarcoTarefa[] = (
    (marcosRaw ?? []) as Array<{
      numero_item: string;
      nome: string | null;
      data_termino: string | null;
    }>
  ).map((r) => ({
    numeroItem: r.numero_item,
    nome: r.nome ?? "—",
    dataTerminoISO: r.data_termino,
  }));

  return {
    marcos,
    terminoPlanejadoISO: (ult as { data_termino: string | null } | null)?.data_termino ?? null,
    nTarefas: count,
  };
}
