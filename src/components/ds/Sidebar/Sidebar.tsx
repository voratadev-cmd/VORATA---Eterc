import { Link, useLocation } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "../Avatar/Avatar";
import { IconButton } from "../IconButton/IconButton";
import { I, type IconName } from "../icons";
import "./Sidebar.css";

export type NavItem = {
  id: string;
  label: string;
  icon?: IconName;
  to?: string;
  /** Params para rotas dinâmicas (ex.: `{ contractId: "abc" }`) */
  params?: Record<string, string>;
  count?: number;
  /** Pequena tag à direita do label (ex.: "CORAÇÃO") */
  tag?: string;
  /** Destaque visual no sub-item (dot brand à direita) */
  key?: boolean;
  /**
   * Casa por prefixo · útil pra rotas-container que redirecionam pra um filho
   * default (ex.: `/rma` → `/rma/visao-geral`). Sem isso, o item nunca acende
   * porque o pathname concreto vira a sub-rota. Default `false` (match exato).
   */
  matchPrefix?: boolean;
  /**
   * Quando true, renderiza como visualmente desabilitado (opacity reduzida ·
   * cursor not-allowed) e não-navegável. Usado quando o item depende de um
   * contexto ausente (ex.: sub-rotas de obra sem obra ativa).
   */
  disabled?: boolean;
  /** Texto do title (tooltip nativo) quando `disabled`. */
  disabledHint?: string;
  children?: NavItem[];
};

export type SidebarUser = {
  name: string;
  subtitle?: string;
  initials?: string;
};

export type SidebarProps = {
  items: NavItem[];
  footerItems?: NavItem[];
  user?: SidebarUser;
  /** Conteúdo customizado do topo. Quando undefined, o topo fica vazio (sem logo padrão). */
  brand?: ReactNode;
  /** Ação de logout — quando passada, o footer mostra o botão "Sair". */
  onLogout?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  isMobile?: boolean;
};

/**
 * Resolve uma string template do TanStack (`/contracts/$contractId/...`) com os
 * params do nav item (`{ contractId: "aeroporto-uberlandia" }`) para produzir
 * o pathname concreto comparável com `useLocation().pathname`.
 */
function resolveTo(to: string, params?: Record<string, string>): string {
  if (!params) return to;
  let resolved = to;
  for (const key of Object.keys(params)) {
    resolved = resolved.replace(`$${key}`, params[key]!);
  }
  return resolved;
}

/**
 * Match estritamente exato por default — não usar `startsWith`, senão a Síntese
 * (`/contracts/$id`) acende em qualquer sub-rota. Trailing slash normalizado
 * em ambos os lados (TanStack às vezes serve `/contracts/$id/`, às vezes sem).
 *
 * Opt-in pra `prefix` em itens-container que redirecionam pra um filho default
 * (ex.: `/rma` → `/rma/visao-geral`). Com prefix, o item acende quando o
 * pathname é igual OU começa com `to + "/"` — preservando a fronteira do path.
 */
function matchesPath(
  pathname: string,
  to?: string,
  params?: Record<string, string>,
  prefix?: boolean,
): boolean {
  if (!to) return false;
  const resolved = resolveTo(to, params);
  const normalize = (p: string) => (p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p);
  const a = normalize(pathname);
  const b = normalize(resolved);
  if (prefix) return a === b || a.startsWith(`${b}/`);
  return a === b;
}

