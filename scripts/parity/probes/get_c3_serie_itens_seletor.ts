// Âncora nova: nº de itens no seletor da Curva S (15 disciplinas + 17 frentes = 32).
// O bug do truncamento (serie_mes 1.472 > teto 1.000) derrubava isto para ~22 em silêncio.
import { getFaturamentoSerieMes } from "../../../src/lib/supabase/faturamentoSerieMes";

export const anchorLabel = "nº itens do seletor da Curva S (15 disc + 17 frentes)";
export async function telaValue(id: string): Promise<number | null> {
  const s = await getFaturamentoSerieMes(id);
  if (!s) return null;
  return s.disciplina.length + s.frente.length;
}
if (import.meta.main) {
  console.log(
    JSON.stringify({ anchorLabel, value: await telaValue("fe288319-ff4f-4564-a459-139dfb021265") }),
  );
}
