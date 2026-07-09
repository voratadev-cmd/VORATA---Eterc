// Adapter Indicadores e Farol (RMA · C.2) → RelatorioDados. Esta é a aba de CONSOLIDAÇÃO: lê os 4
// read-models reais (faturamento · prazo · recursos · insumos), classifica cada bloco pelo DESVIO em
// p.p. do contrato total (régua C.2: Conforme ≥ −1 · Observação −3 a −1 · Risco −8 a −3 · Crítico
// < −8) e consolida no PIOR bloco. Replica EXATAMENTE a lógica da rota indicadores.tsx (computeBlocos
// /computeConsolidado) — paridade dura: os números do relatório batem com a tela. PENDENTE ≠ 0.

import { type FarolLevel, farolLabel } from "@/lib/mocks/contracts";
import { fetchFaturamentoBm } from "@/lib/hooks/useFaturamentoBm";
import { fetchFaturamentoCalc } from "@/lib/hooks/useFaturamentoCalc";
import { fetchPrazoBm } from "@/lib/hooks/usePrazoBm";
import { getRecursos } from "@/lib/supabase/recursos";
import { getInsumos } from "@/lib/supabase/insumos";
import { getInsumoExcedente } from "@/lib/supabase/insumoExcedente";
import type { RelatorioDados, RelatorioFarol } from "@/lib/relatorio/schema";

// ── Helpers de formato (idênticos à rota indicadores.tsx · PT-BR · tabular · minus U+2212) ─────

const fmtPct1 = (v: number | null | undefined) =>
  v != null
    ? `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
    : "—";

const fmtPct1Signed = (v: number | null | undefined) => {
  if (v == null) return "—";
  const sign = v < 0 ? "−" : v > 0 ? "+" : "";
  return `${sign}${Math.abs(v).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
};

const fmtPp = (v: number | null | undefined) => {
  if (v == null) return "—";
  const sign = v < 0 ? "−" : v > 0 ? "+" : "";
  return `${sign}${Math.abs(v).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} p.p.`;
};

const fmtInt = (v: number | null | undefined) =>
  v != null ? v.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "—";

/** R$ em milhões com 2 casas (a partir de reais brutos). Ex.: 78_636_026 → "R$ 78,64 mi". */
const fmtMi2 = (reais: number | null | undefined) =>
  reais != null
    ? `R$ ${(reais / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`
    : "—";

// ── Régua C.2 (desvio em p.p. do contrato) — idêntica à rota ───────────

function farolPorDesvioPp(d: number): FarolLevel {
  if (d >= -1) return "conforme";
  if (d >= -3) return "observacao";
  if (d >= -8) return "risco";
  return "critico";
}
const SEV: Record<FarolLevel, number> = { conforme: 0, observacao: 1, risco: 2, critico: 3 };
const CATS = ["MOD", "MOI", "EQP"] as const;

type MesCorte = { ano: number; mes: number };

function acumAteCorte(
  serie: Array<{ ano: number; mes: number; contratadoQtde: number | null }>,
  corte: MesCorte,
): number {
  let s = 0;
  for (const m of serie) {
    if (m.ano < corte.ano || (m.ano === corte.ano && m.mes <= corte.mes)) {
      s += m.contratadoQtde ?? 0;
    }
  }
  return s;
}

/** Desvio médio ponderado (índice de mercado vs orçado) — idêntico à rota. */
function desvioMedioPonderado(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  excedente: any,
): number | null {
  const itens = (excedente?.comIndice ?? []) as Array<{
    deltaRealPct: number | null;
    qtdOrcada: number | null;
    precoOrcadoRs: number | null;
  }>;
  let wsum = 0;
  let w = 0;
  for (const it of itens) {
    if (it.deltaRealPct == null || it.qtdOrcada == null || it.precoOrcadoRs == null) continue;
    const peso = it.qtdOrcada * it.precoOrcadoRs;
    if (peso <= 0) continue;
    wsum += it.deltaRealPct * peso;
    w += peso;
  }
  return w > 0 ? (wsum / w) * 100 : null;
}

// ── Blocos (valor + footer + farol) — replica computeBlocos da rota ────

type Bloco = {
  key: string;
  titulo: string;
  valorTexto: string;
  footer: string;
  nivel: FarolLevel | null; // null = pendente (sem medida)
};

