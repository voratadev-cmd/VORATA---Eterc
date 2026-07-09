import { getCurvasC8 } from "../../../src/lib/supabase/curvasC8";

export const anchorLabel = "executado acumulado R$ (C.8 · cruza com faturamento real)";

export async function telaValue(id: string): Promise<number | null> {
  const r = await getCurvasC8(id);
  return r?.executadoAcum ?? null;
}

if (import.meta.main) {
  console.log(
    JSON.stringify({ anchorLabel, value: await telaValue("fe288319-ff4f-4564-a459-139dfb021265") }),
  );
}
