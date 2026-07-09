// Análise da Tela — contexto, hook e tipos (sem componentes, p/ não quebrar o fast-refresh do
// Analise.tsx). O estado vive em Context porque no RMA os botões (no header do layout) e o conteúdo
// (na rota-filha via <Outlet/>) precisam conversar — estado local não alcançaria os dois.

import { createContext, useContext, type ReactNode } from "react";
import type { RelatorioAba } from "@/lib/relatorio/schema";

export type AnaliseModo = "tela" | "analise";
/** "tela" = análise desta tela/aba · "geral" = análise consolidada (só RMA). */
export type AnaliseEscopo = "tela" | "geral";

export type AnaliseContexto = {
  modo: AnaliseModo;
  escopo: AnaliseEscopo;
  /** RMA = true (oferece "esta aba" × "RMA inteiro"); demais telas = false. */
  temGeral: boolean;
  /** Handler de download (gera o PDF). Ausente na fase de layout → botão fica desabilitado. */
  podeBaixar: boolean;
  abrir: (escopo?: AnaliseEscopo) => void;
  voltar: () => void;
  setEscopo: (e: AnaliseEscopo) => void;
  baixar: () => void;
};

export type AnaliseProviderProps = {
  /** RMA passa `temGeral` p/ habilitar o seletor de escopo (esta aba × RMA inteiro). */
  temGeral?: boolean;
  /** Gera o PDF da análise no escopo atual. Omitido na fase de layout. */
  onBaixar?: (escopo: AnaliseEscopo) => void;
  /** Modo CONTROLADO (opcional). O RMA controla o estado pela URL (?analise=tela|geral) — porque o
   * layout remonta a cada troca de aba e o estado local zeraria. Se `onChange` for passado, o estado
   * vem de `modo`/`escopo`; senão o Provider usa estado local (telas standalone, que não remontam). */
  modo?: AnaliseModo;
  escopo?: AnaliseEscopo;
  onChange?: (next: { modo: AnaliseModo; escopo: AnaliseEscopo }) => void;
  children: ReactNode;
};

export type AnaliseViewProps = {
  /** O relatório gerado pela IA. null = ainda não gerado → mostra o empty state "Gerar análise". */
  relatorio: RelatorioAba | null;
  /** Rótulo do que está sendo analisado. Ex.: "Aba · Faturamento" ou "RMA completo · BR-101". */
  contexto?: ReactNode;
  /** Dispara a geração do relatório (do empty state). */
  onGerar?: () => void;
};

export const AnaliseCtx = createContext<AnaliseContexto | null>(null);

/** Lê o estado da análise (modo/escopo). Útil p/ telas que rotulam a análise pelo escopo (ex: RMA). */
export function useAnalise(): AnaliseContexto {
  const v = useContext(AnaliseCtx);
  if (!v) throw new Error("Componentes de Análise precisam estar dentro de <AnaliseProvider>");
  return v;
}
