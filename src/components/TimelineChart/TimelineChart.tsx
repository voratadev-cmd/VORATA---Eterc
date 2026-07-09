// TimelineChart · componente SVG data-driven (sem libs de chart) pra
// renderizar uma linha do tempo com swimlanes por tipo, marcos com badges,
// linhas verticais de "hoje" / prazo / projeção, e dots clicáveis.
//
// Aceita TimelineEvento[] e responde a filtro de tipo + seleção. Pronto pra
// receber dados reais quando o backend chegar.

import { useEffect, useRef, useState } from "react";
import type { FarolLevel } from "@/lib/mocks/contracts";
import type { TimelineEvento, TimelineEventoTipo } from "@/lib/mocks/obras";
import "./TimelineChart.css";

const FAROL_COLOR: Record<FarolLevel, string> = {
  critico: "var(--danger)",
  risco: "var(--warning)",
  observacao: "var(--info)",
  conforme: "var(--success)",
};

const MARCO_BG: Record<NonNullable<TimelineEvento["marcoStatus"]>, string> = {
  cumprido: "var(--success)",
  "em-risco": "var(--warning)",
  atrasado: "var(--danger)",
  futuro: "var(--text-3)",
};

/** Ordem das lanes (cima → baixo). */
const LANE_ORDER: TimelineEventoTipo[] = [
  "bm",
  "carta",
  "ata",
  "projeto",
  "impacto",
  "medicao",
  "pleito",
  "rnc",
  "tac",
];

const LANE_LABEL: Record<TimelineEventoTipo, string> = {
  bm: "BMs",
  marco: "Marcos",
  carta: "Cartas",
  ata: "Atas",
  projeto: "Projetos",
  impacto: "Impactos",
  medicao: "Medições",
  pleito: "Pleitos / PPN",
  rnc: "RNCs",
  tac: "TACs",
};

type Props = {
  eventos: TimelineEvento[];
  inicio: Date;
  fim: Date;
  hoje: Date;
  projecaoFim: Date;
  filtroTipo: TimelineEventoTipo | "todos";
  selectedId: string;
  onSelect: (id: string) => void;
};

