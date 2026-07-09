// Âncora nova: Δ projeção vs prazo contratual (meses de atraso projetados · card C.3).
import { fetchFaturamentoCalc } from "../../../src/lib/hooks/useFaturamentoCalc";
import { getFaturamentoReal } from "../../../src/lib/supabase/medicoes";
import { buildFaturamentoBm } from "../../../src/lib/rma/bridgeFaturamento";

export const anchorLabel = "Δ projeção vs prazo (meses · card C.3)";
export async function telaValue(id: string): Promise<number | null> {
  const calc = await fetchFaturamentoCalc(id);
  if (!calc) return null;
  const b = buildFaturamentoBm(calc, await getFaturamentoReal(id));
  return b?.fat.periodo?.deltaProjecaoMeses ?? null;
}
if (import.meta.main) {
  console.log(
    JSON.stringify({ anchorLabel, value: await telaValue("fe288319-ff4f-4564-a459-139dfb021265") }),
  );
}
