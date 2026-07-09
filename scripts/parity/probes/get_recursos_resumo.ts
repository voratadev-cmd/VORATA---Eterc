import { getRecursos } from "../../../src/lib/supabase/recursos";
export const anchorLabel = "MOD contratadoQtde (Σ histograma obra_recursos_meses, homens·mês)";
export async function telaValue(id: string): Promise<number | null> {
  const r = await getRecursos(id);
  return r?.categorias?.MOD?.contratadoQtde ?? null;
}
if (import.meta.main) {
  console.log(
    JSON.stringify({ anchorLabel, value: await telaValue("fe288319-ff4f-4564-a459-139dfb021265") }),
  );
}
