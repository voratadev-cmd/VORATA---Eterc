import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import "./Divider.css";

export type DividerProps = HTMLAttributes<HTMLDivElement> & {
  orientation?: "horizontal" | "vertical";
};

export function Divider({
  orientation = "horizontal",
  className,
  role = "separator",
  ...props
}: DividerProps) {
  return (
    <div
      role={role}
      aria-orientation={orientation}
      className={cn(orientation === "vertical" ? "divider-vertical" : "divider", className)}
      {...props}
    />
  );
}
