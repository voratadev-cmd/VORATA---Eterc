// M3 · Fundação de navegação compartilhada do Painel de Desequilíbrio (D.0 → D.x).
//
// Movimento PURO: extrai, sem mudar comportamento, o mapa de rotas D.x e a escala de magnitude
// da barra de composição que hoje vivem inline na tela-mãe D.0
// (src/routes/_app/contracts/$contractId/desequilibrio/index.tsx).
//
// Sem valor de negócio aqui — só destino de Link e a fração 0..1 da barra. MAGNITUDE ≠ FAROL:
// a intensidade da barra é derivada de valor/total (navy via opacity/color-mix), nunca um tom
// semântico de farol.

/** Código canônico de uma tela do Painel de Desequilíbrio (D.x do Módulo 3). */
export type DeseqCodigo = "D.1" | "D.2" | "D.3" | "D.4" | "D.5" | "D.6" | "D.10";

/** Caminho tipado (TanStack `fullPath`) de cada tela D.x — `$contractId` é o único param. */
export type DeseqTo =
  | "/contracts/$contractId/desequilibrio/indiretos"
  | "/contracts/$contractId/desequilibrio/bdi"
  | "/contracts/$contractId/desequilibrio/encargos"
  | "/contracts/$contractId/desequilibrio/valor-agregado"
  | "/contracts/$contractId/desequilibrio/insumos"
  | "/contracts/$contractId/desequilibrio/pontuais"
  | "/contracts/$contractId/desequilibrio/gerador-claim";

/** Entrada do mapa: nº do item de menu (M3.x), slug da rota e o `to` tipado para o `<Link>`. */
export type DeseqTela = {
  /** Nº do item na Sidebar/menu (3.x). */
  numero: string;
  /** Último segmento da URL. */
  slug: string;
  /** `to` tipado para `<Link>` — casa 1:1 com o `fullPath` do routeTree. */
  to: DeseqTo;
};

/**
 * Mapa D.x → destino de rota do Painel de Desequilíbrio.
 * D.1..D.6 (parcelas) + D.10 (Gerador de Claim). Espelha 1:1 a tabela de rotas M3 do CLAUDE.md
 * (M3.1, M3.2, M3.3, M3.4, M3.7, M3.8, M3.10). Numeração e slugs vêm do que já existia inline na D.0.
 */
export const TELA_DEST = {
  "D.1": {
    numero: "3.1",
    slug: "indiretos",
    to: "/contracts/$contractId/desequilibrio/indiretos",
  },
  "D.2": {
    numero: "3.2",
    slug: "bdi",
    to: "/contracts/$contractId/desequilibrio/bdi",
  },
  "D.3": {
    numero: "3.3",
    slug: "encargos",
    to: "/contracts/$contractId/desequilibrio/encargos",
  },
  "D.4": {
    numero: "3.4",
    slug: "valor-agregado",
    to: "/contracts/$contractId/desequilibrio/valor-agregado",
  },
  "D.5": {
    numero: "3.7",
    slug: "insumos",
    to: "/contracts/$contractId/desequilibrio/insumos",
  },
  "D.6": {
    numero: "3.8",
    slug: "pontuais",
    to: "/contracts/$contractId/desequilibrio/pontuais",
  },
  "D.10": {
    numero: "3.10",
    slug: "gerador-claim",
    to: "/contracts/$contractId/desequilibrio/gerador-claim",
  },
} as const satisfies Record<DeseqCodigo, DeseqTela>;

/** Props de navegação prontas para espalhar em `<Link {...deseqRota("D.1", id)} />`. */
export type DeseqRota = { to: DeseqTo; params: { contractId: string } };

/**
 * Destino de Link de uma tela D.x. Devolve `{ to, params }` prontos para o `<Link>`.
 * Retorna `null` para códigos sem tela dedicada — o chamador simplesmente não renderiza o link,
 * espelhando o `dest ? <Link/> : null` que já vivia inline na D.0.
 */
export function deseqRota(codigo: string, contractId: string): DeseqRota | null {
  const dest = (TELA_DEST as Record<string, DeseqTela | undefined>)[codigo];
  if (!dest) return null;
  return { to: dest.to, params: { contractId } };
}

/**
 * Intensidade 0..1 da barra de composição (magnitude = valor vs. o total/maior) — mesma lógica
 * que hoje é inline na D.0 (`valor / total`). É MAGNITUDE, não farol: a tela aplica a fração como
 * opacity/color-mix sobre o navy (`var(--ink)`), nunca como tom semântico. Entradas não-finitas,
 * `max <= 0` ou fração ≤ 0 → 0; fração ≥ 1 é travada em 1 (contrato "0 a 1").
 */
export function escalaMagnitude(valor: number, max: number): number {
  if (!Number.isFinite(valor) || !Number.isFinite(max) || max <= 0) return 0;
  const frac = valor / max;
  if (frac <= 0) return 0;
  return frac < 1 ? frac : 1;
}
