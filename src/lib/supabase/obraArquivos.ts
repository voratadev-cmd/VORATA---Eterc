// CRUD da tabela `obra_arquivos` · registra cada arquivo subido pra obra.
// Source-of-truth do que existe (independente do Storage).
//
// Status do pipeline (após migration 20260601000001):
//   Fase 1 · Mapeamento
//     'raw' | 'queued' | 'mapping' | 'mapped' | 'mapping_error'
//   Gate humano · 'ready_to_extract'
//   Fase 2 · Extração
//     'extracting' | 'extracted' | 'needs_review' | 'verified' | 'extraction_error'
//   Legado: 'processing' | 'error'

import { getSupabase, RMA_BUCKET } from "./client";
import type { Database } from "./database.types";

/** Tipo base do Supabase + colunas adicionadas pelo pipeline (migration nova).
 *  Quando regerarmos database.types.ts pós-migration, esses opcionais saem. */
export type ObraArquivo = Database["public"]["Tables"]["obra_arquivos"]["Row"] & {
  lease_until?: string | null;
  attempts?: number;
  extract_attempts?: number;
  last_error?: string | null;
};
type ObraArquivoInsert = Database["public"]["Tables"]["obra_arquivos"]["Insert"];

/**
 * Cria um registro de arquivo · chamado logo após o upload no Storage para
 * vincular obra ↔ arquivo no banco.
 */
export async function createObraArquivo(
  input: Omit<ObraArquivoInsert, "id" | "uploaded_at" | "status"> & {
    status?: ObraArquivoInsert["status"];
  },
): Promise<{ ok: true; arquivo: ObraArquivo } | { ok: false; error: string; duplicate?: boolean }> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("obra_arquivos")
    .insert({ ...input, status: input.status ?? "raw" })
    .select()
    .single();
  if (error) {
    // 23505 = unique_violation → mesmo doc (obra+nome+tamanho) já registrado.
    const duplicate = (error as { code?: string }).code === "23505";
    return { ok: false, error: error.message, duplicate };
  }
  return { ok: true, arquivo: data };
}

/** Lista os arquivos de uma obra · ordem do mais recente. */
export async function listObraArquivos(obraId: string): Promise<ObraArquivo[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("obra_arquivos")
    .select("*")
    .eq("obra_id", obraId)
    .order("uploaded_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Deleta a row e o arquivo do Storage (transacional best-effort). */
export async function deleteObraArquivo(
  arquivoId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabase();
  // Busca o path antes de deletar a row
  const { data: row, error: selErr } = await supabase
    .from("obra_arquivos")
    .select("path")
    .eq("id", arquivoId)
    .single();
  if (selErr) return { ok: false, error: selErr.message };

  // Remove a row primeiro · se falhar o storage delete, fica lixo mas DB limpo
  const { error: delErr } = await supabase.from("obra_arquivos").delete().eq("id", arquivoId);
  if (delErr) return { ok: false, error: delErr.message };

  // Remove do Storage (best-effort · errors aqui já saíram do DB). Loga o path
  // órfão se a remoção falhar — pra um job de limpeza futuro varrer.
  if (row?.path) {
    const { error: stErr } = await supabase.storage.from(RMA_BUCKET).remove([row.path]);
    if (stErr)
      console.warn(
        `[storage] órfão (row deletada, arquivo permaneceu): ${row.path} · ${stErr.message}`,
      );
  }
  return { ok: true };
}

/**
 * Gera uma URL assinada (TTL curto) pra abrir o arquivo direto do Supabase
 * Storage em nova aba. Útil pra preview/download imediato sem proxy.
 */
export async function getObraFileSignedUrl(
  path: string,
  ttlSeconds = 300,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage.from(RMA_BUCKET).createSignedUrl(path, ttlSeconds);
  if (error || !data) return { ok: false, error: error?.message ?? "Falha ao gerar URL" };
  return { ok: true, url: data.signedUrl };
}

/**
 * Promove os arquivos 'staged' da obra para 'raw' (entram na fila da IA). Chamado
 * no SUBMIT do cadastro — antes disso os docs ficam 'staged' e a RPC de
 * mapeamento (que só pega 'raw'|'queued'|'mapping_error') NÃO os enfileira, então
 * não se paga mapeamento de obra abandonada.
 */
export async function promoteObraFilesToRaw(
  obraId: string,
): Promise<{ ok: true; affected: number } | { ok: false; error: string }> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("obra_arquivos")
    .update({ status: "raw" })
    .eq("obra_id", obraId)
    .eq("status", "staged")
    .select("id");
  if (error) return { ok: false, error: error.message };
  return { ok: true, affected: (data ?? []).length };
}

/** Atualiza o status de um arquivo (usado pelo agente SDK na fase 2). */
export async function updateObraArquivoStatus(
  arquivoId: string,
  status: ObraArquivo["status"],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabase();
  const { error } = await supabase.from("obra_arquivos").update({ status }).eq("id", arquivoId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Apelido (rename) · guardado em metadata.display_name ──────────────
// Mantém o nome_original intacto (source-of-truth do arquivo); o apelido é só
// pra exibição. Cast local porque `metadata` pode não estar no database.types
// ainda (regerar resolve).
type WithMetadata = { metadata?: Record<string, unknown> | null };

/** Nome exibido: apelido (metadata.display_name) se houver, senão o original. */
export function getDisplayName(arquivo: ObraArquivo): string {
  const dn = (arquivo as WithMetadata).metadata?.display_name;
  return typeof dn === "string" && dn.trim().length > 0 ? dn : arquivo.nome_original;
}

/** Indica se o arquivo tem apelido custom (≠ nome original). */
export function hasCustomName(arquivo: ObraArquivo): boolean {
  const dn = (arquivo as WithMetadata).metadata?.display_name;
  return typeof dn === "string" && dn.trim().length > 0;
}

/** Metadata atual do arquivo (pra merge no rename). */
export function getArquivoMetadata(arquivo: ObraArquivo): Record<string, unknown> | null {
  return (arquivo as WithMetadata).metadata ?? null;
}

/**
 * Sugestão de nome (do mapeador) já dispensada pelo usuário? Compara com a
 * sugestão ATUAL — se um re-mapeamento gerar outra sugestão, ela reaparece.
 */
export function isNameSuggestionDismissed(arquivo: ObraArquivo, suggestion: string): boolean {
  const d = (arquivo as WithMetadata).metadata?.name_suggestion_dismissed;
  return typeof d === "string" && d === suggestion;
}

/** Dispensa a sugestão de nome · grava `metadata.name_suggestion_dismissed`. */
export async function dismissNameSuggestion(
  arquivoId: string,
  suggestion: string,
  currentMetadata: Record<string, unknown> | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabase();
  const meta: Record<string, unknown> = {
    ...(currentMetadata ?? {}),
    name_suggestion_dismissed: suggestion,
  };
  const { error } = await supabase
    .from("obra_arquivos")
    .update({ metadata: meta as never })
    .eq("id", arquivoId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Renomeia (apelido) um arquivo · grava `metadata.display_name`. String vazia
 * limpa o apelido (volta pro nome original). Faz merge com a metadata existente.
 */
export async function renameObraArquivo(
  arquivoId: string,
  displayName: string,
  currentMetadata: Record<string, unknown> | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabase();
  const meta: Record<string, unknown> = { ...(currentMetadata ?? {}) };
  const trimmed = displayName.trim();
  if (trimmed.length > 0) meta.display_name = trimmed;
  else delete meta.display_name;
  const { error } = await supabase
    .from("obra_arquivos")
    .update({ metadata: meta as never })
    .eq("id", arquivoId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
