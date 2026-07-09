import { getPontuaisParams } from "../../../src/lib/supabase/pontuaisD6";

// D.6 Análises Pontuais. Âncora = pendente_total_rs (R$763.276,80): a perda dos
// eventos de paralisação/ociosidade que fica como DOSSIÊ (validada=R$0, não soma à
// D.0 p/ não dobrar com a D.4). Chat (get_pontuais) lê params.pendente_total_rs de
// obra_pontuais_params; a TELA usa getPontuaisParams → pendenteTotalRs (mesma tabela,
// pass-through sem fórmula).
export const anchorLabel = "pendente total dos eventos pontuais (dossiê · D.6) R$";

export async function telaValue(id: string): Promise<number | null> {
  const r = await getPontuaisParams(id);
  return r?.pendenteTotalRs ?? null;
}

if (import.meta.main) {
  console.log(
    JSON.stringify({ anchorLabel, value: await telaValue("fe288319-ff4f-4564-a459-139dfb021265") }),
  );
}
