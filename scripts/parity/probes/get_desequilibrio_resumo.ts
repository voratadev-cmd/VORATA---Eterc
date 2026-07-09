import { getDesequilibrio } from "../../../src/lib/supabase/desequilibrio";

export const anchorLabel = "desequilíbrio total D.0 (R$) — Σ categorias da Bloco 2";

export async function telaValue(id: string): Promise<number | null> {
  const r = await getDesequilibrio(id);
  return r?.totalRs ?? null;
}

if (import.meta.main) {
  console.log(
    JSON.stringify({
      anchorLabel,
      value: await telaValue("fe288319-ff4f-4564-a459-139dfb021265"),
    }),
  );
}
