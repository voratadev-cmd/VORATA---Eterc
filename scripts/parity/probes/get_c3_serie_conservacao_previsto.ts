// Âncora nova: conservação da série do seletor da Curva S — Σ previsto (dimensão disciplina) = PV.
// Também protege contra regressão do truncamento de 1.000 linhas do PostgREST (fix de 30/jun).
import { getFaturamentoSerieMes } from "../../../src/lib/supabase/faturamentoSerieMes";

export const anchorLabel = "Σ previsto série disciplina R$ (= PV · conservação do seletor C.3)";
export async function telaValue(id: string): Promise<number | null> {
  const s = await getFaturamentoSerieMes(id);
  if (!s) return null;
  return s.disciplina.reduce(
    (a, item) => a + item.celulas.reduce((b, c) => b + (c.previstoRs ?? 0), 0),
    0,
  );
}
if (import.meta.main) {
  console.log(
    JSON.stringify({ anchorLabel, value: await telaValue("fe288319-ff4f-4564-a459-139dfb021265") }),
  );
}
