// Read-models do PAINEL DE NORMALIZAÇÃO (tela /normalizacao · controle do que está populado).
// (1) Contagens por tabela obra_* via RPC normalizacao_contagens (dinâmica — tabela nova de
//     entidade aparece sozinha no painel).
// (2) Seções do workbook (obra_secoes · rede de completude do splitter): coberta = tem resolver
//     tipado; capturada = preservada em JSONB aguardando rota.

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

export type ContagemTabela = {
  tabela: string;
  n: number;
  nReview: number;
};

/** Contagens por tabela da obra. Falha-alto em erro de leitura. */
export async function getNormalizacaoContagens(contractId: string): Promise<ContagemTabela[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (getSupabase() as any).rpc("normalizacao_contagens", {
    p_contrato: contractId,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Record<string, number | string | null>>;
  return rows.map((r) => ({
    tabela: String(r.tabela ?? ""),
    n: Number(r.n ?? 0),
    nReview: Number(r.n_review ?? 0),
  }));
}

export type SecaoWorkbook = {
  ordem: number;
  codigo: string | null;
  modulo: string | null;
  titulo: string;
  tipo: string | null;
  nLinhas: number | null;
  temDado: boolean;
  coberta: boolean;
};

/** Seções capturadas do workbook (régua de cobertura do splitter). [] se não há workbook. */
export async function getObraSecoes(contractId: string): Promise<SecaoWorkbook[]> {
  const { data, error } = await untypedTable("obra_secoes")
    .select("ordem, codigo, modulo, titulo, tipo, n_linhas, tem_dado, coberta")
    .eq("contrato_id", contractId)
    .order("ordem", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Record<string, number | string | boolean | null>>;
  return rows.map((r) => ({
    ordem: Number(r.ordem ?? 0),
    codigo: r.codigo != null ? String(r.codigo) : null,
    modulo: r.modulo != null ? String(r.modulo) : null,
    titulo: String(r.titulo ?? ""),
    tipo: r.tipo != null ? String(r.tipo) : null,
    nLinhas: r.n_linhas != null ? Number(r.n_linhas) : null,
    temDado: Boolean(r.tem_dado),
    coberta: Boolean(r.coberta),
  }));
}
