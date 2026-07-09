// Busca global da Topbar — DROPDOWN ancorado no campo (não modal). Escopo na obra ATUAL:
// por padrão mostra atalhos/telas DESTA obra + ações; ao digitar, filtra a navegação da obra e
// só então oferece OUTRAS obras (pra trocar). Filtro instantâneo (case/acento-insensível),
// teclado (↑↓ ↵ esc), realce do trecho, ⌘K foca o campo. Dados via props; navegação TanStack.
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { I, type NavItem } from "@/components/ds";
import { useTheme } from "@/lib/theme";
import type { Obra } from "@/lib/supabase/obras";
import "./TopbarSearch.css";

export type TopbarSearchProps = {
  obras: Obra[] | undefined;
  navItems: NavItem[];
  activeContractId: string;
};

type Cmd = {
  id: string;
  label: string;
  sub?: string;
  icon: ReactNode;
  keywords?: string;
  priority?: boolean;
  run: () => void;
};
type Group = { id: string; title: string; items: Cmd[] };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function highlight(label: string, q: string): ReactNode {
  if (!q) return label;
  const i = label.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return label;
  return (
    <>
      {label.slice(0, i)}
      <mark>{label.slice(i, i + q.length)}</mark>
      {label.slice(i + q.length)}
    </>
  );
}

function flattenNav(items: NavItem[], parent?: string): Array<{ item: NavItem; parent?: string }> {
  const out: Array<{ item: NavItem; parent?: string }> = [];
  for (const it of items) {
    if (it.disabled) continue;
    if (it.to) out.push({ item: it, parent });
    if (it.children?.length) out.push(...flattenNav(it.children, it.label));
  }
  return out;
}

