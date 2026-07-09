import { getPrazoMarcos } from "../../../src/lib/supabase/prazoMarcos";
import { fetchFaturamentoCalc } from "../../../src/lib/hooks/useFaturamentoCalc";
import { corteMesParaISO, statusMarco } from "../../../src/lib/rma/marcoFarol";

// Âncora = nRiscoOuCritico (marcos em risco ou crítico). O read-model getPrazoMarcos só expõe a coluna
// `farol` crua (stale=3); a TELA deriva o farol em prazo.tsx/visao-geral.tsx via statusMarco (corte =
// mesCorte do faturamento, horizonte 12m). Replicamos essa derivação aqui: risco=em-risco, crítico=atrasado.
export const anchorLabel = "nº marcos em risco ou crítico (nRiscoOuCritico)";

export async function telaValue(id: string): Promise<number | null> {
  const [marcos, fat] = await Promise.all([getPrazoMarcos(id), fetchFaturamentoCalc(id)]);
  if (!marcos) return null;
  const corteISO = fat?.mesCorte ? corteMesParaISO(fat.mesCorte.ano, fat.mesCorte.mes) : null;
  return marcos.filter((m) => {
    const s = statusMarco(m.dataLimite, corteISO, m.pctConcluido);
    return s === "em-risco" || s === "atrasado";
  }).length;
}

if (import.meta.main) {
  console.log(
    JSON.stringify({ anchorLabel, value: await telaValue("fe288319-ff4f-4564-a459-139dfb021265") }),
  );
}
