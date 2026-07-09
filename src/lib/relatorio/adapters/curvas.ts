// Adapter Curvas e Responsabilidade (C.8) → RelatorioDados. Mapeia os read-models REAIS da aba
// (obra_curvas_c8 + obra_curvas_serie_mes + obra_curvas_frentes) para os DADOS do relatório — paridade
// com a tela. O FOCO da aba é a ORIGEM DO GARGALO: a cadeia Contratado ≥ Liberado ≥ Capacidade ≥
// Executado revela ONDE o potencial produtivo se perde — gargalo de liberação (Contratante) ou de
// capacidade/subdimensionamento (Contratada). A IA escreve a narrativa ancorada nesses números.

import { farolLabel } from "@/lib/mocks/contracts";
import type { RelatorioDados, RelatorioFarol } from "@/lib/relatorio/schema";
import { getCurvasC8, getCurvasFrentes } from "@/lib/supabase/curvasC8";
import { getCurvasSerieMes } from "@/lib/supabase/curvasSerieMes";

const fmtMi = (v: number | null | undefined): string =>
  v != null
    ? `R$ ${(v / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`
    : "—";
const fmtPct = (v: number | null | undefined): string =>
  v != null ? `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—";
const fmtMiSinal = (v: number): string =>
  `${v >= 0 ? "+" : "−"}R$ ${Math.abs(v / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`;

// MESMA régua da tela (GARGALO_LIM_PP = 15pp na cadeia Contratado→Liberado→Capacidade). Classifica a
// origem do gargalo e a converte no farol oficial da aba — badge e farol não podem se contradizer.
const GARGALO_LIM_PP = 15;
type Gargalo = { rotulo: string; farol: RelatorioFarol; texto: string };
function gargalo(libPct: number | null, capPct: number | null): Gargalo | null {
  if (libPct == null || capPct == null) return null;
  const gapContratadoLib = 100 - libPct; // "Contratado ≫ Liberado"
  const gapLibCap = libPct - capPct; // "Liberado ≫ Capacidade"
  const baixaLib = gapContratadoLib >= GARGALO_LIM_PP;
  const baixaCap = gapLibCap >= GARGALO_LIM_PP;
  if (baixaLib && !baixaCap)
    return {
      rotulo: "Contratante (baixa liberação)",
      farol: "critico",
      texto:
        "Contratado ≫ Liberado (≥15pp) — gargalo de liberação de área (preliminar: Contratante).",
    };
  if (baixaCap && !baixaLib)
    return {
      rotulo: "Contratada (subdimensionamento)",
      farol: "risco",
      texto:
        "Liberado ≫ Capacidade (≥15pp) — subdimensionamento de equipe/mobilização (preliminar: Contratada).",
    };
  if (baixaLib && baixaCap)
    return {
      rotulo: "Compartilhado",
      farol: "observacao",
      texto:
        "Gargalo de liberação E de capacidade (≥15pp em ambos) — responsabilidade compartilhada (preliminar).",
    };
  return null; // 4 curvas próximas — sincronizada, sem gargalo
}

/** DADOS reais da aba Curvas e Responsabilidade (C.8) p/ o relatório (null = obra sem C.8 normalizado). */
export async function dadosCurvas(contractId: string): Promise<RelatorioDados | null> {
  const [c8, serie, frentes] = await Promise.all([
    getCurvasC8(contractId),
    getCurvasSerieMes(contractId),
    getCurvasFrentes(contractId),
  ]);
  // Sem C.8 e sem série, a aba não tem o núcleo (curvas) normalizado → pendente honesto.
  if (!c8 && !serie) return null;

  // Farol oficial = origem do gargalo (cadeia Contratado→Liberado→Capacidade). Sem diagnóstico
  // possível (pcts ausentes) → "observacao" neutro (não fabricar "conforme").
  const diag = c8 ? gargalo(c8.liberacaoPct, c8.capacidadePct) : null;
  const farol: RelatorioFarol =
    diag?.farol ??
    (c8 && c8.liberacaoPct != null && c8.capacidadePct != null ? "conforme" : "observacao");

  const indicadores = [
    {
      label: "Contratado acum.",
      valor: fmtMi(c8?.contratadoAcumCorte ?? null),
      hint: "agendado até o BM corrente",
    },
    {
      label: "Executado acum.",
      valor: fmtMi(c8?.executadoAcum ?? null),
      hint: "faturamento real acumulado",
    },
    {
      label: "Capacidade (produção)",
      valor: fmtMi(c8?.capacidadeAcum ?? null),
      hint: "HH alocado × produtividade da proposta",
    },
    {
      label: "Maior gap",
      valor: fmtMi(c8?.maiorGapRs ?? null),
      hint: diag ? `gargalo: ${farolLabel[farol]}` : "potencial produtivo não realizado",
    },
    // Liberado acumulado (R$ cru → fmtMi divide por 1e6, igual a contratado/executado).
    {
      label: "Liberado acumulado",
      valor: fmtMi(c8?.liberadoAcum ?? null),
      hint: "área liberada acumulada até o BM",
    },
    // Alocado (%): o read-model já entrega 0–100 → fmtPct apenas anexa "%", não remultiplica.
    {
      label: "Alocado (%)",
      valor: fmtPct(c8?.alocadoPct ?? null),
      hint: "HH alocado vs contratado-no-corte",
    },
  ];

  // Curva S das 4 curvas (base financeira/total): Contratado (previsto) × Executado real, acumulado em
  // R$. A curva real (executado) para após o corte (null) — gap natural no gráfico.
  const grafico = serie
    ? {
        tipo: "curva" as const,
        unidade: "R$ mi",
        legenda:
          "Curvas C.8 — Contratado (previsto) × Executado real acumulado, em R$ milhões (base financeira).",
        serie: serie.meses.map((m) => ({
          m: m.periodoLabel ?? `M${String(m.mesNum).padStart(2, "0")}`,
          previsto: m.contratadoAcum != null ? m.contratadoAcum / 1e6 : null,
          real: m.executadoAcum != null ? m.executadoAcum / 1e6 : null,
        })),
      }
    : null;

  // Detalhamento: matriz por frente (Contratado × Produtividade × Gap dominante × Responsabilidade).
  // É a tabela natural da aba que carrega o sinal de responsabilidade por frente.
  const detalhamento =
    frentes && frentes.length > 0
      ? {
          titulo: "Matriz por frente · responsabilidade preliminar",
          colunas: [
            "Frente",
            "Contratado",
            "Produtiv. (R$/HH)",
            "Gap dominante",
            "Responsabilidade",
          ],
          linhas: frentes.map((f) => [
            f.frente,
            fmtMi(f.contratadoRs),
            f.produtividadeRsHh != null
              ? f.produtividadeRsHh.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                  maximumFractionDigits: 0,
                })
              : "—",
            fmtMi(f.gapDominanteRs),
            f.responsabilidade ? f.responsabilidade.replace(/^[●○]\s*/, "") : "—",
          ]),
          colDesvio: 3, // gap dominante
        }
      : null;

  return { titulo: "Curvas e Responsabilidade", farol, indicadores, grafico, detalhamento };
}
