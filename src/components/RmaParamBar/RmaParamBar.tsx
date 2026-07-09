// RmaParamBar — barra fina de parâmetros das abas do RMA (denominador comum das 4 barras
// existentes: ind-param-bar da C.2, fat-param-bar da C.3, ifd-pbar da C.6 e prod-param-bar
// da C.7). Linha de pares "label · valor" separados por divisor de 1px + slot opcional pro
// seletor de período (RmaPeriodoPicker) encostado à direita.
//
// Uso:
//   <RmaParamBar
//     items={[
//       { label: "Data de corte", valor: "31/05/2026" },
//       { label: "BM", valor: "BM 3 (mai/2026)" },
//       { label: "Horizonte", valor: "46 BMs" },
//     ]}
//     picker={<RmaPeriodoPicker contractId={contractId} />}
//   />
//
// Convenções: label var(--text-3) fs-12 · valor fs-13 semibold tabular-nums · valores
// pendentes entram como "—" (pendente ≠ zero — o chamador decide, aqui só renderiza).
import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./RmaParamBar.css";

export type RmaParamItem = {
  label: ReactNode;
  valor: ReactNode;
  /** Tooltip nativo opcional (ex.: explicar de onde o parâmetro vem). */
  title?: string;
};

export type RmaParamBarProps = {
  items: RmaParamItem[];
  /** Slot opcional pro seletor de período (ex.: <RmaPeriodoPicker/>), alinhado à direita. */
  picker?: ReactNode;
  className?: string;
};

export function RmaParamBar({ items, picker, className }: RmaParamBarProps) {
  if (items.length === 0 && !picker) return null;
  return (
    <div className={cn("rma-pbar", className)}>
      {items.map((it, i) => (
        <Fragment key={i}>
          {i > 0 ? <span className="rma-pbar-sep" aria-hidden /> : null}
          <span className="rma-pbar-item" title={it.title}>
            <span className="rma-pbar-k">{it.label}</span>
            <span className="rma-pbar-v">{it.valor}</span>
          </span>
        </Fragment>
      ))}
      {picker ? <span className="rma-pbar-picker">{picker}</span> : null}
    </div>
  );
}
