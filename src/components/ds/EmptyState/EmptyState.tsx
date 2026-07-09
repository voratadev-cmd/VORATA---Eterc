import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./EmptyState.css";

export type EmptyStateProps = {
  icon?: ReactNode;
  title: ReactNode;
  text?: ReactNode;
  /** Chip discreto abaixo do texto (ex.: "Aguardando sincronização"). */
  hint?: ReactNode;
  action?: ReactNode;
  /**
   * Quando true, envolve o conteúdo em uma moldura tracejada (estado "vazio
   * intencional" no nível da página). Sem o framed, o componente fica como
   * inline empty (dentro de cards/listas).
   */
  framed?: boolean;
  className?: string;
};

export function EmptyState({
  icon,
  title,
  text,
  hint,
  action,
  framed = false,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("empty", framed && "empty-framed", className)}>
      {icon ? <div className="empty-illu">{icon}</div> : null}
      <div className="empty-title">{title}</div>
      {text ? <div className="empty-text">{text}</div> : null}
      {hint ? <div className="empty-hint">{hint}</div> : null}
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}
