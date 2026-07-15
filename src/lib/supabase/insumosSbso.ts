// Read-model da C.6 Insumos no REGIME SBSO (cláusula 7 · INCC-DI) — spec ajustes-REVISADO-v3.
// O contrato SBSO/INFRAERO não tem "escolha de base" nem linha divisória do IPCA (regime ATERPA/
// cl. 8.8): o índice de cada item é FIXO pelo Anexo XIII (materiais = I 03), o reajuste é direito
// (concedido ago/25 + novo acumulado) e o reequilíbrio só se apura com preço real (NF) — nenhum
// insumo comprado até o corte. Fontes (tudo já normalizado em obra_secoes/tabelas fd):
//   • "C.6 Insumos — Cards" (KV)                → os 6 números-oracle dos cards (ao centavo)
//   • "C.6 Insumos — Índices de reajuste"       → tabela I 01..I 04 (Io · I · reajuste)
//   • "S-AUX3 — Índices de reajustamento"       → vintages honestos: I 01/I 02 param no 1º
//     reajuste (ago/25); só o I 03 tem ponto mai/26 (a tabela da aba mistura as safras)
//   • obra_insumos_fd / obra_insumos_reeq       → curva ABC (32 itens) + datas/percentual
// Obras sem a seção de cards (BR-101) → null e a rota segue no fluxo ATERPA multifonte.

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
const pick = (r: Row, ...frags: string[]): unknown => {
  const keys = Object.keys(r);
  for (const f of frags) {
    const k = keys.find((kk) => kk.toLowerCase().includes(f.toLowerCase()));
    if (k) return r[k];
  }
  return null;
};

async function getSecao(contractId: string, tituloFrag: string): Promise<unknown> {
  const { data, error } = await untypedTable("obra_secoes")
    .select("dados")
    .eq("contrato_id", contractId)
    .ilike("titulo", `%${tituloFrag}%`)
    .limit(1);
  if (error) throw new Error(error.message);
  return ((data ?? [])[0] as { dados?: unknown } | undefined)?.dados ?? null;
}

export type SbsoIndice = {
  codigo: string;
  serie: string;
  io: number | null;
  iAtual: number | null;
  reajustePct: number | null;
  /** safra do "I" — I 01/I 02 param no 1º reajuste (ago/25); I 03/I 04 têm mai/26. */
  vintage: string | null;
  descontinuado: boolean;
};

export type SbsoItem = {
  ordem: number;
  nome: string;
  unidade: string | null;
  qtd: number | null;
  custoTotalRs: number;
  classe: string | null;
  concedidoRs: number;
  novoRs: number;
  /** balde "Demais insumos (116 itens)" — sem qtd/unidade próprios. */
  balde: boolean;
};

export type InsumosSbso = {
  dataBaseISO: string | null;
  dataCorteISO: string | null;
  dataOsISO: string | null;
  farolFonte: string | null;
  cards: {
    monitorados: number | null;
    demaisRs: number | null;
    baseRs: number;
    concedidoPct: number;
    concedidoRs: number;
    novoPp: number;
    novoRs: number;
    acumPct: number;
    acumRs: number;
    itensComReequilibrio: number;
    reequilibrioRs: number;
  };
  indices: SbsoIndice[];
  /** série base-100 desde a data-base (pontos reais da fonte; sem interpolação). */
  serieBase100: Array<{
    mesLabel: string;
    i01: number | null;
    i02: number | null;
    i03: number | null;
  }>;
  itens: SbsoItem[];
};

