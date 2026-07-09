// Âncora nova (BM oficial jul/26): aderência acumulada do C.3 — o farol oficial da tela.
import { fetchFaturamentoCalc } from "../../../src/lib/hooks/useFaturamentoCalc";
import { getFaturamentoReal } from "../../../src/lib/supabase/medicoes";
import { buildFaturamentoBm } from "../../../src/lib/rma/bridgeFaturamento";

export const anchorLabel = "aderência acumulada % (real ÷ previsto acum · farol oficial C.3)";
export async function telaValue(id: string): Promise<number | null> {
  const calc = await fetchFaturamentoCalc(id);
  if (!calc) return null;
  const b = buildFaturamentoBm(calc, await getFaturamentoReal(id));
  return b?.fat.aderenciaAcumuladoPct ?? null;
}
if (import.meta.main) {
  console.log(
    JSON.stringify({ anchorLabel, value: await telaValue("fe288319-ff4f-4564-a459-139dfb021265") }),
  );
}
