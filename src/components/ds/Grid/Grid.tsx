import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import "./Grid.css";

export function Grid({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid", className)} {...props} />;
}

export type ColSpan = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type ColProps = HTMLAttributes<HTMLDivElement> & {
  span?: ColSpan;
};

export function Col({ span = 12, className, ...props }: ColProps) {
  return <div className={cn(`col-${span}`, className)} {...props} />;
}
