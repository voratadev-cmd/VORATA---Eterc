// Hook da tela 3.2 BDI (M3 · D.2) · cruza getBdi (obra_bdi_rubricas · buildup contratual) com o
// contexto de desequilíbrio (getDeseqContexto). O valor do desequilíbrio do BDI vive SÓ no D.0
// (categoria D.2), não nas rubricas. Null quando o BDI não foi normalizado. Dívida conhecida: o D.2
// não tem fonte detalhada reconciliável (diferente do D.1) — a tela comunica isso com honestidade.

import { useQuery } from "@tanstack/react-query";
import { type Bdi, getBdi } from "@/lib/supabase/bdi";
import { getDeseqContexto } from "@/lib/supabase/deseqContexto";

export type BdiView = {
  bdi: Bdi;
  nome: string | null;
  /** Desequilíbrio do BDI (categoria D.2 do painel D.0). null se ausente — NÃO vem das rubricas. */
  desequilibrioBdi: number | null;
  /** Σ do desequilíbrio (D.0) — denominador do "% do total" e do farol acumulado. */
  totalDesequilibrio: number | null;
  /** Valor contratado (PV) — denominador do farol acumulado. */
  valorContratado: number | null;
};

export function useBdiView(contractId: string) {
  return useQuery<BdiView | null>({
    queryKey: ["bdi-view", contractId],
    queryFn: async () => {
      const [bdi, ctx] = await Promise.all([getBdi(contractId), getDeseqContexto(contractId)]);
      if (!bdi) return null;
      return {
        bdi,
        nome: ctx.nome,
        desequilibrioBdi: ctx.categoriaRs("D.2"),
        totalDesequilibrio: ctx.totalDesequilibrio,
        valorContratado: ctx.valorContratado,
      };
    },
    staleTime: 30_000,
  });
}
