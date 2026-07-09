import { getFaturamentoDisciplinaResumo } from "../../../src/lib/supabase/faturamentoDisciplinaResumo";
export const anchorLabel = "nº de disciplinas (curva física por frente · C.5)";
export async function telaValue(id: string): Promise<number | null> {
  const r = await getFaturamentoDisciplinaResumo(id);
  return r?.nDisciplinas ?? null;
}
if (import.meta.main) {
  console.log(
    JSON.stringify({ anchorLabel, value: await telaValue("fe288319-ff4f-4564-a459-139dfb021265") }),
  );
}
