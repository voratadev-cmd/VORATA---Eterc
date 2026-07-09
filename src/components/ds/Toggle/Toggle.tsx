import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import "./Toggle.css";

export type ToggleProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "type"> & {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

export function Toggle({ checked, onCheckedChange, className, ...props }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={cn("toggle", checked && "on", className)}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    >
      <span className="toggle-knob" />
    </button>
  );
}
