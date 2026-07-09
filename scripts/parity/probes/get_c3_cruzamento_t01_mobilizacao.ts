// Âncora nova: célula T01 × Mobilização do cruzamento (filhos do drill · auxiliar_C.3 JSONB).
// Exercita o caminho obra_secoes→cruzamento, que a atualização do BM reescreveu com alocação por célula.
import { getFaturamentoCruzamento } from "../../../src/lib/supabase/faturamentoCruzamento";

export const anchorLabel = "real T01×Mobilização R$ (célula do cruzamento · auxiliar_C.3)";
export async function telaValue(id: string): Promise<number | null> {
  const cruz = await getFaturamentoCruzamento(id);
  if (!cruz) return null;
  const chave = Object.keys(cruz.porFrente).find((k) => k.startsWith("trecho 01"));
  if (!chave) return null;
  const cel = cruz.porFrente[chave].find((c) => c.nome === "Mobilização");
  return cel?.realAcum ?? null;
}
if (import.meta.main) {
  console.log(
    JSON.stringify({ anchorLabel, value: await telaValue("fe288319-ff4f-4564-a459-139dfb021265") }),
  );
}
