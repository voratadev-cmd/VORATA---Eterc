// Barrel de mocks por obra.
// Registry vazio · obras virão do pipeline de extração (Claude Agent SDK).
// Os helpers continuam funcionais com registry vazio — retornam undefined.

import type {
  BasesData,
  BmSnapshot,
  DiagnosticoData,
  ObraData,
  RevisaoDocumental,
  SinteseObra,
  TranspasseData,
  VisaoGeralData,
} from "./types";

export * from "./types";

const OBRAS_BY_ID: Record<string, ObraData> = {};

/** Retorna os dados completos da obra. `undefined` se contractId não existir. */
export function getObra(contractId: string): ObraData | undefined {
  return OBRAS_BY_ID[contractId];
}

/** Atalho para a Síntese (M2.1.1). */
export function getSintese(contractId: string): SinteseObra | undefined {
  return OBRAS_BY_ID[contractId]?.sintese;
}

/** Atalho para a Revisão Documental (M1.1). `null` quando ainda não modelada. */
export function getRevisao(contractId: string): RevisaoDocumental | null | undefined {
  return OBRAS_BY_ID[contractId]?.preContrato.revisao;
}

/** Atalho para Bases do Negócio (M1.2). `null` quando ainda não modelada. */
export function getBases(contractId: string): BasesData | null | undefined {
  return OBRAS_BY_ID[contractId]?.preContrato.bases;
}

/** Atalho para Diagnóstico do Contrato (M1.3). `null` quando ainda não modelado. */
export function getDiagnostico(contractId: string): DiagnosticoData | null | undefined {
  return OBRAS_BY_ID[contractId]?.preContrato.diagnostico;
}

/** Atalho para Transpasse Orçamentário (M1.4). `null` quando ainda não modelado. */
export function getTranspasse(contractId: string): TranspasseData | null | undefined {
  return OBRAS_BY_ID[contractId]?.preContrato.transpasse;
}

/** Atalho para Visão Geral do Contrato (M2 entry — §5.3.1 expandida). */
export function getVisaoGeral(contractId: string): VisaoGeralData | null | undefined {
  return OBRAS_BY_ID[contractId]?.visaoGeral;
}

/** Snapshot do BM solicitado. Se `numero` for omitido, retorna o BM corrente. */
export function getBm(visao: VisaoGeralData, numero?: string): BmSnapshot {
  const alvo = numero ?? visao.bmCorrente;
  const found = visao.bms.find((b) => b.numero === alvo);
  if (found) return found;
  // Fallback: BM corrente. Garantido existir pelo schema.
  return visao.bms.find((b) => b.numero === visao.bmCorrente) ?? visao.bms[visao.bms.length - 1]!;
}

/** BM correspondente a ano+mês exatos. `undefined` quando inexistente. */
export function getBmByAnoMes(
  visao: VisaoGeralData,
  ano: number,
  mes: number,
): BmSnapshot | undefined {
  return visao.bms.find((b) => b.ano === ano && b.mes === mes);
}

/** Lista de anos com BMs disponíveis (ordenada desc — mais recente primeiro). */
export function listAnosBms(visao: VisaoGeralData): number[] {
  return Array.from(new Set(visao.bms.map((b) => b.ano))).sort((a, b) => b - a);
}

/** Lista de meses (1-12) com BM dentro do ano. */
export function listMesesBms(visao: VisaoGeralData, ano: number): number[] {
  return visao.bms
    .filter((b) => b.ano === ano)
    .map((b) => b.mes)
    .sort((a, b) => a - b);
}
