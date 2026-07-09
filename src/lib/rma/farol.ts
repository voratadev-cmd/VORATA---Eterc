// Camada B · classificador de FAROL (número → nível) + RÉGUAS por indicador.
// Princípio: os critérios vivem AQUI (não escondidos na tela), como dados configuráveis por
// contrato. A tela é só apresentação. Régua OFICIAL passada pela pessoa de domínio (03/jun/2026).
//
// Cada indicador tem DIREÇÃO própria: "maior=melhor" (ex.: CPI ≥ 1,0) ou "menor=melhor" (ex.:
// desequilíbrio % — alto é ruim). Os cortes são os 3 limites Conforme/Observação/Risco; abaixo
// (ou acima, conforme a direção) do último = Crítico.

export type FarolLevel = "conforme" | "observacao" | "risco" | "critico";

/** "maior=melhor": valor alto é bom (aderência, CPI). "menor=melhor": valor alto é ruim
 *  (desequilíbrio, prorrogação, gap). */
export type FarolDir = "maior_melhor" | "menor_melhor";

/** Os 3 cortes Conforme/Observação/Risco (na unidade do indicador). */
export type FarolCortes = { conforme: number; observacao: number; risco: number };

export type FarolRegra = { dir: FarolDir; cortes: FarolCortes; descricao: string };

/**
 * RÉGUA OFICIAL por indicador (pessoa de domínio, 03/jun/2026). Configurável por contrato no
 * futuro — trocar os números aqui, nada na tela muda.
 *
 * Notas de leitura:
 * - desvio de faturamento e atraso físico são em % de DESVIO (negativo = abaixo do previsto =
 *   ruim) → "maior=melhor" (menos negativo é melhor).
 * - tendência de término é GATILHO (sem faixa de Observação): dentro do prazo = Conforme; estoura
 *   até 8% = Risco; acima = Crítico → modelado com observacao == conforme (banda de Obs vazia).
 * - recursos é uma RELAÇÃO: (queda de faturamento − queda de recurso) em pp; faturamento cair ≤
 *   recurso = bom → "menor=melhor".
 */
export const FAROL_REGRAS: Record<string, FarolRegra> = {
  // 1 · Desvio acumulado de faturamento (% vs previsto) — baixo ruim
  faturamento_desvio_acumulado: {
    dir: "maior_melhor",
    cortes: { conforme: -1, observacao: -5, risco: -10 },
    descricao: "Desvio acum. de faturamento (% vs previsto) — abaixo do previsto é ruim",
  },
  // 1b · Aderência acumulada de faturamento (real ÷ previsto acum, %) — baixo ruim. RÉGUA OFICIAL da
  // C.3 (operacional · pessoa de domínio, 14/jun/2026): Conforme ≥ 90 · Observação ≥ 85 · Risco ≥ 70;
  // < 70 = Crítico. A C.2 (executiva) segue com o DESVIO acima — métricas distintas DE PROPÓSITO.
  faturamento_aderencia_acumulada: {
    dir: "maior_melhor",
    cortes: { conforme: 90, observacao: 85, risco: 70 },
    descricao:
      "Aderência acum. de faturamento (real ÷ previsto acum, %) — abaixo do previsto é ruim",
  },
  // 2 · Recursos vs faturamento: (queda fat − queda recurso) em pp — alto ruim
  recursos_vs_faturamento: {
    dir: "menor_melhor",
    cortes: { conforme: 0, observacao: 5, risco: 10 },
    descricao: "Queda de faturamento − queda de recurso (pp); fat. cair ≤ recurso é bom",
  },
  // 3 · Produtividade (CPI) — baixo ruim
  produtividade_cpi: {
    dir: "maior_melhor",
    cortes: { conforme: 1.0, observacao: 0.9, risco: 0.8 },
    descricao: "CPI (índice de desempenho de custo/produtividade) — abaixo de 1,0 é ruim",
  },
  // 4 · Atraso físico (pp: real − previsto) — baixo ruim
  prazo_atraso_fisico: {
    dir: "maior_melhor",
    cortes: { conforme: -2, observacao: -5, risco: -10 },
    descricao: "Atraso físico (pp: realizado − previsto) — abaixo do previsto é ruim",
  },
  // 5 · Prorrogação projetada (% do prazo) — alto ruim
  prazo_prorrogacao: {
    dir: "menor_melhor",
    cortes: { conforme: 1, observacao: 3, risco: 8 },
    descricao: "Prorrogação projetada (% do prazo contratual) — quanto maior, pior",
  },
  // 6 · Tendência de término (% que a projeção estoura o prazo) — GATILHO (sem Observação)
  prazo_tendencia_termino: {
    dir: "menor_melhor",
    cortes: { conforme: 0, observacao: 0, risco: 8 },
    descricao:
      "Tendência de término: dentro do prazo = Conforme; estoura até 8% = Risco; acima = Crítico",
  },
  // 7 · Insumos vs índice (pp acima do índice contratual) — alto ruim (só acima prejudica)
  insumos_vs_indice: {
    dir: "menor_melhor",
    cortes: { conforme: 2, observacao: 5, risco: 10 },
    descricao: "Insumo vs índice de reajuste (pp acima) — só acima do índice prejudica",
  },
  // 8 · Desequilíbrio acumulado (% do contrato) — alto ruim
  desequilibrio_acumulado: {
    dir: "menor_melhor",
    cortes: { conforme: 1, observacao: 5, risco: 10 },
    descricao: "Desequilíbrio acumulado (% do valor do contrato) — quanto maior, pior",
  },
  // 9 · Gap Capacidade − Liberação (pp) — alto ruim
  capacidade_gap: {
    dir: "menor_melhor",
    cortes: { conforme: 2, observacao: 5, risco: 10 },
    descricao: "Gap Capacidade − Liberação (pp) — gargalo quando capacidade supera liberação",
  },
};

