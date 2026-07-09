// Âncora nova: real da Mobilização no drill por disciplina (era 5,33M "100%" fabricado; BM = 64,3%).
import { getFaturamentoDisciplinaResumo } from "../../../src/lib/supabase/faturamentoDisciplinaResumo";

export const anchorLabel = "real acum Mobilização R$ (drill por disciplina C.3)";
export async function telaValue(id: string): Promise<number | null> {
  const r = await getFaturamentoDisciplinaResumo(id);
  return r?.disciplinas.find((d) => d.disciplina === "Mobilização")?.realAcum ?? null;
}
if (import.meta.main) {
  console.log(
    JSON.stringify({ anchorLabel, value: await telaValue("fe288319-ff4f-4564-a459-139dfb021265") }),
  );
}
