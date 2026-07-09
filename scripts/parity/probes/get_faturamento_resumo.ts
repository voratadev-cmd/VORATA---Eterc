import { fetchFaturamentoCalc } from "../../../src/lib/hooks/useFaturamentoCalc";

export const anchorLabel = "realizado acumulado R$";

export async function telaValue(id: string): Promise<number | null> {
  const r = await fetchFaturamentoCalc(id);
  return r?.realizadoAcum ?? null;
}

if (import.meta.main) {
  console.log(
    JSON.stringify({
      anchorLabel,
      value: await telaValue("fe288319-ff4f-4564-a459-139dfb021265"),
    }),
  );
}
