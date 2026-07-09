import { getInsumosFd, selecaoRecomendada, totaisDe } from "../../../src/lib/supabase/insumosFd";

export const anchorLabel =
  "repasse real M2 R$ (excedente ao IPCA × medido · fonte recomendada · v53)";

export async function telaValue(id: string): Promise<number | null> {
  const r = await getInsumosFd(id);
  if (!r) return null;
  const totais = totaisDe(r.insumos, selecaoRecomendada(r.insumos));
  return Math.round(totais.repasseReal * 100) / 100;
}

if (import.meta.main) {
  console.log(
    JSON.stringify({ anchorLabel, value: await telaValue("fe288319-ff4f-4564-a459-139dfb021265") }),
  );
}
