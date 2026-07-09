// Read-model das SÍNTESES da IA (Adm Contratual IA · obra_sinteses). A IA interpreta os fatos
// resolvidos e nunca afirma número fora deles (validador de ancoragem na geração). `status` pode ser
// 'needs_review' quando a saída citou número não-ancorado — o front DEVE sinalizar, não mostrar limpo.

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

export type DiagnosticoTom = "positivo" | "atencao" | "critico";
export type DiagnosticoPonto = { titulo: string; texto: string; tom: DiagnosticoTom };
export type DiagnosticoIA = {
  situacaoGeral: string;
  pontos: DiagnosticoPonto[];
  recomendacao: string;
  /** 'ok' = ancorado nos fatos · 'needs_review' = citou número não-ancorado (sinalizar). */
  status: string;
};

const TONS = new Set<DiagnosticoTom>(["positivo", "atencao", "critico"]);

/** Síntese de TEXTO de uma lente (campo único). Genérico — serve qualquer aba cujo campo de IA é
 * uma string (ex.: Faturamento.analiseTextual ← lente 'analise_faturamento', campo 'analise'). */
export type SinteseTexto = { texto: string; status: string };
export async function getSinteseTexto(
  contractId: string,
  lente: string,
  campoConteudo: string,
): Promise<SinteseTexto | null> {
  const { data, error } = await untypedTable("obra_sinteses")
    .select("conteudo, status")
    .eq("contrato_id", contractId)
    .eq("lente", lente)
    .limit(1)
    .maybeSingle();
  // Falha de leitura não pode virar "síntese ausente" silenciosa — falhe alto.
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as { conteudo: Record<string, unknown> | null; status: string | null };
  const texto = row.conteudo?.[campoConteudo];
  if (typeof texto !== "string" || !texto.trim()) return null;
  return { texto, status: row.status ?? "ok" };
}

/** Diagnóstico executivo da IA (lente 'diagnostico_geral'). Null se ainda não gerado. */
export async function getDiagnostico(contractId: string): Promise<DiagnosticoIA | null> {
  const { data, error } = await untypedTable("obra_sinteses")
    .select("conteudo, status")
    .eq("contrato_id", contractId)
    .eq("lente", "diagnostico_geral")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as { conteudo: Record<string, unknown> | null; status: string | null };
  const c = row.conteudo ?? {};
  const pontosRaw = Array.isArray(c.pontos) ? (c.pontos as Array<Record<string, unknown>>) : [];
  return {
    situacaoGeral: typeof c.situacao_geral === "string" ? c.situacao_geral : "",
    pontos: pontosRaw.map((p) => ({
      titulo: typeof p.titulo === "string" ? p.titulo : "",
      texto: typeof p.texto === "string" ? p.texto : "",
      tom: TONS.has(p.tom as DiagnosticoTom) ? (p.tom as DiagnosticoTom) : "atencao",
    })),
    recomendacao: typeof c.recomendacao === "string" ? c.recomendacao : "",
    status: row.status ?? "ok",
  };
}
