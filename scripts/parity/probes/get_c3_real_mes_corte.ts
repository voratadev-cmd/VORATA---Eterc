// Âncora nova: real do mês de corte (BM corrente) na curva — o valor que era o 6,5M fabricado.
import { getFaturamentoCurva } from "../../../src/lib/supabase/faturamentoCurva";

export const anchorLabel = "real do mês de corte R$ (último mês com real>0 · curva C.3)";
export async function telaValue(id: string): Promise<number | null> {
  const curva = await getFaturamentoCurva(id);
  if (!curva) return null;
  const comReal = curva.meses.filter((m) => (m.realRs ?? 0) > 0);
  return comReal.length ? (comReal[comReal.length - 1].realRs ?? null) : null;
}
if (import.meta.main) {
  console.log(
    JSON.stringify({ anchorLabel, value: await telaValue("fe288319-ff4f-4564-a459-139dfb021265") }),
  );
}
