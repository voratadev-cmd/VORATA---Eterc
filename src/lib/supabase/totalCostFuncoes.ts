// Detalhe FUNÇÃO A FUNÇÃO do Total Cost da D.4 (Perda de Produtividade · M3.4) — FONTE DA VERDADE dos
// dois modos do método. Lê as seções genéricas `obra_secoes` "C.4 MOD/EQP Detalhe — Histograma…",
// pareia Contratado/Real por função (escopo CHEIO, com apoio) e deriva, por recurso:
//   realRs              = "CUSTO TOTAL (R$)" da linha Real (efetivo realmente alocado, acum até o BM)
//   contratadoCheioRs   = "CUSTO TOTAL (R$)" da linha Contratado (Σ full do histograma)
//   contratadoPeriodoRs = "TOTAL NO PERÍODO" × "JORNADA" × "CUSTO UNIT" da linha Contratado —
//                         RECOMPUTADO da fórmula crua (a coluna "CUSTO PERÍODO (R$)" armazenada está
//                         quebrada em algumas linhas, ex.: OPERADOR DE PLACA VIBRATORIA grava 4 em vez
//                         de 81.575). MOD usa CUSTO UNIT (R$/h); EQP usa CUSTO UNIT PRODUTIVO (R$/h).
//   totalCostSemRs (ATIVO) = realRs − contratadoPeriodoRs   → Σ = 791.458 (= C.4 "Diferença de TC")
//   totalCostComRs         = realRs − contratadoCheioRs × avanço  (teto conservador)
// GATE: Σ totalCostSem deve bater o canônico armazenado (C.4 Cards por Categoria · 791.458, tol 1‰).
// Se a seção faltar ou o gate não conservar, retorna null e o consumidor cai pro nível categoria.

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- acesso destipado uniforme (igual aos demais read-models)
  return (getSupabase() as any).from(name);
}

type Row = Record<string, unknown>;
const num = (v: unknown): number =>
  v == null || v === "" || !Number.isFinite(Number(v)) ? 0 : Number(v);
const normC = (s: string): string => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
/** Valor por nome de coluna: match EXATO (normalizado), depois por fragmento. */
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

async function getSecaoRows(contractId: string, tituloFrag: string): Promise<Row[] | null> {
  const { data, error } = await untypedTable("obra_secoes")
    .select("dados")
    .eq("contrato_id", contractId)
    .ilike("titulo", `%${tituloFrag}%`)
    .limit(1);
  // Falha de leitura (RLS/timeout/rede) NÃO pode virar "ausência" silenciosa — erro = milhões.
  if (error) throw new Error(error.message);
  const dados = ((data ?? [])[0] as { dados?: unknown } | undefined)?.dados ?? null;
  return Array.isArray(dados) ? (dados as Row[]) : null;
}

export type TotalCostFuncao = {
  recurso: string;
  realRs: number;
  contratadoCheioRs: number;
  contratadoPeriodoRs: number;
  /** Real − Previsto no período (recomputado) — modo ATIVO. */
  totalCostSemRs: number;
  /** Real − Contratado cheio × avanço — modo conservador. */
  totalCostComRs: number;
};

export type TotalCostFuncoesGrupo = {
  /** 'MOD' | 'EQP'. */
  categoria: string;
  rotulo: string;
  funcoes: TotalCostFuncao[];
  subtotalReal: number;
  subtotalCheio: number;
  subtotalPeriodo: number;
  subtotalSem: number;
  subtotalCom: number;
};

export type TotalCostFuncoes = {
  grupos: TotalCostFuncoesGrupo[];
  totalReal: number;
  totalCheio: number;
  totalPeriodo: number;
  totalSem: number;
  totalCom: number;
  /** Avanço de serviços usado no modo "com ajuste" (fração). */
  avanco: number;
};

/** Identifica linhas de fechamento (TOTAL/SUBTOTAL) — não são funções. */
const isTotalRow = (rec: string) => /^total\b|^subtotal\b/i.test(rec.trim());

type FuncaoBase = Omit<TotalCostFuncao, "totalCostSemRs" | "totalCostComRs">;

/** Pareia Contratado/Real por recurso (escopo CHEIO — todas as funções, inclui apoio). Recompute do
 *  período da fórmula crua. `isEqp` escolhe a coluna de custo unitário (produtivo no EQP). */
