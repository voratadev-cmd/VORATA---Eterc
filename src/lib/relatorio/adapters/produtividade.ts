// Adapter Produtividade (RMA · C.7) → RelatorioDados. Mapeia o read-model REAL da aba (params +
// série econômica R$/HH + curva de faturamento) para os DADOS do relatório — paridade com a tela.
// FOCO: produtividade ECONÔMICA (R$ faturado / hora-homem), NÃO a física (un/h). O farol oficial é a
// aderência acumulada (real ÷ contratada · 95/85/70). A IA só escreve a narrativa sobre estes números.

import {
  getProdutividadeEconomica,
  type ProdutividadeEconomicaMes,
} from "@/lib/supabase/produtividadeEconomica";
import { getProdutividadeParams } from "@/lib/supabase/produtividadeFisica";
import { getFaturamentoCurva } from "@/lib/supabase/faturamentoCurva";
import type { FarolLevel } from "@/lib/mocks/contracts";
import type { RelatorioDados, RelatorioFarol } from "@/lib/relatorio/schema";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotuloMes = (m: { ano: number; mes: number; periodoLabel?: string | null }): string =>
  m.periodoLabel ?? `${MESES[m.mes - 1] ?? m.mes}/${String(m.ano % 100).padStart(2, "0")}`;

const fmtRsHh = (v: number | null | undefined): string =>
  v != null && Number.isFinite(v) ? `R$ ${Math.round(v).toLocaleString("pt-BR")}` : "—";
const fmtBRL = (v: number | null | undefined): string =>
  v != null && Number.isFinite(v)
    ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
    : "—";
const fmtNum = (v: number | null | undefined): string =>
  v != null && Number.isFinite(v) ? v.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "—";
