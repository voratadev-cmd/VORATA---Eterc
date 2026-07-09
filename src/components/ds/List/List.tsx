import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge, type BadgeTone } from "../Badge/Badge";
import "./List.css";

export type ListIconTone =
  | "neutral"
  | "warning"
  | "danger"
  | "success"
  | "info"
  | "brand"
  | "vault";

export function List({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("lst", className)} {...props} />;
}

export type ListItemProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  iconTone?: ListIconTone;
  title: ReactNode;
  meta?: ReactNode;
  metaParts?: ReactNode[];
  value?: ReactNode;
  valueTone?: "pos" | "neg" | "neutral";
  pill?: ReactNode;
  pillTone?: BadgeTone;
};

export function ListItem({
  icon,
  iconTone = "neutral",
  title,
  meta,
  metaParts,
  value,
  valueTone = "neutral",
  pill,
  pillTone = "neutral",
  className,
  type = "button",
  ...props
}: ListItemProps) {
  const renderedMeta = metaParts ? (
    <>
      {metaParts.map((part, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "var(--s-2)" }}>
          {i > 0 ? <span className="dot" /> : null}
          <span>{part}</span>
        </span>
      ))}
    </>
  ) : meta ? (
    <span>{meta}</span>
  ) : null;

  return (
    <button type={type} className={cn("lst-item", className)} {...props}>
      {icon ? (
        <span className={cn("lst-icon", iconTone !== "neutral" && iconTone)}>{icon}</span>
      ) : null}
      <div className="lst-main">
        <div className="lst-title">{title}</div>
        {renderedMeta ? <div className="lst-meta">{renderedMeta}</div> : null}
      </div>
      {pill ? <Badge tone={pillTone}>{pill}</Badge> : null}
      {value != null ? (
        <div className={cn("lst-value", valueTone !== "neutral" && valueTone)}>{value}</div>
      ) : null}
    </button>
  );
}
