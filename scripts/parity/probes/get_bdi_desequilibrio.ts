import { getBdiDeseq } from "../../../src/lib/supabase/bdiDeseq";
export const anchorLabel = "desequilíbrio BDI não-remunerado acumulado (D.2) R$";
export async function telaValue(id: string): Promise<number | null> {
  const r = await getBdiDeseq(id);
  return r?.desequilibrioRs ?? null;
}
if (import.meta.main) {
  console.log(
    JSON.stringify({ anchorLabel, value: await telaValue("fe288319-ff4f-4564-a459-139dfb021265") }),
  );
}
