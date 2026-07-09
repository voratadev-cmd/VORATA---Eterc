import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./DateCell.css";

export type DateCellSize = "md" | "lg";

export type DateCellProps = HTMLAttributes<HTMLDivElement> & {
  day: ReactNode;
  month: ReactNode;
  size?: DateCellSize;
};

export function DateCell({ day, month, size = "md", className, ...props }: DateCellProps) {
  return (
    <div className={cn("date-cell", size === "lg" && "date-cell-lg", className)} {...props}>
      <span className="date-cell-day">{day}</span>
      <span className="date-cell-mon">{month}</span>
    </div>
  );
}
