// Read-model da Normalização (Camada C) · lê as tabelas canônicas (obra_medicoes /
// obra_medicao_itens / obra_medicao_totais) e monta o shape de Faturamento que a tela
// consome — a curva S REAL (medido por BM + acumulado) + os KPIs. Só leitura (anon SELECT
// liberado na migration).

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

export type CurvaPontoReal = {
  bm: number;
  /** Valor R$ medido NO MÊS deste BM. */
  medidoMes: number;
  /** Valor R$ medido ACUMULADO até este BM. */
  acumulado: number;
  /** Competência do BM quando a fonte a conhece (workbook-motor: mês da curva). Permite ao bridge
   *  casar BM↔mês por CHAVE — sem ela o pareamento é posicional e um mês ocioso desalinha a tabela
   *  Mês a Mês. null/undefined = fonte sem competência (cadeia de BMs antiga). */
  ano?: number | null;
  mes?: number | null;
};

export type FaturamentoReal = {
  curva: CurvaPontoReal[];
  /** Valor contratado total (item raiz '1' — maior entre os BMs; é o baseline do contrato). */
  contratadoTotal: number | null;
  /** Por que contratadoTotal é null apesar de haver BM (ex.: raiz ausente) — null se OK. */
  contratadoTotalMotivo: string | null;
  /** Real acumulado até o último BM. */
  realAcumulado: number | null;
  /** realAcumulado / contratadoTotal (fração 0..1). */
  pctFaturado: number | null;
  /** contratadoTotal − realAcumulado. */
  saldoFaturar: number | null;
  /** % FÍSICO realizado DO MÊS do último BM (fração 0..1) — null se o BM não trouxe. */
  fisicoMes: number | null;
  /** % FÍSICO realizado ACUMULADO até o último BM (fração 0..1) — o avanço físico OFICIAL (§4.1). */
  fisicoAcumulado: number | null;
  nBms: number;
};

/** Monta o Faturamento REAL de uma obra a partir do dado normalizado no banco. */
export async function getFaturamentoReal(contractId: string): Promise<FaturamentoReal> {
  const { data: meds, error: medsErr } = await untypedTable("obra_medicoes")
    .select("id, bm_numero")
    .eq("contrato_id", contractId)
    .order("bm_numero", { ascending: true });
  // Falha de leitura não pode virar "obra sem BM" silenciosa — falhe alto (erro = milhões).
  if (medsErr) throw new Error(medsErr.message);
  const list: Array<{ id: string; bm_numero: number }> = meds ?? [];

  const curva: CurvaPontoReal[] = [];
  let fisicoMes: number | null = null;
  let fisicoAcumulado: number | null = null;
  for (const m of list) {
    const { data: t, error: totErr } = await untypedTable("obra_medicao_totais")
      .select(
        "total_periodo_valor, total_acumulado_valor, fisico_pct_periodo, fisico_pct_acumulado",
      )
      .eq("medicao_id", m.id)
      .maybeSingle();
    if (totErr) throw new Error(totErr.message);
    curva.push({
      bm: m.bm_numero,
      medidoMes: Number(t?.total_periodo_valor ?? 0),
      acumulado: Number(t?.total_acumulado_valor ?? 0),
    });
    // lista é ascendente por BM → guarda o físico do ÚLTIMO BM (null se o mais recente não
    // reportou físico — NUNCA herda stale de um BM anterior; o real tem que ser do BM corrente)
    fisicoMes = t?.fisico_pct_periodo != null ? Number(t.fisico_pct_periodo) : null;
    fisicoAcumulado = t?.fisico_pct_acumulado != null ? Number(t.fisico_pct_acumulado) : null;
  }

  // contratado-raiz = baseline do contrato (deve ser consistente entre BMs). NÃO confiar só no
  // ÚLTIMO BM (pode ser parcial ou não trazer a raiz): varre TODOS e pega o maior valor_contratado
  // da raiz '1'. Se ausente em todos, contratadoTotal=null COM motivo explícito (não null mudo).
  let contratadoTotal: number | null = null;
  let contratadoTotalMotivo: string | null = null;
  if (list.length > 0) {
    const { data: raizes, error: raizErr } = await untypedTable("obra_medicao_itens")
      .select("valor_contratado")
      .in(
        "medicao_id",
        list.map((m) => m.id),
      )
      .eq("numero_item", "1");
    if (raizErr) throw new Error(raizErr.message);
    const vals = ((raizes ?? []) as Array<{ valor_contratado: number | null }>)
      .map((r) => (r.valor_contratado != null ? Number(r.valor_contratado) : null))
      .filter((v): v is number => v != null && Number.isFinite(v));
    if (vals.length > 0) contratadoTotal = Math.max(...vals);
    else
      contratadoTotalMotivo = `item raiz '1' ausente nos ${list.length} BM(s) — contratado total indisponível`;
  }

  const realAcumulado = curva.length > 0 ? curva[curva.length - 1].acumulado : null;
  const pctFaturado =
    contratadoTotal && realAcumulado != null ? realAcumulado / contratadoTotal : null;
  const saldoFaturar =
    contratadoTotal != null && realAcumulado != null ? contratadoTotal - realAcumulado : null;

  return {
    curva,
    contratadoTotal,
    contratadoTotalMotivo,
    realAcumulado,
    pctFaturado,
    saldoFaturar,
    fisicoMes,
    fisicoAcumulado,
    nBms: list.length,
  };
}

