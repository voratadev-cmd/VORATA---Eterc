import type { KeyboardEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./Tabs.css";

export type TabItem<T extends string = string> = {
  value: T;
  label: ReactNode;
};

export type TabsProps<T extends string = string> = {
  value: T;
  onChange: (value: T) => void;
  items: TabItem<T>[];
  className?: string;
  "aria-label"?: string;
};

// Navegação por seta no padrão ARIA tablist (←/→/↑/↓/Home/End).
function tablistKeyNav<T extends string>(
  e: KeyboardEvent<HTMLDivElement>,
  value: T,
  items: { value: T }[],
  onChange: (v: T) => void,
) {
  const idx = items.findIndex((i) => i.value === value);
  if (idx < 0) return;
  let next = idx;
  if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % items.length;
  else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
    next = (idx - 1 + items.length) % items.length;
  else if (e.key === "Home") next = 0;
  else if (e.key === "End") next = items.length - 1;
  else return;
  e.preventDefault();
  onChange(items[next].value);
  const btns = e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]');
  btns[next]?.focus();
}

export function Tabs<T extends string = string>({
  value,
  onChange,
  items,
  className,
  ...rest
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      className={cn("tabs", className)}
      onKeyDown={(e) => tablistKeyNav(e, value, items, onChange)}
      {...rest}
    >
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          className={cn("tabs-item", item.value === value && "active")}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
