// Hook da aba Visão Geral (Bridge §7.1) · junta cronograma + curva + medições + obra → toda a
// Camada B (faturamento + prazo + indicadores) + os bridges nested → buildVisaoGeralView.
// data === null = obra sem dado normalizado (empty state).

import { useQuery } from "@tanstack/react-query";

import { getCronogramaPrevisto } from "@/lib/supabase/cronograma";
import {
  faturamentoRealFromCurva,
  getFaturamentoCurva,
  realizadoAcumDe,
} from "@/lib/supabase/faturamentoCurva";
import { getFaturamentoReal } from "@/lib/supabase/medicoes";
import { getObraById } from "@/lib/supabase/obras";
import { getProdutividade } from "@/lib/supabase/produtividade";
import { getProdutividadeEconomica } from "@/lib/supabase/produtividadeEconomica";
import { getDesequilibrio } from "@/lib/supabase/desequilibrio";
import { getRecursos } from "@/lib/supabase/recursos";
import { getInsumos } from "@/lib/supabase/insumos";
import { getInsumoExcedente } from "@/lib/supabase/insumoExcedente";
import { getDiagnostico } from "@/lib/supabase/sinteses";
import {
  type DesequilibrioPainel,
  getDesequilibrioPainel,
} from "@/lib/supabase/desequilibrioPainel";
import { type PrazoMarco, getPrazoMarcos } from "@/lib/supabase/prazoMarcos";
import { type Conduta, getCondutas } from "@/lib/supabase/condutas";
import { type CurvasC8, getCurvasC8 } from "@/lib/supabase/curvasC8";
import { corteMesParaISO } from "@/lib/rma/marcoFarol";
import { calcularFaturamento } from "@/lib/rma/calcFaturamento";
import { calcularPrazo } from "@/lib/rma/calcPrazo";
import { calcularIndicadores } from "@/lib/rma/calcIndicadores";
import { farolOverridesDe, mesclarRegras } from "@/lib/rma/farol";
import { buildFaturamentoBm } from "@/lib/rma/bridgeFaturamento";
import { buildPrazoBm } from "@/lib/rma/bridgePrazo";
import { buildVisaoGeralView, type VisaoGeralBridge } from "@/lib/rma/bridgeVisaoGeral";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Visão Geral + os blocos extras (composição D.0, marcos C.5, condutas C.11, liberação C.8) que
 * a aba surfacea do dado real já normalizado. Cada extra é null/[] quando a obra não tem aquele M. */
export type VisaoGeralViewExt = VisaoGeralBridge & {
  painelDeseq: DesequilibrioPainel | null;
  marcos: PrazoMarco[];
  condutas: Conduta[];
  curvasC8: CurvasC8 | null;
  /** ISO do corte (fim do mês do BM corrente) — referência p/ derivar o farol dos marcos (C.5). */
  corteISO: string | null;
};

/** Monta a Visão Geral REAL de uma obra (plain async, sem React) — reusável pelo hook E pelo adapter
 * de relatório (paridade exata com a aba). null se não normalizada. Inclui os blocos extras. */
export async function fetchVisaoGeralView(contractId: string): Promise<VisaoGeralViewExt | null> {
  const [
    cron,
    curva,
    realMed,
    obra,
    produtividade,
    insumos,
    excedente,
    produtividadeEcon,
    desequilibrio,
    recursos,
    diagnosticoIA,
    painelDeseq,
    marcos,
    condutas,
    curvasC8,
  ] = await Promise.all([
    getCronogramaPrevisto(contractId),
    getFaturamentoCurva(contractId),
    getFaturamentoReal(contractId),
    getObraById(contractId),
    getProdutividade(contractId),
    getInsumos(contractId),
    getInsumoExcedente(contractId),
    getProdutividadeEconomica(contractId),
    getDesequilibrio(contractId),
    getRecursos(contractId),
    getDiagnostico(contractId),
    getDesequilibrioPainel(contractId),
    getPrazoMarcos(contractId),
    getCondutas(contractId),
    getCurvasC8(contractId),
  ]);
  // PRECEDÊNCIA workbook>Sorriso (igual useFaturamentoBm): real direto da curva quando não há BM
  const real =
    realMed.nBms === 0 && curva?.realAcum != null ? faturamentoRealFromCurva(curva) : realMed;
  // Régua por obra (obras.farol_regras) — MESMA mescla do useIndicadoresView, senão o mesmo
  // bloco mostra farol diferente entre as duas abas vizinhas.
  const regras = mesclarRegras(farolOverridesDe(obra?.farol_regras));
  const fat = calcularFaturamento(curva, {
    realizadoAcum: realizadoAcumDe(real, curva),
    regras,
  });
  const prazoCalc = calcularPrazo(cron, fat, {
    fisicoRealizadoAcum: real.fisicoAcumulado ?? cron?.realAcum ?? null,
    fisicoRealizadoMes: real.fisicoMes,
    regras,
  });
  const ind = calcularIndicadores(
    fat,
    prazoCalc,
    produtividade,
    insumos,
    produtividadeEcon,
    desequilibrio,
    recursos,
    regras,
    excedente,
  );
  const corte = fat?.mesCorte;
  const bmLabel = corte
    ? `${MESES[corte.mes - 1]}/${String(corte.ano % 100).padStart(2, "0")}`
    : "—";
  const fatBridge = buildFaturamentoBm(fat, real);
  const prazoBridge = buildPrazoBm(prazoCalc, cron, bmLabel);
  const base = buildVisaoGeralView({
    fatBridge,
    prazoBridge,
    ind,
    fat,
    real,
    obra,
    bmLabel,
    desequilibrio,
    recursos,
    diagnosticoIA,
  });
  if (!base) return null;
  const corteISO = corte ? corteMesParaISO(corte.ano, corte.mes) : null;
  return {
    ...base,
    painelDeseq,
    marcos: marcos ?? [],
    condutas: condutas ?? [],
    curvasC8,
    corteISO,
  };
}

/** Overview executivo (Visão Geral) de uma obra, do dado real. null se não normalizada. */
export function useVisaoGeralView(contractId: string) {
  return useQuery<VisaoGeralViewExt | null>({
    queryKey: ["visao-geral-view", contractId],
    queryFn: () => fetchVisaoGeralView(contractId),
    staleTime: 30_000,
  });
}
