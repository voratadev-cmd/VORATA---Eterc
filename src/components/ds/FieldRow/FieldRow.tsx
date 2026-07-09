import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./FieldRow.css";

export type FieldRowProps = {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
};

export function FieldRow({ label, hint, children, className, htmlFor }: FieldRowProps) {
  return (
    <div className={cn("field-row", className)}>
      <div>
        <label htmlFor={htmlFor} className="field-label-main">
          {label}
        </label>
        {hint ? <div className="field-label-hint">{hint}</div> : null}
      </div>
      <div className="field-control">{children}</div>
    </div>
  );
}
