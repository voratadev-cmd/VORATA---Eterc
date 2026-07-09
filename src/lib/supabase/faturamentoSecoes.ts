// Read-models de DISPLAY do C.3 Faturamento que ainda não têm tabela tipada própria — leem a
// CAPTURA GENÉRICA (obra_secoes · estrutura preservada em JSONB). Cobrem os elementos do caderno de
// mapeamento SaaS (Tela 1) que são "render o que já está na planilha": Tabela por trecho (A93:G111)
// e as matrizes frente×mês PREVISTO (A114:L127) / DÉFICIT (A144:L157). Os números já foram validados
// pelos resolvers tipados (Σ frentes = PV · Σ previsto = curva); aqui é só leitura para exibição.
// PENDENTE ≠ ZERO: Real por trecho é INPUT não medido → real/%/farol ficam pendentes (não 0/Crítico
// fabricado, igual ao fix do C.3 por frente).

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

type SecaoRow = {
  colunas: string[] | null;
  dados: Array<Record<string, unknown>> | null;
};

/** Busca 1 seção do C.3 na captura genérica por fragmento de título. null se ausente. */
async function getSecao(contractId: string, tituloFrag: string): Promise<SecaoRow | null> {
  const { data, error } = await untypedTable("obra_secoes")
    .select("colunas, dados")
    .eq("contrato_id", contractId)
    .ilike("titulo", `%${tituloFrag}%`)
    .limit(1);
  // Falha de leitura não pode virar "seção ausente" silenciosa — falhe alto (erro = milhões).
  if (error) throw new Error(error.message);
  const row = (data ?? [])[0] as SecaoRow | undefined;
  if (!row || !Array.isArray(row.dados) || row.dados.length === 0) return null;
  return row;
}

const num = (v: unknown): number | null =>
  v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null;

export type TrechoFaturamento = {
  ordem: number;
  trecho: string;
  contratadoTotal: number | null;
  realAcum: number | null;
  pct: number | null;
};

export type FaturamentoTrechos = {
  trechos: TrechoFaturamento[];
  somaContratado: number;
  /** Real por trecho não medido (só o agregado existe) → eixo real pendente (— a medir). */
  realPendente: boolean;
  nTrechos: number;
};

/** Tabela por trecho/edifício consolidada (C.3!A93:G111). null se não capturada. */
export async function getFaturamentoTrechos(
  contractId: string,
): Promise<FaturamentoTrechos | null> {
  const sec = await getSecao(contractId, "Por trecho");
  if (!sec) return null;
  const pick = (r: Record<string, unknown>, ...frags: string[]): unknown => {
    const key = Object.keys(r).find((k) =>
      frags.some((f) => k.toLowerCase().includes(f.toLowerCase())),
    );
    return key ? r[key] : null;
  };
  const trechos: TrechoFaturamento[] = sec.dados!.map((r, i) => {
    const real = num(pick(r, "real"));
    return {
      ordem: i,
      trecho: String(pick(r, "trecho", "edifício", "edificio") ?? "").trim(),
      contratadoTotal: num(pick(r, "contratado")),
      realAcum: real, // ausente/branco na fonte → null (pendente, não 0)
      pct: real != null && real > 0 ? num(pick(r, "%")) : null,
    };
  });
  const somaContratado = trechos.reduce((a, t) => a + (t.contratadoTotal ?? 0), 0);
  const realPendente = !trechos.some((t) => (t.realAcum ?? 0) > 0);
  return { trechos, somaContratado, realPendente, nTrechos: trechos.length };
}
