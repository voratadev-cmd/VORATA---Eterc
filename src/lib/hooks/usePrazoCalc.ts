// Hook da Camada B · Prazo. Junta o cronograma previsto físico + o cálculo de Faturamento
// (que resolve o corte e o realizado) e roda `calcularPrazo` → calendário + previsto físico +
// referência financeira, com a aderência física honestamente PENDENTE (sem realizado físico).

import { useQuery } from "@tanstack/react-query";

import { getCronogramaPrevisto } from "@/lib/supabase/cronograma";
import { getFaturamentoCurva, realizadoAcumDe } from "@/lib/supabase/faturamentoCurva";
import { getFaturamentoReal } from "@/lib/supabase/medicoes";
import { calcularFaturamento } from "@/lib/rma/calcFaturamento";
import { calcularPrazo, type PrazoCalc } from "@/lib/rma/calcPrazo";

/** Cálculo de Prazo (Camada B) de uma obra. Null se não há cronograma nem faturamento. */
export function usePrazoCalc(contractId: string) {
  return useQuery<PrazoCalc | null>({
    queryKey: ["prazo-calc", contractId],
    queryFn: async () => {
      const [cron, curva, real] = await Promise.all([
        getCronogramaPrevisto(contractId),
        getFaturamentoCurva(contractId),
        getFaturamentoReal(contractId),
      ]);
      const fat = calcularFaturamento(curva, { realizadoAcum: realizadoAcumDe(real, curva) });
      return calcularPrazo(cron, fat, {
        fisicoRealizadoAcum: real.fisicoAcumulado,
        fisicoRealizadoMes: real.fisicoMes,
      });
    },
    staleTime: 30_000,
  });
}
