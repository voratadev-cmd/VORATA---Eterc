import type { CSSProperties } from "react";

export type SparklineProps = {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
};

export function Sparkline({
  data,
  color = "var(--brand)",
  width = 100,
  height = 32,
  strokeWidth = 1.75,
  className,
  style,
}: SparklineProps) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const padY = height * 0.075;
  const innerH = height - padY * 2;
  const pts = data
    .map((v, i) => `${i * stepX},${height - ((v - min) / range) * innerH - padY}`)
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      className={className}
      style={{ display: "block", ...style }}
      aria-hidden="true"
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
