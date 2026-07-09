import { getPlanoAcao } from "../../../src/lib/supabase/planoAcao";
export const anchorLabel = "nº de tarefas no Plano de Ação (resumo.total)";
export async function telaValue(id: string): Promise<number | null> {
  const r = await getPlanoAcao(id);
  if (!r) return null;
  return r.resumo?.total ?? r.tarefas.length ?? null;
}
if (import.meta.main) {
  console.log(
    JSON.stringify({ anchorLabel, value: await telaValue("fe288319-ff4f-4564-a459-139dfb021265") }),
  );
}
