// Hook da tela D.6 Análises Pontuais (M3 · rota 3.8) · dado REAL normalizado dos eventos de
// paralisação/ociosidade. Combina os 4 reads da D.6 (eventos, chuva mensal, chuva diária, params) +
// getObraById pro nome. Null quando a D.6 não foi normalizada. A perda é DOSSIÊ pendente (R$ 763k,
// não soma — dedup com a D.4 no Gerador de Claim D.10); o resumo vem dos Cards (validada = R$ 0).

import { useQuery } from "@tanstack/react-query";
import { getObraById } from "@/lib/supabase/obras";
import {
  type PontualChuvaDia,
  type PontualChuvaMes,
  type PontualEvento,
  type PontualParams,
  getPontuaisChuvaDia,
  getPontuaisChuvaMensal,
  getPontuaisEventos,
  getPontuaisParams,
} from "@/lib/supabase/pontuaisD6";

export type PontuaisD6View = {
  nome: string | null;
  eventos: PontualEvento[];
  chuvaMensal: PontualChuvaMes[];
  chuvaDia: PontualChuvaDia[];
  params: PontualParams | null;
};

export function usePontuaisD6(contractId: string) {
  return useQuery<PontuaisD6View | null>({
    queryKey: ["pontuais-d6", contractId],
    staleTime: 30_000,
    queryFn: async () => {
      const [eventos, chuvaMensal, chuvaDia, params, obra] = await Promise.all([
        getPontuaisEventos(contractId),
        getPontuaisChuvaMensal(contractId),
        getPontuaisChuvaDia(contractId),
        getPontuaisParams(contractId),
        getObraById(contractId),
      ]);
      if (!eventos && !params) return null;
      return {
        nome: obra?.nome_interno ?? null,
        eventos: eventos ?? [],
        chuvaMensal: chuvaMensal ?? [],
        chuvaDia: chuvaDia ?? [],
        params,
      };
    },
  });
}
