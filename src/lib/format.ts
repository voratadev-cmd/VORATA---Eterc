// Formatadores numéricos PT-BR compartilhados. Centraliza o que estava redefinido byte-a-byte em
// cada tela do M3 (Painel de Desequilíbrio). Convenção compacta do módulo: "mi" (milhões) / "mil".
// Implementações idênticas às originais — pura extração, sem mudança de saída.

/** R$ inteiro (sem centavos). Ex.: "R$ 33.118.333". */
export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

/** R$ com centavos. Ex.: "R$ 31.988.709,39". */
export function formatBRLCents(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** R$ compacto. Ex.: "R$ 611,4 mi" / "R$ 250 mil". */
export function formatBRLCompact(value: number): string {
  if (value >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  }
  if (value >= 1_000) {
    return `R$ ${(value / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  }
  return formatBRL(value);
}

/** Inteiro com separador de milhar. Ex.: "1.433.728". */
export function formatNum(value: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);
}

/** Percentual com 1 casa. Ex.: "96,6%". */
export function formatPct(value: number): string {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

/** Razão/índice com 2 casas. Ex.: "2,29". */
export function formatRatio(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Intervalo de razão. Ex.: "1,63–2,29" (ou só o valor se min≈max). */
export function formatRange(min: number, max: number | null): string {
  if (max == null || Math.abs(max - min) < 0.005) return formatRatio(min);
  return `${formatRatio(min)}–${formatRatio(max)}`;
}
