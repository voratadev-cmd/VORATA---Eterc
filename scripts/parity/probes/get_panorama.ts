import { getPanorama } from "../../../src/lib/supabase/panorama";
export const anchorLabel = "nº de dimensões avaliadas (cobertura, de 6)";
export async function telaValue(id: string): Promise<number | null> {
  const r = await getPanorama(id);
  return r?.nAvaliados ?? null;
}
if (import.meta.main) {
  console.log(
    JSON.stringify({ anchorLabel, value: await telaValue("fe288319-ff4f-4564-a459-139dfb021265") }),
  );
}
