// Read-model LEGADO de insumos — desde o v53 é um ADAPTER sobre o modelo novo (obra_insumos_fd ·
// mesma fonte das telas C.6/D.5), mantendo os tipos originais para os consumidores existentes
// (C.2 Indicadores · Visão Geral · relatório). Os 30 insumos de faturamento direto vêm da PQ
// oficial (Anexo C.04, valores c/ BDI) — o take-off antigo (obra_insumos, conf 0,600) foi
// SUBSTITUÍDO como fonte; a tabela velha fica como histórico e nada mais a lê.

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

export type Insumo = {
  codigo: string;
  descricao: string | null;
  unidade: string | null;
  qtdeTotal: number | null;
  classeAbc: string | null;
  grupoCusto: string | null;
  precoOrcado: number | null;
  /** Valor de contrato (R$ c/ BDI) — PQ oficial (Anexo C.04), fecha com o contrato. */
  valorOrcado: number | null;
};

/** Item da Curva ABC por VALOR (Pareto real): valor R$ + % e % acumulado. */
export type InsumoValorAbc = {
  codigo: string;
  descricao: string | null;
  valorOrcado: number;
  pct: number;
  pctAcum: number;
};

export type InsumosPorUnidade = {
  unidade: string;
  nInsumos: number;
  qtdeTotal: number;
};

export type InsumosPorClasse = { classe: string; nInsumos: number };

export type InsumosResumo = {
  nInsumos: number;
  /** 'ok' = PQ oficial fechada ("✓ bate com a PQ"). */
  status: string;
  /** Insumos SEM qtde (lacuna) — no v53 a PQ é completa (0). */
  nSemQtde: number;
  /** Quantos têm preço unitário (v53: todos — PQ oficial). */
  nComPreco: number;
  nComClasse: number;
  nComValor: number;
  /** Valor de contrato TOTAL (Σ R$ c/ BDI) — PQ oficial (96.818.470,96 no BR-101). */
  totalValor: number | null;
  /** Curva ABC por VALOR (Pareto real): insumos ordenados por valor desc, com % e % acumulado. */
  curvaAbcValor: InsumoValorAbc[];
  /** Nº de insumos que concentram 80% do valor (os "vitais"). */
  nPareto80: number;
  /** Segmentação por unidade (t/l/m3/kg … — nunca somadas entre si). */
  porUnidade: InsumosPorUnidade[];
  /** Distribuição por classe ABC (A/B/C), ordem A→C. */
  porClasse: InsumosPorClasse[];
  /** Lista ordenada por quantidade desc. */
  insumos: Insumo[];
};

/** Insumos de faturamento direto (v53 · PQ C.04). Null se a obra não tem o v53 normalizado. */
export async function getInsumos(contractId: string): Promise<InsumosResumo | null> {
  const { data, error } = await untypedTable("obra_insumos_fd")
    .select(
      "ordem_abc, nome, unidade, classe, categoria, qtd_pq, preco_unit_bdi, valor_contrato_bdi",
    )
    .eq("contrato_id", contractId)
    .order("ordem_abc", { ascending: true });

  // Falha de leitura não pode virar "sem insumos" silencioso — falhe alto (erro = milhões).
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<{
    ordem_abc: number;
    nome: string;
    unidade: string | null;
    classe: string | null;
    categoria: string | null;
    qtd_pq: number | null;
    preco_unit_bdi: number | null;
    valor_contrato_bdi: number | null;
  }>;
  if (rows.length === 0) return null;

  const insumos: Insumo[] = rows
    .map((r) => ({
      codigo: `fd-${r.ordem_abc}`,
      descricao: r.nome,
      unidade: r.unidade,
      qtdeTotal: r.qtd_pq != null ? Number(r.qtd_pq) : null,
      classeAbc: r.classe,
      grupoCusto: r.categoria,
      precoOrcado: r.preco_unit_bdi != null ? Number(r.preco_unit_bdi) : null,
      valorOrcado: r.valor_contrato_bdi != null ? Number(r.valor_contrato_bdi) : null,
    }))
    .sort((a, b) => (b.qtdeTotal ?? 0) - (a.qtdeTotal ?? 0));

  let nSemQtde = 0;
  const porUnidadeMap = new Map<string, InsumosPorUnidade>();
  for (const i of insumos) {
    const u = i.unidade ?? "—";
    const acc = porUnidadeMap.get(u) ?? { unidade: u, nInsumos: 0, qtdeTotal: 0 };
    acc.nInsumos += 1;
    if (i.qtdeTotal != null && Number.isFinite(i.qtdeTotal)) acc.qtdeTotal += i.qtdeTotal;
    else nSemQtde += 1;
    porUnidadeMap.set(u, acc);
  }
  const porUnidade = [...porUnidadeMap.values()].sort((a, b) => b.nInsumos - a.nInsumos);

  const porClasseMap = new Map<string, number>();
  for (const i of insumos) {
    const cl = i.classeAbc ?? "—";
    porClasseMap.set(cl, (porClasseMap.get(cl) ?? 0) + 1);
  }
  const ordemClasse = ["A", "B", "C", "D", "N", "—"];
  const porClasse: InsumosPorClasse[] = [...porClasseMap.entries()]
    .map(([classe, nInsumos]) => ({ classe, nInsumos }))
    .sort((a, b) => ordemClasse.indexOf(a.classe) - ordemClasse.indexOf(b.classe));

  // Curva ABC por VALOR (Pareto real): ordena por valor desc, acumula %, acha quantos = 80%.
  const comValor = insumos.filter(
    (i): i is Insumo & { valorOrcado: number } =>
      i.valorOrcado != null && Number.isFinite(i.valorOrcado) && i.valorOrcado > 0,
  );
  const totalValor = comValor.length ? comValor.reduce((s, i) => s + i.valorOrcado, 0) : null;
  let acc = 0;
  let nPareto80 = 0;
  const curvaAbcValor: InsumoValorAbc[] = [...comValor]
    .sort((a, b) => b.valorOrcado - a.valorOrcado)
    .map((i, idx) => {
      acc += i.valorOrcado;
      const pctAcum = totalValor ? (acc / totalValor) * 100 : 0;
      if (nPareto80 === 0 && pctAcum >= 80) nPareto80 = idx + 1;
      return {
        codigo: i.codigo,
        descricao: i.descricao,
        valorOrcado: i.valorOrcado,
        pct: totalValor ? (i.valorOrcado / totalValor) * 100 : 0,
        pctAcum,
      };
    });
  if (nPareto80 === 0 && curvaAbcValor.length) nPareto80 = curvaAbcValor.length;

  return {
    nInsumos: insumos.length,
    status: "ok",
    nSemQtde,
    nComPreco: insumos.filter((i) => i.precoOrcado != null).length,
    nComClasse: insumos.filter((i) => i.classeAbc != null).length,
    nComValor: comValor.length,
    totalValor,
    curvaAbcValor,
    nPareto80,
    porUnidade,
    porClasse,
    insumos,
  };
}
