import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./Menu.css";

export type MenuProps = HTMLAttributes<HTMLDivElement> & {
  align?: "left" | "right";
};

export function Menu({ align = "left", className, role = "menu", ...props }: MenuProps) {
  return (
    <div
      role={role}
      className={cn("menu", align === "right" && "menu-right", className)}
      {...props}
    />
  );
}

export function MenuSection({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("menu-section", className)} {...props} />;
}

export type MenuItemProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  label: ReactNode;
  kbd?: ReactNode;
  vault?: boolean;
};

export function MenuItem({
  icon,
  label,
  kbd,
  vault,
  className,
  type = "button",
  ...props
}: MenuItemProps) {
  return (
    <button
      type={type}
      role="menuitem"
      className={cn("menu-item", vault && "vault", className)}
      {...props}
    >
      {icon ? <span className="menu-icon">{icon}</span> : null}
      <span className="menu-label">{label}</span>
      {kbd ? <span className="menu-kbd">{kbd}</span> : null}
    </button>
  );
}

export function MenuDivider({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("menu-divider", className)} {...props} />;
}

export function MenuAnchor({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("menu-anchor", className)} {...props} />;
}
