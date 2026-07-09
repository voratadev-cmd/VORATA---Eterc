import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { I } from "../icons";
import "./Checkbox.css";

export type CheckboxSize = "sm" | "md" | "lg";

export type CheckboxProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "type"> & {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  size?: CheckboxSize;
};

const sizeClass: Record<CheckboxSize, string> = {
  sm: "checkbox-sm",
  md: "",
  lg: "checkbox-lg",
};

const iconSize: Record<CheckboxSize, number> = { sm: 12, md: 14, lg: 16 };

export function Checkbox({
  checked,
  onCheckedChange,
  size = "md",
  className,
  ...props
}: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      className={cn("checkbox", checked && "checked", sizeClass[size], className)}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    >
      {checked ? I.check({ size: iconSize[size] }) : null}
    </button>
  );
}
