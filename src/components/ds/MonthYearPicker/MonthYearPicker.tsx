// MonthYearPicker · seletor standalone de mês + ano (formato "YYYY-MM").
// Substitui o <input type="month"> nativo para layout consistente cross-browser.
// Mesmo padrão visual do PeriodoPicker mas SEM dependência de lista de períodos
// disponíveis — aceita qualquer mês/ano.

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { I } from "../icons";
import "./MonthYearPicker.css";

export type MonthYearPickerProps = {
  /** Valor no formato "YYYY-MM". Use "" pra vazio. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
};

const MESES_CURTO = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];
const MESES_LONGO = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function parseValue(v: string): { ano: number; mes: number } | null {
  const m = v.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!m) return null;
  return { ano: parseInt(m[1]!, 10), mes: parseInt(m[2]!, 10) };
}

function formatValue(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

function currentMonth(): { ano: number; mes: number } {
  const d = new Date();
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
}

export function MonthYearPicker({
  value,
  onChange,
  placeholder = "Selecionar mês",
  disabled = false,
  className,
  id,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: MonthYearPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const parsed = parseValue(value);
  const todayMonth = currentMonth();
  const [anoFoco, setAnoFoco] = useState<number>(parsed?.ano ?? todayMonth.ano);

  // Reseta ano em foco ao abrir
  useEffect(() => {
    if (open) setAnoFoco(parsed?.ano ?? todayMonth.ano);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Outside click + ESC fecham
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

  function selecionar(mes: number) {
    onChange(formatValue(anoFoco, mes));
    setOpen(false);
  }

  function limpar() {
    onChange("");
    setOpen(false);
  }

  function selecionarEsteMes() {
    onChange(formatValue(todayMonth.ano, todayMonth.mes));
    setOpen(false);
  }

  const triggerLabel = parsed ? `${MESES_LONGO[parsed.mes - 1]} de ${parsed.ano}` : placeholder;

  return (
    <div className={cn("myp", className)} ref={ref}>
      <button
        id={id}
        type="button"
        className={cn("myp-trigger", open && "open", !parsed && "myp-placeholder")}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid || undefined}
      >
        <span className="myp-icon" aria-hidden>
          {I.calendar({ size: 14 })}
        </span>
        <span className="myp-text">{triggerLabel}</span>
        <span className={cn("myp-caret", open && "open")} aria-hidden>
          {I.chevDown({ size: 14 })}
        </span>
      </button>

      {open && (
        <div className="myp-panel" role="dialog" aria-label="Selecionar mês e ano">
          <div className="myp-head">
            <button
              type="button"
              className="myp-ano-btn"
              onClick={() => setAnoFoco((a) => a - 1)}
              aria-label="Ano anterior"
            >
              {I.chevLeft({ size: 14 })}
            </button>
            <span className="myp-ano-label" aria-live="polite">
              {anoFoco}
            </span>
            <button
              type="button"
              className="myp-ano-btn"
              onClick={() => setAnoFoco((a) => a + 1)}
              aria-label="Próximo ano"
            >
              {I.chevRight({ size: 14 })}
            </button>
          </div>

          <div className="myp-meses" role="grid">
            {MESES_CURTO.map((nome, idx) => {
              const mes = idx + 1;
              const isActive = parsed?.ano === anoFoco && parsed?.mes === mes;
              const isCurrent = todayMonth.ano === anoFoco && todayMonth.mes === mes;
              return (
                <button
                  key={mes}
                  type="button"
                  role="gridcell"
                  className={cn(
                    "myp-mes",
                    isActive && "active",
                    isCurrent && !isActive && "current",
                  )}
                  aria-current={isActive ? "true" : undefined}
                  onClick={() => selecionar(mes)}
                  title={`${MESES_LONGO[idx]} de ${anoFoco}`}
                >
                  {nome}
                </button>
              );
            })}
          </div>

          <div className="myp-foot">
            <button type="button" className="myp-link" onClick={limpar}>
              Limpar
            </button>
            <button type="button" className="myp-link" onClick={selecionarEsteMes}>
              Este mês
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
