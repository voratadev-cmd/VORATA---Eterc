// Leitura de `obra_arquivo_extracoes` (envelope JSON da Fase 2) e `agent_runs`
// (observabilidade) pelo front · usado na Tela de Extração.
//
// O front pega a ÚLTIMA versão (mais recente) por arquivo. Somente leitura
// (anon SELECT liberado na migration 20260601000005). A tabela ainda não está
// em database.types → casts via untypedTable, igual contextos.ts.

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

// ── Envelope (espelha agent/agents/extracao/envelope.py) ───────────────
export type EnvelopeSecao = {
  titulo: string;
  tipo: "tabela" | "chave_valor" | "texto" | string;
  fonte: string;
  colunas?: string[];
  linhas?: Record<string, unknown>[];
  dados?: Record<string, unknown>;
  conteudo?: string;
};

export type Envelope = {
  tipo_documento: string;
  resumo?: string;
  identificacao?: Record<string, unknown>;
  secoes: EnvelopeSecao[];
  totais_declarados?: Record<string, unknown>;
  alertas_extracao?: string[];
};

export type VerifierFinding = {
  severity?: "error" | "warn" | "info" | string;
  message?: string;
  field?: string;
  source?: string;
};

export type ObraArquivoExtracao = {
  id: string;
  arquivo_id: string;
  doc_type: string;
  doc_type_confidence: number | null;
  version: number;
  schema_version: string;
  payload: Envelope;
  field_confidence: Record<string, unknown> | null;
  discrepancies: unknown[] | null;
  verifier_findings: VerifierFinding[] | null;
  created_at: string;
};

export type AgentRun = {
  id: string;
  arquivo_id: string | null;
  agent_name: string;
  model: string;
  pass: number;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_tokens: number | null;
  cache_creation_tokens: number | null;
  cost_usd: number | null;
  latency_ms: number | null;
  status: string;
  error: string | null;
  started_at: string;
  ended_at: string | null;
};

async function arquivoIdsOf(obraId: string): Promise<string[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("obra_arquivos").select("id").eq("obra_id", obraId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((a) => a.id);
}

/** Mapa { arquivo_id → última extração } da obra (maior version). */
export async function listLatestExtracoesByObra(
  obraId: string,
): Promise<Map<string, ObraArquivoExtracao>> {
  const ids = await arquivoIdsOf(obraId);
  if (ids.length === 0) return new Map();

  const { data, error } = await untypedTable("obra_arquivo_extracoes")
    .select("*")
    .in("arquivo_id", ids)
    .order("version", { ascending: false });
  if (error) throw new Error(error.message);

  const latest = new Map<string, ObraArquivoExtracao>();
  for (const e of (data ?? []) as ObraArquivoExtracao[]) {
    if (!latest.has(e.arquivo_id)) latest.set(e.arquivo_id, e);
  }
  return latest;
}

/** Mapa { arquivo_id → runs[] } da obra (observabilidade · tokens/custo/latência). */
export async function listAgentRunsByObra(obraId: string): Promise<Map<string, AgentRun[]>> {
  const ids = await arquivoIdsOf(obraId);
  if (ids.length === 0) return new Map();

  const { data, error } = await untypedTable("agent_runs")
    .select("*")
    .in("arquivo_id", ids)
    .order("started_at", { ascending: true });
  if (error) throw new Error(error.message);

  const byArquivo = new Map<string, AgentRun[]>();
  for (const r of (data ?? []) as AgentRun[]) {
    if (!r.arquivo_id) continue;
    const arr = byArquivo.get(r.arquivo_id);
    if (arr) arr.push(r);
    else byArquivo.set(r.arquivo_id, [r]);
  }
  return byArquivo;
}

/** Re-dispara a extração de um arquivo · volta pra fila (ready_to_extract, zera contador). */
export async function requestReExtraction(
  arquivoId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await untypedTable("obra_arquivos")
    .update({
      status: "ready_to_extract",
      lease_until: null,
      extract_attempts: 0,
      last_error: null,
    })
    .eq("id", arquivoId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Re-extração em LOTE · devolve vários arquivos à fila de uma vez. Usado pelo botão
 * "Re-extrair os que precisam de revisão" — reprocessa só os `needs_review`, não a obra
 * inteira. Retorna a contagem afetada.
 */
export async function requestReExtractionBatch(
  arquivoIds: string[],
): Promise<{ ok: true; affected: number } | { ok: false; error: string }> {
  if (arquivoIds.length === 0) return { ok: true, affected: 0 };
  const { data, error } = await untypedTable("obra_arquivos")
    .update({
      status: "ready_to_extract",
      lease_until: null,
      extract_attempts: 0,
      last_error: null,
    })
    .in("id", arquivoIds)
    .select("id");
  if (error) return { ok: false, error: error.message };
  return { ok: true, affected: (data ?? []).length };
}

// ── helpers de apresentação ────────────────────────────────────────────
export function countLinhas(env: Envelope | undefined): number {
  if (!env?.secoes) return 0;
  return env.secoes.reduce(
    (acc, s) => acc + (s.tipo === "tabela" && Array.isArray(s.linhas) ? s.linhas.length : 0),
    0,
  );
}

/** Formata um valor de célula do envelope pra exibição (número BR, objeto aninhado, etc.). */
export function fmtCell(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number") {
    return v.toLocaleString("pt-BR", { maximumFractionDigits: 6 });
  }
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/**
 * APROVAÇÃO humana de um `needs_review` · o gate reprovou, a pessoa olhou e decidiu que a
 * extração serve assim mesmo → vira 'extracted' e a fila de NORMALIZAÇÃO pega. Mantém o
 * last_error como trilha de auditoria (o motivo da revisão não some).
 */
export async function approveExtraction(
  arquivoId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await untypedTable("obra_arquivos")
    .update({ status: "extracted", lease_until: null, normalize_attempts: 0 })
    .eq("id", arquivoId)
    .eq("status", "needs_review")
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "arquivo não está em needs_review" };
  return { ok: true };
}

/**
 * RE-NORMALIZAÇÃO de um arquivo já 'normalized' · a extração continua válida; só o motor
 * (resolvers/gates) evoluiu → rebaixa para 'extracted' e a fila de normalização re-roda
 * com a config nova. Os upserts são vigente-por-obra: substituem limpo, sem dobrar.
 */
export async function requestReNormalization(
  arquivoId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await untypedTable("obra_arquivos")
    .update({ status: "extracted", lease_until: null, normalize_attempts: 0 })
    .eq("id", arquivoId)
    .in("status", ["normalized", "normalizacao_error"])
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "arquivo não está normalizado (nada a re-rodar)" };
  return { ok: true };
}
