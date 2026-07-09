// Hook da tela 3.1 Indiretos (M3 · D.1) · cruza getIndiretos (obra_indiretos_base/_metodos) com o
// contexto de desequilíbrio (getDeseqContexto: D.0 + denominador PV) para o "% do total", a asserção
// de reconciliação D.0↔D.1 e o farol acumulado. Null quando D.1 não normalizado nesta obra.

import { useQuery } from "@tanstack/react-query";
import { getDeseqContexto } from "@/lib/supabase/deseqContexto";
import { type Indiretos, getIndiretos } from "@/lib/supabase/indiretos";

export type IndiretosView = {
  indiretos: Indiretos;
  nome: string | null;
  /** Σ do desequilíbrio (D.0) — denominador do "% do total" e do farol acumulado. null se D.0 ausente. */
  totalDesequilibrio: number | null;
  /** Valor da categoria D.1 no painel D.0 — para a asserção de reconciliação ao centavo. null se ausente. */
  categoriaD1Rs: number | null;
  /** Valor contratado (PV) — denominador do farol acumulado. null se não há fonte. */
  valorContratado: number | null;
};

export function useIndiretosView(contractId: string) {
  return useQuery<IndiretosView | null>({
    queryKey: ["indiretos-view", contractId],
    queryFn: async () => {
      const [indiretos, ctx] = await Promise.all([
        getIndiretos(contractId),
        getDeseqContexto(contractId),
      ]);
      if (!indiretos) return null;
      return {
        indiretos,
        nome: ctx.nome,
        totalDesequilibrio: ctx.totalDesequilibrio,
        categoriaD1Rs: ctx.categoriaRs("D.1"),
        valorContratado: ctx.valorContratado,
      };
    },
    staleTime: 30_000,
  });
}