/** C.6 no regime SBSO (cl. 7). null quando a obra não tem a seção de cards (→ fluxo ATERPA). */
export async function getInsumosSbso(contractId: string): Promise<InsumosSbso | null> {
  const [cardsRaw, indicesRaw, aux3Raw, fdRes, reeqRes] = await Promise.all([
    getSecao(contractId, "C.6 Insumos — Cards"),
    getSecao(contractId, "C.6 Insumos — Índices de reajuste"),
    getSecao(contractId, "S-AUX3 — Índices de reajustamento"),
    untypedTable("obra_insumos_fd")
      .select("ordem_abc, nome, unidade, classe, qtd_pq, valor_contrato_bdi")
      .eq("contrato_id", contractId)
      .order("ordem_abc"),
    untypedTable("obra_insumos_reeq").select("*").eq("contrato_id", contractId).limit(1),
  ]);
  if (fdRes.error) throw new Error(fdRes.error.message);
  if (reeqRes.error) throw new Error(reeqRes.error.message);

  const kv =
    cardsRaw && typeof cardsRaw === "object" && !Array.isArray(cardsRaw) ? (cardsRaw as Row) : null;
  // O detector do regime é a presença do card de reajuste concedido — só o workbook SBSO o emite.
  if (!kv || num(pick(kv, "reajusteJaConcedido")) == null) return null;

  const fdRows = (fdRes.data ?? []) as Row[];
  const reeq = ((reeqRes.data ?? [])[0] as Row | undefined) ?? null;

  // ── Índices (Anexo XIII): tabela da C.6 + vintages do S-AUX3 ──────────────────────────────
  const aux3 = new Map<string, Row>();
  if (Array.isArray(aux3Raw)) {
    for (const r of aux3Raw as Row[]) {
      const cod = str(pick(r, "código", "codigo"));
      if (cod) aux3.set(cod.replace(/\s+/g, ""), r);
    }
  }
  const indices: SbsoIndice[] = Array.isArray(indicesRaw)
    ? (indicesRaw as Row[]).map((r) => {
        const codigo = str(pick(r, "código", "codigo")) ?? "";
        const serie = str(pick(r, "série", "serie")) ?? "";
        const descontinuado = /descontinuado/i.test(serie);
        const a3 = aux3.get(codigo.replace(/\s+/g, ""));
        // vintage honesto: se o "I (reajuste)" da C.6 é o MESMO do ago/25 do S-AUX3, o índice
        // parou no 1º reajuste; se avançou (I 03 1.270,695 > 1.216,706), é mai/26.
        const iC6 = num(pick(r, "i (reajuste)", "i ("));
        const iAgo = a3 ? num(pick(a3, "i (reajuste 08/25)", "08/25")) : null;
        const vintage =
          iC6 == null ? null : iAgo != null && Math.abs(iC6 - iAgo) < 0.51 ? "ago/25" : "mai/26";
        return {
          codigo,
          serie,
          io: num(pick(r, "io")),
          iAtual: iC6,
          reajustePct: num(pick(r, "reajuste")),
          vintage,
          descontinuado,
        };
      })
    : [];

  // ── Percentuais-chave: ORACLE dos cards ÷ base (a aba usa o parâmetro 7,2199% — derivar dos
  // índices dá 7,22002% e a tabela divergiria do card em R$ 5,96). Índices = fallback. ──
  const a3i03 = aux3.get("I03");
  const io03 = a3i03 ? num(pick(a3i03, "io")) : null;
  const iAgo03 = a3i03 ? num(pick(a3i03, "i (reajuste 08/25)", "08/25")) : null;
  const baseKv = num(pick(kv, "valorContratadoOrcado"));
  const acumPct =
    num(pick(kv, "reajusteTotalAcumulado")) != null && baseKv
      ? num(pick(kv, "reajusteTotalAcumulado"))! / baseKv
      : (num(reeq ? pick(reeq, "ipca_periodo") : null) ?? 0);
  const concedidoPct =
    num(pick(kv, "reajusteJaConcedido")) != null && baseKv
      ? num(pick(kv, "reajusteJaConcedido"))! / baseKv
      : io03 && iAgo03
        ? iAgo03 / io03 - 1
        : (num(reeq ? pick(reeq, "ipca_periodo") : null) ?? 0);
  const novoPp = acumPct - concedidoPct;

  // ── Curva ABC (32 itens · Σ = 4.900.519) com o reajuste POR ITEM (custo × %) ──────────────
  const itens: SbsoItem[] = fdRows.map((r, i) => {
    const valor = num(pick(r, "valor_contrato_bdi")) ?? 0;
    const nome = str(pick(r, "nome")) ?? "";
    return {
      ordem: num(pick(r, "ordem_abc")) ?? i,
      nome,
      unidade: str(pick(r, "unidade")),
      qtd: num(pick(r, "qtd_pq")),
      custoTotalRs: valor,
      classe: str(pick(r, "classe")),
      concedidoRs: valor * concedidoPct,
      novoRs: valor * novoPp,
      balde: /^demais/i.test(nome),
    };
  });
  const baseRs =
    num(pick(kv, "valorContratadoOrcado")) ??
    Math.round(itens.reduce((s, x) => s + x.custoTotalRs, 0) * 100) / 100;

  // ── Série base-100 (pontos REAIS: data-base ago/24 · 1º reajuste ago/25 · verificação mai/26) ─
  const b100 = (io: number | null, i: number | null) => (io && i ? (i / io) * 100 : null);
  const a3de = (cod: string, ...frags: string[]) => {
    const r = aux3.get(cod);
    return r ? num(pick(r, ...frags)) : null;
  };
  const iMai03 = indices.find((x) => x.codigo.replace(/\s+/g, "") === "I03")?.iAtual ?? null;
  const serieBase100 = [
    { mesLabel: "ago/24", i01: 100, i02: 100, i03: 100 },
    {
      mesLabel: "ago/25",
      i01: b100(a3de("I01", "io"), a3de("I01", "08/25")),
      i02: b100(a3de("I02", "io"), a3de("I02", "08/25")),
      i03: b100(io03, iAgo03),
    },
    // I 01/I 02 sem publicação mai/26 na fonte → null (a linha para no ago/25, sem inventar).
    { mesLabel: "mai/26", i01: null, i02: null, i03: b100(io03, iMai03) },
  ];

  const isoDe = (v: unknown): string | null => str(v)?.slice(0, 10) ?? null;
  return {
    dataBaseISO: reeq ? isoDe(pick(reeq, "data_proposta")) : null,
    dataCorteISO: reeq ? isoDe(pick(reeq, "data_verificacao")) : null,
    dataOsISO: reeq ? isoDe(pick(reeq, "data_os")) : null,
    farolFonte: str(pick(kv, "farol")),
    cards: {
      monitorados: num(pick(kv, "insumosMonitorados")),
      demaisRs: itens.find((x) => x.balde)?.custoTotalRs ?? null,
      baseRs,
      concedidoPct,
      concedidoRs: num(pick(kv, "reajusteJaConcedido")) ?? baseRs * concedidoPct,
      novoPp,
      novoRs: num(pick(kv, "novoReajuste")) ?? baseRs * novoPp,
      acumPct,
      acumRs: num(pick(kv, "reajusteTotalAcumulado")) ?? baseRs * acumPct,
      itensComReequilibrio: 0, // nenhum insumo com NF até o corte (obra física não iniciada)
      reequilibrioRs: 0,
    },
    indices,
    serieBase100,
    itens,
  };
}
