import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import "./Skeleton.css";

export type SkeletonVariant = "line" | "line-sm" | "line-lg" | "circle" | "block";

export type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  variant?: SkeletonVariant;
};

export function Skeleton({ variant = "line", className, style, ...props }: SkeletonProps) {
  const classes = cn(
    "sk",
    variant === "line" && "sk-line",
    variant === "line-sm" && "sk-line sm",
    variant === "line-lg" && "sk-line lg",
    variant === "circle" && "sk-circle",
    className,
  );
  return <div className={classes} style={style} {...props} />;
}
