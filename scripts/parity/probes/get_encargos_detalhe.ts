import { getEncargos } from "../../../src/lib/supabase/encargos";
export const anchorLabel = "desequilíbrio de encargos R$ (desequilibrioRs)";
export async function telaValue(id: string): Promise<number | null> {
  const r = await getEncargos(id);
  return r?.desequilibrioRs ?? null;
}
if (import.meta.main) {
  console.log(
    JSON.stringify({ anchorLabel, value: await telaValue("fe288319-ff4f-4564-a459-139dfb021265") }),
  );
}
