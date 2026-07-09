import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./InfoCard.css";

export type InfoCardTone = "success" | "warning" | "info" | "danger" | "vault";

export type InfoCardProps = {
  tone?: InfoCardTone;
  icon?: ReactNode;
  title: ReactNode;
  text?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function InfoCard({ tone = "info", icon, title, text, action, className }: InfoCardProps) {
  return (
    <div className={cn("info-card", `info-card-${tone}`, className)}>
      {icon ? <div className="info-card-icon">{icon}</div> : null}
      <div className="info-card-body">
        <div className="info-card-title">{title}</div>
        {text ? <div className="info-card-text">{text}</div> : null}
      </div>
      {action}
    </div>
  );
}
