// FarolCard — card de indicador "Numeric-first" reutilizável.
// Substitui o padrão "border-top colorida + UPPERCASE tag" (look AI-generated)
// que se repetia em ~25 lugares do projeto. Cada aba RMA tinha sua própria
// variante (.fat-kpi, .prod-kpi, .cur-kpi, .prz-kpi, etc.) com CSS duplicado.
//
// Duas formas de uso:
//
//   1) Com `farol` (criticidade dinâmica) — renderiza Badge no rodapé:
//      <FarolCard
//        label="FATURAMENTO" icon="wallet" value="-15,7%"
//        info="Real R$ 44,1 mi · Contratado R$ 52,3 mi"
//        farol="risco"
//      />
//
//   2) Com `accent` (cor decorativa fixa) — sem Badge no rodapé:
//      <FarolCard
//        label="CURVA LIBERAÇÃO" value="62%"
//        info="projetos · frentes desimpedidas"
//        accent="danger"
//      />

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { I, type IconName } from "../icons";
import "./FarolCard.css";

/** Níveis de farol (re-declarado local — desacopla DS do domínio `obras`). */
export type FarolCardFarol = "conforme" | "observacao" | "risco" | "critico";

/** Cor de acento fixa (alternativa ao farol dinâmico). */
export type FarolCardAccent =
  | "neutral"
  | "brand"
  | "success"
  | "info"
  | "warning"
  | "danger"
  | "ink";

export type FarolCardSize = "sm" | "md";

export type FarolCardProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  /** Label UPPERCASE do topo (ex.: "FATURAMENTO"). */
  label: string;
  /** Ícone do label (chave do mapa `I`). */
  icon?: IconName;
  /** Valor principal — destaque tipográfico. */
  value: ReactNode;
  /** Linha de descrição abaixo do valor. */
  info?: ReactNode;
  /** Nota secundária integrada à `info` com separador "·". */
  hint?: ReactNode;
  /** Criticidade — define cor (valor/ícone) + renderiza Badge no rodapé. */
  farol?: FarolCardFarol;
  /** Cor decorativa fixa (alternativa ao `farol`). Quando ambos passados, `farol` vence. */
  accent?: FarolCardAccent;
  /** Tamanho compacto (`sm`) ou padrão (`md`). Default `md`. */
  size?: FarolCardSize;
  /** Aplica hover effects + mostra arrow → no canto direito. Use quando o card
   * for clicável (wrappar em `<Link>` externamente). */
  interactive?: boolean;
};

/** Label PT-BR do status indicator no canto sup-direito. */
const FAROL_TO_LABEL = {
  conforme: "Conforme",
  observacao: "Observação",
  risco: "Risco",
  critico: "Crítico",
} as const;

/** Mapa farol → accent (compartilha as mesmas CSS vars). */
const FAROL_TO_ACCENT: Record<FarolCardFarol, FarolCardAccent> = {
  conforme: "success",
  observacao: "info",
  risco: "warning",
  critico: "danger",
};

export function FarolCard({
  label,
  icon,
  value,
  info,
  hint,
  farol,
  accent,
  size = "md",
  interactive,
  className,
  ...rest
}: FarolCardProps) {
  // Resolve cor: farol > accent explícito > neutral
  const colorVariant: FarolCardAccent = farol ? FAROL_TO_ACCENT[farol] : (accent ?? "neutral");
  const IconFn = icon ? I[icon] : null;
  const iconSize = size === "sm" ? 12 : 14;

  return (
    <article
      className={cn(
        "farol-card",
        `farol-card-${colorVariant}`,
        `farol-card-${size}`,
        interactive && "farol-card-interactive",
        className,
      )}
      {...rest}
    >
      <header className="farol-card-head">
        {IconFn ? (
          <span className="farol-card-icon" aria-hidden>
            {IconFn({ size: iconSize })}
          </span>
        ) : null}
        <span className="farol-card-label">{label}</span>
        {farol ? (
          <span className="farol-card-status" aria-label={`Status: ${FAROL_TO_LABEL[farol]}`}>
            <span className="farol-card-status-dot" aria-hidden />
            {FAROL_TO_LABEL[farol]}
          </span>
        ) : interactive ? (
          <span className="farol-card-arrow" aria-hidden>
            {I.arrowRight({ size: 14 })}
          </span>
        ) : null}
      </header>

      <div className="farol-card-value">{value}</div>

      {info || hint ? (
        <p className="farol-card-info">
          {info}
          {hint ? <span className="farol-card-hint"> · {hint}</span> : null}
        </p>
      ) : null}
    </article>
  );
}
