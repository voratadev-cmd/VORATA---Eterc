import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./HeroCard.css";

export type HeroCardProps = HTMLAttributes<HTMLDivElement> & {
  label?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
};

export function HeroCard({
  label,
  title,
  subtitle,
  actions,
  className,
  children,
  ...props
}: HeroCardProps) {
  const showRow = title || actions;
  return (
    <div className={cn("hero", className)} {...props}>
      <div className="hero-content">
        {label ? <div className="hero-label">{label}</div> : null}
        {showRow ? (
          <div className="hero-row">
            <div>
              {title ? <h2 className="hero-title">{title}</h2> : null}
              {subtitle ? <div className="hero-sub">{subtitle}</div> : null}
            </div>
            {actions}
          </div>
        ) : (
          <>{subtitle ? <div className="hero-sub">{subtitle}</div> : null}</>
        )}
        {children}
      </div>
    </div>
  );
}
