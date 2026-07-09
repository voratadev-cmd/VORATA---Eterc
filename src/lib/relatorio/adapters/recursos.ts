// Adapter Recursos → RelatorioDados. Mapeia o read-model REAL da aba (getRecursos · MOD/MOI/EQP) para
// os DADOS do relatório — paridade com a tela. A aba mostra a aderência de alocação por categoria
// (real ÷ contratado até o BM, em quantidade), a curva de efetivo e o ranking de desvios. A IA só
// escreve a narrativa ancorada nestes números.
//
// HONESTIDADE: em obra pré-execução (ex.: BR-101) o eixo REAL (alocado) não foi medido — temReal=false.
// Nesse caso a aderência/farol por categoria ficam "Pendente" (nunca verde sobre área cega): o
// indicador mostra "—", o farol da aba cai para "observacao" (info · pendente) e a curva REAL fica null.

import { fetchFaturamentoBm } from "@/lib/hooks/useFaturamentoBm";
import { getRecursos, type CategoriaResumo, type RecursoTipo } from "@/lib/supabase/recursos";
import { type FarolLevel } from "@/lib/rma/farol";
import { formatBRLAbbreviated } from "@/lib/mocks/contracts";
import type { RelatorioDados, RelatorioFarol } from "@/lib/relatorio/schema";

const CRUZ_CATS: RecursoTipo[] = ["MOD", "MOI", "EQP"];

type CorteMes = { ano: number; mes: number };

const fmtQtde = (v: number | null): string =>
  v != null ? v.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "—";
