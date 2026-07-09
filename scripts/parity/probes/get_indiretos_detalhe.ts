import { getIndiretos } from "../../../src/lib/supabase/indiretos";

export const anchorLabel = "desequilíbrio total D.1 Indiretos (R$) — método ATIVO M2.2";

export async function telaValue(id: string): Promise<number | null> {
  const r = await getIndiretos(id);
  return r?.desequilibrioTotal ?? null;
}

if (import.meta.main) {
  console.log(
    JSON.stringify({
      anchorLabel,
      value: await telaValue("fe288319-ff4f-4564-a459-139dfb021265"),
    }),
  );
}