function computeBlocos({
  calc,
  recursos,
  prazo,
  insumos,
  excedente,
  desvioFatPp,
  mesCorte,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  calc: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recursos: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prazo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  insumos: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  excedente: any;
  desvioFatPp: number | null;
  mesCorte: MesCorte;
}): Bloco[] {
  const out: Bloco[] = [];

  // 1 · Faturamento (avanço financeiro real %; farol pelo desvio em p.p.)
  out.push({
    key: "faturamento",
    titulo: "Faturamento",
    valorTexto: fmtPct1(calc?.avancoRealizadoPct),
    footer:
      calc?.realizadoAcum != null
        ? `${fmtMi2(calc.realizadoAcum)} de ${fmtMi2(calc.custoTotal)} · desvio ${fmtPp(desvioFatPp)}`
        : "pendente — sem real acumulado",
    nivel: desvioFatPp != null ? farolPorDesvioPp(desvioFatPp) : null,
  });

  // 2 · Prazo (decorrido %; farol pelo MESMO desvio financeiro em p.p.)
  out.push({
    key: "prazo",
    titulo: "Prazo",
    valorTexto: fmtPct1(prazo?.decorridoPct),
    footer:
      prazo?.decorridoDias != null
        ? `decorrido · ${fmtInt(prazo.decorridoDias)} de ${fmtInt(prazo.prazoContratualDias)} dias · desvio ${fmtPp(desvioFatPp)}`
        : "pendente — sem cronograma",
    nivel: desvioFatPp != null ? farolPorDesvioPp(desvioFatPp) : null,
  });

  // 3 · Recursos (desvio próprio = (Σreal − Σaté-BM)/Σtotal sobre categorias COM real medido)
  const rec = recursos?.categorias;
  if (rec) {
    let realT = 0;
    let ateT = 0;
    let totT = 0;
    const partes = CATS.map((cat) => {
      const c = rec[cat];
      const total = c?.contratadoQtde ?? 0;
      if (c?.temReal) {
        realT += c.realQtde ?? 0;
        ateT += acumAteCorte(c.serieMensal ?? [], mesCorte);
        totT += total;
      }
      return `${cat} ${c?.temReal && total > 0 ? fmtPct1(((c.realQtde ?? 0) / total) * 100) : "—"}`;
    });
    const temRealRec = recursos.temRealGlobal === true;
    const desvioRec = temRealRec && totT > 0 ? ((realT - ateT) / totT) * 100 : null;
    out.push({
      key: "recursos",
      titulo: "Recursos",
      valorTexto: partes.join(" · "),
      footer: temRealRec
        ? `alocado vs contrato · desvio ${fmtPp(desvioRec)}`
        : "pendente — real (alocado) não lançado",
      nivel: desvioRec != null ? farolPorDesvioPp(desvioRec) : null,
    });
  } else {
    out.push({
      key: "recursos",
      titulo: "Recursos",
      valorTexto: "—",
      footer: "pendente — recursos (C.4) ainda não normalizados",
      nivel: null,
    });
  }

  // 4 · Insumos (v53 multifonte) — mesma regra da rota: acima do IPCA → Observação (cl. 8.8)
  const desvioMedio = desvioMedioPonderado(excedente);
  const nAcimaIpca = excedente?.acimaTeto?.length ?? 0;
  out.push({
    key: "insumos",
    titulo: "Insumos",
    valorTexto: insumos ? (nAcimaIpca > 0 ? "Acima do IPCA" : "Dentro do índice") : "—",
    footer: insumos
      ? `${fmtInt(insumos.nInsumos)} monitorados · ${fmtInt(nAcimaIpca)} acima do IPCA · desvio médio ${fmtPct1Signed(desvioMedio)}`
      : "pendente — sem insumos normalizados",
    nivel: insumos ? (nAcimaIpca > 0 ? "observacao" : "conforme") : null,
  });

  return out;
}

