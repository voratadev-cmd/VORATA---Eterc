import { type ReactNode, useEffect, useRef, useState } from "react";
import { useTheme } from "@/lib/theme";
import { Avatar } from "../Avatar/Avatar";
import { Button } from "../Button/Button";
import { IconButton } from "../IconButton/IconButton";
import { Menu, MenuItem } from "../Menu/Menu";
import { I } from "../icons";
import "./Topbar.css";

export type TopbarProps = {
  isMobile?: boolean;
  onOpenSidebar?: () => void;
  /** Slot custom de ações antes do botão "+ Novo" (ex.: filtros específicos da rota). */
  actions?: ReactNode;
  /** Texto / placeholder do campo de busca global (fallback quando não há slot `search`). */
  searchPlaceholder?: string;
  onSearchClick?: () => void;
  /** Slot de busca global (ex.: <TopbarSearch/> com dropdown). Substitui o botão padrão. */
  search?: ReactNode;
};

export function Topbar({
  isMobile,
  onOpenSidebar,
  actions,
  searchPlaceholder = "Buscar em tudo…",
  onSearchClick,
  search,
}: TopbarProps) {
  const { theme, toggleTheme } = useTheme();
  const [novoOpen, setNovoOpen] = useState(false);
  const novoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!novoOpen) return;
    const onDown = (e: MouseEvent) => {
      if (novoRef.current && !novoRef.current.contains(e.target as Node)) {
        setNovoOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [novoOpen]);

  return (
    <header className="tb">
      {isMobile ? (
        <IconButton variant="ghost" size="md" aria-label="Abrir menu" onClick={onOpenSidebar}>
          {I.menu({ size: 20 })}
        </IconButton>
      ) : null}

      {search ?? (
        <button type="button" className="tb-search" onClick={onSearchClick}>
          {I.search({ size: 16 })}
          <span className="tb-search-ph">{searchPlaceholder}</span>
          <span className="tb-kbd">⌘K</span>
        </button>
      )}

      <div className="tb-right">
        {actions}

        <div className="tb-novo" ref={novoRef}>
          <Button
            variant="primary"
            size="sm"
            aria-haspopup="menu"
            aria-expanded={novoOpen}
            onClick={() => setNovoOpen((v) => !v)}
          >
            {I.plus({ size: 14 })} Novo {I.chevDown({ size: 14 })}
          </Button>
          {novoOpen ? (
            <Menu align="right" className="tb-novo-menu">
              <MenuItem
                icon={I.plus({ size: 14 })}
                label="Nova Obra"
                onClick={() => setNovoOpen(false)}
              />
            </Menu>
          ) : null}
        </div>

        <div className="tb-bell">
          <IconButton variant="ghost" size="lg" aria-label="Notificações (3 novas)">
            {I.bell({ size: 18 })}
          </IconButton>
          <span className="tb-bell-badge" aria-hidden>
            3
          </span>
        </div>

        <IconButton
          variant="ghost"
          size="lg"
          aria-label={`Alternar para tema ${theme === "dark" ? "claro" : "escuro"}`}
          onClick={toggleTheme}
        >
          {theme === "dark" ? I.sun({ size: 18 }) : I.moon({ size: 18 })}
        </IconButton>

        <Avatar initials="MS" size="md" aria-label="Conta" />
      </div>
    </header>
  );
}
