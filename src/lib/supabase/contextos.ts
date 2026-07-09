// Helpers de leitura de `obra_arquivo_contextos` pelo front · usado
// na Tela de Mapeamento e na visualização do contexto.
//
// O front pega a ÚLTIMA versão (mais recente) por arquivo.

import { getSupabase, RMA_BUCKET } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

export type ObraArquivoContexto = {
  id: string;
  arquivo_id: string;
  doc_type: string;
  doc_type_confidence: number | null;
  version: number;
  schema_version: string;
  context_md: string;
  context_path: string | null;
  structure: unknown;
  agent_model: string | null;
  validated_by: string | null;
  validated_at: string | null;
  created_at: string;
};

/** Nome sugerido pelo mapeador (`structure.nomeSugerido`), já sanitizado no
 *  backend (com extensão original). null quando não há sugestão. */
export function getSuggestedName(contexto: ObraArquivoContexto | null): string | null {
  if (!contexto) return null;
  const s = contexto.structure;
  if (!s || typeof s !== "object") return null;
  const n = (s as { nomeSugerido?: unknown }).nomeSugerido;
  return typeof n === "string" && n.trim().length > 0 ? n.trim() : null;
}

/** Lista os contextos (última versão por arquivo) da obra. */
export async function listLatestContextosByObra(
  obraId: string,
): Promise<Map<string, ObraArquivoContexto>> {
  const supabase = getSupabase();

  // Pega arquivos da obra · depois os contextos · monta um map (arquivoId → última versão)
  const { data: arquivos, error: arqErr } = await supabase
    .from("obra_arquivos")
    .select("id")
    .eq("obra_id", obraId);
  if (arqErr) throw new Error(arqErr.message);
  if (!arquivos || arquivos.length === 0) return new Map();

  const arquivoIds = arquivos.map((a) => a.id);

  const { data: contextos, error: ctxErr } = await untypedTable("obra_arquivo_contextos")
    .select("*")
    .in("arquivo_id", arquivoIds)
    .order("version", { ascending: false });
  if (ctxErr) throw new Error(ctxErr.message);

  // Para cada arquivo_id, mantém só a primeira ocorrência (= maior version).
  const latest = new Map<string, ObraArquivoContexto>();
  for (const c of (contextos ?? []) as ObraArquivoContexto[]) {
    if (!latest.has(c.arquivo_id)) {
      latest.set(c.arquivo_id, c);
    }
  }
  return latest;
}

/** Pega o contexto mais recente de um arquivo específico (null se não existir). */
export async function getLatestContextoByArquivo(
  arquivoId: string,
): Promise<ObraArquivoContexto | null> {
  const { data, error } = await untypedTable("obra_arquivo_contextos")
    .select("*")
    .eq("arquivo_id", arquivoId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ObraArquivoContexto | null) ?? null;
}

/**
 * Re-dispara o mapeamento de um arquivo · seta status='raw' e zera lease.
 * O worker pega novamente na próxima passada de polling. O contexto
 * antigo fica preservado (versionamento).
 */
export async function requestReMapping(
  arquivoId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Casts via untypedTable: lease_until/attempts/last_error vêm da migration nova.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (untypedTable("obra_arquivos") as any)
    .update({
      status: "raw",
      lease_until: null,
      attempts: 0,
      last_error: null,
    })
    .eq("id", arquivoId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Avança TODOS os arquivos da obra com status='mapped' pra 'ready_to_extract'.
 * Chamado pelo botão "Validar todos e avançar" da Tela de Mapeamento.
 *
 * Retorna quantos arquivos foram afetados.
 */
export async function advanceAllMappedToReadyExtraction(
  obraId: string,
): Promise<{ ok: true; affected: number } | { ok: false; error: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (untypedTable("obra_arquivos") as any)
    .update({ status: "ready_to_extract" })
    .eq("obra_id", obraId)
    .eq("status", "mapped")
    .select("id");
  if (error) return { ok: false, error: error.message };
  return { ok: true, affected: (data ?? []).length };
}

/**
 * Para o mapeamento da obra · marca como 'cancelled' os arquivos que ainda
 * não foram processados (raw/queued/mapping_error). Arquivos já em 'mapping'
 * (no máx. 1 por vez) terminam sozinhos; os demais não serão pegos pelo worker.
 * Reversível via `resumeMapping`.
 *
 * Retorna quantos arquivos foram cancelados.
 */
export async function cancelMapping(
  obraId: string,
): Promise<{ ok: true; affected: number } | { ok: false; error: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (untypedTable("obra_arquivos") as any)
    .update({ status: "cancelled", lease_until: null })
    .eq("obra_id", obraId)
    .in("status", ["raw", "queued", "mapping_error"])
    .select("id");
  if (error) return { ok: false, error: error.message };
  return { ok: true, affected: (data ?? []).length };
}

/**
 * Retoma o mapeamento · devolve os arquivos cancelados pra fila (status='raw',
 * attempts zerado). O worker volta a processá-los no próximo poll.
 */
export async function resumeMapping(
  obraId: string,
): Promise<{ ok: true; affected: number } | { ok: false; error: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (untypedTable("obra_arquivos") as any)
    .update({ status: "raw", attempts: 0, lease_until: null, last_error: null })
    .eq("obra_id", obraId)
    .eq("status", "cancelled")
    .select("id");
  if (error) return { ok: false, error: error.message };
  return { ok: true, affected: (data ?? []).length };
}

/** Signed URL pra abrir o context.md direto do Storage (preview de download). */
export async function getContextoSignedUrl(
  contextPath: string,
  ttlSeconds = 300,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from(RMA_BUCKET)
    .createSignedUrl(contextPath, ttlSeconds);
  if (error || !data) return { ok: false, error: error?.message ?? "Falha ao gerar URL" };
  return { ok: true, url: data.signedUrl };
}
