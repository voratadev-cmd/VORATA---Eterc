import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./FormField.css";

export type FormFieldProps = {
  label: string;
  /** id do controle interno — liga o <label> via htmlFor (acessibilidade). */
  htmlFor?: string;
  /** Dica abaixo do campo (some quando há erro). */
  hint?: string;
  /** Mensagem de erro — quando presente, pinta o campo e some a dica. */
  error?: string;
  children: ReactNode;
  className?: string;
};

/**
 * Wrapper compacto de campo de formulário: label empilhado + controle + dica/erro.
 * Mais leve que o FieldRow (que é grid 240px|1fr, ótimo p/ settings). Ideal p/
 * formulários verticais como o login. Quando `error`, a classe `.ff-has-error`
 * pinta o `.input` filho de vermelho via CSS (sem o campo precisar saber do erro).
 */
export function FormField({ label, htmlFor, hint, error, children, className }: FormFieldProps) {
  return (
    <div className={cn("ff", error && "ff-has-error", className)}>
      <label className="ff-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <span className="ff-error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="ff-hint">{hint}</span>
      ) : null}
    </div>
  );
}
