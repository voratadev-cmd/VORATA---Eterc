// Hook da Camada B · Faturamento. Junta a curva crua (Contratado + Projeção) com o realizado
// autoritativo (cadeia de BMs) e roda o cálculo puro `calcularFaturamento` → desvio/aderência +
// farol já classificado. A tela só consome o resultado; toda regra vive na Camada B.

import { useQuery } from "@tanstack/react-query";

import { getFaturamentoCurva, realizadoAcumDe } from "@/lib/supabase/faturamentoCurva";
import { getFaturamentoReal } from "@/lib/supabase/medicoes";
import { getObraById } from "@/lib/supabase/obras";
import { calcularFaturamento, type FaturamentoCalc } from "@/lib/rma/calcFaturamento";
import { farolOverridesDe, mesclarRegras } from "@/lib/rma/farol";

/** Cálculo de Faturamento (Camada B) sem hook — reutilizável pelo hook E pelo adapter de relatório. */
export async function fetchFaturamentoCalc(contractId: string): Promise<FaturamentoCalc | null> {
  const [curva, realMed, obra] = await Promise.all([
    getFaturamentoCurva(contractId),
    getFaturamentoReal(contractId),
    getObraById(contractId),
  ]);
  return calcularFaturamento(curva, {
    realizadoAcum: realizadoAcumDe(realMed, curva),
    regras: mesclarRegras(farolOverridesDe(obra?.farol_regras)),
  });
}

/** Cálculo de Faturamento (Camada B) de uma obra. Null se a curva ainda não foi normalizada. */
export function useFaturamentoCalc(contractId: string) {
  return useQuery<FaturamentoCalc | null>({
    queryKey: ["faturamento-calc", contractId],
    queryFn: () => fetchFaturamentoCalc(contractId),
    staleTime: 30_000,
  });
}
