// Adapter Faturamento → RelatorioDados. Mapeia o read-model REAL da aba (FaturamentoBridge) para os
// DADOS do relatório — garante paridade com a tela (mesmos números). A IA só escreve a narrativa em
// cima destes números (ancorada). Adicionar aba = um adapter assim + uma lente foco no Python.

import { fetchFaturamentoBm } from "@/lib/hooks/useFaturamentoBm";
import { farolLabel } from "@/lib/mocks/contracts";
import type { RelatorioDados, RelatorioFarol } from "@/lib/relatorio/schema";

const fmtPct = (v: number | null | undefined): string =>
  v != null ? `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—";
const fmtMi = (v: number | null): string =>
  v != null
    ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`
    : "—";
const fmtMiSinal = (v: number): string =>
  `${v >= 0 ? "+" : "−"}R$ ${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`;

/** DADOS reais da aba Faturamento p/ o relatório (null = obra sem faturamento normalizado). */
export async function dadosFaturamento(contractId: string): Promise<RelatorioDados | null> {
  const bridge = await fetchFaturamentoBm(contractId);
  if (!bridge) return null;
  const f = bridge.fat;
  const farol: RelatorioFarol = f.aderenciaFarol ?? "observacao";

  const indicadores = [
    { label: "Contratado total", valor: f.contratadoTotalLabel, hint: f.contratadoTotalNota },
    { label: "Realizado acumulado", valor: f.realAcumuladoLabel, hint: f.realAcumuladoNota },
    {
      label: "Aderência vs previsto",
      valor: fmtPct(f.aderenciaAcumuladoPct),
      hint: f.aderenciaFarol ? `farol ${farolLabel[f.aderenciaFarol]}` : `corte ${bridge.bmLabel}`,
    },
    {
      label: "Desvio acumulado",
      valor: f.desvioValorLabel,
      hint: f.totalExecutadoPct != null ? `${fmtPct(f.totalExecutadoPct)} executado` : "magnitude",
    },
    {
      label: "Saldo a faturar",
      valor: f.saldoFaturarLabel,
      hint: `${fmtPct(f.saldoFaturarPct)} do contrato · ${f.saldoFaturarBmsRestantes} BMs restantes`,
    },
    {
      label: "Projeção de término",
      valor:
        f.periodo?.projecaoTerminoMeses != null
          ? `${Math.round(f.periodo.projecaoTerminoMeses)} meses`
          : "—",
      hint: f.periodo?.alertaProrrogacao ?? undefined,
    },
    {
      label: "Ritmo médio (3 BMs)",
      valor: f.periodo?.ritmo3BmLabel ?? "—",
      hint: "média dos últimos 3 BMs",
    },
  ];

  // Curva S: contratado (previsto) × realizado, acumulado em R$ mi. A curva real para após o corte (null).
  const serie = f.curvaS.map((p) => ({ m: p.bm, previsto: p.contratado, real: p.real }));
  const grafico = {
    tipo: "curva" as const,
    unidade: "R$ mi",
    legenda: "Curva S — contratado × realizado acumulado, em R$ milhões.",
    serie,
  };

  // Detalhamento: meses medidos (real != null) com contratado × realizado × desvio acumulado.
  const medidos = f.curvaS.filter((p) => p.real != null);
  const detalhamento = medidos.length
    ? {
        titulo: "Faturamento mês a mês (acumulado)",
        colunas: ["Mês", "Contratado", "Realizado", "Desvio"],
        linhas: medidos.map((p) => [
          p.bm,
          fmtMi(p.contratado),
          fmtMi(p.real),
          p.real != null ? fmtMiSinal(p.real - p.contratado) : "—",
        ]),
        colDesvio: 3,
      }
    : null;

  // 2ª tabela — Faturamento do MÊS (não acumulado): previsto × real do mês, com Δ. previstoMes/realMes
  // já vêm em R$ mi na curvaS (CurvaSPonto), mesma unidade de contratado/real — usa o MESMO fmtMi.
  const mesAMesTodos = f.curvaS.filter((p) => p.previstoMes != null || p.realMes != null);
  // mostra a janela de near-term (medidos + plano imediato); a curva inteira já está no gráfico.
  const JANELA = 12;
  const mesAMes = mesAMesTodos.slice(0, JANELA);
  const tabelas = mesAMes.length
    ? [
        {
          titulo:
            mesAMesTodos.length > JANELA
              ? `Faturamento do mês (não acumulado) · primeiros ${JANELA} de ${mesAMesTodos.length} meses`
              : "Faturamento do mês (não acumulado)",
          colunas: ["Mês", "Previsto (mês)", "Real (mês)", "Δ"],
          linhas: mesAMes.map((p) => [
            p.bm,
            fmtMi(p.previstoMes ?? null),
            fmtMi(p.realMes ?? null),
            p.previstoMes != null && p.realMes != null
              ? fmtMiSinal(p.realMes - p.previstoMes)
              : "—",
          ]),
          colDesvio: 3,
        },
      ]
    : undefined;

  return { titulo: "Faturamento", farol, indicadores, grafico, detalhamento, tabelas };
}
