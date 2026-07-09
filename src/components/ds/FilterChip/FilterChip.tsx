import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { I } from "../icons";
import "./FilterChip.css";

export type FilterChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: ReactNode;
  value?: ReactNode;
  active?: boolean;
  onClear?: () => void;
  dashed?: boolean;
};

export function FilterChip({
  label,
  value,
  active,
  onClear,
  dashed,
  className,
  type = "button",
  ...props
}: FilterChipProps) {
  return (
    <button
      type={type}
      className={cn("fchip", active && "active", dashed && "fchip-dashed", className)}
      {...props}
    >
      <span>{label}</span>
      {value != null ? <span className="fchip-value">{value}</span> : null}
      {onClear ? (
        <span
          role="button"
          aria-label="Limpar filtro"
          className="fchip-clear"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
        >
          {I.close({ size: 12 })}
        </span>
      ) : null}
    </button>
  );
}