const fmtPct = (v: number | null | undefined): string =>
  v != null && Number.isFinite(v)
    ? `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
    : "—";

// O farol oficial da aba é gravado como label PT-BR ("Conforme/Observação/Risco/Crítico"); mapeia de
// volta pra chave canônica do relatório. Fallback honesto = "observacao" (igual ao Faturamento).
const LABEL_TO_FAROL: Record<string, FarolLevel> = {
  Conforme: "conforme",
  Observação: "observacao",
  Observacao: "observacao",
  Risco: "risco",
  Crítico: "critico",
  Critico: "critico",
};

/** DADOS reais da aba Produtividade (R$/HH) p/ o relatório (null = obra sem C.7 normalizado). */
export async function dadosProdutividade(contractId: string): Promise<RelatorioDados | null> {
  const [serie, params, curva] = await Promise.all([
    getProdutividadeEconomica(contractId),
    getProdutividadeParams(contractId),
    getFaturamentoCurva(contractId),
  ]);
  // Mesma condição da aba: sem série E sem params → ainda não normalizada.
  if (!serie && !params) return null;
  const p = params;
  const meses = serie?.meses ?? [];

  const farol: RelatorioFarol =
    (p?.farolAderencia ? LABEL_TO_FAROL[p.farolAderencia.trim()] : undefined) ?? "observacao";

  // Contratada R$/HH do mês — derivação IDÊNTICA à da aba (paridade): exato nos medidos
  // (rsPorHh ÷ aderencia); cross-join com a curva de faturamento nos futuros (contratadoRs ÷ HH prev).
  const fatContrPorMes = new Map<string, number>();
  for (const m of curva?.meses ?? []) {
    if (m.contratadoRs != null) fatContrPorMes.set(`${m.ano}-${m.mes}`, m.contratadoRs);
  }
  const contratadaMes = (m: ProdutividadeEconomicaMes): number | null => {
    if (m.rsPorHh != null && m.aderencia != null && m.aderencia > 0) return m.rsPorHh / m.aderencia;
    const fc = fatContrPorMes.get(`${m.ano}-${m.mes}`);
    return fc != null && m.hhPrevisto != null && m.hhPrevisto > 0 ? fc / m.hhPrevisto : null;
  };

  // KPIs de cabeçalho da aba (cards REAIS · params). Financeiro R$/HH — não confundir com físico.
  const indicadores = [
    {
      label: "Real acumulado",
      valor: fmtRsHh(p?.realAcumRsHh),
      hint: "R$ faturado ÷ HH real",
    },
    {
      label: "Contratada do período",
      valor: fmtRsHh(p?.contratadaPeriodoRsHh),
      hint: "R$/HH previsto até o BM",
    },
    {
      label: "Aderência acum.",
      valor: fmtPct(p?.aderenciaAcum),
      hint: p?.farolAderencia ? `farol ${p.farolAderencia}` : "real ÷ contratada · 95/85/70",
    },
    {
      label: "Meta do projeto",
      valor: fmtRsHh(p?.metaProjetoRsHh),
      hint: "R$/HH · valor total ÷ HH previsto",
    },
    // Σ HH (homem-hora) acumulado da série — âncora de conservação da aba (real é parcial).
    {
      label: "Σ HH real",
      valor: serie ? `${fmtNum(serie.somaHhReal)} HH` : "—",
      hint: "HH medido até agora (parcial)",
    },
    {
      label: "Σ HH previsto",
      valor: serie ? `${fmtNum(serie.somaHhPrevisto)} HH` : "—",
      hint: "HH previsto total (âncora)",
    },
  ];

  // Curva natural: R$/HH no tempo — Contratada (previsto) × Real, mês a mês. Real só onde houve
  // medição (hhReal > 0); a contratada futura pode pender da normalização (vira null → gap no gráfico).
  const serieGraf = meses.map((m) => ({
    m: rotuloMes(m),
    previsto: contratadaMes(m),
    real: (m.hhReal ?? 0) > 0 ? m.rsPorHh : null,
  }));
  const grafico =
    serieGraf.length > 0
      ? {
          tipo: "curva" as const,
          unidade: "R$/HH",
          legenda: "R$/HH no tempo — contratada × real, mês a mês (não achatado pela média).",
          serie: serieGraf,
        }
      : null;

  // Detalhamento: meses MEDIDOS (HH real > 0, faturado presente) — faturado × HH real × R$/HH real,
  // com aderência (real ÷ contratada) como coluna de desvio. Mesma régua da série da aba.
  const medidos = meses.filter((mm) => (mm.hhReal ?? 0) > 0 && mm.faturadoRs != null);
  const detalhamento = medidos.length
    ? {
        titulo: "Produtividade mês a mês (medições)",
        colunas: ["Mês", "Faturado", "HH real", "Contratada R$/HH", "Real R$/HH", "Aderência"],
        linhas: medidos.map((mm) => {
          const c = contratadaMes(mm);
          const ader = mm.rsPorHh != null && c != null && c > 0 ? mm.rsPorHh / c : mm.aderencia;
          return [
            rotuloMes(mm),
            fmtBRL(mm.faturadoRs),
            fmtNum(mm.hhReal),
            fmtRsHh(c),
            fmtRsHh(mm.rsPorHh),
            fmtPct(ader),
          ];
        }),
        colDesvio: 5,
      }
    : null;

  // 2ª tabela: série econômica mês a mês (campos crus da série) — complementa o detalhamento (que só
  // traz meses medidos com a contratada derivada). Aqui mostramos a série toda com dado (faturado ≠ null).
  const mesesSerie = meses.filter((mm) => mm.faturadoRs != null);
  const tabelas: RelatorioDados["tabelas"] = mesesSerie.length
    ? [
        {
          titulo: "Produtividade mês a mês",
          colunas: ["Mês", "Faturado", "HH real", "R$/HH real", "Aderência"],
          linhas: mesesSerie.map((mm) => [
            rotuloMes(mm),
            fmtBRL(mm.faturadoRs),
            fmtNum(mm.hhReal),
            fmtRsHh(mm.rsPorHh),
            fmtPct(mm.aderencia),
          ]),
        },
      ]
    : undefined;

  return { titulo: "Produtividade", farol, indicadores, grafico, detalhamento, tabelas };
}