export function TopbarSearch({ obras, navItems, activeContractId }: TopbarSearchProps) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  }, []);

  // ponte de navegação tipada: NavItem.to é string; as rotas são válidas em runtime.
  const go = useCallback(
    (to: string, params?: Record<string, string>) => {
      close();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      navigate({ to: to as any, params: params as any });
    },
    [navigate, close],
  );

  // ── índices ─────────────────────────────────────────────────────────
  const actions = useMemo<Cmd[]>(
    () => [
      {
        id: "act-nova",
        label: "Nova obra",
        sub: "Cadastrar um novo contrato",
        icon: I.plus({ size: 16 }),
        keywords: "cadastrar criar contrato adicionar novo",
        run: () => go("/contracts/new"),
      },
      {
        id: "act-obras",
        label: "Ver todas as obras",
        sub: "Lista de contratos",
        icon: I.house({ size: 16 }),
        keywords: "lista portfolio carteira obras contratos trocar",
        run: () => go("/contracts"),
      },
      {
        id: "act-tema",
        label: theme === "dark" ? "Tema claro" : "Tema escuro",
        sub: "Alternar aparência",
        icon: theme === "dark" ? I.sun({ size: 16 }) : I.moon({ size: 16 }),
        keywords: "tema dark claro escuro aparencia theme modo",
        run: () => {
          toggleTheme();
          close();
        },
      },
      {
        id: "act-config",
        label: "Configurações",
        sub: "Preferências da conta",
        icon: I.settings({ size: 16 }),
        keywords: "settings preferencias ajustes perfil conta",
        run: () => go("/settings"),
      },
    ],
    [go, theme, toggleTheme, close],
  );

  const obraCmds = useMemo<Cmd[]>(
    () =>
      (obras ?? []).map((o) => {
        const local = [o.cidade, o.uf].filter(Boolean).join("/");
        const sub = [o.contratante, local].filter(Boolean).join(" · ");
        return {
          id: `obra-${o.id}`,
          label: o.nome_interno,
          sub: sub || undefined,
          icon: I.map({ size: 16 }),
          keywords: [o.contratante, o.cidade, o.uf, o.objeto_contratado].filter(Boolean).join(" "),
          priority: o.id === activeContractId,
          run: () => go("/contracts/$contractId/dashboard", { contractId: o.id }),
        };
      }),
    [obras, activeContractId, go],
  );

  const navCmds = useMemo<Cmd[]>(() => {
    if (!activeContractId) return [];
    return flattenNav(navItems).map(({ item, parent }) => ({
      id: `nav-${item.id}`,
      label: item.label,
      sub: parent,
      icon: item.icon ? I[item.icon]({ size: 16 }) : I.doc({ size: 16 }),
      keywords: parent ?? "",
      priority: Boolean(item.key) || ["dashboard", "m2-1-1", "m3-0"].includes(item.id),
      run: () => go(item.to as string, item.params ?? { contractId: activeContractId }),
    }));
  }, [navItems, activeContractId, go]);

  // ── grupos visíveis ─────────────────────────────────────────────────
  const q = query.trim();
  const groups = useMemo<Group[]>(() => {
    if (!q) {
      const def: Group[] = [];
      const atalhos = navCmds.filter((c) => c.priority);
      if (atalhos.length) def.push({ id: "nav", title: "Nesta obra", items: atalhos });
      def.push({ id: "acoes", title: "Ações", items: actions });
      // Sem obra ativa: oferece as obras pra escolher uma.
      if (!activeContractId && obraCmds.length)
        def.push({ id: "obras", title: "Obras", items: obraCmds.slice(0, 6) });
      return def;
    }
    const nq = norm(q);
    const match = (c: Cmd) => norm(`${c.label} ${c.sub ?? ""} ${c.keywords ?? ""}`).includes(nq);
    const out: Group[] = [];
    const n = navCmds.filter(match).slice(0, 10);
    if (n.length) out.push({ id: "nav", title: "Nesta obra", items: n });
    // Outras obras (≠ atual) — pra TROCAR de obra explicitamente.
    const o = obraCmds
      .filter((c) => c.id !== `obra-${activeContractId}`)
      .filter(match)
      .slice(0, 6);
    if (o.length) out.push({ id: "obras", title: "Trocar de obra", items: o });
    const a = actions.filter(match);
    if (a.length) out.push({ id: "acoes", title: "Ações", items: a });
    return out;
  }, [q, navCmds, obraCmds, actions, activeContractId]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // ── teclado / foco / clique-fora ────────────────────────────────────
  useEffect(() => setActive(0), [q, open]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  // ⌘K / Ctrl+K foca o campo (abre o dropdown)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // clique fora fecha
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
        setActive((i) => (flat.length ? (i + 1) % flat.length : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        flat[active]?.run();
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    },
    [flat, active, close],
  );

  let idx = -1;
  return (
    <div className={`tbs${open ? " is-open" : ""}`} ref={wrapRef}>
      <div className="tbs-field">
        <span className="tbs-ic" aria-hidden>
          {I.search({ size: 16 })}
        </span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Buscar telas, obras, ações…"
          aria-label="Buscar"
          autoComplete="off"
          spellCheck={false}
        />
        {query ? (
          <button
            type="button"
            className="tbs-clear"
            aria-label="Limpar busca"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
          >
            {I.close({ size: 14 })}
          </button>
        ) : (
          <span className="tbs-kbd">⌘K</span>
        )}
      </div>

      {open ? (
        <div className="tbs-pop">
          <div className="tbs-list" ref={listRef}>
            {flat.length === 0 ? (
              <div className="tbs-empty">
                Nenhum resultado para <strong>“{q}”</strong>.
                <br />
                Tente o nome de uma tela, obra ou ação.
              </div>
            ) : (
              groups.map((g) => (
                <div className="tbs-group" key={g.id}>
                  <div className="tbs-group-t">{g.title}</div>
                  {g.items.map((c) => {
                    idx += 1;
                    const i = idx;
                    return (
                      <div
                        key={c.id}
                        data-idx={i}
                        className={`tbs-row${i === active ? " is-active" : ""}`}
                        onMouseMove={() => setActive(i)}
                        onClick={() => c.run()}
                      >
                        <span className="tbs-row-ic" aria-hidden>
                          {c.icon}
                        </span>
                        <span className="tbs-row-body">
                          <span className="tbs-row-label">{highlight(c.label, q)}</span>
                          {c.sub ? <span className="tbs-row-sub">{c.sub}</span> : null}
                        </span>
                        <span className="tbs-row-go" aria-hidden>
                          abrir <span className="tbs-chip">↵</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
          <div className="tbs-foot">
            <div className="tbs-foot-hints">
              <span className="tbs-foot-hint">
                <span className="tbs-chip">↑</span>
                <span className="tbs-chip">↓</span> navegar
              </span>
              <span className="tbs-foot-hint">
                <span className="tbs-chip">↵</span> abrir
              </span>
              <span className="tbs-foot-hint">
                <span className="tbs-chip">esc</span> fechar
              </span>
            </div>
            <span className="tbs-foot-count">
              {flat.length} resultado{flat.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
