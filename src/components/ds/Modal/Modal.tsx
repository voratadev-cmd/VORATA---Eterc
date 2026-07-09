import { useEffect, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { I } from "../icons";
import "./Modal.css";

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  headerColor?: string;
  headerStyle?: CSSProperties;
  children?: ReactNode;
  actions?: ReactNode;
  maxWidth?: number;
  className?: string;
  closeOnBackdrop?: boolean;
};

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  headerColor,
  headerStyle,
  children,
  actions,
  maxWidth = 480,
  className,
  closeOnBackdrop = true,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const headStyle: CSSProperties | undefined = headerColor
    ? { ...headerStyle, background: headerColor }
    : headerStyle;

  return (
    <div
      className="modal-backdrop"
      onClick={() => {
        if (closeOnBackdrop) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn("modal", className)}
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        {title ? (
          <div className="modal-head" style={headStyle}>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">
              {I.close({ size: 16 })}
            </button>
            <div className="modal-title">{title}</div>
            {subtitle ? <div className="modal-sub">{subtitle}</div> : null}
          </div>
        ) : null}
        {children ? <div className="modal-body">{children}</div> : null}
        {actions ? <div className="modal-actions">{actions}</div> : null}
      </div>
    </div>
  );
}
