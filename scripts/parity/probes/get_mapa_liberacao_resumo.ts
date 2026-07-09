import { getMapaFrentes } from "../../../src/lib/supabase/mapaSegmentos";
export const anchorLabel = "Σ valor das frentes físicas do mapa (R$, obra física C.14)";
export async function telaValue(id: string): Promise<number | null> {
  const frentes = await getMapaFrentes(id);
  if (!frentes) return null;
  return frentes.reduce((acc, f) => acc + f.valorRs, 0);
}
if (import.meta.main) {
  console.log(
    JSON.stringify({ anchorLabel, value: await telaValue("fe288319-ff4f-4564-a459-139dfb021265") }),
  );
}
