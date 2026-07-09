import { getOrcamento } from "../../../src/lib/supabase/orcamento";
export const anchorLabel = "preco_venda (PV · Σ BASE1 orçamento de venda R$, C.1)";
export async function telaValue(id: string): Promise<number | null> {
  const r = await getOrcamento(id);
  return r?.precoVenda ?? null;
}
if (import.meta.main) {
  console.log(
    JSON.stringify({ anchorLabel, value: await telaValue("fe288319-ff4f-4564-a459-139dfb021265") }),
  );
}