function anyChildMatches(item: NavItem, pathname: string): boolean {
  if (!item.children) return false;
  return item.children.some(
    (c) => matchesPath(pathname, c.to, c.params, c.matchPrefix) || anyChildMatches(c, pathname),
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any -- Link's typed `to` requires the generated route tree; for dynamic items we widen. */
function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const content = (
    <>
      {item.icon ? <span className="sb-item-icon">{I[item.icon]({ size: 16 })}</span> : null}
      <span className="sb-item-label">{item.label}</span>
      {item.tag ? <span className="sb-item-tag">{item.tag}</span> : null}
      {item.count != null ? <span className="sb-count">{item.count}</span> : null}
    </>
  );
  if (item.disabled) {
    return (
      <span className={cn("sb-item", "disabled")} aria-disabled="true" title={item.disabledHint}>
        {content}
      </span>
    );
  }
  if (!item.to) {
    return (
      <button type="button" className={cn("sb-item", active && "active")}>
        {content}
      </button>
    );
  }
  // O TanStack Link cuida do `.active`: aplica via `activeProps.className`,
  // só quando match exato por default. Itens-container (matchPrefix) recebem
  // `exact: false` pra acender também em sub-rotas (ex.: RMA Mensal).
  return (
    <Link
      to={item.to as any}
      params={item.params as any}
      activeOptions={{ exact: !item.matchPrefix }}
      activeProps={{ className: "active" }}
      className="sb-item"
    >
      {content}
    </Link>
  );
}

function NavSubLink({ item }: { item: NavItem }) {
  const className = cn("sb-subitem", item.key && "key");
  if (item.disabled) {
    return (
      <span className={cn(className, "disabled")} aria-disabled="true" title={item.disabledHint}>
        {item.label}
      </span>
    );
  }
  if (!item.to) {
    return (
      <button type="button" className={className}>
        {item.label}
      </button>
    );
  }
  return (
    <Link
      to={item.to as any}
      params={item.params as any}
      activeOptions={{ exact: !item.matchPrefix }}
      activeProps={{ className: "active" }}
      className={className}
    >
      {item.label}
    </Link>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function NavGroup({ item, pathname }: { item: NavItem; pathname: string }) {
  const childMatches = anyChildMatches(item, pathname);
  const itemMatches = matchesPath(pathname, item.to, item.params, item.matchPrefix);
  const [openManually, setOpenManually] = useState<boolean | null>(null);
  // Abre só por CLIQUE (toggle). Default = rota ativa abre o grupo correspondente.
  const isOpen = openManually ?? (childMatches || itemMatches);

  if (!item.children) {
    return <NavLink item={item} active={itemMatches} />;
  }

  // Destaque sutil no parent quando algum filho está ativo (sem duplicar `.active`).
  const showChildActive = childMatches && !itemMatches;
  const childCount = item.children.length;

  return (
    <div className="sb-group">
      <button
        type="button"
        className={cn("sb-item", itemMatches && "active", showChildActive && "child-active")}
        onClick={() => setOpenManually(!isOpen)}
        aria-expanded={isOpen}
      >
        {item.icon ? <span className="sb-item-icon">{I[item.icon]({ size: 16 })}</span> : null}
        <span className="sb-item-label">{item.label}</span>
        {item.tag ? <span className="sb-item-tag">{item.tag}</span> : null}
        {item.count != null ? <span className="sb-count">{item.count}</span> : null}
        <span className="sb-child-count" aria-hidden>
          {childCount}
        </span>
        {/* Bullet brand quando há filho ativo e o grupo está fechado — sinaliza que
            há item selecionado dentro sem precisar abrir. */}
        {showChildActive && !isOpen ? <span className="sb-child-dot" aria-hidden /> : null}
        <span className={cn("sb-caret", isOpen && "open")}>{I.chevDown({ size: 14 })}</span>
      </button>
      {/* Sub-lista SEMPRE montada — a animação de altura via grid-template-rows
          (0fr→1fr) precisa dos dois estados pra animar abertura E fechamento.
          `inert` quando fechado tira os links do tab order e de pointer-events. */}
      <div className={cn("sb-sub-wrap", isOpen && "open")} inert={!isOpen}>
        <ul className="sb-sub">
          {item.children.map((c) => (
            <li key={c.id}>
              <NavSubLink item={c} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function Sidebar({
  items,
  footerItems,
  user,
  brand,
  onLogout,
  mobileOpen,
  onCloseMobile,
  isMobile,
}: SidebarProps) {
  const location = useLocation();
  const pathname = location.pathname;

  const mainItems = useMemo(() => items, [items]);
  const fItems = useMemo(() => footerItems ?? [], [footerItems]);

  const backdrop =
    isMobile && mobileOpen ? (
      <div className="sb-backdrop" onClick={onCloseMobile} aria-hidden="true" />
    ) : null;

  const hasBrand = !!brand;

  return (
    <>
      {backdrop}
      <aside
        className={cn("sb", isMobile && "sb-mobile", mobileOpen && "open")}
        aria-label="Navegação principal"
      >
        <div className={cn("sb-brand", !hasBrand && "empty")}>
          {brand}
          {isMobile ? (
            <IconButton variant="ghost" size="md" aria-label="Fechar menu" onClick={onCloseMobile}>
              {I.close({ size: 18 })}
            </IconButton>
          ) : null}
        </div>

        <nav className="sb-nav">
          {mainItems.map((item) => (
            <NavGroup key={item.id} item={item} pathname={pathname} />
          ))}

          {fItems.length > 0 ? (
            <>
              <div className="sb-divider" />
              {fItems.map((item) => (
                <NavGroup key={item.id} item={item} pathname={pathname} />
              ))}
            </>
          ) : null}
        </nav>

        {user ? (
          <div className="sb-footer">
            <Avatar size="md" initials={user.initials ?? user.name.slice(0, 2)} />
            <div className="sb-me">
              <div className="sb-me-name">{user.name}</div>
              {user.subtitle ? <div className="sb-me-plan">{user.subtitle}</div> : null}
            </div>
            {onLogout ? (
              <IconButton variant="ghost" size="sm" aria-label="Sair" onClick={onLogout}>
                {I.logout({ size: 16 })}
              </IconButton>
            ) : null}
          </div>
        ) : null}
      </aside>
    </>
  );
}
