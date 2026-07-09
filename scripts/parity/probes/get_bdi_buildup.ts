import { getBdi } from "../../../src/lib/supabase/bdi";
export const anchorLabel = "markup total do BDI (Σ folhas, sem double-count · C.1) R$";
export async function telaValue(id: string): Promise<number | null> {
  const r = await getBdi(id);
  return r?.markupTotal ?? null;
}
if (import.meta.main) {
  console.log(
    JSON.stringify({ anchorLabel, value: await telaValue("fe288319-ff4f-4564-a459-139dfb021265") }),
  );
}
