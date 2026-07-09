import { getInsumosFd } from "../../../src/lib/supabase/insumosFd";

export const anchorLabel = "contrato FD c/ BDI R$ (Σ obra_insumos_fd.valor_contrato_bdi · v53)";

export async function telaValue(id: string): Promise<number | null> {
  const r = await getInsumosFd(id);
  return r ? Math.round(r.totalFdBdi * 100) / 100 : null;
}

if (import.meta.main) {
  console.log(
    JSON.stringify({ anchorLabel, value: await telaValue("fe288319-ff4f-4564-a459-139dfb021265") }),
  );
}
