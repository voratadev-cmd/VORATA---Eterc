// useRmaCorte — lê o BM de corte escolhido no seletor de período do RMA (?bm = "YYYY-MM").
// Retorna { ano, mes } | null. null/ausente/inválido = "Obra inteira" (corte = último mês medido =
// comportamento default, intacto). É só estado de URL — qualquer aba filha do RMA pode ler.
import { useSearch } from "@tanstack/react-router";

export type CorteBm = { ano: number; mes: number };

/** Parse defensivo do `?bm`. Formato esperado "YYYY-MM"; qualquer outra coisa (legado/lixo) → null. */
export function parseBm(bm: unknown): CorteBm | null {
  if (typeof bm !== "string") return null;
  const m = /^(\d{4})-(\d{2})$/.exec(bm);
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  if (!Number.isFinite(ano) || mes < 1 || mes > 12) return null;
  return { ano, mes };
}

/** Serializa um corte pro `?bm`. */
export function bmId(c: CorteBm): string {
  return `${c.ano}-${String(c.mes).padStart(2, "0")}`;
}

/** Corte escolhido no seletor de período do RMA (ou null = Obra inteira / default). */
export function useRmaCorte(): CorteBm | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- search dinâmico (lido de qualquer aba filha)
  const search = useSearch({ strict: false }) as any;
  return parseBm(search?.bm);
}

/**
 * Corte EFETIVO da aba: o `?bm` da URL quando presente/válido; senão o fallback vindo do
 * DADO (BM corrente = último mês medido do read-model da aba). É o hook padrão pras abas
 * que respondem ao seletor de período (RmaParamBar/RmaPeriodoPicker): a aba nunca fica sem
 * corte enquanto o dado tiver ao menos um mês medido.
 *
 * Adoção: C.4 Recursos já consome; C.3 resolve o fallback dentro do useFaturamentoBm (exceção
 * documentada). Novas abas corte-aware devem usar este hook.
 *
 * `fallback` null/undefined (dado ainda carregando ou obra sem medição) → retorna o `?bm`
 * se houver, senão null (a aba trata como "Obra inteira", comportamento default de hoje).
 */
export function useRmaCorteEfetivo(fallback: CorteBm | null | undefined): CorteBm | null {
  const corte = useRmaCorte();
  return corte ?? fallback ?? null;
}
