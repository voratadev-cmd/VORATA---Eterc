// Schemas Zod do cadastro de obra. Fonte da verdade dos tipos do form e
// validação. Tipos derivados via `z.infer`. Mensagens em PT-BR.

import { z } from "zod";

/** 27 UFs brasileiras (26 estados + DF). */
export const UF_VALUES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;
export type UF = (typeof UF_VALUES)[number];

export const MODALIDADE_VALUES = [
  "empreitada-global",
  "contratacao-integrada",
  "empreitada-integral",
  "administracao",
  "outra",
] as const;
export type Modalidade = (typeof MODALIDADE_VALUES)[number];

export const MODALIDADE_LABEL: Record<Modalidade, string> = {
  "empreitada-global": "Empreitada Global",
  "contratacao-integrada": "Contratação Integrada",
  "empreitada-integral": "Empreitada Integral",
  administracao: "Administração",
  outra: "Outra",
};

export const INDICE_REAJUSTE_VALUES = ["ipca", "incc", "igp-m", "sinapi", "icc", "outro"] as const;
export type IndiceReajuste = (typeof INDICE_REAJUSTE_VALUES)[number];

export const INDICE_REAJUSTE_LABEL: Record<IndiceReajuste, string> = {
  ipca: "IPCA",
  incc: "INCC",
  "igp-m": "IGP-M",
  sinapi: "SINAPI",
  icc: "ICC",
  outro: "Outro",
};

export const PERIODICIDADE_VALUES = ["anual", "semestral", "unico"] as const;
export type Periodicidade = (typeof PERIODICIDADE_VALUES)[number];

export const PERIODICIDADE_LABEL: Record<Periodicidade, string> = {
  anual: "Anual",
  semestral: "Semestral",
  unico: "Único",
};

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
  .optional()
  .or(z.literal(""));

/**
 * Schema do cadastro de obra · APENAS `nomeInterno` é obrigatório.
 * Os demais campos são opcionais e podem ser preenchidos posteriormente
 * — a maioria das informações virá da extração dos documentos pelo pipeline.
 * Validações de formato (datas, valor) só disparam se o campo for preenchido.
 */
export const ContractIdentificationSchema = z
  .object({
    nomeInterno: z
      .string()
      .trim()
      .min(2, "Informe um apelido com pelo menos 2 caracteres")
      .max(80, "Máximo de 80 caracteres"),
    objetoContratado: z
      .string()
      .trim()
      .max(500, "Máximo de 500 caracteres")
      .optional()
      .or(z.literal("")),
    cidade: z.string().trim().max(80).optional().or(z.literal("")),
    uf: z.enum(UF_VALUES).optional().or(z.literal("")),
    contratante: z.string().trim().max(120).optional().or(z.literal("")),
    modalidade: z.enum(MODALIDADE_VALUES).optional().or(z.literal("")),
    valorContratual: z.number().nonnegative("O valor não pode ser negativo").optional(),
    dataAssinaturaISO: dateString,
    dataInicioISO: dateString,
    dataTerminoISO: dateString,
    gestorObra: z.string().trim().max(120).optional().or(z.literal("")),
    admContratual: z.string().trim().max(120).optional().or(z.literal("")),
    indiceReajuste: z.enum(INDICE_REAJUSTE_VALUES).optional().or(z.literal("")),
    periodicidadeReajuste: z.enum(PERIODICIDADE_VALUES).optional().or(z.literal("")),
    /** Mês de referência do RMA no formato YYYY-MM. Define o segmento de path no Storage. */
    mesReferenciaRMA: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Formato YYYY-MM")
      .optional()
      .or(z.literal("")),
  })
  .refine(
    (data) => {
      if (!data.dataInicioISO || !data.dataTerminoISO) return true;
      return new Date(data.dataTerminoISO).getTime() >= new Date(data.dataInicioISO).getTime();
    },
    { path: ["dataTerminoISO"], message: "Término deve ser igual ou posterior ao início" },
  );

export type ContractIdentification = z.infer<typeof ContractIdentificationSchema>;

/** Estado parcial usado durante o preenchimento (campos como strings, validação no submit). */
export type ContractDraft = {
  nomeInterno: string;
  objetoContratado: string;
  cidade: string;
  uf: UF | "";
  contratante: string;
  modalidade: Modalidade | "";
  /** Valor digitado como string (mask de moeda). Converte para number antes de validar. */
  valorContratualInput: string;
  dataAssinaturaISO: string;
  dataInicioISO: string;
  dataTerminoISO: string;
  gestorObra: string;
  admContratual: string;
  indiceReajuste: IndiceReajuste | "";
  periodicidadeReajuste: Periodicidade | "";
  mesReferenciaRMA: string;
};

export const EMPTY_CONTRACT_DRAFT: ContractDraft = {
  nomeInterno: "",
  objetoContratado: "",
  cidade: "",
  uf: "",
  contratante: "",
  modalidade: "",
  valorContratualInput: "",
  dataAssinaturaISO: "",
  dataInicioISO: "",
  dataTerminoISO: "",
  gestorObra: "",
  admContratual: "",
  indiceReajuste: "",
  periodicidadeReajuste: "",
  mesReferenciaRMA: "",
};

/** Calcula prazo total em dias a partir das datas ISO. Retorna null se faltarem dados. */
export function calcularPrazoTotal(inicioISO: string, terminoISO: string): number | null {
  if (!inicioISO || !terminoISO) return null;
  const inicio = new Date(inicioISO).getTime();
  const termino = new Date(terminoISO).getTime();
  if (isNaN(inicio) || isNaN(termino) || termino < inicio) return null;
  return Math.round((termino - inicio) / (1000 * 60 * 60 * 24));
}

/** Converte string com mask (R$ 1.234.567,89) para number. */
export function parseBRLInput(input: string): number {
  const cleaned = input.replace(/[^\d,]/g, "").replace(",", ".");
  const value = parseFloat(cleaned);
  return isNaN(value) ? 0 : value;
}
