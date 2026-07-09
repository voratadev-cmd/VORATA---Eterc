// M4 · Check-list da Obra (SASBY) — hook honesto. O diagnóstico por engenharia é OUTPUT dos 8
// agentes setoriais de IA (backend · fase final), que ainda NÃO existem. Então NÃO fabricamos farol
// nem diagnóstico: mostramos a ESTRUTURA da metodologia (as 8 engenharias + o que cada agente vai
// varrer, do doc) com status "aguardando agente setorial", sobre o contexto REAL da obra (Síntese
// via useVisaoGeralView). Quando os agentes entrarem, troca-se `setores` por dado real; a UI segue.

import { useVisaoGeralView } from "./useVisaoGeralView";

export type SetorSasby = {
  slug: string;
  codigo: string;
  nome: string;
  /** O que o agente daquela engenharia varre (resumo do doc M4 · §7.2). */
  escopo: string;
  /** O que alimenta no restante da plataforma (RMA/M3), quando houver. */
  alimenta?: string;
  icon: string;
  /** 4.1 Cenário Tendente é o destaque transversal ("meteorologia" do contrato). */
  destaque?: boolean;
  /** Itens que o agente daquela engenharia vai varrer (do doc M4 · §7.2). */
  itens: string[];
};

export const SETORES_SASBY: SetorSasby[] = [
  {
    slug: "cenario-tendente",
    codigo: "4.1",
    nome: "Cenário Tendente e Relações",
    escopo:
      "Projeta para onde o contrato está caminhando — extensão de prazo provável, escalada de conflitos, deterioração de relações e risco de litígio. A “meteorologia” do contrato.",
    alimenta: "Alimenta o RMA com o cenário projetado",
    icon: "trending",
    destaque: true,
    itens: [
      "Extensão de prazo provável",
      "Escalada de conflitos com a Contratante",
      "Deterioração de relações e risco de litígio",
      "Projeção do desfecho do contrato",
    ],
  },
  {
    slug: "mobilizacao",
    codigo: "4.2",
    nome: "Mobilização, Canteiro e Desmobilização",
    escopo:
      "Estado da mobilização inicial, operação do canteiro durante a execução e plano de desmobilização — pendências de equipamentos, atrasos em recebimento, infraestrutura.",
    icon: "pkg",
    itens: [
      "Mobilização inicial e recebimento de equipamentos",
      "Operação e infraestrutura do canteiro",
      "Plano de desmobilização",
      "Pendências e atrasos de infraestrutura",
    ],
  },
  {
    slug: "orcamento",
    codigo: "4.3",
    nome: "Orçamento e Bases do Negócio",
    escopo:
      "Evolução do orçamento, formalização de TACs, ajustes de quantidades e controle do saldo contratual (reexecuta parte do M1.2 quando a obra entra após a assinatura).",
    icon: "wallet",
    itens: [
      "Evolução do orçamento e saldo contratual",
      "Formalização de TACs",
      "Ajustes de quantidades",
      "Bases do negócio (reexecuta parte do M1.2)",
    ],
  },
  {
    slug: "qualidade",
    codigo: "4.4",
    nome: "Qualidade e Segurança",
    escopo:
      "Tratamento de RNCs e conformidade documental, segurança do trabalho, meio ambiente e práticas trabalhistas/comunitárias (componente ESG).",
    icon: "shield",
    itens: [
      "Tratamento de RNCs e conformidade documental",
      "Segurança do trabalho",
      "Meio ambiente",
      "Práticas trabalhistas e comunitárias (ESG)",
    ],
  },
  {
    slug: "planejamento",
    codigo: "4.5",
    nome: "Planejamento",
    escopo:
      "Cronograma vs. realizado, desvios no caminho crítico, Windows Analysis e extensão de prazo justificável.",
    alimenta: "Alimenta o M3 com a base temporal do desequilíbrio",
    icon: "clock",
    itens: [
      "Cronograma vs. realizado",
      "Desvios no caminho crítico",
      "Windows Analysis (cronograma impactado)",
      "Extensão de prazo justificável",
    ],
  },
  {
    slug: "medicao",
    codigo: "4.6",
    nome: "Medição",
    escopo:
      "Boletins de medição, glosas indevidas, medido × contratado por item, preços novos e sugestão de impugnações.",
    alimenta: "Conecta ao Faturamento e ao M3 (glosas)",
    icon: "doc",
    itens: [
      "Boletins de medição (BMs)",
      "Glosas indevidas",
      "Medido × contratado por item",
      "Preços novos e sugestão de impugnações",
    ],
  },
  {
    slug: "engenharia",
    codigo: "4.7",
    nome: "Engenharia (Projetos)",
    escopo:
      "Lista mestra de projetos (recebimento/revisões), take-off automatizado, serviços extra-escopo → pedidos de preço novo, e impacto de revisões.",
    alimenta: "Alimenta o Take-off e o Mapa Retigráfico",
    icon: "note",
    itens: [
      "Lista mestra de projetos (recebimento e revisões)",
      "Take-off automatizado",
      "Serviços extra-escopo → pedido de preço novo",
      "Impacto de revisões de projeto",
    ],
  },
  {
    slug: "producao",
    codigo: "4.8",
    nome: "Processo de Produção",
    escopo:
      "Controle de produção real — MOD/MOI/EQP, produtividade, frentes de serviço e RDO. Fonte primária dos dados de execução.",
    alimenta: "Alimenta o RMA mensal e o Painel de Desequilíbrio",
    icon: "users",
    itens: [
      "MOD / MOI / EQP e produtividade",
      "Frentes de serviço",
      "RDO (diário de obra)",
      "Controle de produção real",
    ],
  },
];

export type ChecklistView = ReturnType<typeof useVisaoGeralView>["data"];

/** Contexto REAL da obra (Síntese) + as 8 engenharias da metodologia (pendentes de agente). */
export function useChecklist(contractId: string) {
  const vg = useVisaoGeralView(contractId);
  return {
    isLoading: vg.isLoading,
    isError: vg.isError,
    data: vg.data ?? null,
    setores: SETORES_SASBY,
  };
}
