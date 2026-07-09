// Adapter Panorama (C.10) → RelatorioDados. Mapeia o read-model REAL da aba (getPanorama · obra_panorama)
// para os DADOS do relatório — garante paridade com a tela (mesmos números, mesmo farol). A IA só escreve
// a narrativa em cima destes números (ancorada).
//
// HONESTIDADE: dimensão com farol null = NÃO avaliada → "Pendente" (nunca verde sobre área cega). Métricas
// null viram "—", nunca 0 fabricado. O farol oficial da aba é o CONSOLIDADO; se ele for null, a aba está em
// estado pendente e a narrativa usa "observacao" como tom neutro de espera (não "conforme").

import { farolLabel } from "@/lib/mocks/contracts";
import { getPanorama } from "@/lib/supabase/panorama";
import type { RelatorioDados, RelatorioFarol } from "@/lib/relatorio/schema";

const fmtBRL = (v: number | null): string =>
  v != null
    ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
    : "—";
const fmtPct = (v: number | null): string => (v != null ? `${Math.round(v * 100)}%` : "—");

/** DADOS reais da aba Panorama p/ o relatório (null = obra sem C.10 normalizado → empty state). */
export async function dadosPanorama(contractId: string): Promise<RelatorioDados | null> {
  const p = await getPanorama(contractId);
  if (!p) return null;

  // Farol oficial = consolidado da tela. Pendente (null) → tom neutro de espera, nunca "conforme".
  const farol: RelatorioFarol = p.consolidado ?? "observacao";

  const indicadores = [
    {
      label: "Consolidado",
      valor: p.consolidado ? farolLabel[p.consolidado] : "Pendente",
      hint: `${p.nAvaliados}/6 dimensões avaliadas`,
    },
    {
      label: "Áreas liberadas",
      valor: fmtPct(p.pctAreasLiberadas),
      hint: "liberadas para execução",
    },
    {
      label: "Frentes impedidas (hoje)",
      valor: fmtBRL(p.frentesImpedidasRs),
      hint: "R$ impedido por força maior/sinistro",
    },
    {
      label: "Dias parados (acum)",
      valor: p.diasParadosAcum != null ? String(p.diasParadosAcum) : "—",
      hint: "por clima/força maior",
    },
  ];

  // Sem curva temporal natural na aba (visão de farol por dimensão, não série mensal).
  const grafico = null;

  // Detalhamento: as 6 dimensões com seu farol (Pendente = não avaliada). Tabela natural da aba.
  const detalhamento = {
    titulo: "Dimensões do panorama",
    colunas: ["Dimensão", "Farol"],
    linhas: p.dimensoes.map((d) => [d.label, d.nivel ? farolLabel[d.nivel] : "Pendente"]),
  };

  return { titulo: "Panorama do Contrato", farol, indicadores, grafico, detalhamento };
}
