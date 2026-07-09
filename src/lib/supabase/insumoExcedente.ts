// Read-model LEGADO do excedente ao IPCA — desde o v53 é um ADAPTER sobre o modelo multifonte
// (obra_insumos_fd + fontes recomendadas + obra_insumos_reeq · mesma fonte das telas C.6/D.5),
// mantendo os tipos originais para os consumidores (C.2 Indicadores · Visão Geral · relatório).
// Semântica v53: Δ% = fonte RECOMENDADA no período OS mar/26 → mai/26; excedente = (Δ% − IPCA)⁺;
// totalDeltaRs = REPASSE REAL (excedente × valor MEDIDO — canônico do D.10/D.11/chat: 10.246,94).

import {
  LIMIAR_EXCEDENTE,
  fonteSelecionada,
  getInsumosFd,
  selecaoRecomendada,
  totaisDe,
} from "./insumosFd";

export type InsumoExcedente = {
  ordem: number;
  insumo: string;
  classeAbc: string | null;
  qtdOrcada: number | null;
  precoOrcadoRs: number | null;
  /** orçado × (1+Δ%) da fonte recomendada. */
  precoRefRealRs: number | null;
  /** fração · Δ% da fonte recomendada (OS mar/26 → mai/26). */
  deltaRealPct: number | null;
  tetoIpcaPct: number | null;
  /** (Δ% − IPCA)⁺ · fração. */
  excedentePct: number | null;
  /** Repasse REAL do item (excedente × valor MEDIDO) · 0 quando ainda não medido. */
  deltaRs: number | null;
  /** 'Conforme' | 'Conforme · caiu' | 'Observação' · farol por item. */
  farol: string | null;
  indicePendente: boolean;
};

export type ExcedenteResumo = {
  insumos: InsumoExcedente[];
  /** período do snapshot (marco OS → verificação). */
  snapshotLabel: string | null;
  /** IPCA do período — linha divisória 8.8 (fração). */
  tetoSnapshotPct: number | null;
  dataBase: string | null;
  normativa: string | null;
  /** farol consolidado (Observação quando há potencial de repasse). */
  farolHeader: string | null;
  metodoAtivo: string | null;
  /** nº de insumos acima do IPCA (fonte recomendada). */
  insumosAcimaTeto: number | null;
  /** REPASSE REAL total (Σ excedente × valor medido) — canônico (10.246,94 no BR-101). */
  totalDeltaRs: number | null;
  pctSobrePv: number | null;
  reajustePagoAcumRs: number | null;
  comIndice: InsumoExcedente[];
  acimaTeto: InsumoExcedente[];
  caiu: InsumoExcedente[];
  pendentes: InsumoExcedente[];
  /** maior excedente (fração) e o insumo dono dele. */
  maiorGap: { insumo: string; excedentePct: number; deltaRealPct: number | null } | null;
};

/** Reequilíbrio 8.8 (v53 multifonte). Null se a obra não tem o v53 normalizado. */
export async function getInsumoExcedente(contractId: string): Promise<ExcedenteResumo | null> {
  const fd = await getInsumosFd(contractId);
  if (!fd) return null;

  const sel = selecaoRecomendada(fd.insumos);
  const totais = totaisDe(fd.insumos, sel);

  const insumos: InsumoExcedente[] = fd.insumos.map((i) => {
    const f = fonteSelecionada(i, sel);
    const delta = f?.delta ?? null;
    const excBruto = f?.excedente ?? null;
    const excede = excBruto != null && excBruto > LIMIAR_EXCEDENTE;
    const excedentePct = excBruto == null ? null : excede ? excBruto : 0;
    const repasse = excede && i.valorMedidoBdi > 0 ? excBruto * i.valorMedidoBdi : 0;
    return {
      ordem: i.ordemAbc,
      insumo: i.nome,
      classeAbc: i.classe,
      qtdOrcada: i.qtdPq,
      precoOrcadoRs: i.precoUnitBdi,
      precoRefRealRs: delta != null ? i.precoUnitBdi * (1 + delta) : null,
      deltaRealPct: delta,
      tetoIpcaPct: fd.reeq.ipcaPeriodo,
      excedentePct,
      deltaRs: Math.round(repasse * 100) / 100,
      farol:
        delta == null ? null : excede ? "Observação" : delta < 0 ? "Conforme · caiu" : "Conforme",
      indicePendente: delta == null,
    };
  });

  const comIndice = insumos.filter((i) => !i.indicePendente);
  const acimaTeto = comIndice.filter((i) => (i.excedentePct ?? 0) > 0);
  const maior = [...acimaTeto].sort((a, b) => (b.excedentePct ?? 0) - (a.excedentePct ?? 0))[0];
  const repasseReal = Math.round(totais.repasseReal * 100) / 100;

  return {
    insumos,
    snapshotLabel: "mai/26 (marco OS mar/26)",
    tetoSnapshotPct: fd.reeq.ipcaPeriodo,
    dataBase: fd.reeq.dataOs,
    normativa: "IPCA (cl. 6.2) · excedente repassável (cl. 8.8) · multifonte v53",
    farolHeader: totais.potencial > 0 ? "Observação" : "Conforme",
    metodoAtivo: "M2 multifonte (fonte recomendada por insumo)",
    insumosAcimaTeto: totais.acimaDoIpca,
    totalDeltaRs: repasseReal,
    pctSobrePv: fd.reeq.contratoCheioBdi > 0 ? repasseReal / fd.reeq.contratoCheioBdi : null,
    reajustePagoAcumRs: 0,
    comIndice,
    acimaTeto,
    caiu: comIndice.filter((i) => (i.deltaRealPct ?? 0) < 0),
    pendentes: insumos.filter((i) => i.indicePendente),
    maiorGap: maior
      ? {
          insumo: maior.insumo,
          excedentePct: maior.excedentePct ?? 0,
          deltaRealPct: maior.deltaRealPct,
        }
      : null,
  };
}
