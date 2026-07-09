// Catálogo canônico dos documentos do RMA mensal.
// Fonte de verdade para: slots de upload, validação de accept, heurística de
// auto-classificação por nome, e tooltips. Mantenha alinhado com
// docs/rma/DOCUMENTOS REVISADOS/README.md.

import type { IconName } from "@/components/ds";

/** Slug estável usado como segmento de path no Supabase Storage. */
export type RmaDocTypeId =
  | "bm"
  | "medicao-acumulada"
  | "rdo"
  | "relatorio-semanal"
  | "ms-project"
  | "pluviometrico"
  | "armacao-concreto"
  | "faturamento";

export type RmaDocType = {
  id: RmaDocTypeId;
  /** Nome PT-BR exibido no FileSlotCard. */
  label: string;
  /** Hint curto abaixo do label no slot vazio. */
  hint: string;
  /** Tooltip detalhado (ícone info ao lado do label). */
  tooltip: string;
  /** Extensões aceitas (com ponto, ex.: ".pdf"). */
  accept: readonly string[];
  /** MIME types correspondentes (validação extra no client). */
  mimeTypes: readonly string[];
  /** Quantos arquivos cabem no slot. `false` → 1 só. */
  multiple: boolean;
  /** Obrigatório para fechar um BM. */
  required: boolean;
  /** Ícone do DS exibido no slot vazio. */
  iconKey: IconName;
  /** Tabs do RMA que este documento alimenta (referência). */
  tabs: readonly number[];
  /** Regex testadas contra o nome do arquivo para auto-classificação. */
  nameMatchers: readonly RegExp[];
};

export const RMA_DOC_TYPES: readonly RmaDocType[] = [
  {
    id: "bm",
    label: "Boletim de Medição",
    hint: "1 PDF do BM do mês",
    tooltip: "Boletim de Medição mensal assinado. Um PDF por mês de referência.",
    accept: [".pdf"],
    mimeTypes: ["application/pdf"],
    multiple: false,
    required: false,
    iconKey: "doc",
    tabs: [2, 4, 7],
    nameMatchers: [/\bBM[\s_-]?\d{1,3}\b/i, /\bboletim[\s_-]?medi[cç][aã]o\b/i],
  },
  {
    id: "medicao-acumulada",
    label: "Medição Acumulada",
    hint: "Planilha .xlsx até o BM atual",
    tooltip: "Planilha consolidada com o acumulado do contrato até o BM corrente.",
    accept: [".xlsx"],
    mimeTypes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    multiple: false,
    required: false,
    iconKey: "wallet",
    tabs: [2, 4, 7],
    nameMatchers: [/\bmedi[cç][aã]o[\s_-]?acumul/i],
  },
  {
    id: "relatorio-semanal",
    label: "Relatório Semanal",
    hint: "4-5 PDFs por mês",
    tooltip: "Relatórios semanais (RS) emitidos pela Contratada. Tipicamente 4 a 5 por mês.",
    accept: [".pdf"],
    mimeTypes: ["application/pdf"],
    multiple: true,
    required: false,
    iconKey: "note",
    tabs: [3, 4, 7],
    nameMatchers: [/\brelat[oó]rio[\s_-]?semanal\b/i, /\bRS[\s_-]?\d{1,3}\b/i],
  },
  {
    id: "ms-project",
    label: "MS Project Revisões",
    hint: "Arquivo .mpp da revisão",
    tooltip:
      "Cronograma físico-financeiro em MS Project (.mpp). Substituído a cada revisão emitida.",
    accept: [".mpp"],
    mimeTypes: ["application/vnd.ms-project", "application/x-msproject"],
    multiple: false,
    required: false,
    iconKey: "calendar",
    tabs: [5, 7],
    nameMatchers: [/\.mpp$/i, /\bcronograma\b/i],
  },
  {
    id: "pluviometrico",
    label: "Controle Pluviométrico",
    hint: "Planilha de chuvas do mês",
    tooltip:
      "Registro pluviométrico do canteiro. Alimenta a análise de chuvas (Tab 8) e eventos de força maior.",
    accept: [".xlsx", ".xls"],
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ],
    multiple: true,
    required: false,
    iconKey: "trending",
    tabs: [8],
    nameMatchers: [/\bpluvi[oô]m/i, /\bchuvas?\b/i],
  },
  {
    id: "rdo",
    label: "RDO Diário",
    hint: "Vários por mês (opcional)",
    tooltip:
      "Relatório Diário de Obra. Vários arquivos por mês. Atualmente opcional — quando ausente afeta Tabs 3, 4, 5 e 7.",
    accept: [".xls", ".xlsx"],
    mimeTypes: [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    multiple: true,
    required: false,
    iconKey: "calendar",
    tabs: [3, 4, 5, 7],
    nameMatchers: [/\bRDO\b/i, /\bdi[aá]rio[\s_-]?obra\b/i],
  },
  {
    id: "armacao-concreto",
    label: "Controle Armação e Concreto",
    hint: "Planilha sob demanda",
    tooltip: "Controle físico de armação e concreto. Carga sob demanda.",
    accept: [".xlsx"],
    mimeTypes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    multiple: true,
    required: false,
    iconKey: "pkg",
    tabs: [6, 7],
    nameMatchers: [/\barma[cç][aã]o\b/i, /\bconcreto\b/i],
  },
  {
    id: "faturamento",
    label: "Controle de Faturamento",
    hint: "Histórico de compras .xlsx",
    tooltip:
      "Histórico de compras / controle de faturamento (proxy quando a fonte principal falta).",
    accept: [".xlsx"],
    mimeTypes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    multiple: true,
    required: false,
    iconKey: "cart",
    tabs: [6, 7],
    nameMatchers: [/\bfaturamento\b/i, /\bhist[oó]rico[\s_-]?compras?\b/i],
  },
] as const;

/** Mapa por id para acesso O(1). */
export const RMA_DOC_TYPE_BY_ID: Record<RmaDocTypeId, RmaDocType> = Object.fromEntries(
  RMA_DOC_TYPES.map((t) => [t.id, t]),
) as Record<RmaDocTypeId, RmaDocType>;

/** Labels PT-BR por id · usado em telas (mapeamento, extração) pra mostrar o tipo
 *  identificado pelo agente. Cobre os 8 canônicos + fallbacks. */
export const DOC_TYPE_REGISTRY_LABELS: Record<string, string> = {
  ...Object.fromEntries(RMA_DOC_TYPES.map((t) => [t.id, t.label])),
  unknown: "Não identificado",
};

/** Tenta classificar um File pelo nome. Retorna `null` se nenhum tipo casar. */
export function classifyFileByName(fileName: string): RmaDocTypeId | null {
  const extMatch = fileName.match(/\.([a-z0-9]+)$/i);
  const ext = extMatch ? `.${extMatch[1]!.toLowerCase()}` : "";
  for (const docType of RMA_DOC_TYPES) {
    const matchesExt = docType.accept.includes(ext);
    if (!matchesExt) continue;
    const matchesName = docType.nameMatchers.some((re) => re.test(fileName));
    if (matchesName) return docType.id;
  }
  return null;
}

/** Lista combinada de extensões pra atributo `accept` do <input type=file>.
 * Inclui formatos do catálogo + .csv .doc .docx .md que o usuário pode subir
 * livre (texto, planilhas alternativas, documentos formatados, anotações
 * markdown) — o agente SDK identifica o tipo depois. */
export const ALL_RMA_ACCEPT = Array.from(
  new Set([...RMA_DOC_TYPES.flatMap((t) => t.accept), ".csv", ".doc", ".docx", ".md"]),
).join(",");