const fmtPct = (v: number | null): string =>
  v != null
    ? `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
    : "—";
const signedQtde = (v: number | null): string =>
  v != null ? `${v > 0 ? "+" : v < 0 ? "−" : ""}${fmtQtde(Math.abs(v))}` : "—";
// R$ acum (cru) do ranking de desvios — MESMA formatação da aba (formatBRLAbbreviated em recursos.tsx).
const fmtRs = (v: number | null): string => (v != null ? formatBRLAbbreviated(v) : "—");
const signedRs = (v: number | null): string =>
  v != null ? `${v > 0 ? "+" : v < 0 ? "−" : ""}${formatBRLAbbreviated(Math.abs(v))}` : "—";

// Bandas simétricas de |aderência − 100%| (pp) — idênticas à aba (ALOC_DESVIO_PP em recursos.tsx).
const ALOC_DESVIO_PP = { conforme: 5, observacao: 15, risco: 30 };
function farolAlocacao(aderencia: number | null): FarolLevel | null {
  if (aderencia == null) return null;
  const desvioPp = Math.abs(aderencia * 100 - 100);
  if (desvioPp <= ALOC_DESVIO_PP.conforme) return "conforme";
  if (desvioPp <= ALOC_DESVIO_PP.observacao) return "observacao";
  if (desvioPp <= ALOC_DESVIO_PP.risco) return "risco";
  return "critico";
}
const SEVERIDADE: Record<FarolLevel, number> = { conforme: 0, observacao: 1, risco: 2, critico: 3 };

// Acumula contratado/real de recursos ATÉ o mês de corte (Σ serieMensal ≤ corte) — MESMA lógica da
// aba (acumRecAteCorte): banana com banana, mesmo horizonte do faturamento. real null se a categoria
// não tem alocação medida (temReal=false).
function acumRecAteCorte(cat: CategoriaResumo, corte: CorteMes) {
  let cq = 0;
  let cr = 0;
  let rq = 0;
  let rr = 0;
  for (const m of cat.serieMensal) {
    if (m.ano < corte.ano || (m.ano === corte.ano && m.mes <= corte.mes)) {
      cq += m.contratadoQtde;
      cr += m.contratadoRs;
      rq += m.realQtde ?? 0;
      rr += m.realRs ?? 0;
    }
  }
  return { cq, cr, rq: cat.temReal ? rq : null, rr: cat.temReal ? rr : null };
}

/** DADOS reais da aba Recursos p/ o relatório (null = obra sem recursos normalizados). */
export async function dadosRecursos(contractId: string): Promise<RelatorioDados | null> {
  const data = await getRecursos(contractId);
  if (!data) return null;

  // Corte (mês do BM) — mesmo horizonte do faturamento. Sem faturamento → sem corte → acumula tudo
  // (a aba também perde o "até o BM"; mas os totais por categoria seguem do histograma completo).
  const bridge = await fetchFaturamentoBm(contractId).catch(() => null);
  const corte: CorteMes | null = bridge?.mesCorte ?? null;
  const bmLabel = bridge?.bmLabel ?? null;

  // Acumulado por categoria até o BM (ou total quando sem corte) — espelha RecKpis/RecResumoCat.
  const acum = (cat: CategoriaResumo) =>
    corte
      ? acumRecAteCorte(cat, corte)
      : (() => {
          // sem corte: usa o total do histograma já consolidado no resumo
          const rq = cat.temReal ? cat.realQtde : null;
          const rr = cat.temReal ? cat.realRs : null;
          return { cq: cat.contratadoQtde, cr: cat.contratadoRs ?? 0, rq, rr };
        })();

  // ── Farol oficial da aba: pior aderência de alocação entre as categorias COM real medido.
  // Pré-execução (nenhuma categoria medida) → não há farol sobre área cega: cai p/ "observacao"
  // (pendente · info), exatamente como a aba pinta "Pendente" + badge de conservação info.
  let piorFarol: FarolLevel | null = null;
  for (const c of CRUZ_CATS) {
    const a = acum(data.categorias[c]);
    const ader = a.rq != null && a.cq > 0 ? a.rq / a.cq : null;
    const f = farolAlocacao(ader);
    if (f && (piorFarol == null || SEVERIDADE[f] > SEVERIDADE[piorFarol])) piorFarol = f;
  }
  const farol: RelatorioFarol = piorFarol ?? "observacao";

  // ── Indicadores: aderência acum por categoria (3 KPIs do cabeçalho) + conservação (4º informativo).
  const indicadores = CRUZ_CATS.map((c) => {
    const cat = data.categorias[c];
    const a = acum(cat);
    const ader = a.rq != null && a.cq > 0 ? a.rq / a.cq : null;
    const f = farolAlocacao(ader);
    const hint =
      ader != null
        ? `${fmtQtde(a.rq)} real ÷ ${fmtQtde(a.cq)} contratado${bmLabel ? ` até ${bmLabel}` : ""}`
        : cat.catalogoAusente
          ? "real pendente · catálogo por função não normalizado"
          : "real (alocado) ainda não medido — pendente";
    return {
      label: `Aderência ${cat.label}`,
      valor: ader != null ? `${fmtPct(ader)} · ${f ? FAROL_PT[f] : "—"}` : "—",
      hint,
    };
  });
  // 4º indicador: estado de conservação da aba (badge do cabeçalho) — NÃO "0 itens" (o histograma
  // existe; só o catálogo por função pode faltar). PENDENTE ≠ 0.
  const conservacao =
    data.status === "needs_review"
      ? "Em revisão"
      : data.ressalvas.length > 0
        ? "Conservação parcial"
        : "Conservação OK";
  const catalogoAusente = CRUZ_CATS.every((c) => data.categorias[c].catalogoAusente);
  const conservHint = catalogoAusente
    ? "custo do histograma mensal · catálogo por função pendente"
    : data.ressalvas.length > 0
      ? data.ressalvas[0]
      : data.temRealGlobal
        ? "histograma e alocação real conferem"
        : "plano contratado · alocação real ainda não medida";
  indicadores.push({
    label: "Conservação do plano",
    valor: conservacao,
    hint: conservHint,
  });
  // Pico de mobilização da MOD: maior efetivo contratado num mês + rótulo do mês (label pronto na aba).
  const catMod = data.categorias.MOD;
  if (catMod && catMod.picoLabel && catMod.picoLabel !== "—" && catMod.picoQtde > 0) {
    indicadores.push({
      label: "Pico de mobilização (MOD)",
      valor: `${fmtQtde(catMod.picoQtde)} ${catMod.unidade}`,
      hint: `mês de pico: ${catMod.picoLabel}`,
    });
  }

  // ── Gráfico: curva de efetivo da MOD (categoria default da aba) — contratado × real acumulado
  // em homens·mês. Real para no último mês medido (null adiante = gap), idêntico ao histograma da aba.
  const mod = data.categorias.MOD;
  let grafico: RelatorioDados["grafico"] = null;
  if (mod && mod.serieMensal.length > 0) {
    let ultimoMedido = -1;
    mod.serieMensal.forEach((m, i) => {
      if (m.realQtde != null || m.realRs != null) ultimoMedido = i;
    });
    let cq = 0;
    let rq = 0;
    const serie = mod.serieMensal.map((m, i) => {
      cq += m.contratadoQtde;
      rq += m.realQtde ?? 0;
      const medido = mod.temReal && i <= ultimoMedido;
      return { m: m.periodoLabel, previsto: cq, real: medido ? rq : null };
    });
    grafico = {
      tipo: "curva" as const,
      unidade: mod.unidade,
      legenda: `Curva de efetivo MOD — contratado × real (alocado) acumulado, em ${mod.unidade}.`,
      serie,
    };
  }

  // ── Detalhamento: resumo por categoria acum até o BM (contratado × real × desvio, em quantidade) —
  // espelha os KPIs e o RecResumoCat. Desvio = real − contratado (null quando real pendente).
  const linhas = CRUZ_CATS.map((c) => {
    const cat = data.categorias[c];
    const a = acum(cat);
    const desvio = a.rq != null ? a.rq - a.cq : null;
    return [
      `${cat.label} (${cat.unidade})`,
      fmtQtde(a.cq),
      a.rq != null ? fmtQtde(a.rq) : "—",
      signedQtde(desvio),
    ];
  });
  const detalhamento = linhas.length
    ? {
        titulo: `Recursos por categoria — acumulado${bmLabel ? ` até ${bmLabel}` : ""} (quantidade)`,
        colunas: ["Categoria", "Contratado", "Real", "Desvio"],
        linhas,
        colDesvio: 3,
      }
    : null;

  // 2ª tabela — Maiores desvios de alocação por recurso (R$ acum · Real − Contratado · C.4). Mesma
  // formatação de R$ da aba (formatBRLAbbreviated). Só adiciona se o ranking foi normalizado.
  const tabelas: RelatorioDados["tabelas"] =
    data.maioresDesvios.length > 0
      ? [
          {
            titulo: "Maiores desvios de alocação",
            colunas: ["Recurso", "Contratado", "Real", "Desvio"],
            linhas: data.maioresDesvios.map((d) => [
              d.recurso,
              fmtRs(d.contratadoRs),
              fmtRs(d.realRs),
              signedRs(d.desvioRs),
            ]),
            colDesvio: 3,
          },
        ]
      : undefined;

  return { titulo: "Recursos", farol, indicadores, grafico, detalhamento, tabelas };
}

const FAROL_PT: Record<FarolLevel, string> = {
  conforme: "Em conformidade",
  observacao: "Observar",
  risco: "Alerta",
  critico: "Defasado",
};
