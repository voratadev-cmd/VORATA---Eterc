// Read-model do PAINEL DE PRAZO FÍSICO da aba C.5 (dialeto SBSO/workbook-motor) — o físico
// DECLARADO pela fonte, que na tela vence o proxy financeiro derivado do faturamento.
// Três seções da captura genérica `obra_secoes`:
//   • "C.5 — Painel de Prazo Físico + Parâmetros + Resumo por categoria + Impacto final" (KV)
//   • "C.5 — Dados da Curva Física (Previsto × Real, % acumulado, financeiro e físico)" (18 meses ×
//     4 séries — o gráfico de 4 linhas da spec: financeiro prev/real + físico prev/real)
//   • "C.5 — Marcos de prazo por disciplina (previsto × real) + Natureza do avanço real"
// Obras sem essas seções (BR-101) → null em tudo; a tela cai no derivado (sem regressão).

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

const pct = (v: number | null): number | null => (v != null ? v * 100 : null);

export type PrazoC5Painel = {
  /** avanço físico REAL acumulado até o BM (%) — 19,01 na SBSO. */
  fisicoRealPct: number | null;
  /** avanço físico PREVISTO da obra no corte (%) — 38,43. */
  fisicoPrevistoPct: number | null;
  /** previsto do CRONOGRAMA no corte (%) — 43,77 (referência). */
  previstoCronogramaPct: number | null;
  /** atraso acumulado (pp) — 19,42. */
  atrasoAcumPp: number | null;
  /** aderência física = real ÷ previsto (%) — derivada. */
  aderenciaPct: number | null;
  /** prazo decorrido (fração do contrato) — regra da fonte: projeção suprimida < 20%. */
  decorridoPct: number | null;
  ritmoRecentePctMes: number | null;
  ritmoNecessarioPctMes: number | null;
  /** rótulo pronto da fonte — "7,2% vs 9,0%/mês". */
  ritmoVsNecessario: string | null;
  terminoContratual: string | null;
  /** OS real declarada pela fonte (ISO) — 2025-09-22 na SBSO. */
  inicioOsISO: string | null;
  /** data de corte (fim do BM) declarada pela fonte (ISO) — 2026-06-30. */
  dataCorteISO: string | null;
  terminoProjetado: string | null;
  deltaVsContratualDias: number | null;
  prorrogacaoEstimadaMeses: number | null;
  impactoFinalDias: number | null;
  riscoDePrazo: string | null;
  prazoContratualMeses: number | null;
  bmCorrente: number | null;
  resumo: { cumpridos: number; noPrazo: number; emRisco: number; atrasados: number } | null;
};

export type PrazoC5CurvaMes = {
  mesLabel: string;
  finPrevPct: number | null;
  finRealPct: number | null;
  fisPrevPct: number | null;
  fisRealPct: number | null;
};

export type PrazoC5Disciplina = {
  disciplina: string;
  prevPct: number | null;
  realPct: number | null;
  deltaPp: number | null;
  /** texto da fonte ("Atrasado" / "Em risco" / "No prazo" / "Cumprido") sem o bullet. */
  status: string | null;
  natureza: string | null;
  valorMedidoRs: number | null;
  emExecucao: string | null;
};

/** Fatia da COMPOSIÇÃO do avanço medido (tabela "Natureza do avanço real" — 4 fatias + TOTAL). */
export type PrazoC5Natureza = {
  natureza: string;
  valorRs: number;
  /** % do medido — calculado (valor ÷ total); o header da coluna na fonte veio envenenado
   *  como data ("2027-03-09"), então NUNCA lido pela chave. */
  pctDoMedido: number | null;
};

export type PrazoC5 = {
  painel: PrazoC5Painel | null;
  curva: PrazoC5CurvaMes[];
  disciplinas: PrazoC5Disciplina[];
  /** Composição do avanço medido (4 fatias). Na planilha essa tabela mora AO LADO da de marcos
   *  (colunas L–N, mesmas linhas) — a captura funde as duas; aqui ela é separada de volta.
   *  As fatias NÃO têm vínculo com a disciplina da mesma linha (spec ajustes-REVISADO-v3 §C.5.2). */
  naturezas: PrazoC5Natureza[];
  naturezaTotalRs: number | null;
  /** Texto de leitura ("Achado: …") — linhas da tabela-fonte sem valor; exibir como prosa. */
  naturezaAchado: string | null;
};

