// Read-model da Normalização (Camada A) · lê o PLANO de recursos contratado normalizado
// (obra_recursos = itens MOD/MOI/EQP · obra_recursos_meses = histograma mensal) e monta o resumo
// que a aba Recursos consome. Só leitura (anon SELECT liberado na migration). Tabelas ainda não
// em database.types → untypedTable.
//
// HONESTIDADE: em obra pré-execução o eixo REAL (alocado) vem ZERO/NULL — o resumo marca
// temReal=false e a aba mostra "—/pendente" no real + farol de mobilização PENDENTE (nunca verde
// sobre área cega). Totais por categoria saem do histograma mensal (completo); a lista por função
// pode ser PARCIAL (ex.: MOI detalha 662 de 683) — sinalizado em catalogoParcial.

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

export type RecursoTipo = "MOD" | "MOI" | "EQP";

/** Item-cabeçalho: um recurso (função/equipamento) com contratado × real, qtde e R$. */
export type RecursoItem = {
  ordem: number;
  categoria: RecursoTipo;
  recurso: string;
  contratadoQtde: number | null;
  realQtde: number | null;
  contratadoRs: number | null;
  realRs: number | null;
};

/** Ponto da série mensal de mobilização (uma por mês × categoria). */
export type RecursoMes = {
  categoria: RecursoTipo;
  ano: number;
  mes: number;
  periodoLabel: string;
  contratadoQtde: number | null;
  realQtde: number | null;
  contratadoRs: number | null;
  realRs: number | null;
};

/** Resumo consolidado de uma categoria (MOD | MOI | EQP). */
export type CategoriaResumo = {
  categoria: RecursoTipo;
  /** Label de UI: "MOD" / "MOI" / "Equipamentos". */
  label: string;
  /** Unidade do total (Σ mensal): "homens·mês" / "unid.·mês". */
  unidade: string;
  /** Substantivo da lista: "funções" / "itens". */
  plural: string;
  /** Singular do `plural`: "função" / "item". */
  singular: string;
  nItens: number;
  /** Total contratado (Σ histograma mensal — completo). */
  contratadoQtde: number;
  contratadoRs: number | null;
  /** true quando ALGUM item da categoria traz R$ por função (MOD/EQP). false quando o R$ só existe
   *  agregado no histograma (MOI) — a coluna Custo da tabela fica "—" e o KPI explica a origem. */
  rsPorItem: boolean;
  /** Real alocado (Σ histograma) — 0 em pré-execução. */
  realQtde: number;
  realRs: number | null;
  /** true quando há QUALQUER real alocado > 0 (libera o eixo real). */
  temReal: boolean;
  /** Pico de mobilização: maior efetivo contratado num mês + rótulo do mês. */
  picoQtde: number;
  picoLabel: string;
  /** Σ da lista por função (pode ser < contratadoQtde se a lista for parcial). */
  catalogoQtde: number;
  /** true quando a lista por função não fecha o total do histograma (área-cega, ex.: MOI). */
  catalogoParcial: boolean;
  /** true quando NÃO há catálogo por função mas HÁ histograma (ex.: BR-101): o recurso está
   *  declarado no histograma, mas o detalhamento por função não foi normalizado. A UI deve mostrar
   *  "catálogo por função pendente" — NUNCA "0 funções"/"não declarou" (PENDENTE ≠ 0). */
  catalogoAusente: boolean;
  /** Série mensal contratado (para o gráfico de mobilização). */
  serieMensal: Array<{
    ano: number;
    mes: number;
    periodoLabel: string;
    contratadoQtde: number;
    contratadoRs: number;
    /** null = mês NÃO MEDIDO (PENDENTE ≠ 0) — o gráfico corta a linha/barra no último medido. */
    realQtde: number | null;
    realRs: number | null;
  }>;
};

export type RecursosResumo = {
  /** 'ok' = gate de conservação (qtde) fechou · 'needs_review' = algum item em revisão. */
  status: string;
  nItensTotal: number;
  /** true se QUALQUER categoria já tem real alocado (obra em execução). */
  temRealGlobal: boolean;
  /** Ressalvas de conservação derivadas (lista por função parcial, R$ só agregado…). Vazio = sem
   *  ressalva → o badge pode mostrar "Conservação OK"; não-vazio → "Conservação parcial". */
  ressalvas: string[];
  categorias: Record<RecursoTipo, CategoriaResumo>;
  /** Todos os itens (a aba filtra pela categoria selecionada). */
  itens: RecursoItem[];
  /** Maiores desvios de alocação por recurso (R$ acum até o BM · Real − Contratado · C.4). Vazio se
   *  o ranking não foi normalizado. */
  maioresDesvios: RecursoDesvio[];
};

