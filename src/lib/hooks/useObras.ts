// React Query hooks pra leitura/escrita da tabela `obras`.
// Reaproveita o QueryClient já configurado em __root.tsx.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ContractIdentification } from "@/lib/schemas/contract";
import { createObra, deleteObra, listObras, type Obra } from "@/lib/supabase/obras";
import { removeObraTree } from "@/lib/supabase/uploadObraRawFile";

/** Chave canônica do cache · evita strings mágicas espalhadas. */
export const OBRAS_QUERY_KEY = ["obras"] as const;

/** Lista todas as obras · refetch a cada window focus. */
export function useObras() {
  return useQuery<Obra[], Error>({
    queryKey: OBRAS_QUERY_KEY,
    queryFn: listObras,
    staleTime: 30_000,
  });
}

/**
 * Cria uma obra · ao concluir, invalida o cache pra disparar refetch da listagem
 * em `/contracts` e ContractPicker.
 */
export function useCreateObra() {
  const qc = useQueryClient();
  return useMutation<Obra, Error, { obraId: string; parsed: ContractIdentification }>({
    mutationFn: async ({ obraId, parsed }) => {
      const result = await createObra(obraId, parsed);
      if (!result.ok) throw new Error(result.error);
      return result.obra;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: OBRAS_QUERY_KEY });
    },
  });
}

/**
 * Exclui uma obra · deleta a row no DB (CASCADE remove obra_arquivos + extracoes
 * + contextos) e remove a árvore inteira do Storage.
 *
 * Ordem: DB primeiro · se falhar, paramos. Storage depois, best-effort
 * (se Storage falhar, fica lixo mas DB tá limpo · operável manualmente).
 */
export function useDeleteObra() {
  const qc = useQueryClient();
  return useMutation<{ obraId: string }, Error, string>({
    mutationFn: async (obraId) => {
      const dbResult = await deleteObra(obraId);
      if (!dbResult.ok) throw new Error(dbResult.error);
      // Storage cleanup · best-effort. Erros aqui não bloqueiam a UX.
      await removeObraTree(obraId).catch(() => {});
      return { obraId };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: OBRAS_QUERY_KEY });
    },
  });
}
