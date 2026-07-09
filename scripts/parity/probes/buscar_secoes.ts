import { getObraSecoes } from "../../../src/lib/supabase/normalizacao";

// Domínio qualitativo/de busca (régua de cobertura do splitter · obra_secoes). Sem
// headline financeiro/percentual. A única âncora numérica possível é uma CONTAGEM
// estrutural de seções. O chat (buscar_secoes) filtra tem_dado=true, aplica busca
// ilike em titulo/codigo e LIMITA a 8 — o campo `n` que ele devolve é uma contagem
// de resultados de busca capada no limit (n=8), NÃO um total estável do domínio.
// A TELA (normalizacao.ts:getObraSecoes) lista TODAS as seções sem filtro de busca.
// Âncora aqui = nº de seções com dado (tem_dado=true), a população que o chat busca.
export const anchorLabel = "nº de seções com dado (tem_dado=true · obra_secoes)";

export async function telaValue(id: string): Promise<number | null> {
  const r = await getObraSecoes(id);
  if (!r) return null;
  return r.filter((s) => s.temDado).length;
}

if (import.meta.main) {
  console.log(
    JSON.stringify({ anchorLabel, value: await telaValue("fe288319-ff4f-4564-a459-139dfb021265") }),
  );
}