function parearFuncoes(rows: Row[], isEqp: boolean): FuncaoBase[] {
  const map = new Map<string, { real: number; contr: number; periodo: number }>();
  const ordem: string[] = [];
  for (const r of rows) {
    const rec = String(pick(r, "função", "funcao", "equipamento", "recurso") ?? "").trim();
    const st = normC(String(pick(r, "status") ?? ""));
    if (!rec || isTotalRow(rec)) continue;
    if (st !== "contratado" && st !== "real") continue;
    if (!map.has(rec)) {
      map.set(rec, { real: 0, contr: 0, periodo: 0 });
      ordem.push(rec);
    }
    const slot = map.get(rec)!;
    const custoTotal = num(pick(r, "custo total (r$)", "custo total"));
    if (st === "real") {
      slot.real = custoTotal;
    } else {
      slot.contr = custoTotal;
      // período RECOMPUTADO = total-no-período × jornada × custo-unit (a coluna armazenada é furada).
      const totPer = num(pick(r, "total no período", "total no periodo"));
      const jorn = num(pick(r, "jornada"));
      const unit = isEqp
        ? num(pick(r, "custo unit produtivo", "custo unit produt"))
        : num(pick(r, "custo unit (r$/h)", "custo unit (r"));
      slot.periodo = totPer * jorn * unit;
    }
  }
  return ordem
    .map((rec) => {
      const o = map.get(rec)!;
      return {
        recurso: rec,
        realRs: o.real,
        contratadoCheioRs: o.contr,
        contratadoPeriodoRs: o.periodo,
      };
    })
    .filter((f) => f.realRs !== 0 || f.contratadoCheioRs !== 0);
}

/**
 * Detalhe do Total Cost função a função (sem/com ajuste). `null` se as seções de detalhe não existirem
 * OU se Σ totalCostSem NÃO conservar contra o canônico armazenado (`gateSemTotal`) — nesse caso o
 * consumidor cai pro detalhe por categoria, NUNCA fabrica.
 */
export async function getTotalCostFuncoes(
  contractId: string,
  opts: {
    avanco: number;
    /** Σ Total Cost SEM ajuste esperado (C.4 Cards por Categoria · 791.458) — gate de conservação. */
    gateSemTotal?: number;
  },
): Promise<TotalCostFuncoes | null> {
  const [modRows, eqpRows] = await Promise.all([
    getSecaoRows(contractId, "C.4 MOD Detalhe — Histograma"),
    getSecaoRows(contractId, "C.4 EQP Detalhe — Histograma"),
  ]);
  if (!modRows || !eqpRows) return null;

  const avanco = opts.avanco;
  const modBase = parearFuncoes(modRows, false);
  const eqpBase = parearFuncoes(eqpRows, true);

  const comTc = (fs: FuncaoBase[]): TotalCostFuncao[] =>
    fs.map((f) => ({
      ...f,
      totalCostSemRs: f.realRs - f.contratadoPeriodoRs,
      totalCostComRs: f.realRs - f.contratadoCheioRs * avanco,
    }));
  const mod = comTc(modBase);
  const eqp = comTc(eqpBase);
  if (mod.length === 0 && eqp.length === 0) return null;

  const sum = (fs: TotalCostFuncao[], k: keyof TotalCostFuncao) =>
    fs.reduce((a, f) => a + (f[k] as number), 0);

  const totalSem = sum(mod, "totalCostSemRs") + sum(eqp, "totalCostSemRs");
  // GATE: Σ sem ajuste deve bater o canônico armazenado (tol 0,1% sobre o alvo, mín R$ 2).
  if (opts.gateSemTotal != null && opts.gateSemTotal !== 0) {
    const tol = Math.max(2, Math.abs(opts.gateSemTotal) * 0.001);
    if (Math.abs(totalSem - opts.gateSemTotal) > tol) return null;
  }

  const grupo = (
    categoria: string,
    rotulo: string,
    fs: TotalCostFuncao[],
  ): TotalCostFuncoesGrupo => ({
    categoria,
    rotulo,
    funcoes: fs,
    subtotalReal: sum(fs, "realRs"),
    subtotalCheio: sum(fs, "contratadoCheioRs"),
    subtotalPeriodo: sum(fs, "contratadoPeriodoRs"),
    subtotalSem: sum(fs, "totalCostSemRs"),
    subtotalCom: sum(fs, "totalCostComRs"),
  });

  const grupos = [
    grupo(
      "MOD",
      `MÃO DE OBRA DIRETA (${mod.length} ${mod.length === 1 ? "função" : "funções"})`,
      mod,
    ),
    grupo("EQP", `EQUIPAMENTOS (${eqp.length} ${eqp.length === 1 ? "item" : "itens"})`, eqp),
  ];

  return {
    grupos,
    totalReal: grupos.reduce((a, g) => a + g.subtotalReal, 0),
    totalCheio: grupos.reduce((a, g) => a + g.subtotalCheio, 0),
    totalPeriodo: grupos.reduce((a, g) => a + g.subtotalPeriodo, 0),
    totalSem,
    totalCom: grupos.reduce((a, g) => a + g.subtotalCom, 0),
    avanco,
  };
}
