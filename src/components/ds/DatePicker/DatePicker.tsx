// DatePicker · seletor de data com calendar custom (react-day-picker v9).
// Substitui o <input type="date"> nativo para layout consistente cross-browser.
// Valor no formato ISO "YYYY-MM-DD".

import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { I } from "../icons";
import "./DatePicker.css";

export type DatePickerProps = {
  /** Valor no formato ISO "YYYY-MM-DD". Use "" pra vazio. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Data mínima selecionável (ISO). */
  min?: string;
  /** Data máxima selecionável (ISO). */
  max?: string;
  className?: string;
  id?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
};

function fromISO(s: string): Date | undefined {
  if (!s) return undefined;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return undefined;
  const y = parseInt(m[1]!, 10);
  const mo = parseInt(m[2]!, 10);
  const d = parseInt(m[3]!, 10);
  const date = new Date(y, mo - 1, d);
  return isNaN(date.getTime()) ? undefined : date;
}

function toISO(d: Date | undefined): string {
  if (!d) return "";
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

function formatPtBR(d: Date | undefined): string {
  if (!d) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Selecionar data",
  disabled = false,
  min,
  max,
  className,
  id,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = fromISO(value);
  const [monthFoco, setMonthFoco] = useState<Date>(selected ?? new Date());

  useEffect(() => {
    if (open) setMonthFoco(selected ?? new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function escolher(date: Date | undefined) {
    onChange(toISO(date));
    setOpen(false);
  }

  function limpar() {
    onChange("");
    setOpen(false);
  }

  function escolherHoje() {
    const today = new Date();
    onChange(toISO(today));
    setOpen(false);
  }

  return (
    <div className={cn("dpk", className)} ref={ref}>
      <button
        id={id}
        type="button"
        className={cn("dpk-trigger", open && "open", !selected && "dpk-placeholder")}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid || undefined}
      >
        <span className="dpk-icon" aria-hidden>
          {I.calendar({ size: 14 })}
        </span>
        <span className="dpk-text">{selected ? formatPtBR(selected) : placeholder}</span>
        <span className={cn("dpk-caret", open && "open")} aria-hidden>
          {I.chevDown({ size: 14 })}
        </span>
      </button>

      {open && (
        <div className="dpk-panel" role="dialog" aria-label="Selecionar data">
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={escolher}
            month={monthFoco}
            onMonthChange={setMonthFoco}
            locale={ptBR}
            showOutsideDays
            captionLayout="dropdown"
            startMonth={min ? fromISO(min) : new Date(2000, 0)}
            endMonth={max ? fromISO(max) : new Date(2100, 11)}
            classNames={{
              root: "dpk-rdp",
              month_caption: "dpk-rdp-caption",
              caption_label: "dpk-rdp-caption-label",
              dropdowns: "dpk-rdp-dropdowns",
              dropdown: "dpk-rdp-dropdown",
              dropdown_root: "dpk-rdp-dropdown-root",
              months: "dpk-rdp-months",
              month_grid: "dpk-rdp-grid",
              weekdays: "dpk-rdp-weekdays",
              weekday: "dpk-rdp-weekday",
              week: "dpk-rdp-week",
              day: "dpk-rdp-day",
              day_button: "dpk-rdp-day-button",
              selected: "dpk-rdp-selected",
              today: "dpk-rdp-today",
              outside: "dpk-rdp-outside",
              disabled: "dpk-rdp-disabled",
              hidden: "dpk-rdp-hidden",
              nav: "dpk-rdp-nav",
              button_previous: "dpk-rdp-nav-btn",
              button_next: "dpk-rdp-nav-btn",
              chevron: "dpk-rdp-chevron",
            }}
          />

          <div className="dpk-foot">
            <button type="button" className="dpk-link" onClick={limpar}>
              Limpar
            </button>
            <button type="button" className="dpk-link" onClick={escolherHoje}>
              Hoje
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
