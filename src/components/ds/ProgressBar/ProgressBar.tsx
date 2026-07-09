import { cn } from "@/lib/utils";
import "./ProgressBar.css";

export type ProgressTone = "brand" | "success" | "warning" | "danger" | "info" | "vault";
export type ProgressSize = "sm" | "md" | "lg";

export type ProgressBarProps = {
  value: number;
  max?: number;
  tone?: ProgressTone;
  size?: ProgressSize;
  className?: string;
  "aria-label"?: string;
};

export function ProgressBar({
  value,
  max = 100,
  tone = "brand",
  size = "md",
  className,
  ...rest
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn(
        "progress",
        size === "sm" && "progress-sm",
        size === "lg" && "progress-lg",
        className,
      )}
      {...rest}
    >
      <div className={cn("progress-fill", tone !== "brand" && tone)} style={{ width: `${pct}%` }} />
    </div>
  );
}
