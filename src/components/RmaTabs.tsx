// Tabs horizontais do RMA — 12 abas (Visão Geral + 11 abas do doc §5.3).
// Cada tab pode ter um dot colorido pelo farol do bloco correspondente do BM atual.
// Aparece em todas as rotas dentro de /contracts/$id/rma/*.

import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import type { BmSnapshot } from "@/lib/mocks/obras";
import type { FarolLevel } from "@/lib/mocks/contracts";
import "./RmaTabs.css";

export type RmaTabId =
  | "visao-geral"
  | "indicadores"
  | "faturamento"
  | "recursos"
  | "produtividade"
  | "prazo"
  | "insumos"
  | "curvas"
  | "chuvas"
  | "responsabilidade"
  | "panorama"
  | "condutas"
  | "plano-acao";

export type RmaTab = {
  id: RmaTabId;
  label: string;
  /** Dot derivado do farol do bloco correspondente no BM atual. */
  dot?: FarolLevel;
};

const DOT_COLOR: Record<FarolLevel, string> = {
  critico: "var(--danger)",
  risco: "var(--warning)",
  observacao: "var(--info)",
  conforme: "var(--success)",
};

export type RmaTabsProps = {
  contractId: string;
  /** Quando passado, deriva os dots dos blocos correspondentes daquele BM. */
  bm?: BmSnapshot | null;
};

function buildTabs(bm: BmSnapshot | null | undefined): RmaTab[] {
  return [
    { id: "visao-geral", label: "Visão Geral" },
    { id: "indicadores", label: "Indicadores e Farol", dot: bm?.situacao },
    { id: "faturamento", label: "Faturamento", dot: bm?.blocoFaturamento.nivel },
    { id: "recursos", label: "Recursos", dot: bm?.blocoRecursos.nivel },
    { id: "produtividade", label: "Produtividade", dot: bm?.blocoProdutividade.nivel },
    { id: "prazo", label: "Prazo", dot: bm?.blocoPrazo.nivel },
    { id: "insumos", label: "Insumos", dot: bm?.blocoInsumos.nivel },
    { id: "curvas", label: "Curvas e Responsabilidade" },
    { id: "chuvas", label: "Chuvas" },
    { id: "panorama", label: "Panorama" },
  ];
}

// Atualizador de search das abas: preserva tudo (ex.: ?bm=) e, se a análise estiver aberta, mantém-na
// aberta porém na NOVA aba (escopo "tela"). Trocar de aba no modo análise → análise da aba clicada.
function preservaAnalise(prev: Record<string, unknown>): Record<string, unknown> {
  return prev.analise ? { ...prev, analise: "tela" } : prev;
}

export function RmaTabs({ contractId, bm }: RmaTabsProps) {
  const tabs = buildTabs(bm);

  return (
    <nav className="rma-tabs" aria-label="Abas do RMA">
      <ul className="rma-tabs-list">
        {tabs.map((t) => {
          const href = `/contracts/${contractId}/rma/${t.id}`;
          return (
            <li key={t.id}>
              <Link
                // Destinos dinâmicos por aba — string `to` direto.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                to={href as any}
                // Preserva os search params atuais; se a análise estiver aberta, mantém aberta mas na
                // NOVA aba (escopo "tela"). Sem isso, trocar de aba perderia o ?analise= e zeraria.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                search={preservaAnalise as any}
                activeOptions={{ exact: true }}
                activeProps={{ className: "active" }}
                className={cn("rma-tab")}
              >
                {t.dot ? (
                  <span
                    className="rma-tab-dot"
                    style={{ background: DOT_COLOR[t.dot] }}
                    aria-hidden
                  />
                ) : null}
                <span className="rma-tab-label">{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
