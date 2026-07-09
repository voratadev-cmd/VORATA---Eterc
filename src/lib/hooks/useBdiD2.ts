// Hook da tela D.2 BDI (desequilíbrio do BDI não remunerado) · combina o dado REAL normalizado:
//   getBdiDeseq (params/KPIs) + getBdiRubricasTempo (6 rubricas) + getBdiPerdaMensal (curva 46m).
// Null quando o D.2 ainda não foi normalizado. A calculadora de cenários usa os params (PV, BDI,
// adm%CD, overhead/mês) — mesma fórmula do workbook.

import { useQuery } from "@tanstack/react-query";
import { getObraById } from "@/lib/supabase/obras";
import {
  type BdiCurvaPerda,
  type BdiDeseqParams,
  type BdiPerdaMensal,
  type BdiRubricaTempo,
  computeBdiCurvaPerda,
  getBdiDeseq,
  getBdiPerdaMensal,
  getBdiRubricasTempo,
} from "@/lib/supabase/bdiDeseq";
import { getFaturamentoCurva } from "@/lib/supabase/faturamentoCurva";

export type BdiD2View = {
  nome: string | null;
  params: BdiDeseqParams;
  rubricas: BdiRubricaTempo[];
  perda: BdiPerdaMensal[];
  /** Duas curvas (real × teórica) do BLOCO 6, reconstruídas da curva de faturamento. Null = fallback. */
  curvaPerda: BdiCurvaPerda | null;
};

export function useBdiD2(contractId: string) {
  return useQuery<BdiD2View | null>({
    queryKey: ["bdi-d2", contractId],
    staleTime: 30_000,
    queryFn: async () => {
      const [params, rubricas, perda, curva, obra] = await Promise.all([
        getBdiDeseq(contractId),
        getBdiRubricasTempo(contractId),
        getBdiPerdaMensal(contractId),
        getFaturamentoCurva(contractId),
        getObraById(contractId),
      ]);
      if (!params) return null; // sem D.2 normalizado → tela mostra EmptyState
      const rubs = rubricas ?? [];
      return {
        nome: obra?.nome_interno ?? null,
        params,
        rubricas: rubs,
        perda: perda ?? [],
        curvaPerda: computeBdiCurvaPerda(params, rubs, curva?.meses ?? null),
      };
    },
  });
}