/** Um recurso no ranking de maiores desvios de alocação (R$ acum). */
export type RecursoDesvio = {
  recurso: string;
  contratadoRs: number | null;
  realRs: number | null;
  desvioRs: number | null;
};

const CAT_META: Record<
  RecursoTipo,
  { label: string; unidade: string; plural: string; singular: string }
> = {
  MOD: { label: "MOD", unidade: "homens·mês", plural: "funções", singular: "função" },
  MOI: { label: "MOI", unidade: "homens·mês", plural: "funções", singular: "função" },
  EQP: { label: "Equipamentos", unidade: "unid.·mês", plural: "itens", singular: "item" },
};
const ORDEM_CAT: RecursoTipo[] = ["MOD", "MOI", "EQP"];

function n(x: number | null | undefined): number | null {
  return x != null && Number.isFinite(Number(x)) ? Number(x) : null;
}

/** Plano de recursos (MOD/MOI/EQP) de uma obra. Null se ainda não normalizado. */
export async function getRecursos(contractId: string): Promise<RecursosResumo | null> {
  const [itensRes, mesesRes, desvioRes] = await Promise.all([
    untypedTable("obra_recursos")
      .select(
        "ordem, categoria, recurso, contratado_qtde, real_qtde, contratado_rs, real_rs, status",
      )
      .eq("contrato_id", contractId)
      .order("categoria", { ascending: true })
      .order("contratado_qtde", { ascending: false })
      .order("ordem", { ascending: true }),
    untypedTable("obra_recursos_meses")
      .select(
        "categoria, ano, mes, periodo_label, contratado_qtde, real_qtde, contratado_rs, real_rs",
      )
      .eq("contrato_id", contractId)
      .order("ano", { ascending: true })
      .order("mes", { ascending: true }),
    untypedTable("obra_recursos_desvio")
      .select("ordem, recurso, contratado_rs, real_rs, desvio_rs")
      .eq("contrato_id", contractId)
      .order("ordem", { ascending: true }),
  ]);

  // Falha de leitura não pode virar "obra não normalizada" silenciosa — falhe alto (erro = milhões).
  if (itensRes.error) throw new Error(itensRes.error.message);
  if (mesesRes.error) throw new Error(mesesRes.error.message);
  if (desvioRes.error) throw new Error(desvioRes.error.message);
  const itensRaw = itensRes.data;
  const mesesRaw = mesesRes.data;

  const itensRows = (itensRaw ?? []) as Array<{
    ordem: number;
    categoria: RecursoTipo;
    recurso: string;
    contratado_qtde: number | null;
    real_qtde: number | null;
    contratado_rs: number | null;
    real_rs: number | null;
    status: string | null;
  }>;
  // Só é "não normalizado" se AMBAS as fontes faltarem. O catálogo por função (obra_recursos) pode
  // estar vazio enquanto o histograma mensal (obra_recursos_meses) já traz os totais por categoria
  // (ex.: BR-101) — nesse caso montamos as categorias por agregação do histograma e as listas por
  // função ficam vazias (área-cega sinalizada na UI), em vez de esconder o dado que existe.
  if (itensRows.length === 0 && (mesesRaw ?? []).length === 0) return null;

  const itens: RecursoItem[] = itensRows.map((r) => ({
    ordem: r.ordem,
    categoria: r.categoria,
    recurso: r.recurso,
    contratadoQtde: n(r.contratado_qtde),
    realQtde: n(r.real_qtde),
    contratadoRs: n(r.contratado_rs),
    realRs: n(r.real_rs),
  }));

  const meses = (
    (mesesRaw ?? []) as Array<{
      categoria: RecursoTipo;
      ano: number;
      mes: number;
      periodo_label: string;
      contratado_qtde: number | null;
      real_qtde: number | null;
      contratado_rs: number | null;
      real_rs: number | null;
    }>
  ).map((r) => ({
    categoria: r.categoria,
    ano: r.ano,
    mes: r.mes,
    periodoLabel: r.periodo_label,
    contratadoQtde: n(r.contratado_qtde),
    realQtde: n(r.real_qtde),
    contratadoRs: n(r.contratado_rs),
    realRs: n(r.real_rs),
  }));

  const categorias = {} as Record<RecursoTipo, CategoriaResumo>;
  for (const cat of ORDEM_CAT) {
    const meta = CAT_META[cat];
    const catItens = itens.filter((i) => i.categoria === cat);
    const catMeses = meses.filter((m) => m.categoria === cat);

    // Totais autoritativos do histograma mensal (completo). Σ ignora null (lacuna ≠ 0 silencioso).
    let contratadoQtde = 0;
    let contratadoRs = 0;
    let temRs = false;
    let realQtde = 0;
    let realRs = 0;
    let picoQtde = -1;
    let picoLabel = "—";
    const serieMensal: CategoriaResumo["serieMensal"] = [];
    for (const m of catMeses) {
      const cq = m.contratadoQtde ?? 0;
      const cr = m.contratadoRs ?? 0;
      const rq = m.realQtde ?? 0;
      contratadoQtde += cq;
      if (m.contratadoRs != null) {
        contratadoRs += m.contratadoRs;
        temRs = true;
      }
      realQtde += rq;
      realRs += m.realRs ?? 0;
      if (cq > picoQtde) {
        picoQtde = cq;
        picoLabel = m.periodoLabel;
      }
      serieMensal.push({
        ano: m.ano,
        mes: m.mes,
        periodoLabel: m.periodoLabel,
        contratadoQtde: cq,
        contratadoRs: cr,
        // null preservado da fonte: mês não medido ≠ "0 medido" (o consumidor decide somar ou cortar)
        realQtde: m.realQtde,
        realRs: m.realRs,
      });
    }

    const catalogoQtde = catItens.reduce((s, i) => s + (i.contratadoQtde ?? 0), 0);
    // se não houver histograma da categoria, cai pro catálogo (defensivo)
    const totalQtde = catMeses.length ? contratadoQtde : catalogoQtde;
    const rsPorItem = catItens.some((i) => i.contratadoRs != null);

    categorias[cat] = {
      categoria: cat,
      label: meta.label,
      unidade: meta.unidade,
      plural: meta.plural,
      singular: meta.singular,
      nItens: catItens.length,
      contratadoQtde: totalQtde,
      contratadoRs: temRs ? contratadoRs : null,
      rsPorItem,
      realQtde,
      realRs,
      temReal: realQtde > 0 || realRs > 0,
      picoQtde: picoQtde < 0 ? 0 : picoQtde,
      picoLabel,
      catalogoQtde,
      catalogoParcial:
        catMeses.length > 0 && catItens.length > 0 && Math.abs(catalogoQtde - totalQtde) > 0.5,
      // recurso declarado no histograma, mas sem detalhamento por função normalizado (≠ "0 funções").
      catalogoAusente: catItens.length === 0 && catMeses.length > 0,
      serieMensal,
    };
  }

  const status = itensRows.some((r) => r.status === "needs_review") ? "needs_review" : "ok";
  const temRealGlobal = ORDEM_CAT.some((c) => categorias[c].temReal);

  // Ressalvas de conservação (derivadas) — a divergência fica VISÍVEL à UI, não escondida.
  const ressalvas: string[] = [];
  for (const c of ORDEM_CAT) {
    const r = categorias[c];
    if (r.catalogoParcial) {
      ressalvas.push(
        `${r.label}: histograma soma ${Math.round(r.contratadoQtde)}; lista por função detalha ${Math.round(r.catalogoQtde)} (parcial).`,
      );
    }
    if (r.contratadoRs != null && !r.rsPorItem) {
      ressalvas.push(
        `${r.label}: custo R$ vem do histograma mensal (a fonte não traz R$ por função).`,
      );
    }
  }

  const maioresDesvios: RecursoDesvio[] = (
    (desvioRes.data ?? []) as Array<Record<string, number | string | null>>
  ).map((r) => ({
    recurso: String(r.recurso ?? ""),
    contratadoRs: n(r.contratado_rs as number | null),
    realRs: n(r.real_rs as number | null),
    desvioRs: n(r.desvio_rs as number | null),
  }));

  return {
    status,
    nItensTotal: itens.length,
    temRealGlobal,
    ressalvas,
    categorias,
    itens,
    maioresDesvios,
  };
}
