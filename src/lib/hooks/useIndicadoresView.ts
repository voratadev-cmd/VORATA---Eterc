// Hook da aba Indicadores (Bridge §7.1) · junta cronograma + curva de faturamento + medições →
// calcularFaturamento + calcularPrazo + calcularIndicadores (Camada B) → buildIndicadoresView.
// data === null = obra sem dado normalizado (empty state).

import { useQuery } from "@tanstack/react-query";

import { getCronogramaPrevisto } from "@/lib/supabase/cronograma";
import { getFaturamentoCurva, realizadoAcumDe } from "@/lib/supabase/faturamentoCurva";
import { getFaturamentoReal } from "@/lib/supabase/medicoes";
import { getProdutividade } from "@/lib/supabase/produtividade";
import { getProdutividadeEconomica } from "@/lib/supabase/produtividadeEconomica";
import { getDesequilibrio } from "@/lib/supabase/desequilibrio";
import { getRecursos } from "@/lib/supabase/recursos";
import { getCurvasC8 } from "@/lib/supabase/curvasC8";
import { getInsumos } from "@/lib/supabase/insumos";
import { getInsumoExcedente } from "@/lib/supabase/insumoExcedente";
import { getPrazoMarcos } from "@/lib/supabase/prazoMarcos";
import { getObraById } from "@/lib/supabase/obras";
import { getDiagnostico } from "@/lib/supabase/sinteses";
import { calcularFaturamento } from "@/lib/rma/calcFaturamento";
import { calcularPrazo } from "@/lib/rma/calcPrazo";
import { calcularIndicadores } from "@/lib/rma/calcIndicadores";
import { farolOverridesDe, mesclarRegras } from "@/lib/rma/farol";
import { buildIndicadoresView, type IndicadoresBridge } from "@/lib/rma/bridgeIndicadores";
import { corteMesParaISO } from "@/lib/rma/marcoFarol";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** View consolidada de Indicadores de uma obra (ou null se não normalizada). */
export function useIndicadoresView(contractId: string) {
  return useQuery<IndicadoresBridge | null>({
    queryKey: ["indicadores-view", contractId],
    queryFn: async () => {
      const [
        cron,
        curva,
        real,
        produtividade,
        insumos,
        excedente,
        produtividadeEcon,
        desequilibrio,
        recursos,
        curvasC8,
        marcos,
        obra,
        diagnosticoIA,
      ] = await Promise.all([
        getCronogramaPrevisto(contractId),
        getFaturamentoCurva(contractId),
        getFaturamentoReal(contractId),
        getProdutividade(contractId),
        getInsumos(contractId),
        getInsumoExcedente(contractId),
        getProdutividadeEconomica(contractId),
        getDesequilibrio(contractId),
        getRecursos(contractId),
        getCurvasC8(contractId),
        getPrazoMarcos(contractId),
        getObraById(contractId),
        getDiagnostico(contractId),
      ]);
      const regras = mesclarRegras(farolOverridesDe(obra?.farol_regras));
      const fat = calcularFaturamento(curva, {
        realizadoAcum: realizadoAcumDe(real, curva),
        regras,
      });
      const prazo = calcularPrazo(cron, fat, {
        fisicoRealizadoAcum: real.fisicoAcumulado ?? cron?.realAcum ?? null,
        fisicoRealizadoMes: real.fisicoMes,
        regras,
      });
      const ind = calcularIndicadores(
        fat,
        prazo,
        produtividade,
        insumos,
        produtividadeEcon,
        desequilibrio,
        recursos,
        regras,
        excedente,
      );
      const corte = fat?.mesCorte;
      const bmLabel = corte
        ? `${MESES[corte.mes - 1]}/${String(corte.ano % 100).padStart(2, "0")}`
        : "—";
      const corteISO = corte ? corteMesParaISO(corte.ano, corte.mes) : null;
      return buildIndicadoresView(ind, bmLabel, curvasC8, marcos, corteISO, regras, diagnosticoIA);
    },
    staleTime: 30_000,
  });
}
