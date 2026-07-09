import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import "./Tag.css";

export function Tag({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("tag", className)} {...props} />;
}
