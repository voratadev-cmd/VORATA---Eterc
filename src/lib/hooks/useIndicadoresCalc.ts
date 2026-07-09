// Hook da Camada B · Indicadores. Junta os cálculos de Faturamento + Prazo e monta o painel
// consolidado (6 blocos + contagem + situação geral) que a aba Indicadores/Visão Geral consome.

import { useQuery } from "@tanstack/react-query";

import { getCronogramaPrevisto } from "@/lib/supabase/cronograma";
import { getFaturamentoCurva, realizadoAcumDe } from "@/lib/supabase/faturamentoCurva";
import { getFaturamentoReal } from "@/lib/supabase/medicoes";
import { calcularFaturamento } from "@/lib/rma/calcFaturamento";
import { calcularPrazo } from "@/lib/rma/calcPrazo";
import { calcularIndicadores, type IndicadoresCalc } from "@/lib/rma/calcIndicadores";

/** Painel de indicadores (Camada B) de uma obra: agrega os faróis das abas já calculadas. */
export function useIndicadoresCalc(contractId: string) {
  return useQuery<IndicadoresCalc>({
    queryKey: ["indicadores-calc", contractId],
    queryFn: async () => {
      const [cron, curva, real] = await Promise.all([
        getCronogramaPrevisto(contractId),
        getFaturamentoCurva(contractId),
        getFaturamentoReal(contractId),
      ]);
      const fat = calcularFaturamento(curva, { realizadoAcum: realizadoAcumDe(real, curva) });
      const prazo = calcularPrazo(cron, fat, {
        fisicoRealizadoAcum: real.fisicoAcumulado,
        fisicoRealizadoMes: real.fisicoMes,
      });
      return calcularIndicadores(fat, prazo);
    },
    staleTime: 30_000,
  });
}
