// Read-model do C.3 Faturamento por Frente × Trecho (drill-down · caderno SaaS A171:I242) · lê
// obra_faturamento_frente_trecho. Agrupa os trechos por frente para o drill-down (seletor Frente →
// trechos com farol → detalhe). PENDENTE ≠ ZERO: Real é input não medido → real/déficit/aderência
// NULL e realPendente=true; a tela pinta "a medir" (vermelho operacional) no drill-down.

import { getSupabase } from "./client";
import type { Database } from "./database.types";
import type { FarolLevel } from "@/lib/mocks/contracts";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

export type TrechoDrill = {
  ordem: number;
  trecho: string;
  sharePct: number | null;
  contratadoRs: number | null;
  previstoAcumRs: number | null;
  realAcumRs: number | null;
  deficitRs: number | null;
  aderencia: number | null;
  /** Farol calculado quando o Real foi medido; null = pendente (front mostra "a medir"). */
  farol: FarolLevel | null;
  realPendente: boolean;
};

export type FrenteDrill = {
  frente: string;
  trechos: TrechoDrill[];
  contratadoTotal: number;
  nTrechos: number;
  /** Nenhum trecho da frente teve Real medido. */
  realPendente: boolean;
};

export type FaturamentoFrenteTrecho = {
  frentes: FrenteDrill[];
  somaContratado: number;
  nLinhas: number;
  nFrentes: number;
  realPendente: boolean;
};

const FAROIS: ReadonlySet<string> = new Set(["conforme", "observacao", "risco", "critico"]);

/** Drill-down Frente×Trecho de uma obra. null se não normalizado. */
export async function getFaturamentoFrenteTrecho(
  contractId: string,
): Promise<FaturamentoFrenteTrecho | null> {
  const { data, error } = await untypedTable("obra_faturamento_frente_trecho")
    .select(
      "ordem, frente, trecho, share_pct, contratado_rs, previsto_acum_rs, real_acum_rs, deficit_rs, aderencia, farol, real_pendente",
    )
    .eq("contrato_id", contractId)
    .order("ordem", { ascending: true });
  // Falha de leitura não pode virar "não normalizado" silencioso — falhe alto (erro = milhões).
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<Record<string, number | string | boolean | null>>;
  if (rows.length === 0) return null;

  const num = (v: number | string | boolean | null) => (v != null ? Number(v) : null);
  const farolOf = (v: number | string | boolean | null): FarolLevel | null =>
    typeof v === "string" && FAROIS.has(v) ? (v as FarolLevel) : null;

  const byFrente = new Map<string, TrechoDrill[]>();
  for (const r of rows) {
    const frente = String(r.frente ?? "");
    const t: TrechoDrill = {
      ordem: Number(r.ordem ?? 0),
      trecho: String(r.trecho ?? ""),
      sharePct: num(r.share_pct),
      contratadoRs: num(r.contratado_rs),
      previstoAcumRs: num(r.previsto_acum_rs),
      realAcumRs: num(r.real_acum_rs),
      deficitRs: num(r.deficit_rs),
      aderencia: num(r.aderencia),
      farol: farolOf(r.farol),
      realPendente: r.real_pendente !== false,
    };
    (byFrente.get(frente) ?? byFrente.set(frente, []).get(frente)!).push(t);
  }

  const frentes: FrenteDrill[] = [...byFrente.entries()].map(([frente, trechos]) => ({
    frente,
    trechos,
    contratadoTotal: trechos.reduce((a, t) => a + (t.contratadoRs ?? 0), 0),
    nTrechos: trechos.length,
    realPendente: !trechos.some((t) => !t.realPendente),
  }));
  // frente com maior contratado primeiro (default sensato)
  frentes.sort((a, b) => b.contratadoTotal - a.contratadoTotal);

  const somaContratado = frentes.reduce((a, f) => a + f.contratadoTotal, 0);
  return {
    frentes,
    somaContratado,
    nLinhas: rows.length,
    nFrentes: frentes.length,
    realPendente: !frentes.some((f) => !f.realPendente),
  };
}
