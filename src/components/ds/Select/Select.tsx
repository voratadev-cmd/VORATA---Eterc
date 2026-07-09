// Select custom — substitui o <select> nativo do browser (que renderiza
// dropdown do SO, sem controle visual). Trigger button + popover de opções,
// com keyboard navigation (↑↓ Enter Esc) e ARIA acessível.
//
// Genérico em T (string | number) — preserva tipo do valor.

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { cn } from "@/lib/utils";
import { I } from "../icons";
import "./Select.css";

export type SelectItem<T extends string | number> = {
  value: T;
  label: string;
  /** Sub-label opcional renderizado em cinza ao lado direito (ex.: "BM-09"). */
  hint?: string;
  /** Quando true, item fica desabilitado. */
  disabled?: boolean;
};

export type SelectProps<T extends string | number> = {
  value: T;
  onChange: (value: T) => void;
  items: SelectItem<T>[];
  /** Texto exibido quando nenhum item corresponde ao value (raro — mais pra fallback). */
  placeholder?: string;
  /** Tamanho visual: "sm" (compacto pra header/filtro) ou "md" (padrão). */
  size?: "sm" | "md";
  /** Alinhamento horizontal do popover em relação ao trigger. Default: "start". */
  align?: "start" | "end";
  /** Largura mínima do popover. Default: largura do trigger. */
  popoverMinWidth?: number;
  /** Desabilita o select inteiro. */
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
};

export function Select<T extends string | number>({
  value,
  onChange,
  items,
  placeholder = "Selecionar…",
  size = "md",
  align = "start",
  popoverMinWidth,
  disabled,
  className,
  "aria-label": ariaLabel,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();

  const selectedIndex = items.findIndex((i) => i.value === value);
  const selectedItem = selectedIndex >= 0 ? items[selectedIndex] : undefined;

  // Ao abrir, posiciona o active no item selecionado (ou primeiro habilitado).
  useEffect(() => {
    if (!open) return;
    const initial = selectedIndex >= 0 ? selectedIndex : items.findIndex((i) => !i.disabled);
    setActiveIndex(initial);
  }, [open, selectedIndex, items]);

  // Fecha ao clicar fora do trigger/popover.
  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown, true);
    return () => document.removeEventListener("pointerdown", onDocPointerDown, true);
  }, [open]);

  // Mantém o item ativo visível (scrollIntoView) quando muda via teclado.
  useLayoutEffect(() => {
    if (!open || activeIndex < 0) return;
    const li = popoverRef.current?.querySelector<HTMLLIElement>(`[data-index="${activeIndex}"]`);
    li?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const commit = useCallback(
    (idx: number) => {
      const item = items[idx];
      if (!item || item.disabled) return;
      onChange(item.value);
      setOpen(false);
      triggerRef.current?.focus();
    },
    [items, onChange],
  );

  function moveActive(delta: number) {
    setActiveIndex((prev) => {
      const n = items.length;
      if (n === 0) return -1;
      let next = prev;
      for (let step = 0; step < n; step++) {
        next = (next + delta + n) % n;
        if (!items[next]?.disabled) return next;
      }
      return prev;
    });
  }

  function onTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
      return;
    }
  }

  function onListKeyDown(e: KeyboardEvent<HTMLUListElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActive(1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActive(-1);
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      const first = items.findIndex((i) => !i.disabled);
      if (first >= 0) setActiveIndex(first);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      for (let i = items.length - 1; i >= 0; i--) {
        if (!items[i]?.disabled) {
          setActiveIndex(i);
          return;
        }
      }
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (activeIndex >= 0) commit(activeIndex);
      return;
    }
    if (e.key === "Tab") {
      setOpen(false);
      return;
    }
  }

  return (
    <div className={cn("ds-select", `ds-select-${size}`, className)}>
      <button
        ref={triggerRef}
        type="button"
        className={cn("ds-select-trigger", open && "open")}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
      >
        <span className={cn("ds-select-value", !selectedItem && "ds-select-placeholder")}>
          {selectedItem ? selectedItem.label : placeholder}
        </span>
        <span className="ds-select-chev" aria-hidden>
          {I.chevDown({ size: 14 })}
        </span>
      </button>

      {open && (
        <ul
          ref={(node) => {
            popoverRef.current = node;
            // Foca a lista assim que o nó aparece — habilita keyboard nav imediato.
            node?.focus();
          }}
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          className={cn("ds-select-popover", `ds-select-popover-${align}`)}
          style={popoverMinWidth ? { minWidth: popoverMinWidth } : undefined}
          aria-label={ariaLabel}
          onKeyDown={onListKeyDown}
        >
          {items.map((item, idx) => {
            const isSelected = item.value === value;
            const isActive = idx === activeIndex;
            return (
              <li
                key={String(item.value)}
                data-index={idx}
                role="option"
                aria-selected={isSelected}
                aria-disabled={item.disabled || undefined}
                className={cn(
                  "ds-select-item",
                  isSelected && "selected",
                  isActive && !item.disabled && "active",
                  item.disabled && "disabled",
                )}
                onPointerDown={(e) => {
                  // Previne blur do trigger antes do commit.
                  e.preventDefault();
                  if (!item.disabled) commit(idx);
                }}
                onPointerEnter={() => !item.disabled && setActiveIndex(idx)}
              >
                <span className="ds-select-item-check" aria-hidden>
                  {isSelected ? I.check({ size: 12 }) : null}
                </span>
                <span className="ds-select-item-label">{item.label}</span>
                {item.hint && <span className="ds-select-item-hint">{item.hint}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
