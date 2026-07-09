// Hook do Painel de Desequilíbrio (M3 · D.0). Lê o contexto compartilhado (D.0 + obra + curva) via
// getDeseqContexto: composição/total do painel + o denominador OFICIAL do farol acumulado
// (obras.valor_contratual ?? custo_total da curva = PV). null nas duas pontas → pct/farol pendentes
// (nunca fabricados). Só leitura.

import { useQuery } from "@tanstack/react-query";
import { getDeseqContexto } from "@/lib/supabase/deseqContexto";
import type { Desequilibrio } from "@/lib/supabase/desequilibrio";

export type DesequilibrioView = {
  deseq: Desequilibrio;
  /** nome_interno da obra (header). null se a obra não tem nome. */
  nome: string | null;
  /** Valor contratado (R$) usado como denominador do % e do farol acumulado. null se não há fonte. */
  valorContratado: number | null;
  /** De onde veio o valor contratado — para rotular com honestidade. */
  valorContratadoFonte: "obra" | "faturamento" | null;
};

export function useDesequilibrio(contractId: string) {
  return useQuery<DesequilibrioView | null>({
    queryKey: ["desequilibrio", contractId],
    queryFn: async () => {
      const ctx = await getDeseqContexto(contractId);
      if (!ctx.deseq) return null;
      return {
        deseq: ctx.deseq,
        nome: ctx.nome,
        valorContratado: ctx.valorContratado,
        valorContratadoFonte: ctx.valorContratadoFonte,
      };
    },
    staleTime: 30_000,
  });
}
