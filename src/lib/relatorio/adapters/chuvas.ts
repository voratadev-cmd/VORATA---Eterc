// Adapter Chuvas (RMA · C.9) → RelatorioDados. Mapeia o read-model REAL da aba (getChuvasPainel) para
// os DADOS do relatório — garante paridade com a tela (mesmos números: dias >5 mm proposta × real,
// "dias a cobrar" sem compensar déficit entre meses, pleiteável). A IA só escreve a narrativa em cima
// destes números (ancorada). Domínio: dias improdutivos por chuva — financeiro só na ponta pleiteável.

import { farolLabel } from "@/lib/mocks/contracts";
import type { RelatorioDados, RelatorioFarol } from "@/lib/relatorio/schema";
import { getChuvasPainel } from "@/lib/supabase/chuvasPainel";

const anoDe = (mesAno: string) => "20" + (mesAno.split("/")[1] ?? "").trim();
const mesDe = (mesAno: string) => (mesAno.split("/")[0] ?? "").trim();
const fmtRs = (v: number | null): string =>
  v != null
    ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";
const fmtDias = (v: number | null): string => (v != null ? v.toLocaleString("pt-BR") : "—");

/** DADOS reais da aba Chuvas (C.9) p/ o relatório (null = obra sem C.9 normalizada → empty state). */
export async function dadosChuvas(contractId: string): Promise<RelatorioDados | null> {
  const painel = await getChuvasPainel(contractId);
  if (!painel) return null;
  const k = painel.kpis;

  // Farol OFICIAL da aba: badge do header = "dias a cobrar > 0 → Risco, senão Conforme" (chuvas.tsx).
  const farol: RelatorioFarol = k.diasACobrar > 0 ? "risco" : "conforme";

  const indicadores = [
    {
      label: "Dias >5 mm — proposta (acum)",
      valor: fmtDias(k.diasPropostaAcum),
      hint: `baseline contratual · ${k.nMesesReais} ${k.nMesesReais === 1 ? "mês" : "meses"} medidos`,
    },
    {
      label: "Dias >5 mm — real / RDO (acum)",
      valor: fmtDias(k.diasRealAcum),
      hint: "evidência diária (RDO)",
    },
    {
      label: "Δ acumulado (net)",
      valor: `${k.deltaNet > 0 ? "+" : ""}${fmtDias(k.deltaNet)} dias`,
      hint: k.deltaNet === 0 ? "sem excesso líquido" : "real − proposta",
    },
    {
      label: "Dias a cobrar (Σ excessos)",
      valor: `${fmtDias(k.diasACobrar)} dias`,
      hint:
        k.pleiteavelRs != null
          ? `pleiteável ${fmtRs(k.pleiteavelRs)} · ${farolLabel[farol]} · sem compensar`
          : `${farolLabel[farol]} · método sem compensar`,
    },
  ];

  // KPIs extras dos TOTAIS (auxiliar_D.6 — Totais): decomposição financeira do pleiteável (MOD + EQP)
  // e o HH ocioso correspondente. Pulam quando a obra não tem o quadro de totais normalizado.
  const t = painel.totais;
  if (t?.mod != null) {
    indicadores.push({
      label: "Pleiteável MOD",
      valor: fmtRs(t.mod),
      hint: "mão de obra direta · ociosidade por chuva",
    });
  }
  if (t?.eqp != null) {
    indicadores.push({
      label: "Pleiteável EQP",
      valor: fmtRs(t.eqp),
      hint: "equipamentos · ociosidade por chuva",
    });
  }
  if (t?.hhOciosas != null) {
    indicadores.push({
      label: "HH ociosas",
      valor: `${t.hhOciosas.toLocaleString("pt-BR")} HH`,
      hint: "homem-hora improdutivo nos dias excedentes",
    });
  }

  // Curva natural da aba: dias >5 mm proposta (previsto) × real (RDO), mês a mês. Real null nos meses
  // ainda sem RDO (PENDENTE ≠ 0 → gap na série). Usa só o ano com medição real (mesmo recorte do
  // gráfico A da tela, que abre no primeiro ano disponível).
  const anosComReal = [
    ...new Set(painel.serieMensal.filter((m) => m.diasReal != null).map((m) => anoDe(m.mesAno))),
  ];
  const anoFoco = anosComReal[0] ?? anoDe(painel.serieMensal[0]?.mesAno ?? "");
  const serie = painel.serieMensal
    .filter((m) => anoDe(m.mesAno) === anoFoco)
    .map((m) => ({ m: mesDe(m.mesAno), previsto: m.diasProp, real: m.diasReal }));
  const grafico = serie.length
    ? {
        tipo: "curva" as const,
        unidade: "dias >5 mm",
        legenda: `Dias >5 mm — proposta (baseline contratual) × real (RDO), mês a mês (${anoFoco}).`,
        serie,
      }
    : null;

  // Detalhamento: apuração mês a mês (excedente → pleiteável), MESMA máscara da tela — real/excedente/
  // pleiteável só aparecem nos meses COM RDO medido (fonte = Acompanhamento); o futuro pré-preenchido
  // no workbook vira "—" (PENDENTE ≠ 0).
  const normMes = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const comReal = new Set(
    painel.serieMensal.filter((m) => m.diasReal != null).map((m) => normMes(m.mesAno)),
  );
  const linhasApur = painel.apuracao.filter((a) => a.real != null || a.prev != null);
  const detalhamento = linhasApur.length
    ? {
        titulo: "Apuração mês a mês — sem compensar déficit",
        colunas: ["Mês", "Prev. >5mm", "Real >5mm", "Excedente", "Pleiteável (mês)"],
        linhas: linhasApur.map((a) => {
          const temReal = comReal.has(normMes(a.mes));
          return [
            a.mes,
            a.prev != null ? a.prev.toLocaleString("pt-BR") : "—",
            temReal && a.real != null ? a.real.toLocaleString("pt-BR") : "—",
            temReal && a.excedente != null
              ? `${a.excedente > 0 ? "+" : ""}${a.excedente.toLocaleString("pt-BR")}`
              : "—",
            temReal && a.total != null && a.total > 0 ? fmtRs(a.total) : "—",
          ];
        }),
        colDesvio: 3,
      }
    : null;

  return { titulo: "Chuvas", farol, indicadores, grafico, detalhamento };
}
