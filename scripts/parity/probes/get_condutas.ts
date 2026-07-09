import { getCondutas } from "../../../src/lib/supabase/condutas";

// Domínio qualitativo (catálogo de ações sugeridas pela IA · C.11). Sem headline
// financeiro/percentual — a única âncora numérica é a CONTAGEM de condutas
// (n_condutas no chat). A TELA (condutas.ts:getCondutas) e o chat (get_condutas)
// leem a mesma obra_condutas com .eq(contrato_id), então a contagem deve bater.
export const anchorLabel = "nº de condutas (n_condutas)";

export async function telaValue(id: string): Promise<number | null> {
  const r = await getCondutas(id);
  return r?.length ?? null;
}

if (import.meta.main) {
  console.log(
    JSON.stringify({ anchorLabel, value: await telaValue("fe288319-ff4f-4564-a459-139dfb021265") }),
  );
}
