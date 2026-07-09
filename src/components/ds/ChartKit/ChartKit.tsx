// ChartKit — tooltip + legenda compartilhados para gráficos Recharts (RMA / M3).
// Mata os tooltips default do Recharts e as legendas custom divergentes por aba.
//
// ── CONVENÇÃO DE COR DE SÉRIE (única, vale pra todo gráfico do produto) ──────────────
//   · Contratado / Previsto   → var(--info)
//   · Real / Executado        → var(--rma-navy)  — navy LOCAL definido em ChartKit.css:
//                               var(--ink) no claro · var(--text) no escuro (mesmo padrão
//                               do --c6-navy já usado na C.6 Insumos, agora global).
//   · Projeção                → tracejada (strokeDasharray) na MESMA cor do Real.
//   · Meta / Referência       → var(--warning)
//   · var(--danger)           → APENAS quando semanticamente ruim (desvio, estouro, glosa).
//                               A série "Real" NUNCA usa danger fixo.
// Constantes prontas em CHART_SERIE_COR — usar em stroke/fill em vez de repetir strings.
//
// Uso (tooltip):   <Tooltip content={<ChartTooltip prefixo="R$" unidade="mi" />} />
//   Recharts injeta active/payload/label; `formatter` aceita função única OU um mapa
//   por dataKey ({ real: fmtBRL, aderencia: fmtPct }). Valores null → "—" (pendente ≠ 0).
// Uso (legenda):   <ChartLegend items={[{ label: "Real", tipo: "linha", cor: CHART_SERIE_COR.real }]} />
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./ChartKit.css";

/** Cores canônicas de série (ver convenção no topo do arquivo). */
export const CHART_SERIE_COR = {
  /** Contratado / Previsto */
  contratado: "var(--info)",
  /** Real / Executado — e a Projeção, tracejada na mesma cor */
  real: "var(--rma-navy)",
  /** Meta / Referência */
  meta: "var(--warning)",
  /** APENAS quando semanticamente ruim (desvio, estouro, glosa) */
  ruim: "var(--danger)",
} as const;

// ── ChartTooltip ─────────────────────────────────────────────────────────────────────

export type ChartFormatter = (value: number) => string;

/** Entrada do payload injetado pelo Recharts (tipagem local, estável entre versões 2.x). */
export type ChartTooltipEntry = {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string | ReadonlyArray<number | string> | null;
  color?: string;
  strokeDasharray?: string | number;
  payload?: Record<string, unknown>;
};

export type ChartTooltipProps = {
  /** Injetado pelo Recharts via `content={<ChartTooltip/>}` — não passar manualmente. */
  active?: boolean;
  /** Injetado pelo Recharts. */
  payload?: ChartTooltipEntry[];
  /** Injetado pelo Recharts (valor do eixo X). */
  label?: string | number;
  /** Título do tooltip; default = o `label` do eixo X. Aceita nó ou função (label, payload). */
  titulo?:
    | ReactNode
    | ((label: string | number | undefined, payload: ChartTooltipEntry[]) => ReactNode);
  /**
   * Formatador de valor pt-BR: função única (todas as séries) OU mapa por dataKey
   * (`{ real: fmtBRL, aderencia: (v) => \`${v}%\` }`). Sem formatter → default pt-BR
   * com `prefixo`/`unidade`/`casas`.
   */
  formatter?: ChartFormatter | Record<string, ChartFormatter>;
  /** Prefixo do formatador default (ex.: "R$"). */
  prefixo?: string;
  /** Unidade/sufixo do formatador default (ex.: "mi", "%", "HH"). */
  unidade?: string;
  /** Máximo de casas decimais do formatador default (default 2). */
  casas?: number;
  /** Renomeia séries (dataKey → rótulo PT-BR) quando o `name` do Recharts não serve. */
  nomes?: Record<string, string>;
  /** Oculta séries com valor null/undefined (default false → mostra "—", pendente ≠ 0). */
  ocultarNulos?: boolean;
  className?: string;
};

function fmtPtBr(v: number, casas: number, prefixo?: string, unidade?: string): string {
  const n = v.toLocaleString("pt-BR", { maximumFractionDigits: casas });
  return `${prefixo ? `${prefixo} ` : ""}${n}${unidade ? ` ${unidade}` : ""}`;
}

/** Tooltip custom p/ Recharts: fundo --surface, borda, sombra --sh-pop, valores tabular-nums pt-BR. */
export function ChartTooltip({
  active,
  payload,
  label,
  titulo,
  formatter,
  prefixo,
  unidade,
  casas = 2,
  nomes,
  ocultarNulos = false,
  className,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const fmtDe = (dataKey: string): ChartFormatter | undefined =>
    typeof formatter === "function" ? formatter : formatter?.[dataKey];

  const fmtValor = (entry: ChartTooltipEntry): string => {
    const um = (v: number | string): string => {
      if (typeof v !== "number") return String(v);
      const fmt = fmtDe(String(entry.dataKey ?? ""));
      return fmt ? fmt(v) : fmtPtBr(v, casas, prefixo, unidade);
    };
    const v = entry.value;
    if (v == null) return "—"; // pendente ≠ zero
    if (Array.isArray(v)) return v.map(um).join(" – ");
    return um(v as number | string);
  };

  const entries = ocultarNulos ? payload.filter((e) => e.value != null) : payload;
  if (entries.length === 0) return null;

  const cabeca = typeof titulo === "function" ? titulo(label, payload) : (titulo ?? label);

  return (
    <div className={cn("chart-tip", className)}>
      {cabeca != null && cabeca !== "" ? <div className="chart-tip-title">{cabeca}</div> : null}
      {entries.map((e, i) => {
        const key = String(e.dataKey ?? e.name ?? i);
        const rotulo = nomes?.[String(e.dataKey ?? "")] ?? (e.name != null ? String(e.name) : key);
        const tracejada = e.strokeDasharray != null && e.strokeDasharray !== "";
        return (
          <div className="chart-tip-row" key={`${key}-${i}`}>
            <span
              className={cn("chart-tip-sw", tracejada && "chart-tip-sw-tracejada")}
              style={{ color: e.color ?? "var(--text-4)" }}
              aria-hidden
            />
            <span className="chart-tip-k">{rotulo}</span>
            <span className="chart-tip-v">{fmtValor(e)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── ChartLegend ──────────────────────────────────────────────────────────────────────

export type ChartLegendItem = {
  label: ReactNode;
  /** Forma do swatch: linha cheia · linha tracejada · barra (quadrado) · dot (círculo 8px). */
  tipo: "linha" | "tracejada" | "barra" | "dot";
  /** Cor via token — ex.: CHART_SERIE_COR.real, "var(--info)". */
  cor: string;
};

export type ChartLegendProps = {
  items: ChartLegendItem[];
  className?: string;
};

/** Legenda compartilhada: linha de swatches (cheia/tracejada/barra/dot) + label --text-2. */
export function ChartLegend({ items, className }: ChartLegendProps) {
  if (items.length === 0) return null;
  return (
    <ul className={cn("chart-legend", className)}>
      {items.map((it, i) => (
        <li className="chart-legend-item" key={i}>
          <span
            className={`chart-legend-sw chart-legend-sw-${it.tipo}`}
            style={{ color: it.cor }}
            aria-hidden
          />
          <span className="chart-legend-label">{it.label}</span>
        </li>
      ))}
    </ul>
  );
}