/** Painel/curva/disciplinas do físico declarado (aba C.5). null se a obra não tem as seções. */
export async function getPrazoC5(contractId: string): Promise<PrazoC5 | null> {
  const [painelRaw, curvaRaw, discRaw] = await Promise.all([
    getSecaoDados(contractId, "Painel de Prazo Físico"),
    getSecaoDados(contractId, "Dados da Curva Física"),
    getSecaoDados(contractId, "Marcos de prazo por disciplina"),
  ]);
  if (!painelRaw && !curvaRaw && !discRaw) return null;

  let painel: PrazoC5Painel | null = null;
  if (painelRaw && typeof painelRaw === "object" && !Array.isArray(painelRaw)) {
    const p = painelRaw as Row;
    const real = pct(num(pick(p, "avancoFisicoReal_perc")));
    const prev = pct(num(pick(p, "avancoFisicoPrevistoObra_perc")));
    painel = {
      fisicoRealPct: real,
      fisicoPrevistoPct: prev,
      previstoCronogramaPct: pct(num(pick(p, "avancoPrevistoCronograma_perc"))),
      atrasoAcumPp: num(pick(p, "atrasoAcum_pp")),
      aderenciaPct: real != null && prev != null && prev > 0 ? (real / prev) * 100 : null,
      decorridoPct: pct(num(pick(p, "decorrido_perc"))),
      ritmoRecentePctMes: num(pick(p, "ritmoRecente_percMes")),
      ritmoNecessarioPctMes: num(pick(p, "ritmoNecessario_percMes")),
      ritmoVsNecessario: str(pick(p, "impactoCritico_ritmoRecenteVsNecessario")),
      terminoContratual: str(pick(p, "terminoContratual")),
      terminoProjetado: str(
        pick(p, "terminoProjetadoTendencia", "impactoCritico_cenarioTendencia_terminoProjetado"),
      ),
      deltaVsContratualDias: num(pick(p, "deltaVsContratual_dias")),
      prorrogacaoEstimadaMeses: num(pick(p, "prorrogacaoEstimada_meses")),
      impactoFinalDias: num(pick(p, "impactoFinal_diasProrrogacao")),
      inicioOsISO: str(pick(p, "inicioOSreal"))?.slice(0, 10) ?? null,
      dataCorteISO: str(pick(p, "dataCorteFimBM"))?.slice(0, 10) ?? null,
      riscoDePrazo: str(pick(p, "riscoDePrazo")),
      prazoContratualMeses: num(pick(p, "prazoContratualMeses")),
      bmCorrente: num(pick(p, "bmCorrente")),
      resumo:
        num(pick(p, "resumo_cumpridos")) != null
          ? {
              cumpridos: num(pick(p, "resumo_cumpridos")) ?? 0,
              noPrazo: num(pick(p, "resumo_noPrazo")) ?? 0,
              emRisco: num(pick(p, "resumo_emRisco")) ?? 0,
              atrasados: num(pick(p, "resumo_atrasados")) ?? 0,
            }
          : null,
    };
  }

  const curva: PrazoC5CurvaMes[] = Array.isArray(curvaRaw)
    ? (curvaRaw as Row[])
        .map((r) => ({
          mesLabel: str(pick(r, "mês", "mes")) ?? "",
          finPrevPct: pct(num(pick(r, "previsto % acum (cronograma) - financeiro"))),
          finRealPct: pct(num(pick(r, "real % acum (medido)"))),
          fisPrevPct: pct(num(pick(r, "previsto % acum (cronograma) - fisico"))),
          fisRealPct: pct(num(pick(r, "real % acum (fisico)"))),
        }))
        .filter((m) => m.mesLabel)
    : [];

  const disciplinas: PrazoC5Disciplina[] = Array.isArray(discRaw)
    ? (discRaw as Row[])
        .map((r) => {
          const prev = pct(num(pick(r, "% previsto")));
          const real = pct(num(pick(r, "% real")));
          return {
            disciplina: str(pick(r, "disciplina")) ?? "",
            prevPct: prev,
            realPct: real,
            deltaPp: num(pick(r, "δ (pp)")) ?? (prev != null && real != null ? real - prev : null),
            status: str(pick(r, "status"))?.replace(/^[●○◐•]\s*/u, "") ?? null,
            natureza: str(pick(r, "natureza")),
            valorMedidoRs: num(pick(r, "valor medido (r$)", "valor medido")),
            emExecucao: str(pick(r, "em execução (rdo)", "em execucao")),
          };
        })
        .filter((d) => d.disciplina && !/^total/i.test(d.disciplina))
    : [];

  // Composição do avanço medido: nas linhas fundidas, fatia = Natureza COM valor; a linha
  // "TOTAL" fecha a conservação (Σ fatias == total == medido do BM); Natureza SEM valor são os
  // fragmentos do "Achado" (texto de leitura, quebrado em linhas pela fonte).
  const naturezas: PrazoC5Natureza[] = [];
  let naturezaTotalRs: number | null = null;
  const achadoFrag: string[] = [];
  if (Array.isArray(discRaw)) {
    for (const r of discRaw as Row[]) {
      const nat = str(pick(r, "natureza"));
      if (!nat) continue;
      const valor = num(pick(r, "valor medido (r$)", "valor medido"));
      if (/^total/i.test(nat)) naturezaTotalRs = valor;
      else if (valor != null) naturezas.push({ natureza: nat, valorRs: valor, pctDoMedido: null });
      else achadoFrag.push(nat);
    }
    const total = naturezaTotalRs ?? naturezas.reduce((s, f) => s + f.valorRs, 0);
    if (total > 0) for (const f of naturezas) f.pctDoMedido = (f.valorRs / total) * 100;
    if (naturezaTotalRs == null && naturezas.length) naturezaTotalRs = total;
  }
  const naturezaAchado = achadoFrag.length ? achadoFrag.join(" ") : null;

  return { painel, curva, disciplinas, naturezas, naturezaTotalRs, naturezaAchado };
}
