// Helper reusável de coleção (busca + ordenação + paginação client-side) — o padrão canônico do
// projeto para qualquer tabela/lista com 5+ itens (CLAUDE.md). Genérico em T: o chamador passa
// como extrair o texto buscável e os comparadores de ordenação (que tratam null por conta deles).
// Usado pela tabela de 98 recursos (3.4 Valor Agregado) e pela Curva ABC de insumos (3.7).

import { useEffect, useMemo, useState } from "react";

export type ColecaoSort<T> = {
  key: string;
  label: string;
  cmp: (a: T, b: T) => number;
};

export type ColecaoOpts<T> = {
  /** Texto buscável de um item (será comparado em lowercase, includes). */
  searchText: (item: T) => string;
  /** Opções de ordenação nomeadas (estável — defina fora do componente ou via useMemo). */
  sorts: ColecaoSort<T>[];
  /** Chave de ordenação inicial (default: primeira opção). */
  initialSortKey?: string;
  /** Itens por página (default 10). */
  pageSize?: number;
  /** Debounce da busca em ms (default 280). */
  debounceMs?: number;
};

/** Normaliza para busca acento-insensível: remove diacríticos (NFD) + lowercase. "AÇO" → "aco". */
function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function useColecao<T>(items: T[], opts: ColecaoOpts<T>) {
  const { searchText, sorts, pageSize = 10, debounceMs = 280 } = opts;
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sortKey, setSortKey] = useState(opts.initialSortKey ?? sorts[0]?.key ?? "");
  const [page, setPage] = useState(1);

  // debounce da busca
  useEffect(() => {
    const t = setTimeout(() => setDebounced(norm(query.trim())), debounceMs);
    return () => clearTimeout(t);
  }, [query, debounceMs]);

  // volta pra página 1 quando o filtro ou a ordenação muda
  useEffect(() => {
    setPage(1);
  }, [debounced, sortKey]);

  const filtered = useMemo(() => {
    const base = debounced ? items.filter((it) => norm(searchText(it)).includes(debounced)) : items;
    const sort = sorts.find((s) => s.key === sortKey) ?? sorts[0];
    return sort ? [...base].sort(sort.cmp) : base;
  }, [items, debounced, sortKey, sorts, searchText]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  return {
    query,
    setQuery,
    clear: () => setQuery(""),
    sortKey,
    setSortKey,
    sorts,
    page: safePage,
    setPage,
    pageCount,
    pageItems,
    totalFiltered: filtered.length,
    totalAll: items.length,
    rangeStart: filtered.length === 0 ? 0 : start + 1,
    rangeEnd: Math.min(start + pageSize, filtered.length),
    isFiltered: debounced.length > 0,
  };
}
