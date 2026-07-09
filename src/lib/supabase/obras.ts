// CRUD da tabela `obras` no Supabase Postgres. Tipos derivados do
// `database.types.ts` gerado pela Management API.

import type { ContractIdentification } from "@/lib/schemas/contract";
import { getSupabase, RMA_BUCKET } from "./client";
import type { Database } from "./database.types";

export type Obra = Database["public"]["Tables"]["obras"]["Row"];
type ObraInsert = Database["public"]["Tables"]["obras"]["Insert"];

/** Converte strings vazias em null pra evitar `''` no banco quando o campo é opcional. */
function blankToNull(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Verifica se já existe obra com `nome_interno` igual (case-sensitive).
 * Usado pra dar feedback de unicidade ANTES do INSERT, evitando erro 23505 críptico.
 */
export async function checkNomeInternoExists(nomeInterno: string): Promise<boolean> {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from("obras")
    .select("id", { count: "exact", head: true })
    .eq("nome_interno", nomeInterno);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

/**
 * Resolve `nome_interno` → obra existente (id + nome). Usado pra oferecer
 * "abrir a obra existente" quando o cadastro bate numa colisão de nome,
 * em vez de dar beco sem saída. Retorna null se não existe.
 */
export async function findObraByNomeInterno(
  nomeInterno: string,
): Promise<{ id: string; nome_interno: string } | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("obras")
    .select("id, nome_interno")
    .eq("nome_interno", nomeInterno)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { id: data.id, nome_interno: data.nome_interno } : null;
}

/**
 * Insere uma obra. O `obraId` é gerado client-side (UUID v4) e usado tanto na
 * row quanto como pasta raiz no Supabase Storage — mantém Storage e DB com
 * mesma chave.
 */
export async function createObra(
  obraId: string,
  parsed: ContractIdentification,
): Promise<{ ok: true; obra: Obra } | { ok: false; error: string }> {
  const supabase = getSupabase();
  const row: ObraInsert = {
    id: obraId,
    nome_interno: parsed.nomeInterno,
    objeto_contratado: blankToNull(parsed.objetoContratado),
    cidade: blankToNull(parsed.cidade),
    uf: blankToNull(parsed.uf),
    contratante: blankToNull(parsed.contratante),
    modalidade: blankToNull(parsed.modalidade),
    valor_contratual: typeof parsed.valorContratual === "number" ? parsed.valorContratual : null,
    data_assinatura: blankToNull(parsed.dataAssinaturaISO),
    data_inicio: blankToNull(parsed.dataInicioISO),
    data_termino: blankToNull(parsed.dataTerminoISO),
    gestor_obra: blankToNull(parsed.gestorObra),
    adm_contratual: blankToNull(parsed.admContratual),
    indice_reajuste: blankToNull(parsed.indiceReajuste),
    periodicidade_reajuste: blankToNull(parsed.periodicidadeReajuste),
    mes_referencia_rma: blankToNull(parsed.mesReferenciaRMA),
  };
  const { data, error } = await supabase.from("obras").insert(row).select().single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, obra: data };
}

/** Uma obra pelo id (read-model do shell do RMA). null se não existe. */
export async function getObraById(id: string): Promise<Obra | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("obras").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

/** Lista todas as obras ordenadas do mais recente para o mais antigo. */
export async function listObras(): Promise<Obra[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("obras")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Atualiza uma obra existente (usado quando a row já foi criada como stub
 * durante o upload de arquivos, e o submit final preenche os dados).
 */
export async function updateObra(
  id: string,
  parsed: ContractIdentification,
): Promise<{ ok: true; obra: Obra } | { ok: false; error: string }> {
  const supabase = getSupabase();
  const row: Partial<ObraInsert> = {
    nome_interno: parsed.nomeInterno,
    objeto_contratado: blankToNull(parsed.objetoContratado),
    cidade: blankToNull(parsed.cidade),
    uf: blankToNull(parsed.uf),
    contratante: blankToNull(parsed.contratante),
    modalidade: blankToNull(parsed.modalidade),
    valor_contratual: typeof parsed.valorContratual === "number" ? parsed.valorContratual : null,
    data_assinatura: blankToNull(parsed.dataAssinaturaISO),
    data_inicio: blankToNull(parsed.dataInicioISO),
    data_termino: blankToNull(parsed.dataTerminoISO),
    gestor_obra: blankToNull(parsed.gestorObra),
    adm_contratual: blankToNull(parsed.admContratual),
    indice_reajuste: blankToNull(parsed.indiceReajuste),
    periodicidade_reajuste: blankToNull(parsed.periodicidadeReajuste),
    mes_referencia_rma: blankToNull(parsed.mesReferenciaRMA),
  };
  const { data, error } = await supabase.from("obras").update(row).eq("id", id).select().single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, obra: data };
}

/**
 * Deleta a row da obra. Usado pra rollback quando o upload de arquivos falha
 * após o INSERT já ter sido executado.
 */
export async function deleteObra(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabase();
  const { error } = await supabase.from("obras").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Remove uma lista de arquivos do bucket pelo path. Usado pra rollback.
 * Falhas silenciosas (best-effort) — não bloqueiam o fluxo de erro.
 */
export async function cleanupObraStorage(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    const supabase = getSupabase();
    await supabase.storage.from(RMA_BUCKET).remove(paths);
  } catch {
    /* best-effort · log futuro */
  }
}
