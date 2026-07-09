import { getValorAgregado } from "../../../src/lib/supabase/valorAgregado";

export const anchorLabel = "perda de produtividade TOTAL D.4 (R$) — Real alocado − VA medido";

export async function telaValue(id: string): Promise<number | null> {
  const r = await getValorAgregado(id);
  return r?.total?.perdaRs ?? null;
}

if (import.meta.main) {
  console.log(
    JSON.stringify({
      anchorLabel,
      value: await telaValue("fe288319-ff4f-4564-a459-139dfb021265"),
    }),
  );
}
