// Read-model da C.15 Melhorias Documentais no DIALETO SBSO — 4 seções da captura:
//   • "C.15 — Painel (Melhorias Documentais)" (KV)      → 4 KPIs + farol geral
//   • "C.15 — Desvios do Previsto (varredura CFF × RDO × PDOT)" (8 cards)
//   • "C.15 — Defasagem de Faturamento por Disciplina" (9 linhas · Σ = R$ 7.191.278,
//     que CONSERVA com o painel e com o C.3: previsto 17.411.200 · medido 10.219.922)
//   • "C.15 — Achados, Melhorias Recomendadas e Síntese" (texto estruturado ①/②/✗/✓)
// O payload BR-101 (Análise narrativa v46) tem OUTRA estrutura — a rota ramifica por dialeto.
// null quando a obra não tem o painel SBSO (BR-101 segue no fluxo atual).

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

type Row = Record<string, unknown>;
const num = (v: unknown): number | null =>
  v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null;
const str = (v: unknown): string | null => {
  const s = v == null ? "" : String(v).trim();
  return s ? s : null;
};

async function getSecao(contractId: string, frag: string): Promise<unknown> {
  const { data, error } = await untypedTable("obra_secoes")
    .select("dados")
    .eq("contrato_id", contractId)
    .ilike("titulo", `%${frag}%`)
    .limit(1);
  if (error) throw new Error(error.message);
  return ((data ?? [])[0] as { dados?: unknown } | undefined)?.dados ?? null;
}

export type MelhoriaDesvio = {
  item: string;
  severidade: string | null; // "CRÍTICO" / "RISCO" (da fonte)
  fonte: string | null;
  previsto: string | null;
  real: string | null;
  justificativa: string | null;
  acao: string | null;
};
export type MelhoriaDefasagem = {
  item: string;
  frente: string;
  previstoRs: number | null;
  medidoRs: number | null;
  defasagemRs: number | null;
  pctMed: number | null; // fração 0..1 da fonte
  situacao: string | null;
};

export type MelhoriasSbso = {
  painel: {
    rdos: string | null;
    atas: string | null;
    defasagem: string | null;
    farolGeral: string | null;
  };
  desvios: MelhoriaDesvio[];
  defasagem: MelhoriaDefasagem[];
  defasagemTot: {
    previstoRs: number;
    medidoRs: number;
    defasagemRs: number;
    pctMed: number | null;
  };
  /** texto estruturado da fonte (①/②, ✗ achados, ✓ melhorias, síntese) — parseado na view. */
  achadosTexto: string | null;
};

/** C.15 no dialeto SBSO. null → obra sem o painel (BR-101 segue o fluxo narrativo v46). */
export async function getMelhoriasSbso(contractId: string): Promise<MelhoriasSbso | null> {
  const [painelRaw, desviosRaw, defRaw, achadosRaw] = await Promise.all([
    getSecao(contractId, "C.15 — Painel"),
    getSecao(contractId, "C.15 — Desvios do Previsto"),
    getSecao(contractId, "C.15 — Defasagem de Faturamento"),
    getSecao(contractId, "C.15 — Achados"),
  ]);
  const kv =
    painelRaw && typeof painelRaw === "object" && !Array.isArray(painelRaw)
      ? (painelRaw as Row)
      : null;
  if (!kv) return null;

  const desvios: MelhoriaDesvio[] = Array.isArray(desviosRaw)
    ? (desviosRaw as Row[]).map((r) => ({
        item: str(r["Item"]) ?? "—",
        severidade: str(r["Sev."] ?? r["Severidade"]),
        fonte: str(r["Fonte"]),
        previsto: str(r["Previsto"]),
        real: str(r["Real / medido"] ?? r["Real"]),
        justificativa: str(r["Justificativa?"] ?? r["Justificativa"]),
        acao: str(r["Ação a tratar"] ?? r["Acao"]),
      }))
    : [];

  const defasagem: MelhoriaDefasagem[] = Array.isArray(defRaw)
    ? (defRaw as Row[]).map((r) => ({
        item: str(r["Item"]) ?? "—",
        frente: str(r["Frente / serviço"] ?? r["Frente"]) ?? "—",
        previstoRs: num(r["Previsto acum. jun (R$)"] ?? r["Previsto (R$)"]),
        medidoRs: num(r["Medido (R$)"]),
        defasagemRs: num(r["Defasagem (R$)"]),
        pctMed: num(r["% med."]),
        situacao: str(r["Situação"] ?? r["Situacao"]),
      }))
    : [];
  const somar = (k: keyof MelhoriaDefasagem) =>
    Math.round(defasagem.reduce((s, d) => s + ((d[k] as number | null) ?? 0), 0) * 100) / 100;
  const previstoRs = somar("previstoRs");
  const medidoRs = somar("medidoRs");
  const defasagemTot = {
    previstoRs,
    medidoRs,
    defasagemRs: somar("defasagemRs"),
    pctMed: previstoRs > 0 ? medidoRs / previstoRs : null,
  };

  const achadosTexto =
    achadosRaw && typeof achadosRaw === "object" && !Array.isArray(achadosRaw)
      ? str((achadosRaw as Row)["conteudo"])
      : null;

  return {
    painel: {
      rdos: str(kv["rdosAnalisados"]),
      atas: str(kv["atasROS"]),
      defasagem: str(kv["defasagemFaturamento"]),
      farolGeral: str(kv["farolGeral"]),
    },
    desvios,
    defasagem,
    defasagemTot,
    achadosTexto,
  };
}
