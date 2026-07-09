import { getProdutividadeParams } from "../../../src/lib/supabase/produtividadeFisica";
export const anchorLabel = "ponte_pct_capacidade (% capacidade vs contratado, C.7 Sinais)";
export async function telaValue(id: string): Promise<number | null> {
  const r = await getProdutividadeParams(id);
  return r?.pontePctCapacidade ?? null;
}
if (import.meta.main) {
  console.log(
    JSON.stringify({ anchorLabel, value: await telaValue("fe288319-ff4f-4564-a459-139dfb021265") }),
  );
}
