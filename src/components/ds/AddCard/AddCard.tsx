import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { I } from "../icons";
import "./AddCard.css";

export type AddCardProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: ReactNode;
  icon?: ReactNode;
  compact?: boolean;
};

export function AddCard({
  label,
  icon,
  compact,
  className,
  type = "button",
  ...props
}: AddCardProps) {
  return (
    <button
      type={type}
      className={cn("add-card", compact && "add-card-compact", className)}
      {...props}
    >
      <span className="add-card-icon">{icon ?? I.plus({ size: compact ? 16 : 22 })}</span>
      <span>{label}</span>
    </button>
  );
}
