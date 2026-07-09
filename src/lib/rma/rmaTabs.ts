// Mapeamento canônico das 8 tabs (etapas) do RMA mensal · alinhado com
// docs/rma/DOCUMENTOS REVISADOS/README.md. Cada tab declara:
// - Os documentos cuja "tab dona" é esta (primaryDocs) — são pedidos no upload.
// - Se a tab é agregadora (calculada a partir das outras, sem upload próprio).

import type { IconName } from "@/components/ds";
import type { RmaDocTypeId } from "./documentTypes";

export type RmaTabId =
  | "indicadores"
  | "faturamento"
  | "recursos"
  | "produtividade"
  | "prazo"
  | "insumos"
  | "curvas-responsabilidade"
  | "chuvas";

export type RmaTab = {
  id: RmaTabId;
  /** Número da tab no documento técnico v5 (1-8). */
  numero: number;
  label: string;
  icon: IconName;
  description: string;
  /** Documentos primários · onde o upload "pertence" a esta tab. */
  primaryDocs: RmaDocTypeId[];
  /** Quando true, a tab é agregadora (calculada das outras) — sem upload próprio. */
  aggregator?: boolean;
  /** Quando agregadora, lista dos docs (de outras tabs) que alimentam o cálculo. */
  aggregatedFrom?: RmaDocTypeId[];
};

export const RMA_TABS: readonly RmaTab[] = [
  {
    id: "indicadores",
    numero: 1,
    label: "Indicadores e Farol",
    icon: "bell",
    description:
      "Painel agregado · resume os faróis das demais tabs sem consumir documentos próprios.",
    primaryDocs: [],
    aggregator: true,
    aggregatedFrom: ["bm", "medicao-acumulada", "rdo", "relatorio-semanal", "ms-project"],
  },
  {
    id: "faturamento",
    numero: 2,
    label: "Faturamento",
    icon: "wallet",
    description: "Curva S contratual × real, frentes de serviço e histórico mês a mês.",
    primaryDocs: ["bm", "medicao-acumulada"],
  },
  {
    id: "recursos",
    numero: 3,
    label: "Recursos · MOD/MOI/EQP",
    icon: "users",
    description: "Mão de obra direta e indireta, equipamentos · contratado × alocado.",
    primaryDocs: ["relatorio-semanal", "rdo"],
  },
  {
    id: "produtividade",
    numero: 4,
    label: "Produtividade",
    icon: "trending",
    description:
      "Hora-Homem e índices · agrega medições, RDOs e relatórios semanais para calcular ganho/perda.",
    primaryDocs: [],
    aggregator: true,
    aggregatedFrom: ["bm", "medicao-acumulada", "rdo", "relatorio-semanal"],
  },
  {
    id: "prazo",
    numero: 5,
    label: "Prazo e Cronograma",
    icon: "calendar",
    description: "Cronograma físico-financeiro · revisões do MS Project e avanço real.",
    primaryDocs: ["ms-project"],
  },
  {
    id: "insumos",
    numero: 6,
    label: "Insumos",
    icon: "pkg",
    description: "Controle de armação e concreto · histórico de compras e faturamento.",
    primaryDocs: ["armacao-concreto", "faturamento"],
  },
  {
    id: "curvas-responsabilidade",
    numero: 7,
    label: "Curvas e Responsabilidade",
    icon: "share",
    description:
      "Análise Liberação × Capacidade × Alocado e atribuição de causa · cruza todas as fontes.",
    primaryDocs: [],
    aggregator: true,
    aggregatedFrom: [
      "bm",
      "medicao-acumulada",
      "rdo",
      "relatorio-semanal",
      "ms-project",
      "armacao-concreto",
    ],
  },
  {
    id: "chuvas",
    numero: 8,
    label: "Análise de Chuvas",
    icon: "repeat",
    description: "Registro pluviométrico do canteiro · dispara eventos de força maior.",
    primaryDocs: ["pluviometrico"],
  },
] as const;

/** Acesso O(1) por id. */
export const RMA_TAB_BY_ID: Record<RmaTabId, RmaTab> = Object.fromEntries(
  RMA_TABS.map((t) => [t.id, t]),
) as Record<RmaTabId, RmaTab>;
