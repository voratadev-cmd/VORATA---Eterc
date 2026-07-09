import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import "./Badge.css";

export type BadgeTone = "neutral" | "warning" | "danger" | "info" | "success" | "brand" | "vault";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return <span className={cn("badge", `badge-${tone}`, className)} {...props} />;
}
