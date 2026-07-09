// Bridge §7.1 · Visão Geral — o overview executivo (entrada conceitual do RMA). Tipo ESTREITO
// (Pick) sobre BmSnapshot + VisaoGeralData. REUSA buildFaturamentoBm e buildPrazoBm para os
// nested REAIS (Curva S do mini-gráfico, Donut de prazo); blocos de farol vêm do calcIndicadores.
// PENDENTES honestos: recursos (sem histogramas), desequilíbrio (M3), diagnóstico/eventos (IA),
// síntese (campos do contrato ainda não normalizados), entregáveis. Honestidade: situação NEUTRA
// com cobertura parcial (igual Indicadores).

import { formatBRL } from "@/lib/mocks/contracts";
import type { DiagnosticoIA } from "@/lib/supabase/sinteses";
import type {
  BmSnapshot,
  RecursosBarraMensal,
  RecursosBM,
  RecursosCurvaAcumulada,
  RecursosGrupo,
  RecursosTipo,
  VisaoGeralData,
} from "@/lib/mocks/obras";
import type { Obra } from "@/lib/supabase/obras";
import type { Desequilibrio } from "@/lib/supabase/desequilibrio";
import type { RecursosResumo } from "@/lib/supabase/recursos";
import type { FaturamentoReal } from "@/lib/supabase/medicoes";
import type { FaturamentoCalc } from "./calcFaturamento";
import type { IndicadoresCalc } from "./calcIndicadores";
import type { FaturamentoBridge } from "./bridgeFaturamento";
import type { PrazoBridge } from "./bridgePrazo";
import { toBlocoFarol } from "./bridgeIndicadores";

/** Campos do BmSnapshot que a aba Visão Geral consome.
 * faturamentoPct/contratadoPct viram nuláveis aqui: fonte sem custo_total ⇒ null ⇒ "—" na aba
 * (PENDENTE ≠ "0%" fabricado). */
export type VgViewBm = Omit<
  Pick<
    BmSnapshot,
    | "numero"
    | "desequilibrioAcumulado"
    | "desequilibrioMesAtual"
    | "desequilibrioPctValor"
    | "faturamentoPct"
    | "faturamentoContratadoPct"
    | "prazoDecorridoDias"
    | "situacao"
    | "situacaoPendente"
    | "situacaoLabel"
    | "diagnostico"
    | "blocoFaturamento"
    | "blocoRecursos"
    | "blocoProdutividade"
    | "blocoPrazo"
    | "blocoDesequilibrio"
    | "faturamento"
    | "recursos"
    | "prazo"
    | "ultimosEventos"
  >,
  "faturamentoPct" | "faturamentoContratadoPct"
> & {
  faturamentoPct: number | null;
  faturamentoContratadoPct: number | null;
};

/** Campos da VisaoGeralData (metadados da obra) que a aba consome.
 * tacsEmNegociacao nulável: TACs nunca foram normalizados ⇒ null ⇒ "—" (não afirmar "nenhum"
 * sobre área cega). */
export type VgViewMeta = Omit<
  Pick<VisaoGeralData, "prazoTotalDias" | "terminoPrevistoISO" | "sinteseResumida" | "entregaveis">,
  "sinteseResumida"
> & {
  sinteseResumida: Omit<VisaoGeralData["sinteseResumida"], "tacsEmNegociacao"> & {
    tacsEmNegociacao: number | null;
  };
};

export type VisaoGeralBridge = {
  bm: VgViewBm;
  visao: VgViewMeta;
  bmLabel: string;
  /** Diagnóstico estruturado da IA (ancorado nos fatos). Null se ainda não gerado. */
  diagnosticoIA: DiagnosticoIA | null;
};

/** RecursosGrupo pendente — sem histograma normalizado (gap #1/#6). curvaAcumulada vazia → 0/0. */
function grupoPendente(label: string, unidade: string): RecursosGrupo {
  return {
    label,
    unidade,
    contratadoTotalLabel: "—",
    contratadoTotalNota: "pendente — histograma (§2/§6)",
    previstoAteBmLabel: "—",
    previstoAteBmNota: "pendente",
    realAlocadoLabel: "—",
    realAlocadoNota: "pendente",
    desvioPct: 0,
    desvioFarol: "observacao",
    desvioNotaLabel: "pendente",
    custoRealLabel: "—",
    custoNotaLabel: "pendente",
    barrasMensais: [],
    barrasObservacao: "Pendente — histogramas de recursos não normalizados (§2/§6).",
    curvaAcumulada: [],
    curvaUltimoRealLabel: "—",
    curvaUltimoContratadoLabel: "—",
  };
}

