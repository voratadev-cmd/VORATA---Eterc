// Mock data — contratos sob administração (lista do portfólio).
// Mantém só os dados de "cabeçalho/portfólio": valor, prazo, farol, coordenadas.
// Os dados completos de cada obra (síntese, RMA, etc.) vivem em src/lib/mocks/obras/<id>.ts.

import type { BadgeTone } from "@/components/ds";

export type FarolLevel = "conforme" | "observacao" | "risco" | "critico";

export const farolToBadge: Record<FarolLevel, BadgeTone> = {
  conforme: "success",
  observacao: "info",
  risco: "warning",
  critico: "danger",
};

export const farolLabel: Record<FarolLevel, string> = {
  conforme: "Conforme",
  observacao: "Observação",
  risco: "Risco",
  critico: "Crítico",
};

export type Contract = {
  id: string;
  /** Nome interno (apelido) usado no menu */
  nome: string;
  /** Nome completo do objeto contratado */
  objeto: string;
  cliente: string;
  localizacao: string;
  /** Coordenadas decimais — para o Mapa das Obras */
  lat: number;
  lng: number;
  valorContratual: number;
  inicioISO: string;
  fimPrevistoISO: string;
  prazoTotalDias: number;
  prazoDecorridoDias: number;
  /** % do contrato já faturado */
  faturamentoPct: number;
  /** Desvio do faturamento previsto (negativo = atrasado). Ex.: -12 = 12% abaixo do previsto. */
  faturamentoDesvioPct: number;
  desequilibrioAcumulado: number;
  /** Qualidade documental 0-100 — entra no KPI agregado */
  qualidadeDocumental: number;
  farol: FarolLevel;
};

export const MOCK_CONTRACTS: Contract[] = [];

export function getContract(id: string): Contract | undefined {
  return MOCK_CONTRACTS.find((c) => c.id === id);
}

export function formatBRL(value: number, withSymbol = true): string {
  const fmt = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
  return withSymbol ? fmt : fmt.replace(/^R\$\s?/, "");
}

/** Formato compacto para KPIs agregados: R$ 2,4 bi · R$ 318 mi · R$ 12,9 mi · R$ 540 k */
export function formatBRLAbbreviated(value: number, withSymbol = true): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  let formatted: string;
  if (abs >= 1_000_000_000) {
    formatted = `${(abs / 1_000_000_000).toFixed(1).replace(".", ",")} bi`;
  } else if (abs >= 1_000_000) {
    formatted = `${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace(".", ",")} mi`;
  } else if (abs >= 1_000) {
    formatted = `${(abs / 1_000).toFixed(0)} k`;
  } else {
    // Arredonda SEMPRE (regra global v3: R$ sem casas decimais) — `String(abs)` cru vazava o
    // float da fonte pra tela ("R$ 682.00674" na linha do motorista-basculante · spec §C.4.2).
    formatted = abs.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  }
  return `${sign}${withSymbol ? "R$ " : ""}${formatted}`;
}

/** Conta contratos por nível de farol — útil pra legenda do mapa e contadores. */
export function farolCounts(contracts: Contract[] = MOCK_CONTRACTS): Record<FarolLevel, number> {
  const out: Record<FarolLevel, number> = { conforme: 0, observacao: 0, risco: 0, critico: 0 };
  for (const c of contracts) out[c.farol]++;
  return out;
}

/** Média (arredondada) da qualidade documental do portfólio. */
export function avgQualidadeDocumental(contracts: Contract[] = MOCK_CONTRACTS): number {
  if (contracts.length === 0) return 0;
  const sum = contracts.reduce((s, c) => s + c.qualidadeDocumental, 0);
  return Math.round(sum / contracts.length);
}
