// Hook da tela C.15 Melhorias Documentais · lê o read-model (2 seções obra_secoes: narrativa
// estruturada + tabela de desvios) + o nome da obra. Null quando a C.15 ainda não foi normalizada
// (a tela cai em EmptyState).

import { useQuery } from "@tanstack/react-query";
import { getObraById } from "@/lib/supabase/obras";
import { type MelhoriasDocView, getMelhoriasDoc } from "@/lib/supabase/melhoriasDoc";

export type MelhoriasDocResult = MelhoriasDocView & { nome: string | null };

export function useMelhoriasDoc(contractId: string) {
  return useQuery<MelhoriasDocResult | null>({
    queryKey: ["melhorias-doc-c15", contractId],
    staleTime: 30_000,
    queryFn: async () => {
      const [view, obra] = await Promise.all([
        getMelhoriasDoc(contractId),
        getObraById(contractId),
      ]);
      if (!view) return null;
      return { ...view, nome: obra?.nome_interno ?? null };
    },
  });
}