export function TimelineChart({
  eventos,
  inicio,
  fim,
  hoje,
  projecaoFim,
  filtroTipo,
  selectedId,
  onSelect,
}: Props) {
  // Width responsivo via ResizeObserver no container.
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1100);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 1100;
      setWidth(Math.max(600, Math.floor(w)));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Quando filtroTipo !== "todos", só exibe a lane correspondente +
  // sempre exibe a lane de marcos no topo (com badges).
  const lanesVisiveis =
    filtroTipo === "todos" ? LANE_ORDER : filtroTipo === "marco" ? [] : [filtroTipo];

  // Layout
  const padding = { top: 60, right: 40, bottom: 50, left: 110 };
  const laneHeight = 38;
  const chartHeight = padding.top + lanesVisiveis.length * laneHeight + padding.bottom;
  const chartWidth = width;

  // Escala temporal (linear) — total inclui a projeção pra direita do prazo.
  const xMin = inicio.getTime();
  const xMax = projecaoFim.getTime();
  const scaleX = (d: Date) =>
    padding.left +
    ((d.getTime() - xMin) / (xMax - xMin)) * (chartWidth - padding.left - padding.right);

  const laneY = (tipo: TimelineEventoTipo) => {
    const idx = lanesVisiveis.indexOf(tipo);
    if (idx < 0) return -100;
    return padding.top + idx * laneHeight + laneHeight / 2;
  };

  // Ticks mensais (a cada 2 meses se o intervalo for grande).
  const ticks = monthTicks(inicio, projecaoFim);

  // Filtra eventos: aplica filtro de tipo (marcos sempre aparecem no topo).
  const eventosFiltrados = eventos.filter((e) => {
    if (e.tipo === "marco") return true; // marcos sempre desenhados separadamente
    if (filtroTipo === "todos") return true;
    if (filtroTipo === "marco") return false;
    return e.tipo === filtroTipo;
  });

  const marcos = eventos.filter((e) => e.tipo === "marco");
  const caminhoCriticoEventos = eventos
    .filter((e) => e.caminhoCritico && e.tipo !== "marco")
    .sort((a, b) => new Date(a.dataISO).getTime() - new Date(b.dataISO).getTime());

  return (
    <div ref={containerRef} className="tlc-wrap">
      <svg
        className="tlc-svg"
        width={chartWidth}
        height={chartHeight}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        role="img"
        aria-label="Linha do tempo do contrato"
      >
        {/* Background das lanes (alternado) */}
        {lanesVisiveis.map((tipo, i) => (
          <rect
            key={tipo}
            x={padding.left}
            y={padding.top + i * laneHeight}
            width={chartWidth - padding.left - padding.right}
            height={laneHeight}
            fill={i % 2 === 0 ? "var(--surface-2)" : "transparent"}
          />
        ))}

        {/* Lane labels */}
        {lanesVisiveis.map((tipo, i) => (
          <text
            key={tipo}
            x={padding.left - 10}
            y={padding.top + i * laneHeight + laneHeight / 2 + 4}
            textAnchor="end"
            fontSize="11"
            fill="var(--text-3)"
            fontWeight="600"
          >
            {LANE_LABEL[tipo]}
          </text>
        ))}

        {/* Ticks mensais (eixo X) */}
        {ticks.map((t) => (
          <g key={t.toISOString()}>
            <line
              x1={scaleX(t)}
              x2={scaleX(t)}
              y1={padding.top - 10}
              y2={chartHeight - padding.bottom + 4}
              stroke="var(--border)"
              strokeDasharray="2 3"
            />
            <text
              x={scaleX(t)}
              y={chartHeight - padding.bottom + 22}
              textAnchor="middle"
              fontSize="10"
              fill="var(--text-3)"
            >
              {formatTickLabel(t)}
            </text>
          </g>
        ))}

        {/* Caminho crítico (linha vermelha tracejada conectando os dots) */}
        {filtroTipo === "todos" && caminhoCriticoEventos.length > 1 && (
          <polyline
            points={caminhoCriticoEventos
              .map((e) => `${scaleX(new Date(e.dataISO))},${laneY(e.tipo)}`)
              .join(" ")}
            fill="none"
            stroke="var(--danger)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            opacity="0.55"
          />
        )}

        {/* Linha "hoje" */}
        <line
          x1={scaleX(hoje)}
          x2={scaleX(hoje)}
          y1={padding.top - 24}
          y2={chartHeight - padding.bottom + 4}
          stroke="var(--text-2)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <text
          x={scaleX(hoje)}
          y={padding.top - 30}
          textAnchor="middle"
          fontSize="10"
          fontWeight="700"
          fill="var(--text-2)"
        >
          hoje ({formatBR(hoje)})
        </text>

        {/* Linha prazo contratual */}
        <line
          x1={scaleX(fim)}
          x2={scaleX(fim)}
          y1={padding.top - 24}
          y2={chartHeight - padding.bottom + 4}
          stroke="var(--text-3)"
          strokeWidth="1.5"
        />
        <text
          x={scaleX(fim)}
          y={padding.top - 30}
          textAnchor="middle"
          fontSize="10"
          fill="var(--text-3)"
        >
          prazo ({formatBR(fim)})
        </text>

        {/* Linha projeção */}
        {projecaoFim.getTime() > fim.getTime() && (
          <>
            <line
              x1={scaleX(projecaoFim)}
              x2={scaleX(projecaoFim)}
              y1={padding.top - 24}
              y2={chartHeight - padding.bottom + 4}
              stroke="var(--danger)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <text
              x={scaleX(projecaoFim)}
              y={padding.top - 30}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fill="var(--danger)"
            >
              +{daysBetween(fim, projecaoFim)}d ({formatBR(projecaoFim)})
            </text>
          </>
        )}

        {/* Marcos M1-M6 no topo */}
        {marcos.map((m) => (
          <MarcoMarker
            key={m.id}
            evento={m}
            x={scaleX(new Date(m.dataISO))}
            yTop={6}
            yBottom={chartHeight - padding.bottom}
            selected={m.id === selectedId}
            onClick={() => onSelect(m.id)}
          />
        ))}

        {/* Dots dos eventos nas lanes */}
        {eventosFiltrados
          .filter((e) => e.tipo !== "marco")
          .map((e) => {
            const cx = scaleX(new Date(e.dataISO));
            const cy = laneY(e.tipo);
            if (cy < 0) return null;
            const isSelected = e.id === selectedId;
            return (
              <g
                key={e.id}
                className="tlc-dot-g"
                onClick={() => onSelect(e.id)}
                style={{ cursor: "pointer" }}
              >
                {isSelected && (
                  <circle cx={cx} cy={cy} r="9" fill={FAROL_COLOR[e.farol]} opacity="0.25" />
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected ? 5.5 : 4.5}
                  fill={FAROL_COLOR[e.farol]}
                  stroke={isSelected ? "var(--text)" : "var(--surface)"}
                  strokeWidth={isSelected ? 1.5 : 1}
                />
                <title>{`${formatBR(new Date(e.dataISO))} · ${e.titulo}`}</title>
              </g>
            );
          })}
      </svg>
    </div>
  );
}

// ── Marco com badge no topo ──────────────────────────────────────────

function MarcoMarker({
  evento,
  x,
  yTop,
  yBottom,
  selected,
  onClick,
}: {
  evento: TimelineEvento;
  x: number;
  yTop: number;
  yBottom: number;
  selected: boolean;
  onClick: () => void;
}) {
  const cor = MARCO_BG[evento.marcoStatus ?? "futuro"];
  const num = evento.marcoNumero ?? "M";
  return (
    <g style={{ cursor: "pointer" }} onClick={onClick}>
      {/* Linha vertical do badge até a baseline */}
      <line
        x1={x}
        x2={x}
        y1={yTop + 24}
        y2={yBottom}
        stroke={cor}
        strokeWidth={selected ? 1.5 : 0.75}
        strokeDasharray="2 3"
        opacity={selected ? 0.9 : 0.55}
      />
      {/* Badge circular com número */}
      <circle
        cx={x}
        cy={yTop + 14}
        r={selected ? 13 : 11}
        fill={cor}
        stroke={selected ? "var(--text)" : "transparent"}
        strokeWidth={selected ? 1.5 : 0}
      />
      <text x={x} y={yTop + 18} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">
        {num}
      </text>
      <title>{`${num} · ${evento.titulo} · ${evento.marcoStatus ?? "futuro"}`}</title>
    </g>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

function monthTicks(start: Date, end: Date): Date[] {
  const ticks: Date[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end) {
    ticks.push(new Date(cur));
    cur.setMonth(cur.getMonth() + 2);
  }
  return ticks;
}

const MONTHS_PT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function formatTickLabel(d: Date): string {
  return `${MONTHS_PT[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;
}

function formatBR(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
