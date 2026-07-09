// Read-model dos RELATÓRIOS de IA por aba (obra_relatorios). Espelha o padrão de sinteses.ts.
// A `meta` é montada das COLUNAS (fonte da verdade de status/versão/modelo), não do JSON gravado.

import { getSupabase } from "./client";
import type { RelatorioAba } from "@/lib/relatorio/schema";

// `string` (não `keyof Tables`) porque obra_relatorios entra no database.types só após aplicar a
// migration + regenerar os tipos. O acesso é `any` de qualquer forma.
function untypedTable(name: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

/** Relatório vigente de uma aba. null = ainda não gerado (ou tabela ainda não provisionada). */
export async function getRelatorio(contractId: string, aba: string): Promise<RelatorioAba | null> {
  const { data, error } = await untypedTable("obra_relatorios")
    .select("conteudo, status, fatos_hash, extracao_version, modelo, gerado_em")
    .eq("contrato_id", contractId)
    .eq("aba", aba)
    .limit(1)
    .maybeSingle();

  if (error) {
    // Tabela ainda não aplicada (migration pendente) → trata como "não gerado", não erro de tela.
    const code = (error as { code?: string }).code;
    const msg = (error as { message?: string }).message ?? "";
    if (code === "42P01" || /does not exist|Could not find the table/i.test(msg)) return null;
    // Falha de leitura real não vira "ausência" silenciosa — falhe alto (regra dura do projeto).
    throw new Error(error.message);
  }
  if (!data) return null;

  const row = data as {
    conteudo: Record<string, unknown> | null;
    status: string | null;
    fatos_hash: string | null;
    extracao_version: number | null;
    modelo: string | null;
    gerado_em: string | null;
  };
  if (!row.conteudo || typeof row.conteudo !== "object") return null;

  const rel = row.conteudo as unknown as RelatorioAba;
  return {
    ...rel,
    meta: {
      geradoEm: row.gerado_em ?? rel.meta?.geradoEm ?? "",
      modelo: row.modelo ?? rel.meta?.modelo ?? "",
      status: (row.status as RelatorioAba["meta"]["status"]) ?? rel.meta?.status ?? "ok",
      fatosHash: row.fatos_hash ?? rel.meta?.fatosHash,
      extracaoVersion: row.extracao_version ?? rel.meta?.extracaoVersion,
    },
  };
}