/** Overrides PARCIAIS dos cortes por indicador (vêm de `obras.farol_regras` · jsonb). A direção
 *  é estrutural (vive no código) — só os NÚMEROS são configuráveis por contrato. */
export type FarolOverrides = Record<string, Partial<FarolCortes>>;

/** Mescla os overrides da obra sobre a régua oficial. Chave desconhecida ou corte não-numérico é
 *  ignorado (a régua oficial nunca é corrompida por um jsonb malformado). */
export function mesclarRegras(overrides?: FarolOverrides | null): Record<string, FarolRegra> {
  if (!overrides) return FAROL_REGRAS;
  const out: Record<string, FarolRegra> = { ...FAROL_REGRAS };
  for (const [chave, cortes] of Object.entries(overrides)) {
    const base = out[chave];
    if (!base || cortes == null || typeof cortes !== "object") continue;
    const novo = { ...base.cortes };
    for (const nivel of ["conforme", "observacao", "risco"] as const) {
      const v = (cortes as Partial<FarolCortes>)[nivel];
      if (typeof v === "number" && Number.isFinite(v)) novo[nivel] = v;
    }
    out[chave] = { ...base, cortes: novo };
  }
  return out;
}

/** Extrai/valida os overrides do jsonb cru de `obras.farol_regras`. null se ausente/malformado. */
export function farolOverridesDe(raw: unknown): FarolOverrides | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as FarolOverrides;
}

/** Classifica "MAIOR = MELHOR": ≥ conforme → conforme; ≥ obs → obs; ≥ risco → risco; senão crítico. */
export function classificarMaiorMelhor(
  valor: number | null | undefined,
  cortes: FarolCortes,
): FarolLevel | null {
  if (valor == null || Number.isNaN(valor)) return null;
  if (valor >= cortes.conforme) return "conforme";
  if (valor >= cortes.observacao) return "observacao";
  if (valor >= cortes.risco) return "risco";
  return "critico";
}

/** Classifica "MENOR = MELHOR": ≤ conforme → conforme; ≤ obs → obs; ≤ risco → risco; senão crítico. */
export function classificarMenorMelhor(
  valor: number | null | undefined,
  cortes: FarolCortes,
): FarolLevel | null {
  if (valor == null || Number.isNaN(valor)) return null;
  if (valor <= cortes.conforme) return "conforme";
  if (valor <= cortes.observacao) return "observacao";
  if (valor <= cortes.risco) return "risco";
  return "critico";
}

/** Classifica pela RÉGUA do indicador (aplica a direção certa). null se indicador desconhecido.
 *  `regras` opcional = régua já mesclada com os overrides da obra (default: régua oficial). */
export function classificarPorRegra(
  indicador: keyof typeof FAROL_REGRAS | string,
  valor: number | null | undefined,
  regras: Record<string, FarolRegra> = FAROL_REGRAS,
): FarolLevel | null {
  const regra = regras[indicador];
  if (!regra) return null;
  return regra.dir === "maior_melhor"
    ? classificarMaiorMelhor(valor, regra.cortes)
    : classificarMenorMelhor(valor, regra.cortes);
}

/** Tom do DS para o nível (mapeia 1:1 com Badge tone). */
export const FAROL_TONE: Record<FarolLevel, "success" | "info" | "warning" | "danger"> = {
  conforme: "success",
  observacao: "info",
  risco: "warning",
  critico: "danger",
};

export const FAROL_LABEL: Record<FarolLevel, string> = {
  conforme: "Conforme",
  observacao: "Observação",
  risco: "Risco",
  critico: "Crítico",
};
