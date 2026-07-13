// Hook da aba Faturamento (Bridge §7.1) · junta os read-models reais (curva contratada/projeção +
// medições) → calcularFaturamento (Camada B) → buildFaturamentoBm (Bridge) e devolve o
// FaturamentoBM pronto para a aba. data === null = obra sem faturamento normalizado (empty state).

import { useQuery } from "@tanstack/react-query";

import {
  faturamentoRealFromCurva,
  getFaturamentoCurva,
  realizadoAcumDe,
} from "@/lib/supabase/faturamentoCurva";
import { getFaturamentoReal } from "@/lib/supabase/medicoes";
import { getSinteseTexto } from "@/lib/supabase/sinteses";
import { getObraById } from "@/lib/supabase/obras";
import { calcularFaturamento } from "@/lib/rma/calcFaturamento";
import { farolOverridesDe, mesclarRegras } from "@/lib/rma/farol";
import { buildFaturamentoBm, type FaturamentoBridge } from "@/lib/rma/bridgeFaturamento";

/** Busca o FaturamentoBM real (sem hook) — reutilizável pelo hook E pelo adapter de relatório.
 *  `corteBmOverride` (opcional · seletor de período do RMA) rebobina o corte pro mês escolhido;
 *  ausente = corte = último mês medido (comportamento de hoje, intacto). */
export async function fetchFaturamentoBm(
  contractId: string,
  corteBmOverride?: { ano: number; mes: number } | null,
): Promise<FaturamentoBridge | null> {
  const [curva, realMed, analiseIA, obra] = await Promise.all([
    getFaturamentoCurva(contractId),
    getFaturamentoReal(contractId),
    getSinteseTexto(contractId, "analise_faturamento", "analise"),
    getObraById(contractId),
  ]);
  // PRECEDÊNCIA: medições (cadeia de BMs · Sorriso) vencem; se não há BM mas a curva traz o Real
  // DIRETO (workbook-motor), sintetiza o realizado da curva. Coexistência limpa, sem rip-out.
  let real =
    realMed.nBms === 0 && curva?.realAcum != null ? faturamentoRealFromCurva(curva) : realMed;
  // GUARD: no workbook-motor a raiz '1' do BM pode ser só a 1ª disciplina (ex.: SBSO 3,67mi) —
  // um contratadoTotal < 50% do CFF da curva é implausível → o baseline oficial é a curva.
  if (
    curva?.custoTotal != null &&
    (real.contratadoTotal == null || real.contratadoTotal < curva.custoTotal * 0.5)
  ) {
    const ct = curva.custoTotal;
    real = {
      ...real,
      contratadoTotal: ct,
      contratadoTotalMotivo: "raiz do BM parcial — baseline = CFF da curva",
      pctFaturado: real.realAcumulado != null ? real.realAcumulado / ct : real.pctFaturado,
      saldoFaturar: real.realAcumulado != null ? ct - real.realAcumulado : real.saldoFaturar,
    };
  }
  const regras = mesclarRegras(farolOverridesDe(obra?.farol_regras));
  const calc = calcularFaturamento(curva, {
    realizadoAcum: realizadoAcumDe(real, curva),
    regras,
    corteBmOverride,
  });
  const bridge = buildFaturamentoBm(calc, real, analiseIA);
  return bridge ? { ...bridge, regras } : null;
}

/** FaturamentoBM real de uma obra (ou null se não normalizado).
 *  `corteBmOverride` ausente → queryKey e resultado IDÊNTICOS a hoje (não afeta outros consumidores). */
export function useFaturamentoBm(
  contractId: string,
  corteBmOverride?: { ano: number; mes: number } | null,
) {
  return useQuery<FaturamentoBridge | null>({
    queryKey: corteBmOverride
      ? ["faturamento-bm", contractId, corteBmOverride.ano, corteBmOverride.mes]
      : ["faturamento-bm", contractId],
    queryFn: () => fetchFaturamentoBm(contractId, corteBmOverride),
    staleTime: 30_000,
  });
}
