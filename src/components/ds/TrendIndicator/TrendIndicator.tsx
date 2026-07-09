import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { I } from "../icons";
import "./TrendIndicator.css";

export type TrendDirection = "up" | "down" | "flat";

export type TrendIndicatorProps = HTMLAttributes<HTMLSpanElement> & {
  direction: TrendDirection;
  children: ReactNode;
  hideIcon?: boolean;
};

export function TrendIndicator({
  direction,
  hideIcon,
  className,
  children,
  ...props
}: TrendIndicatorProps) {
  return (
    <span className={cn("trend", `trend-${direction}`, className)} {...props}>
      {hideIcon
        ? null
        : direction === "up"
          ? I.arrowUp({ size: 12 })
          : direction === "down"
            ? I.arrowDown({ size: 12 })
            : null}
      {children}
    </span>
  );
}
