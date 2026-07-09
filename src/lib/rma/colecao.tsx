// Coleção: busca (debounce) + ordenação configurável + filtro opcional + paginação. Padrão canônico
// do projeto (CLAUDE.md: "toda coleção com 5+ itens ganha busca/ordenação/paginação") compartilhado
// entre as abas do RMA (Faturamento, Prazo, …) — antes era duplicado por tela. Estilo em patterns.css
// (classes .col-*). Listas pequenas → recomputar a cada render é barato; sem memoização do `opts`.

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { I, Select } from "@/components/ds";

export const COL_PAGE = 8;

/** Normaliza p/ busca: minúsculas, sem acento, trim. */
export function normTxt(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/** Uma opção de ordenação: rótulo + comparador. A 1ª da lista é a ordenação padrão. */
export type Ordenacao<T> = { value: string; label: string; cmp: (a: T, b: T) => number };

/** Ordenações padrão "Maior valor" (desc) + "Nome (A–Z)" — usado pelas tabelas valor×nome. */
export function ordValorNome<T>(nome: (x: T) => string, valor: (x: T) => number): Ordenacao<T>[] {
  return [
    { value: "valor", label: "Maior valor", cmp: (a, b) => valor(b) - valor(a) },
    {
      value: "nome",
      label: "Nome (A–Z)",
      cmp: (a, b) => normTxt(nome(a)).localeCompare(normTxt(nome(b))),
    },
  ];
}

export type ColecaoOpts<T> = {
  /** Texto pesquisável do item (concatena os campos relevantes). */
  busca: (x: T) => string;
  /** Ordenações disponíveis (a 1ª é o default). */
  ordenacoes: Ordenacao<T>[];
  /** Filtro extra (ex.: por status/farol) aplicado antes da busca. */
  filtro?: (x: T) => boolean;
  /** Itens por página (default 8). */
  perPage?: number;
  /** Quando muda, zera a página (ex.: troca de seleção pai). */
  resetKey?: unknown;
};

export function useColecao<T>(items: T[], opts: ColecaoOpts<T>) {
  const perPage = opts.perPage ?? COL_PAGE;
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sortVal, setSortVal] = useState(opts.ordenacoes[0]?.value ?? "");
  const [page, setPage] = useState(1);

  // debounce 280ms — input responde ao teclar, o filtro respira (regra canônica).
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query), 280);
    return () => window.clearTimeout(id);
  }, [query]);
  // NÃO incluir opts.filtro nas deps: é função inline (nova a cada render) → resetaria a página
  // todo render. Mudança de filtro deve vir via `resetKey` (valor estável, ex.: o status atual).
  useEffect(() => setPage(1), [debounced, sortVal, opts.resetKey]);

  const cmp = opts.ordenacoes.find((o) => o.value === sortVal)?.cmp ?? opts.ordenacoes[0]?.cmp;
  const filtered = useMemo(() => {
    const q = normTxt(debounced);
    let base = opts.filtro ? items.filter(opts.filtro) : items;
    if (q) base = base.filter((x) => normTxt(opts.busca(x)).includes(q));
    return cmp ? [...base].sort(cmp) : base;
  }, [items, debounced, cmp, opts]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const cur = Math.min(page, totalPages);
  const start = (cur - 1) * perPage;
  return {
    query,
    setQuery,
    debounced,
    sort: sortVal,
    setSort: setSortVal,
    ordenacoes: opts.ordenacoes,
    page: cur,
    setPage,
    totalPages,
    perPage,
    visible: filtered.slice(start, start + perPage),
    total: filtered.length,
    nItens: items.length,
    start,
    /** Mostrar a toolbar (busca+ordenação) só quando a lista passa de uma página. */
    showToolbar: items.length > perPage,
  };
}

/** Toolbar: busca + Select de ordenação + slot opcional `extra` (ex.: filtro por status). */
export function ColToolbar<T>({
  col,
  placeholder,
  extra,
}: {
  col: ReturnType<typeof useColecao<T>>;
  placeholder: string;
  extra?: ReactNode;
}) {
  return (
    <div className="col-toolbar">
      <label className="col-busca">
        <span className="col-busca-ic" aria-hidden>
          {I.search({ size: 15 })}
        </span>
        <input
          type="search"
          className="col-busca-in"
          placeholder={placeholder}
          value={col.query}
          onChange={(e) => col.setQuery(e.target.value)}
          aria-label={placeholder}
        />
        {col.query ? (
          <button
            type="button"
            className="col-busca-cl"
            onClick={() => col.setQuery("")}
            aria-label="Limpar busca"
          >
            {I.close({ size: 13 })}
          </button>
        ) : null}
      </label>
      {extra}
      {col.ordenacoes.length > 1 ? (
        <Select
          value={col.sort}
          onChange={col.setSort}
          items={col.ordenacoes.map((o) => ({ value: o.value, label: o.label }))}
          size="sm"
          align="end"
        />
      ) : null}
    </div>
  );
}

/** Paginação "X–Y de N rótulo" + setas. Some quando há ≤ 1 página. */
export function ColPag<T>({
  col,
  rotulo,
}: {
  col: ReturnType<typeof useColecao<T>>;
  rotulo: string;
}) {
  if (col.totalPages <= 1) return null;
  return (
    <nav className="col-pag" aria-label="Paginação">
      <span className="col-pag-st">
        {col.start + 1}–{Math.min(col.start + col.perPage, col.total)} de {col.total} {rotulo}
      </span>
      <div className="col-pag-ct">
        <button
          type="button"
          className="col-pag-bt"
          disabled={col.page <= 1}
          onClick={() => col.setPage(col.page - 1)}
          aria-label="Página anterior"
        >
          {I.chevLeft({ size: 15 })}
        </button>
        <span className="col-pag-num">
          {col.page}/{col.totalPages}
        </span>
        <button
          type="button"
          className="col-pag-bt"
          disabled={col.page >= col.totalPages}
          onClick={() => col.setPage(col.page + 1)}
          aria-label="Próxima página"
        >
          {I.chevRight({ size: 15 })}
        </button>
      </div>
    </nav>
  );
}

/** Estado de busca sem match — com ação "Limpar busca" (regra #4). */
export function ColVazio({
  termo,
  rotulo,
  onClear,
  artigo = "Nenhum",
}: {
  termo: string;
  rotulo: string;
  onClear: () => void;
  /** Concordância de gênero do rótulo: "Nenhum trecho" × "Nenhuma disciplina". */
  artigo?: "Nenhum" | "Nenhuma";
}) {
  return (
    <div className="col-vazia">
      {artigo} {rotulo} para "{termo}".{" "}
      <button type="button" className="col-vazia-clear" onClick={onClear}>
        Limpar busca
      </button>
    </div>
  );
}
