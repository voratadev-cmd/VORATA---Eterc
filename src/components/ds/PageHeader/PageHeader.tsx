import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { I } from "../icons";
import "./PageHeader.css";

export type PageHeaderBack = {
  /** Texto ao lado da seta · ex: "Obras". */
  label: string;
  /** Ação ao clicar · normalmente um navigate(). */
  onClick: () => void;
};

export type PageHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Link de voltar renderizado acima do título (seta ← + label). */
  back?: PageHeaderBack;
  className?: string;
};

export function PageHeader({ title, subtitle, actions, back, className }: PageHeaderProps) {
  return (
    <div className={cn("page-head", className)}>
      <div className="page-head-main">
        {back ? (
          <button type="button" className="page-back" onClick={back.onClick}>
            <span className="page-back-icon" aria-hidden>
              {I.arrowLeft({ size: 15 })}
            </span>
            {back.label}
          </button>
        ) : null}
        <h1 className="page-title">{title}</h1>
        {subtitle ? <div className="page-sub">{subtitle}</div> : null}
      </div>
      {actions ? <div className="page-head-actions">{actions}</div> : null}
    </div>
  );
}
