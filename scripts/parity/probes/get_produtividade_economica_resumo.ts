import { getProdutividadeEconomica } from "../../../src/lib/supabase/produtividadeEconomica";

// Âncora: Σ HH previsto de todos os meses (C.7). É o ÚNICO número com paridade estrita
// chat↔read-model: chat.hh_previsto_total == read-model.somaHhPrevisto (gate de conservação),
// e tem oráculo registrado (~2.658.616). Os cards R$/HH e aderência NÃO são computados por
// getProdutividadeEconomica (saem de obra_produtividade_params / só na tool), logo não são
// comparáveis 1:1 por este read-model.
export const anchorLabel = "HH previsto total (Σ HH previsto · gate de conservação C.7)";

export async function telaValue(id: string): Promise<number | null> {
  const r = await getProdutividadeEconomica(id);
  return r?.somaHhPrevisto ?? null;
}

if (import.meta.main) {
  console.log(
    JSON.stringify({
      anchorLabel,
      value: await telaValue("fe288319-ff4f-4564-a459-139dfb021265"),
    }),
  );
}