// Mini-chart de Recursos da Visão Geral a partir do RecursosResumo REAL (não mais zerado via
// recursosPendente). Preenche contratado SEMPRE (histograma existe) + real onde medido nos BMs.
function recursosFromResumo(rec: RecursosResumo): RecursosBM {
  const ORDEM = ["MOD", "MOI", "EQP"] as const;
  const fmtQ = (n: number | null) =>
    n != null ? n.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "—";
  const porGrupo = {} as Record<RecursosTipo, RecursosGrupo>;
  for (const c of ORDEM) {
    const cat = rec.categorias[c];
    let accC = 0;
    let accR = 0;
    const barras: RecursosBarraMensal[] = [];
    const curva: RecursosCurvaAcumulada[] = [];
    // o consumidor (MiniRecursosChart da VG) lê só o ÚLTIMO ponto (totais contratado × real
    // acumulado) — não desenha linha temporal, então o acumulado cheio é o valor certo aqui
    for (const m of cat.serieMensal ?? []) {
      accC += m.contratadoQtde ?? 0;
      accR += m.realQtde ?? 0;
      barras.push({ bm: m.periodoLabel, contratado: m.contratadoQtde ?? 0, real: m.realQtde ?? 0 });
      curva.push({ bm: m.periodoLabel, contratado: accC, real: cat.temReal ? accR : 0 });
    }
    porGrupo[c] = {
      label: cat.label,
      unidade: cat.unidade,
      contratadoTotalLabel: `${fmtQ(cat.contratadoQtde)} ${cat.unidade}`,
      contratadoTotalNota: cat.contratadoRs != null ? formatBRL(cat.contratadoRs) : "histograma",
      previstoAteBmLabel: "—",
      previstoAteBmNota: "previsto até o BM pendente",
      realAlocadoLabel: cat.temReal ? `${fmtQ(cat.realQtde)} ${cat.unidade}` : "—",
      realAlocadoNota: cat.temReal ? "medido nos BMs" : "pré-execução (real não medido)",
      desvioPct: 0,
      desvioFarol: "observacao",
      desvioNotaLabel: cat.temReal ? "mobilização vs contratado · régua pendente" : "pendente",
      custoRealLabel: cat.temReal && cat.realRs != null ? formatBRL(cat.realRs) : "—",
      custoNotaLabel: cat.temReal ? "custo real alocado" : "pendente",
      barrasMensais: barras,
      barrasObservacao: cat.temReal
        ? "Contratado × Real medido nos BMs."
        : "Contratado (histograma) · real pendente.",
      curvaAcumulada: curva,
      curvaUltimoRealLabel: cat.temReal ? fmtQ(accR) : "—",
      curvaUltimoContratadoLabel: fmtQ(accC),
    };
  }
  const comReal = ORDEM.filter((c) => rec.categorias[c].temReal);
  return {
    porGrupo,
    analiseCruzada: comReal.length
      ? `Real medido em ${comReal.join("+")} · análise cruzada com produtividade pendente.`
      : "Pendente — análise cruzada depende dos histogramas (§2) e produtividade (§1.3).",
    resumoCruzado: [],
    resumoObservacao: rec.temRealGlobal
      ? "Recursos com alocação real medida nos BMs."
      : "Pendente.",
    chatQuote: "",
    chatSugestoes: [],
  };
}

function recursosPendente(): RecursosBM {
  const porGrupo = {
    MOD: grupoPendente("MOD", "Hh"),
    MOI: grupoPendente("MOI", "Hh"),
    EQP: grupoPendente("Equipamentos", "unid.×mês"),
  } as Record<RecursosTipo, RecursosGrupo>;
  return {
    porGrupo,
    analiseCruzada:
      "Pendente — análise cruzada depende dos histogramas (§2) e produtividade (§1.3).",
    resumoCruzado: [],
    resumoObservacao: "Pendente.",
    chatQuote: "",
    chatSugestoes: [],
  };
}

