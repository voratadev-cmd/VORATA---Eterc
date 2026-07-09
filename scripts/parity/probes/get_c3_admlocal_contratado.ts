// Âncora nova: contratado da Administração Local (decisão do dono: 46 × 2.843.062,58).
import { getFaturamentoDisciplinaResumo } from "../../../src/lib/supabase/faturamentoDisciplinaResumo";

export const anchorLabel = "contratado Adm Local R$ (drill por disciplina C.3 · 46×2.843.062,58)";
export async function telaValue(id: string): Promise<number | null> {
  const r = await getFaturamentoDisciplinaResumo(id);
  return (
    r?.disciplinas.find((d) => d.disciplina === "Administração Local")?.contratadoTotal ?? null
  );
}
if (import.meta.main) {
  console.log(
    JSON.stringify({ anchorLabel, value: await telaValue("fe288319-ff4f-4564-a459-139dfb021265") }),
  );
}
