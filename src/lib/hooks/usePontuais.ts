// Hook da tela 3.8 Análises Pontuais (M3 · D.6 Eventos + D.8 Pleitos) · cruza getChuvas (C.9 · chuva
// PREVISTA + impedimento planejado) com o contexto de desequilíbrio (getDeseqContexto: D.6, D.8, total,
// denominador). D.6 precisa do real medido (RDO) → R$ 0 hoje; D.8 (pleitos) é null até abrir um pleito.
// Null quando as chuvas não foram normalizadas (base ausente).

import { useQuery } from "@tanstack/react-query";
import { type Chuvas, getChuvas } from "@/lib/supabase/chuvas";
import { getDeseqContexto } from "@/lib/supabase/deseqContexto";

export type PontuaisView = {
  chuvas: Chuvas;
  nome: string | null;
  /** D.6 Eventos Pontuais (do painel D.0). null se a categoria não existe. */
  desequilibrioEventos: number | null;
  /** D.8 Pleitos Pontuais (do painel D.0). null = aguardando pleito (ou sem categoria). */
  pleitosPontuais: number | null;
  /** true quando a categoria D.8 existe no D.0 (mesmo com valor null = pleito a abrir). */
  temCategoriaD8: boolean;
  totalDesequilibrio: number | null;
  valorContratado: number | null;
};

export function usePontuais(contractId: string) {
  return useQuery<PontuaisView | null>({
    queryKey: ["pontuais-view", contractId],
    queryFn: async () => {
      const [chuvas, ctx] = await Promise.all([
        getChuvas(contractId),
        getDeseqContexto(contractId),
      ]);
      if (!chuvas) return null;
      return {
        chuvas,
        nome: ctx.nome,
        desequilibrioEventos: ctx.categoriaRs("D.6"),
        pleitosPontuais: ctx.categoriaRs("D.8"),
        temCategoriaD8: ctx.temCategoria("D.8"),
        totalDesequilibrio: ctx.totalDesequilibrio,
        valorContratado: ctx.valorContratado,
      };
    },
    staleTime: 30_000,
  });
}
