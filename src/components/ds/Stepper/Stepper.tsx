// Stepper · progresso em sequência (Cadastro → Mapeamento → Extração).
// Cada fase é um bloco compacto [nó + label/hint]; conectores flexíveis entre
// as fases preenchem a largura (verde no trecho concluído). Quando `onStepClick`
// é passado, a fase inteira vira clicável pra navegar. Empilha em ≤640px.

import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./Stepper.css";

export type StepStatus = "done" | "current" | "upcoming";

export type Step = {
  id: string;
  label: string;
  /** Texto secundário opcional · ex: "concluído", "em andamento". */
  hint?: string;
  status: StepStatus;
};

export type StepperProps = {
  steps: Step[];
  /** Se passado, cada fase vira clicável e dispara onStepClick(id). */
  onStepClick?: (stepId: string) => void;
  className?: string;
  ariaLabel?: string;
};

const CheckGlyph = (
  <svg className="stepper-check" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M5 12.5l4.4 4.4L19 7"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export function Stepper({
  steps,
  onStepClick,
  className,
  ariaLabel = "Fases do fluxo",
}: StepperProps) {
  const clickable = typeof onStepClick === "function";

  return (
    <nav className={cn("stepper", className)} aria-label={ariaLabel}>
      <ol className="stepper-list">
        {steps.map((step, idx) => {
          const node: ReactNode = step.status === "done" ? CheckGlyph : <span>{idx + 1}</span>;
          const body = (
            <>
              <span className="stepper-node" aria-hidden>
                {node}
              </span>
              <span className="stepper-meta">
                <span className="stepper-label">{step.label}</span>
                {step.hint ? <span className="stepper-hint">{step.hint}</span> : null}
              </span>
            </>
          );
          return (
            <Fragment key={step.id}>
              <li className={cn("stepper-item", `is-${step.status}`)}>
                {clickable ? (
                  <button
                    type="button"
                    className="stepper-trigger"
                    onClick={() => onStepClick!(step.id)}
                    aria-current={step.status === "current" ? "step" : undefined}
                    aria-label={`Ir para ${step.label}`}
                  >
                    {body}
                  </button>
                ) : (
                  <div
                    className="stepper-trigger"
                    aria-current={step.status === "current" ? "step" : undefined}
                  >
                    {body}
                  </div>
                )}
              </li>
              {idx < steps.length - 1 ? (
                <li
                  className={cn("stepper-conn", step.status === "done" && "is-filled")}
                  aria-hidden
                />
              ) : null}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
