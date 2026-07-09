import { getCronogramaTarefas } from "../../../src/lib/supabase/cronograma";
export const anchorLabel = "nº de tarefas do cronograma-fonte (obra_cronograma_tarefas)";
export async function telaValue(id: string): Promise<number | null> {
  const r = await getCronogramaTarefas(id);
  return r?.nTarefas ?? null;
}
if (import.meta.main) {
  console.log(
    JSON.stringify({ anchorLabel, value: await telaValue("fe288319-ff4f-4564-a459-139dfb021265") }),
  );
}
