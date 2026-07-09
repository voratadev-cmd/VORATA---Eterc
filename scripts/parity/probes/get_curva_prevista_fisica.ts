import { getFaturamentoDisciplinaResumo } from "../../../src/lib/supabase/faturamentoDisciplinaResumo";
export const anchorLabel =
  "físico real overall % (Σ real serviços ÷ Σ contratado serviços) no BM de corte · C.5 Prazo";
export async function telaValue(id: string): Promise<number | null> {
  // Replica prazo.tsx:derivarFisico (overall): apenas serviços, Σ realAcum ÷ Σ contratadoTotal × 100.
  const r = await getFaturamentoDisciplinaResumo(id);
  if (!r) return null;
  const serv = r.disciplinas.filter((d) => d.servico);
  const totalServ = serv.reduce((a, d) => a + (d.contratadoTotal ?? 0), 0);
  const realServ = serv.reduce((a, d) => a + (d.realAcum ?? 0), 0);
  return totalServ > 0 ? (realServ / totalServ) * 100 : null;
}
if (import.meta.main) {
  console.log(
    JSON.stringify({ anchorLabel, value: await telaValue("fe288319-ff4f-4564-a459-139dfb021265") }),
  );
}
