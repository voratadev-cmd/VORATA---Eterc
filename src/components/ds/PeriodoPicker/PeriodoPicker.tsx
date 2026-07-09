// PeriodoPicker · seletor de ano + mês para o BM ativo.
// Padrão visual: trigger compacto com ícone calendar + label + caret · dropdown
// com header de ano (segmented quando há mais de 1) + grid 4×3 de meses.
// Meses sem BM aparecem disabled e mudos. Mês ativo recebe destaque brand.

import { useEffect, useRef, useState } from "react";
import { I } from "../icons";
import "./PeriodoPicker.css";

export type PeriodoOpcao = {
  /** Identificador opaco (geralmente o número do BM: "BM-09"). */
  id: string;
  ano: number;
  /** 1–12 */
  mes: number;
};

type Props = {
  /** Lista de períodos disponíveis · normalmente derivada de `visao.bms`. */
  opcoes: PeriodoOpcao[];
  /** Período atualmente selecionado (id). */
  valor: string;
  /** Callback ao selecionar um novo período. */
  onChange: (opcao: PeriodoOpcao) => void;
  /** Label antes do valor no trigger (default: "Período"). */
  label?: string;
  /**
   * Modo "tudo" (opcional · ex.: "Obra inteira"). Quando `allLabel` é setado: o painel ganha uma
   * linha no topo que chama `onAll`, e — se `allActive` — o trigger mostra `allLabel` e nenhum mês
   * fica destacado. Aditivo/retrocompatível: sem `allLabel`, comportamento idêntico ao de antes.
   */
  allLabel?: string;
  allActive?: boolean;
  onAll?: () => void;
  /** Desabilita o trigger (não abre) · com tooltip opcional. Aditivo. */
  disabled?: boolean;
  title?: string;
};

const MESES_CURTO = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

const MESES_LONGO = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function PeriodoPicker({
  opcoes,
  valor,
  onChange,
  label = "Período",
  allLabel,
  allActive,
  onAll,
  disabled,
  title,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const atual = opcoes.find((o) => o.id === valor) ?? opcoes[opcoes.length - 1];
  const anosDisponiveis = Array.from(new Set(opcoes.map((o) => o.ano))).sort((a, b) => a - b);
  // Limites do navegador de ano · 1 ano antes do primeiro BM e 1 ano depois do
  // último, permitindo "espiar" passado/futuro mesmo quando vazios.
  const anoMin = (anosDisponiveis[0] ?? new Date().getFullYear()) - 1;
  const anoMax = (anosDisponiveis[anosDisponiveis.length - 1] ?? new Date().getFullYear()) + 1;

  // Ano em foco no dropdown · começa no ano do valor atual.
  const [anoFoco, setAnoFoco] = useState<number>(atual?.ano ?? new Date().getFullYear());

  // Reseta o ano em foco sempre que abrir o dropdown.
  useEffect(() => {
    if (open && atual) setAnoFoco(atual.ano);
  }, [open, atual]);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!atual && !allLabel) return null;

  // Mapa mes(1-12) → opção · pra saber se cada mês está disponível no anoFoco.
  const mesesNoAnoFoco = new Map<number, PeriodoOpcao>();
  for (const o of opcoes) {
    if (o.ano === anoFoco) mesesNoAnoFoco.set(o.mes, o);
  }

  function escolher(opcao: PeriodoOpcao) {
    setOpen(false);
    onChange(opcao);
  }

  return (
    <div className="pp" ref={ref}>
      <button
        type="button"
        className="pp-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        title={title}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="pp-trigger-icon">{I.calendar({ size: 14 })}</span>
        <span className="pp-trigger-text">
          <span className="pp-trigger-label">{label}</span>
          <span className="pp-trigger-valor">
            {(allActive && allLabel) || !atual ? (
              (allLabel ?? "")
            ) : (
              <>
                {MESES_LONGO[atual.mes - 1]} <span className="pp-trigger-ano">· {atual.ano}</span>
              </>
            )}
          </span>
        </span>
        <span className={`pp-caret ${open ? "open" : ""}`}>{I.chevDown({ size: 14 })}</span>
      </button>

      {open && (
        <div className="pp-panel" role="dialog" aria-label="Selecionar período">
          {allLabel && (
            <button
              type="button"
              className={`pp-all ${allActive ? "active" : ""}`}
              aria-pressed={!!allActive}
              onClick={() => {
                setOpen(false);
                onAll?.();
              }}
            >
              <span className="pp-all-label">{allLabel}</span>
              {allActive && (
                <span className="pp-all-check" aria-hidden>
                  {I.check({ size: 14 })}
                </span>
              )}
            </button>
          )}
          <div className="pp-panel-head">
            <div className="pp-panel-titulo">
              {opcoes.length} {opcoes.length === 1 ? "mês disponível" : "meses disponíveis"}
            </div>
            <div className="pp-ano-nav" role="group" aria-label="Navegar entre anos">
              <button
                type="button"
                className="pp-ano-btn"
                onClick={() => setAnoFoco((a) => Math.max(anoMin, a - 1))}
                disabled={anoFoco <= anoMin}
                aria-label="Ano anterior"
              >
                {I.chevLeft({ size: 14 })}
              </button>
              <span
                className={`pp-ano-label ${mesesNoAnoFoco.size === 0 ? "pp-ano-label-empty" : ""}`}
                aria-live="polite"
              >
                {anoFoco}
              </span>
              <button
                type="button"
                className="pp-ano-btn"
                onClick={() => setAnoFoco((a) => Math.min(anoMax, a + 1))}
                disabled={anoFoco >= anoMax}
                aria-label="Próximo ano"
              >
                {I.chevRight({ size: 14 })}
              </button>
            </div>
          </div>

          <div className="pp-meses" role="grid">
            {MESES_CURTO.map((nome, idx) => {
              const mes = idx + 1;
              const opcao = mesesNoAnoFoco.get(mes);
              const isAtual = !allActive && !!opcao && !!atual && opcao.id === atual.id;
              const isDisponivel = !!opcao;
              return (
                <button
                  key={mes}
                  type="button"
                  role="gridcell"
                  className={`pp-mes ${isAtual ? "active" : ""} ${isDisponivel ? "" : "disabled"}`}
                  disabled={!isDisponivel}
                  aria-current={isAtual ? "true" : undefined}
                  onClick={() => opcao && escolher(opcao)}
                  title={isDisponivel ? `${MESES_LONGO[idx]} ${anoFoco}` : "Sem BM neste mês"}
                >
                  {nome}
                  {isDisponivel && <span className="pp-mes-dot" aria-hidden />}
                </button>
              );
            })}
          </div>

          <div className="pp-panel-foot">
            <span className="pp-panel-foot-label">Atual:</span>
            <span className="pp-panel-foot-valor">
              {allActive && allLabel
                ? allLabel
                : atual
                  ? `${MESES_LONGO[atual.mes - 1]} ${atual.ano}`
                  : (allLabel ?? "")}
              {!allActive && atual && !/^\d{4}-/.test(atual.id) && (
                <span className="pp-panel-foot-id"> · {atual.id}</span>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
