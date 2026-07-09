import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./DataTable.css";

export type DataTableAlign = "left" | "right" | "center";

export type DataTableColumn<T> = {
  key: string;
  label: ReactNode;
  /** CSS grid track size (e.g. "40px", "1fr", "180px"). Default: "1fr". */
  width?: string;
  align?: DataTableAlign;
  render?: (row: T, index: number) => ReactNode;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T, index: number) => string | number;
  onRowClick?: (row: T, index: number) => void;
  selectedId?: string | number;
  emptyText?: ReactNode;
  className?: string;
};

function alignClass(align?: DataTableAlign) {
  if (align === "right") return "dt-cell-right";
  if (align === "center") return "dt-cell-center";
  return "";
}

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  onRowClick,
  selectedId,
  emptyText = "Sem registros.",
  className,
}: DataTableProps<T>) {
  const cols = columns.map((c) => c.width ?? "1fr").join(" ");
  const style = { "--dt-cols": cols } as CSSProperties;

  return (
    <div className={cn("dt", className)} style={style} role="table">
      <div className="dt-head" role="row">
        {columns.map((c) => (
          <div key={c.key} role="columnheader" className={alignClass(c.align)}>
            {c.label}
          </div>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="dt-empty">{emptyText}</div>
      ) : (
        rows.map((row, i) => {
          const id = getRowId(row, i);
          const clickable = !!onRowClick;
          const Tag = (clickable ? "button" : "div") as "button" | "div";
          return (
            <Tag
              key={id}
              type={clickable ? "button" : undefined}
              role="row"
              className={cn("dt-row", clickable && "clickable", selectedId === id && "selected")}
              onClick={clickable ? () => onRowClick(row, i) : undefined}
            >
              {columns.map((c) => (
                <div key={c.key} role="cell" className={alignClass(c.align)}>
                  {c.render
                    ? c.render(row, i)
                    : ((row as Record<string, ReactNode>)[c.key] ?? null)}
                </div>
              ))}
            </Tag>
          );
        })
      )}
    </div>
  );
}