/** Monta a Visão Geral real. null se não há o núcleo (faturamento/prazo/indicadores). */
export function buildVisaoGeralView(args: {
  fatBridge: FaturamentoBridge | null;
  prazoBridge: PrazoBridge | null;
  ind: IndicadoresCalc | null;
  fat: FaturamentoCalc | null;
  real: FaturamentoReal;
  obra: Obra | null;
  bmLabel: string;
  desequilibrio?: Desequilibrio | null;
  recursos?: RecursosResumo | null;
  diagnosticoIA?: DiagnosticoIA | null;
}): VisaoGeralBridge | null {
  const { fatBridge, prazoBridge, ind, fat, real, obra, bmLabel, desequilibrio, recursos } = args;
  if (!fatBridge || !prazoBridge || !ind) return null;

  const pz = prazoBridge.prazo;
  const byChave = new Map(ind.blocos.map((b) => [b.chave, b]));
  const custoTotal = fat?.custoTotal ?? real.contratadoTotal ?? 0;
  // Denominador OFICIAL do % de desequilíbrio = obras.valor_contratual ?? custo_total da curva (mesma
  // precedência do getDeseqContexto que alimenta o painel D.0). Sem isso, o hero (custoTotal) e o painel
  // (valor_contratual) exibiriam "% do contrato" DIFERENTE pro mesmo número quando há PV manual na obra.
  const valorManual = obra?.valor_contratual != null ? Number(obra.valor_contratual) : null;
  const denomDeseq = valorManual ?? custoTotal;

  // desequilíbrio REAL (D.0 · M3) quando normalizado; senão 0 + o bloco fica pendente (a aba checa
  // blocoDesequilibrio.pendente p/ não afirmar "sem desequilíbrio" sobre área cega).
  const deseqTotal = desequilibrio?.totalRs ?? 0;
  const bm: VgViewBm = {
    numero: bmLabel,
    desequilibrioAcumulado: deseqTotal,
    desequilibrioMesAtual: 0,
    desequilibrioPctValor:
      deseqTotal > 0 && denomDeseq ? Math.round((deseqTotal / denomDeseq) * 1000) / 10 : 0,
    // faturamento físico-financeiro (real) — null quando a curva não tem custo_total (a aba
    // mostra "—"; "0%" aqui seria dado fabricado com medições existindo)
    faturamentoPct:
      fat?.avancoRealizadoPct != null ? Math.round(fat.avancoRealizadoPct * 10) / 10 : null,
    faturamentoContratadoPct:
      fat?.avancoContratadoPct != null ? Math.round(fat.avancoContratadoPct * 10) / 10 : null,
    prazoDecorridoDias: pz.decorridoDias,
    // HONESTO: situação neutra com cobertura parcial (não verde "Conforme")
    situacao: ind.farolGeral ?? "observacao",
    situacaoPendente: ind.farolGeral == null,
    situacaoLabel: ind.situacaoLabel,
    diagnostico: "Pendente — diagnóstico do Adm Contratual IA a partir dos números normalizados.",
    blocoFaturamento: toBlocoFarol(byChave.get("faturamento")),
    blocoRecursos: toBlocoFarol(byChave.get("recursos")),
    blocoProdutividade: toBlocoFarol(byChave.get("produtividade")),
    blocoPrazo: toBlocoFarol(byChave.get("prazo")),
    blocoDesequilibrio: toBlocoFarol(byChave.get("desequilibrio")),
    // nested REAIS (reuso dos bridges) + recursos pendente
    faturamento: fatBridge.fat,
    recursos: recursos ? recursosFromResumo(recursos) : recursosPendente(),
    prazo: pz,
    ultimosEventos: [],
  };

  const visao: VgViewMeta = {
    prazoTotalDias: pz.prazoContratualDias,
    terminoPrevistoISO: pz.fimContratualISO || "",
    sinteseResumida: {
      cliente: obra?.contratante || obra?.nome_interno || "—",
      modalidade: obra?.modalidade || "—",
      valorContratado: custoTotal ? formatBRL(custoTotal) : "—",
      saldoFaturar: real.saldoFaturar != null ? formatBRL(real.saldoFaturar) : "—",
      assinaturaISO: obra?.data_assinatura || pz.inicioISO || "",
      terminoPrevistoISO: pz.fimContratualISO || "",
      prazoLabel: `${pz.decorridoDias} / ${pz.prazoContratualDias} dias (${pz.decorridoPct.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%)`,
      reajuste: obra?.indice_reajuste || "— (pendente · §1.6/§3)",
      gestorObra: obra?.gestor_obra || "— (pendente · §4.2)",
      admContratual: obra?.adm_contratual || "— (pendente · §4.2)",
      documentosIndexados: null, // PENDENTE ≠ ZERO: não indexado → "—", não "0 itens" fabricado
      tacsEmNegociacao: null, // idem: TACs nunca normalizados → "—", não "nenhum em negociação"
    },
    entregaveis: [],
  };

  return { bm, visao, bmLabel, diagnosticoIA: args.diagnosticoIA ?? null };
}
