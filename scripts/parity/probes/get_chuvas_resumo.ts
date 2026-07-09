import { getChuvasPainel } from "../../../src/lib/supabase/chuvasPainel";

// Âncora = headline da TELA C.9 ("dias a cobrar = 2"), que é o número com oráculo
// (getChuvasPainel; mai/26 real 5 vs prop 3 → Σ max(0, real−prop) = 2). O chat
// get_chuvas_resumo NÃO expõe este campo (lê obra_chuvas/_meses → impedido/liberado/
// chuva_prev, com real pendente), daí a divergência estrutural chat↔tela.
export const anchorLabel = "dias a cobrar (kpis.diasACobrar)";

export async function telaValue(id: string): Promise<number | null> {
  const r = await getChuvasPainel(id);
  return r?.kpis.diasACobrar ?? null;
}

if (import.meta.main) {
  console.log(
    JSON.stringify({
      anchorLabel,
      value: await telaValue("fe288319-ff4f-4564-a459-139dfb021265"),
    }),
  );
}
