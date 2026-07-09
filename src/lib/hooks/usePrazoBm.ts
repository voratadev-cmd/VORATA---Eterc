// Hook da aba Prazo (Bridge §7.1) · junta cronograma previsto + curva de faturamento + medições →
// calcularFaturamento (resolve o corte) → calcularPrazo (Camada B) → buildPrazoBm (Bridge).
// data === null = obra sem cronograma/faturamento normalizado (empty state).

import { useQuery } from "@tanstack/react-query";

import { getCronogramaPrevisto, getCronogramaTarefas } from "@/lib/supabase/cronograma";
import { getFaturamentoCurva, realizadoAcumDe } from "@/lib/supabase/faturamentoCurva";
import { getFaturamentoReal } from "@/lib/supabase/medicoes";
import { getSinteseTexto } from "@/lib/supabase/sinteses";
import { getObraById } from "@/lib/supabase/obras";
import { calcularFaturamento } from "@/lib/rma/calcFaturamento";
import { calcularPrazo } from "@/lib/rma/calcPrazo";
import { farolOverridesDe, mesclarRegras } from "@/lib/rma/farol";
import { buildPrazoBm, type PrazoBridge } from "@/lib/rma/bridgePrazo";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** PrazoBM real sem hook — reutilizável pelo hook E pelo adapter de relatório. */
export async function fetchPrazoBm(contractId: string): Promise<PrazoBridge | null> {
  const [cron, curva, real, tarefas, analiseIA, obra] = await Promise.all([
    getCronogramaPrevisto(contractId),
    getFaturamentoCurva(contractId),
    getFaturamentoReal(contractId),
    getCronogramaTarefas(contractId),
    getSinteseTexto(contractId, "analise_prazo", "analise"),
    getObraById(contractId),
  ]);
  const regras = mesclarRegras(farolOverridesDe(obra?.farol_regras));
  const fat = calcularFaturamento(curva, {
    realizadoAcum: realizadoAcumDe(real, curva),
    regras,
  });
  // físico real por PRECEDÊNCIA: BM físico (medições · Sorriso) vence; senão o real_pct da curva
  // (workbook-motor). Nesta obra o físico real é PENDENTE (input vazio) → null → farol pendente.
  const calc = calcularPrazo(cron, fat, {
    fisicoRealizadoAcum: real.fisicoAcumulado ?? cron?.realAcum ?? null,
    fisicoRealizadoMes: real.fisicoMes,
    regras,
  });
  const corte = fat?.mesCorte;
  const bmLabel = corte
    ? `${MESES[corte.mes - 1]}/${String(corte.ano % 100).padStart(2, "0")}`
    : "—";
  return buildPrazoBm(calc, cron, bmLabel, tarefas, analiseIA);
}

/** PrazoBM real de uma obra (ou null se não normalizado). */
export function usePrazoBm(contractId: string) {
  return useQuery<PrazoBridge | null>({
    queryKey: ["prazo-bm", contractId],
    queryFn: () => fetchPrazoBm(contractId),
    staleTime: 30_000,
  });
}
