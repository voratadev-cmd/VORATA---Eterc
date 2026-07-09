import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./ProgressRing.css";

export type ProgressRingProps = {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  label?: ReactNode;
  centerText?: ReactNode;
  className?: string;
};

export function ProgressRing({
  value,
  max = 100,
  size = 64,
  stroke = 6,
  color = "var(--brand)",
  trackColor = "var(--surface-2)",
  label,
  centerText,
  className,
}: ProgressRingProps) {
  const pct = Math.max(0, Math.min(1, value / max));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // Arco visível = fração da circunferência (em vez de dasharray=c, que deixava o cap redondo "solto"
  // num blob em valores pequenos). dash = trecho preenchido · gap = resto → cap redondo fecha limpo.
  const arc = c * pct;
  const cx = size / 2;
  const cy = size / 2;
  // Sem progresso → não desenha o arco (evita um ponto/cap solto no topo).
  const hasArc = pct > 0;
  // Cap redondo só quando há folga p/ ele caber sem virar bolha; arcos minúsculos usam ponta reta.
  const cap = arc > stroke ? "round" : "butt";
  const display = centerText ?? `${Math.round(pct * 100)}%`;

  return (
    <div className={cn("progress-ring", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true" shapeRendering="geometricPrecision">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
        {hasArc ? (
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap={cap}
            strokeDasharray={`${arc} ${c - arc}`}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: "stroke-dasharray .4s var(--easing)" }}
          />
        ) : null}
      </svg>
      <div className="progress-ring-center">
        <span className="progress-ring-pct">{display}</span>
        {label ? <span className="progress-ring-label">{label}</span> : null}
      </div>
    </div>
  );
}
