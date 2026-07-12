// Read-model da D.4 — PERDA DE PRODUTIVIDADE (3 métodos em paralelo · M3.4). Total Cost e Milha Aferida
// vêm das seções genéricas `obra_secoes` "D.4 Produtividade — *" e "D.4 Milha — *". O 3º método (Valor
// Agregado · AACE 25R-03) é first-class → getValorAgregado.
//
// Esta tela DETALHA a perda (sem-ajuste R$ 791.458 · ajustado R$ 5.959.649 · VA). O que entra no PAINEL
// D.0 NÃO é nenhum desses: a D.0 usa o "Total Cost do período" (R$ 736.741) da própria Bloco 2 (ver
// desequilibrio.ts). NÃO confundir os números desta tela com a parcela D.4 do D.0. Só leitura.

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- acesso destipado uniforme (igual aos demais read-models)
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

/** dados de uma seção por fragmento de título (array de linhas OU objeto chave_valor). null se ausente. */
async function getSecaoDados(contractId: string, tituloFrag: string): Promise<unknown> {
  const { data, error } = await untypedTable("obra_secoes")
    .select("dados")
    .eq("contrato_id", contractId)
    .ilike("titulo", `%${tituloFrag}%`)
    .limit(1);
  // Falha de leitura (RLS/timeout/rede) NÃO pode virar "ausência" silenciosa — erro = milhões.
  if (error) throw new Error(error.message);
  return ((data ?? [])[0] as { dados?: unknown } | undefined)?.dados ?? null;
}

export type TotalCostCategoria = {
  categoria: string; // 'MOD' | 'EQP'
  realRs: number | null;
  /** Contratado cheio (Σ do histograma, full). */
  contratadoCheioRs: number | null;
  /** Contratado ajustado = Contratado cheio × avanço de serviços. */
  contratadoAjustadoRs: number | null;
  /** Total Cost = Real − Contratado ajustado. */
  totalCostRs: number | null;
};

export type MilhaAferida = {
  refModRs: number | null; // Milha de referência — Fat/MOD (R$/recurso)
  refEqpRs: number | null; // Milha de referência — Fat/EQP (R$/recurso)
  impedimentoModRs: number | null;
  impedimentoEqpRs: number | null;
  impedimentoTotalRs: number | null;
  custoAdicionalRs: number | null;
  status: string | null;
};

/** Total Cost SEM ajuste (ATIVO) = Real − Previsto no período · canônico da C.4 (Diferença de Total
 *  Cost até o período). MOD + EQP (exclui MOI). Reconcilia com a curva por função recomputada. */
export type TotalCostSemAjuste = {
  modRs: number | null;
  eqpRs: number | null;
  /** MOD + EQP (= 791.458 na BR-101). Headline desta tela (D.4 detalhe). NÃO é a parcela D.4 do D.0. */
  totalRs: number | null;
};

export type PerdaProdutividade = {
  totalCost: {
    categorias: TotalCostCategoria[]; // MOD, EQP
    /** Total Cost COM ajuste (Real − ajustado) = R$ 5.959.649 (teto conservador desta tela · NÃO usado pela D.0). */
    totalRs: number | null;
    realTotalRs: number | null;
    contratadoTotalRs: number | null;
    contratadoAjustadoRs: number | null;
    pctPv: number | null;
    farol: string | null;
  };
  /** SEM ajuste (ATIVO) — Real − Previsto no período (C.4 Cards por Categoria). */
  semAjuste: TotalCostSemAjuste;
  /** avanço de serviços (fração · 0,5037%). */
  avancoServicos: number | null;
  milha: MilhaAferida;
  leituraIA: string | null;
};

