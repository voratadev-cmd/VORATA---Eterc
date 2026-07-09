import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import "./IconButton.css";

export type IconButtonVariant = "ghost" | "outline" | "solid";
export type IconButtonSize = "sm" | "md" | "lg";

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  /** Required for a11y — icon-only buttons must have an accessible name. */
  "aria-label": string;
};

export function IconButton({
  variant = "ghost",
  size = "md",
  className,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn("icon-btn", `icon-btn-${variant}`, `icon-btn-${size}`, className)}
      {...props}
    />
  );
}
