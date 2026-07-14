// Read-model da C.9 no dialeto SBSO — chuva MENSAL (mm): baseline INMET 2020-2025 (Sorriso A904)
// × real INMET 2026 × registro RDO. Substitui o conceito ATERPA de "dias improdutivos >5 mm"
// (rodoviário) para obras que declaram a análise em mm — a conversão p/ impacto de prazo/pleito
// é feita à parte, não por "dias >5 mm".
// Fontes (obra_secoes · captura genérica):
//   • "C.9 — Análise de Chuvas (baseline INMET 2020-2025 × real 2026 × RDO)" — 18 meses (M1–M18)
//   • "C.9 — Notas sobre o registro RDO" — texto pronto da aba (formatos DDO/Diário, divergências)
// Obras sem a seção (BR-101) → null; a tela cai no modo dias >5 mm intocado.

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
const normC = (s: string): string => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
function pick(row: Row | null | undefined, ...frags: string[]): unknown {
  if (!row) return null;
  const keys = Object.keys(row);
  for (const f of frags) {
    const k = keys.find((kk) => normC(kk) === normC(f));
    if (k) return row[k];
  }
  for (const f of frags) {
    const k = keys.find((kk) => normC(kk).includes(normC(f)));
    if (k) return row[k];
  }
  return null;
}

async function getSecaoDados(contractId: string, tituloFrag: string): Promise<unknown> {
  const { data, error } = await untypedTable("obra_secoes")
    .select("dados")
    .eq("contrato_id", contractId)
    .ilike("titulo", `%${tituloFrag}%`)
    .limit(1);
  if (error) throw new Error(error.message);
  return ((data ?? [])[0] as { dados?: unknown } | undefined)?.dados ?? null;
}

export type ChuvaC9Mes = {
  /** "M1".."M18" */
  mesObra: string;
  /** "out/25".."mar/27" */
  mesAno: string;
  prevMm: number | null;
  inmetMm: number | null;
  rdoMm: number | null;
  /** Δ INMET − previsto (mm) — null nos meses futuros. */
  deltaMm: number | null;
  /** "▲ Mais que histórico" / "▼ Menos que histórico" — literal da fonte. */
  analise: string | null;
};

export type ChuvasC9 = {
  meses: ChuvaC9Mes[];
  /** meses já medidos (Real INMET não-nulo). */
  nMedidos: number;
  /** Σ baseline dos meses medidos (mm). */
  prevAcumMm: number | null;
  /** Σ Real INMET dos meses medidos (mm). */
  inmetAcumMm: number | null;
  /** Δ acumulado (mm) e %. */
  deltaAcumMm: number | null;
  deltaAcumPct: number | null;
  /** meses medidos ACIMA do histórico (Δ > 0). */
  mesesAcima: number;
  /** notas da aba sobre o registro RDO (texto pronto). */
  notas: string | null;
};

/** Análise de chuvas mensal (mm) do dialeto SBSO. null se a obra não tem a seção. */
export async function getChuvasC9(contractId: string): Promise<ChuvasC9 | null> {
  const [tab, notasRaw] = await Promise.all([
    getSecaoDados(contractId, "C.9 — Análise de Chuvas"),
    getSecaoDados(contractId, "Notas sobre o registro RDO"),
  ]);
  if (!Array.isArray(tab) || tab.length === 0) return null;

  const meses: ChuvaC9Mes[] = (tab as Row[])
    .map((r) => ({
      mesObra: str(pick(r, "mês obra", "mes obra")) ?? "",
      mesAno: str(pick(r, "mês/ano", "mes/ano")) ?? "",
      prevMm: num(pick(r, "chuva prev")),
      inmetMm: num(pick(r, "real inmet")),
      rdoMm: num(pick(r, "real rdo")),
      deltaMm: num(pick(r, "δ inmet")),
      analise: str(pick(r, "análise", "analise")),
    }))
    .filter((m) => m.mesAno);

  const medidos = meses.filter((m) => m.inmetMm != null);
  const somar = (xs: (number | null)[]): number | null => {
    const p = xs.filter((x): x is number => x != null);
    return p.length ? Math.round(p.reduce((a, b) => a + b, 0) * 10) / 10 : null;
  };
  const prevAcumMm = somar(medidos.map((m) => m.prevMm));
  const inmetAcumMm = somar(medidos.map((m) => m.inmetMm));
  const deltaAcumMm =
    prevAcumMm != null && inmetAcumMm != null
      ? Math.round((inmetAcumMm - prevAcumMm) * 10) / 10
      : null;
  const deltaAcumPct = deltaAcumMm != null && prevAcumMm ? (deltaAcumMm / prevAcumMm) * 100 : null;

  const notas =
    notasRaw && typeof notasRaw === "object" && !Array.isArray(notasRaw)
      ? str((notasRaw as Row)["conteudo"])
      : typeof notasRaw === "string"
        ? str(notasRaw)
        : null;

  return {
    meses,
    nMedidos: medidos.length,
    prevAcumMm,
    inmetAcumMm,
    deltaAcumMm,
    deltaAcumPct,
    mesesAcima: medidos.filter((m) => (m.deltaMm ?? 0) > 0).length,
    notas,
  };
}
