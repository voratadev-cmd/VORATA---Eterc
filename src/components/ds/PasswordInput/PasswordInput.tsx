import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { I } from "../icons";
import "./PasswordInput.css";

/**
 * Campo de senha com toggle de visibilidade (olho). Reusa o `.input` base do DS,
 * só adiciona o botão de mostrar/ocultar à direita. O toggle é `tabIndex={-1}`
 * pra não atrapalhar o fluxo de Tab (email → senha → entrar).
 */
export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function PasswordInput({ className, ...props }, ref) {
    const [show, setShow] = useState(false);
    return (
      <div className="pwd">
        <input
          ref={ref}
          type={show ? "text" : "password"}
          className={cn("input", "pwd-input", className)}
          {...props}
        />
        <button
          type="button"
          className="pwd-toggle"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={show}
          tabIndex={-1}
        >
          {show ? I.eyeOff({ size: 16 }) : I.eye({ size: 16 })}
        </button>
      </div>
    );
  },
);