/** D.4 — Perda de Produtividade (Total Cost + Milha) de uma obra. Null se não normalizada (M3.4). */
export async function getPerdaProdutividade(
  contractId: string,
): Promise<PerdaProdutividade | null> {
  const [cards, ajuste, params, milhaParams, milhaResumo, leitura, cardsCat] = await Promise.all([
    getSecaoDados(contractId, "D.4%Cards"),
    getSecaoDados(contractId, "D.4%Tabela de ajuste"),
    getSecaoDados(contractId, "D.4%Parâmetros"),
    getSecaoDados(contractId, "D.4 Milha — Parâmetros"),
    getSecaoDados(contractId, "D.4 Milha — Resumo"),
    getSecaoDados(contractId, "D.4%Leitura IA"),
    getSecaoDados(contractId, "Cards por Categoria"),
  ]);

  const cardsObj =
    cards && typeof cards === "object" && !Array.isArray(cards) ? (cards as Row) : null;
  if (!cardsObj) return null; // sem o núcleo da D.4 → não normalizada

  const realTotalRs = num(pick(cardsObj, "real total (mod+eqp)", "real total"));
  const contratadoTotalRs = num(pick(cardsObj, "contratado total (mod+eqp)", "contratado total"));
  const contratadoAjustadoRs = num(pick(cardsObj, "contratado ajustado"));
  const pctPv = num(pick(cardsObj, "% sobre o pv"));
  const farol = str(pick(cardsObj, "farol"));
  // Canônico = Real − ajustado (o mesmo do painel D.0); robusto à coluna truncada do "Real − ajustado".
  const totalRs =
    realTotalRs != null && contratadoAjustadoRs != null ? realTotalRs - contratadoAjustadoRs : null;

  // Tabela de ajuste por categoria (MOD/EQP): Real, Contratado cheio, Contratado ajustado, Total Cost.
  const ajusteRows = Array.isArray(ajuste) ? (ajuste as Row[]) : [];
  const categorias: TotalCostCategoria[] = ajusteRows
    .map((r) => {
      const rec = str(pick(r, "recurso")) ?? "";
      // linha "Total (MOD + EQP)" não é categoria — descartada (o total é derivado/consistido acima)
      const cat = /total/i.test(rec)
        ? "TOTAL"
        : /eqp|equip/i.test(rec)
          ? "EQP"
          : /mod|mão|mao/i.test(rec)
            ? "MOD"
            : rec;
      return {
        categoria: cat,
        realRs: num(pick(r, "real total", "realtotal")),
        contratadoCheioRs: num(pick(r, "contratado total", "contratadototal")),
        contratadoAjustadoRs: num(pick(r, "contratado ajustado", "contratadoajustado")),
        totalCostRs: num(
          pick(r, "total cost (real", "totalcostrealmenosajustado", "totalcostreal"),
        ),
      };
    })
    .filter((c) => c.categoria === "MOD" || c.categoria === "EQP");

  const paramsObj =
    params && typeof params === "object" && !Array.isArray(params) ? (params as Row) : null;
  const avancoServicos = num(
    pick(paramsObj, "avanço de serviços", "avanco de servicos", "avanço usado"),
  );

  const mpObj =
    milhaParams && typeof milhaParams === "object" && !Array.isArray(milhaParams)
      ? (milhaParams as Row)
      : null;
  const mrObj =
    milhaResumo && typeof milhaResumo === "object" && !Array.isArray(milhaResumo)
      ? (milhaResumo as Row)
      : null;
  const milha: MilhaAferida = {
    refModRs: num(
      pick(mpObj, "milha de referência — fat/mod", "milha de referencia — fat/mod", "fat/mod"),
    ),
    refEqpRs: num(
      pick(mpObj, "milha de referência — fat/eqp", "milha de referencia — fat/eqp", "fat/eqp"),
    ),
    impedimentoModRs: num(pick(mrObj, "σ impedimento — mod", "impedimento — mod")),
    impedimentoEqpRs: num(pick(mrObj, "σ impedimento — eqp", "impedimento — eqp")),
    impedimentoTotalRs: num(pick(mrObj, "σ impedimento — total", "impedimento — total")),
    custoAdicionalRs: num(pick(mrObj, "custo adicional líquido", "custo adicional liquido")),
    status: str(pick(mrObj, "status")),
  };

  const leituraObj =
    leitura && typeof leitura === "object" && !Array.isArray(leitura) ? (leitura as Row) : null;
  const leituraIA = str(pick(leituraObj, "conteudo", "conteúdo"));

  // SEM ajuste (ATIVO) — C.4 Cards por Categoria, linha "Diferença de Total Cost — até o período (R$)".
  // MOD + EQP (MOI fica fora do D.4). É o canônico que a curva por função (recomputada) reconcilia.
  const catRows = Array.isArray(cardsCat) ? (cardsCat as Row[]) : [];
  const difRow = catRows.find((r) => {
    const ind = normC(String(pick(r, "indicador") ?? ""));
    return ind.includes("diferenca de total cost") && ind.includes("periodo");
  });
  const semModRs = difRow ? num(pick(difRow, "mod")) : null;
  const semEqpRs = difRow ? num(pick(difRow, "eqp")) : null;
  const semAjuste: TotalCostSemAjuste = {
    modRs: semModRs,
    eqpRs: semEqpRs,
    totalRs: semModRs != null && semEqpRs != null ? semModRs + semEqpRs : null,
  };

  return {
    totalCost: {
      categorias,
      totalRs,
      realTotalRs,
      contratadoTotalRs,
      contratadoAjustadoRs,
      pctPv,
      farol,
    },
    semAjuste,
    avancoServicos,
    milha,
    leituraIA,
  };
}