// ── Acompanhamento · medições normalizadas por obra (fila + detalhe) ────
export type MedicaoResumo = {
  id: string;
  arquivoId: string;
  bmNumero: number;
  /** 'ok' = gate passou · 'needs_review' = invariante não fechou. */
  status: string;
  nItens: number;
  totalPeriodo: number | null;
};

/** Lista as medições normalizadas de uma obra (uma por documento). */
export async function listMedicoesByObra(contractId: string): Promise<MedicaoResumo[]> {
  const { data: meds, error: medsErr } = await untypedTable("obra_medicoes")
    .select("id, arquivo_id, bm_numero, status")
    .eq("contrato_id", contractId)
    .order("bm_numero", { ascending: true });
  if (medsErr) throw new Error(medsErr.message);
  const out: MedicaoResumo[] = [];
  for (const m of (meds ?? []) as Array<{
    id: string;
    arquivo_id: string;
    bm_numero: number;
    status: string;
  }>) {
    const { count, error: cntErr } = await untypedTable("obra_medicao_itens")
      .select("id", { count: "exact", head: true })
      .eq("medicao_id", m.id);
    if (cntErr) throw new Error(cntErr.message);
    const { data: t, error: totErr } = await untypedTable("obra_medicao_totais")
      .select("total_periodo_valor")
      .eq("medicao_id", m.id)
      .maybeSingle();
    if (totErr) throw new Error(totErr.message);
    out.push({
      id: m.id,
      arquivoId: m.arquivo_id,
      bmNumero: m.bm_numero,
      status: m.status,
      nItens: count ?? 0,
      totalPeriodo: t?.total_periodo_valor != null ? Number(t.total_periodo_valor) : null,
    });
  }
  return out;
}

export type MedicaoItem = {
  ordem: number;
  numero_item: string;
  nivel: number | null;
  descricao: string | null;
  unidade: string | null;
  valor_contratado: number | null;
  valor_medido_periodo: number | null;
  valor_medido_acumulado: number | null;
};

/** Itens canônicos de uma medição (o detalhe). */
export async function getMedicaoItens(medicaoId: string): Promise<MedicaoItem[]> {
  const { data, error } = await untypedTable("obra_medicao_itens")
    .select(
      "ordem, numero_item, nivel, descricao, unidade, valor_contratado, valor_medido_periodo, valor_medido_acumulado",
    )
    .eq("medicao_id", medicaoId)
    .order("ordem", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as MedicaoItem[];
}