function joinE(itens: string[]): string {
  if (itens.length === 0) return "";
  if (itens.length === 1) return itens[0];
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

type Consolidado = { nivel: FarolLevel; mensagem: string };

function computeConsolidado(blocos: Bloco[]): Consolidado | null {
  const medidos = blocos.filter((b) => b.nivel != null) as Array<Bloco & { nivel: FarolLevel }>;
  if (medidos.length === 0) return null;
  const pior = medidos.reduce((a, b) => (SEV[b.nivel] >= SEV[a.nivel] ? b : a));
  const nivel = pior.nivel;

  const semRiscoCritico = medidos.every((b) => b.nivel === "conforme" || b.nivel === "observacao");
  const piores = medidos.filter((b) => b.nivel === nivel).map((b) => b.titulo.toLowerCase());
  const nomes = joinE(piores);
  const nomesCap = nomes.charAt(0).toUpperCase() + nomes.slice(1);

  let mensagem: string;
  if (nivel === "conforme") {
    mensagem =
      "Todos os blocos dentro da régua. Faturamento, prazo, recursos e insumos conformes. Monitorar.";
  } else if (nivel === "observacao") {
    mensagem = `${semRiscoCritico ? "Nenhum bloco em Risco ou Crítico. " : ""}${nomesCap} levemente abaixo do previsto — desvios pequenos, próprios da fase de mobilização. Monitorar.`;
  } else if (nivel === "risco") {
    mensagem = `${nomesCap} em Risco — desvio relevante sobre o previsto. Priorizar ação corretiva.`;
  } else {
    mensagem = `${nomesCap} em situação Crítica — desvio severo sobre o previsto. Ação imediata.`;
  }

  return { nivel, mensagem };
}

/** DADOS reais da aba Indicadores e Farol p/ o relatório. null = obra sem faturamento normalizado
 *  (o faturamento gateia a tela, igual à rota). */
export async function dadosIndicadores(contractId: string): Promise<RelatorioDados | null> {
  const fatBm = await fetchFaturamentoBm(contractId);
  if (!fatBm) return null; // mesmo gate da rota: sem medições normalizadas → empty state

  // Carrega os 4 blocos em paralelo (mesmos read-models que a aba consome).
  const [calc, recursos, prazoBridge, insumos, excedente] = await Promise.all([
    fetchFaturamentoCalc(contractId),
    getRecursos(contractId),
    fetchPrazoBm(contractId),
    getInsumos(contractId),
    getInsumoExcedente(contractId),
  ]);
  const prazo = prazoBridge?.prazo ?? null;
  const fat = fatBm.fat;
  const mesCorte = fatBm.mesCorte;

  // Desvio em p.p. do contrato (real − previsto, mesma base) — eixo do farol C.2.
  const desvioFatPp =
    calc?.avancoRealizadoPct != null && calc?.avancoContratadoPct != null
      ? calc.avancoRealizadoPct - calc.avancoContratadoPct
      : null;

  const blocos = computeBlocos({
    calc,
    recursos,
    prazo,
    insumos,
    excedente,
    desvioFatPp,
    mesCorte,
  });
  const consolidado = computeConsolidado(blocos);
  // Farol OFICIAL da aba = consolidado (pior bloco). Sem nenhum bloco medido → observacao neutro.
  const farol: RelatorioFarol = consolidado?.nivel ?? "observacao";

  // Indicadores de cabeçalho = os 4 cards de bloco (valor + farol por bloco no hint).
  const indicadores = blocos.map((b) => ({
    label: b.titulo,
    valor: b.valorTexto,
    hint: b.nivel ? `farol ${farolLabel[b.nivel]}` : "pendente",
  }));

  // KPIs extras (campos diretos dos read-models — não recalcula nada): faturamento realizado em R$,
  // avanço físico real % e dias restantes. Físico real coerce p/ 0 quando PENDENTE (input vazio) →
  // não exibir 0,0% fabricado (mesma honestidade da aba Prazo).
  if (calc?.realizadoAcum != null) {
    indicadores.push({
      label: "Realizado acumulado",
      valor: fmtMi2(calc.realizadoAcum),
      hint: "faturamento real (cadeia de BMs)",
    });
  }
  if (prazo && prazo.fisicoRealPendente !== true && prazo.avancoFisicoRealPct != null) {
    indicadores.push({
      label: "Avanço físico real",
      valor: fmtPct1(prazo.avancoFisicoRealPct),
      hint: "execução física medida",
    });
  }
  if (prazo?.restantesDias != null) {
    indicadores.push({
      label: "Dias restantes",
      valor: `${fmtInt(prazo.restantesDias)} dias`,
      hint: "prazo contratual − decorrido",
    });
  }

  // Gráfico = Curva S de faturamento (mesma série da aba: contratado × real acumulado em R$ mi).
  const curva = (fat.curvaS ?? []) as Array<{
    bm: string;
    contratado: number;
    real: number | null;
  }>;
  const grafico = curva.length
    ? {
        tipo: "curva" as const,
        unidade: "R$ mi",
        legenda: "Curva de faturamento — previsto × real acumulado, em R$ milhões.",
        serie: curva.map((p) => ({ m: p.bm, previsto: p.contratado, real: p.real })),
      }
    : null;

  // Detalhamento = a tabela natural da consolidação: bloco × valor × desvio × farol.
  const detalhamento = {
    titulo: "Indicadores por bloco — farol pelo desvio em p.p. do contrato",
    colunas: ["Bloco", "Valor", "Situação", "Farol"],
    linhas: blocos.map((b) => [
      b.titulo,
      b.valorTexto,
      b.footer,
      b.nivel ? farolLabel[b.nivel] : "Pendente",
    ]),
  };

  return { titulo: "Indicadores e Farol", farol, indicadores, grafico, detalhamento };
}
