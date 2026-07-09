// Read-model do MAPA DA OBRA (C.14) — modelo v46 por FRENTE. A obra é decomposta em 16 frentes
// FÍSICAS na rodovia (km 144,6 → 190,3): 5 trechos de pista (duplicação) + 11 pontuais
// (OAEs/pontes · dispositivos/retornos · talude · geodreno), cada uma com valor de contrato.
// Lê obra_mapa_segmentos (Σ 381.573.415 = obra física). Os 2 itens TRANSVERSAIS sem km
// (Administração Local + Materiais Faturamento Direto = 229.783.899) vêm de obra_secoes —
// físicas + transversais = PV 611.357.314 (bate C.8/C.10/C.3). Só leitura; null se não normalizado.

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

/** Tipo da frente no banco. `trecho` = segmento de pista (impedível por faixa de km);
 *  os demais são pontuais (impedíveis por inteiro). */
export type FrenteTipo = "trecho" | "oae" | "dispositivo" | "talude" | "geodreno";

export type FrenteMapa = {
  ordem: number;
  codigo: string;
  nome: string;
  tipo: FrenteTipo;
  kmInicio: number;
  kmFim: number;
  valorRs: number;
  /** trecho de pista (true) ou ponto/elemento isolado (false). */
  ehPista: boolean;
};

/** Item transversal (sem km) — não impedível por trecho. */
export type TransversalMapa = {
  nome: string;
  natureza: string;
  tratadoEm: string;
  valorRs: number;
};

const FRENTE_TIPOS: ReadonlySet<string> = new Set([
  "trecho",
  "oae",
  "dispositivo",
  "talude",
  "geodreno",
]);

/** As 16 frentes físicas do mapa (C.14), ordenadas. Null se ainda não normalizado. */
export async function getMapaFrentes(contractId: string): Promise<FrenteMapa[] | null> {
  const { data, error } = await untypedTable("obra_mapa_segmentos")
    .select("ordem, seg_codigo, item_nome, tipo, km_inicio, km_fim, valor_contrato_rs")
    .eq("contrato_id", contractId)
    .order("ordem", { ascending: true });
  // Falha de leitura não pode virar null silencioso — erro = milhões.
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Record<string, number | string | null>>;
  if (rows.length === 0) return null;

  return rows.map((r) => {
    const raw = String(r.tipo ?? "").toLowerCase();
    const tipo = (FRENTE_TIPOS.has(raw) ? raw : "trecho") as FrenteTipo;
    return {
      ordem: Number(r.ordem ?? 0),
      codigo: String(r.seg_codigo ?? ""),
      nome: String(r.item_nome ?? ""),
      tipo,
      kmInicio: Number(r.km_inicio ?? 0),
      kmFim: Number(r.km_fim ?? 0),
      valorRs: Number(r.valor_contrato_rs ?? 0),
      ehPista: tipo === "trecho",
    };
  });
}

/** Itens transversais do mapa (C.14 · obra_secoes). [] se a seção não existe. */
export async function getMapaTransversais(contractId: string): Promise<TransversalMapa[]> {
  const { data, error } = await untypedTable("obra_secoes")
    .select("dados")
    .eq("contrato_id", contractId)
    .ilike("titulo", "%C.14%Itens transversais%")
    .maybeSingle();
  if (error) throw new Error(error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  const rows = Array.isArray(d?.dados) ? (d.dados as Array<Record<string, unknown>>) : [];
  return rows.map((r) => ({
    nome: String(r["Item"] ?? ""),
    natureza: String(r["Natureza"] ?? ""),
    tratadoEm: String(r["Tratado em"] ?? ""),
    valorRs: Number(r["Valor (R$)"] ?? 0),
  }));
}
