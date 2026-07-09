// Read-model das CONDUTAS sugeridas (C.11 · obra_condutas). Catálogo de ações do Adm
// Contratual IA: gatilho + categoria + cláusula-base + documento sugerido + prioridade.
// `status` da linha é o estágio operacional (Sugerida/Em redação/Aceita) vindo do workbook.

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

export type Conduta = {
  ordem: number;
  /** O título/ação da conduta (ex.: "Análise crítica dos projetos fornecidos"). */
  gatilho: string;
  categoria: string | null;
  /** Base contratual (ex.: "Dever da Contratante de fornecer projeto exequível"). */
  clausula: string | null;
  documento: string | null;
  prioridade: string | null;
  /** Estágio operacional do workbook (ex.: "Sugerida", "Em redação", "Aceita"). */
  status: string | null;
  /** Prazo da conduta (ex.: "a definir", "recorrente"). */
  dataSugerida: string | null;
  diasAberto: number | null;
  /** Quem recebe a conduta — "Arteris (Contratante)" ou "Interno → subsidia…". */
  destinatario: string | null;
  responsavel: string | null;
  resultadoEsperado: string | null;
  /** Parágrafo de motivo/contexto — o porquê da conduta. */
  motivo: string | null;
};

/** Condutas sugeridas de uma obra (C.11). [] se ainda não normalizado. */
export async function getCondutas(contractId: string): Promise<Conduta[]> {
  const { data, error } = await untypedTable("obra_condutas")
    .select(
      "ordem, gatilho, categoria, clausula, documento, prioridade, status, data_sugerida, dias_aberto, destinatario, responsavel, resultado_esperado, motivo",
    )
    .eq("contrato_id", contractId)
    .order("ordem", { ascending: true });
  // Falha de leitura não pode virar "sem condutas" silenciosa — falhe alto.
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Record<string, number | string | null>>;
  const str = (v: number | string | null) => (v != null ? String(v) : null);
  return rows.map((r) => ({
    ordem: Number(r.ordem ?? 0),
    gatilho: String(r.gatilho ?? ""),
    categoria: str(r.categoria),
    clausula: str(r.clausula),
    documento: str(r.documento),
    prioridade: str(r.prioridade),
    status: str(r.status),
    dataSugerida: str(r.data_sugerida),
    diasAberto: r.dias_aberto != null ? Number(r.dias_aberto) : null,
    destinatario: str(r.destinatario),
    responsavel: str(r.responsavel),
    resultadoEsperado: str(r.resultado_esperado),
    motivo: str(r.motivo),
  }));
}
