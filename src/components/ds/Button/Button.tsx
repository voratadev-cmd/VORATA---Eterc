import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import "./Button.css";

export type ButtonVariant = "primary" | "ink" | "ghost" | "outline" | "danger" | "vault";
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn("btn", `btn-${variant}`, `btn-${size}`, className)}
      {...props}
    />
  );
}
