// Tipos compartilhados pelos arquivos de cada obra.
// Cada obra real ficará em src/lib/mocks/obras/<id>.ts implementando ObraData.
//
// Princípio: deixar os campos em estruturas paralelas pra facilitar adicionar mais
// dados conforme cada módulo for sendo construído. Quando uma seção ainda não foi
// implementada, deixar `null` — a tela responsável faz o fallback pra empty state.

import type { FarolLevel } from "../contracts";

// ── Síntese do Contrato (M2.1.1) ──────────────────────────────────────

export type DataChave = {
  id: string;
  rotulo: string;
  iso: string;
  /** Status relativo à data atual fixa dos mocks (2026-05-17). */
  status: "passado" | "futuro";
};

export type DocumentoContratual = {
  id: string;
  nome: string;
  categoria:
    | "contrato"
    | "edital"
    | "projeto"
    | "planilha"
    | "cronograma"
    | "anexo"
    | "ata"
    | "carta";
  paginas?: number;
  /** Quando true, é documento formalmente assinado/protocolado. */
  assinado: boolean;
};

export type EquipeMembro = {
  id: string;
  nome: string;
  cargo: string;
  iniciais: string;
  setor?: string;
};

export type Contato = {
  id: string;
  lado: "Contratante" | "Contratada" | "Terceiro";
  nome: string;
  cargo: string;
  email?: string;
  telefone?: string;
};

export type SinteseObra = {
  contractId: string;
  /** Diagnóstico textual gerado pelo Adm Contratual IA — situação geral em 1 parágrafo. */
  diagnostico: string;
  /** Data de corte da síntese — referência das análises (2026-05-15 por padrão). */
  dataCorteISO: string;
  datasChave: DataChave[];
  documentosContratuais: DocumentoContratual[];
  equipe: EquipeMembro[];
  contatos: Contato[];
};

// ── Pré-Contrato · Revisão Documental (M1.1) ──────────────────────────

export type DocTipo =
  | "edital"
  | "contrato"
  | "projeto"
  | "planilha"
  | "procedimento"
  | "anexo"
  | "cronograma"
  | "memorial";

export type DocStatus = "processado" | "processando" | "pendente" | "erro";

export type ConcorrenciaDocument = {
  id: string;
  nome: string;
  tipo: DocTipo;
  status: DocStatus;
  paginas?: number;
};

export type AnaliseTipo =
  | "riscos-contratuais"
  | "compatibilidade-projeto-planilha"
  | "analise-tecnica-projetos"
  | "analise-procedimentos"
  | "obrigacoes-contratuais"
  | "questionamentos-contratante";

export type Analise = {
  tipo: AnaliseTipo;
  titulo: string;
  descricao: string;
  /** "pronto" pra entregáveis sem criticidade (ex.: lista de perguntas). */
  nivel: FarolLevel | "pronto";
};

export type PontoCritico = {
  id: string;
  nivel: FarolLevel;
  texto: string;
};

export type ChatSugestao = {
  id: string;
  pergunta: string;
};

export type SintesePreContrato = {
  valorEstimado: number;
  prazoPropostoDias: number;
  dataLimitePropostaISO: string;
  documentosProcessados: number;
  paginasIndexadas: number;
};

export type RevisaoDocumental = {
  contractId: string;
  pontosAtencao: {
    total: number;
    criticos: number;
    risco: number;
    observacao: number;
    conforme: number;
  };
  documentosCarregados: number;
  paginasIndexadas: number;
  analisesConcluidas: number;
  analisesTotal: number;
  /** Texto relativo, ex.: "há 4 min". */
  ultimaAnalise: string;
  documentos: ConcorrenciaDocument[];
  analises: Analise[];
  pontosCriticos: PontoCritico[];
  chatAgentQuote: string;
  chatSugestoes: ChatSugestao[];
  /** Frase em destaque no mini-chatbox do rodapé (Síntese do Contrato em Análise). */
  chatRodapeQuote: string;
  sintese: SintesePreContrato;
  /** Texto descritivo: "Fase pré-assinatura · Concorrência em andamento". */
  estadoContrato: string;
};

// ── Pré-Contrato · Bases do Negócio (M1.2) ────────────────────────────

/** Linha do comparativo de produtividades e preços vs. base referencial. */
export type ItemComparativo = {
  id: string;
  item: string;
  /** Unidade — m², m³, kg, vb, etc. */
  und: string;
  qtde: number;
  precoProposto: number;
  referencia: number;
  /** Origem da referência: "Orsafáscio" · "SINAPI/MG" · "Histórico" etc. */
  fonte: string;
  /** Desvio em % do proposto vs. referência. Negativo = subdimensionado. */
  desvioPct: number;
  farol: FarolLevel;
};

export type BDIComponente = {
  id: string;
  nome: string;
  /** Percentual sobre custo direto. */
  pct: number;
  /** Avaliação textual do agente. */
  status: string;
  /** No M1.2 a aferição é binária: OK (conforme) ou alerta (risco). */
  farol: "conforme" | "risco";
};

export type PremissaItem = {
  id: string;
  premissa: string;
  /** Valor textual (ex.: "0,42 HH/m²"). */
  valorProposto: string;
  referencia: string;
  /** Diagnóstico curto do agente. */
  analise: string;
  farol: FarolLevel;
};

export type PremissaFragilFormalizar = {
  id: string;
  titulo: string;
  /** Descrição curta da premissa + risco se não formalizada. */
  descricao: string;
};

export type BasesData = {
  contractId: string;
  /** Risco orçamentário estimado (R$) — soma do impacto financeiro das premissas frágeis. */
  riscoOrcamentarioEstimado: number;
  /** % do risco sobre o valor proposto. */
  riscoOrcamentarioPct: number;
  /** Quantidade de premissas frágeis a formalizar no Transpasse. */
  premissasFrageisCount: number;
  /** Itens com desvio: {fora} de {total} fora do intervalo aceitável. */
  itensComDesvio: { fora: number; total: number };
  /** Linhas da tabela "Comparativo de Produtividades e Preços" (ordenadas por desvio negativo). */
  comparativoPrecos: ItemComparativo[];
  /** BDI total % sobre custo direto. */
  bdiTotalPct: number;
  bdiComponentes: BDIComponente[];
  /** Frase em destaque no chat lateral (Agente Orçamento). */
  chatAgentQuote: string;
  chatSugestoes: ChatSugestao[];
  /** Linhas da tabela "Premissas da Proposta · Validação". */
  premissas: PremissaItem[];
  /** Cards do bloco amarelo "Premissas Frágeis a Formalizar no Transpasse" (até 5 visíveis). */
  premissasFrageis: PremissaFragilFormalizar[];
  /** "+ N outras premissas" — restante linkado no Diagnóstico (M1.3). */
  premissasFrageisRestantes: number;
};

// ── Pré-Contrato · Diagnóstico do Contrato (M1.3) ─────────────────────

/** Decisão final do agente sobre a viabilidade do contrato. */
export type RecomendacaoFinal = "ASSINAR" | "RENEGOCIAR" | "RECUSAR";

export type ClausulaRenegociacao = {
  id: string;
  /** Numeração contratual (ex.: "14.3", "7.2"). */
  codigo: string;
  /** Resumo curto: "Multa diária 0,5% sem teto". */
  titulo: string;
  /** Sugestão pontual do agente: "sugerir teto de 10%". */
  sugestao: string;
};

export type ModeloRecomendado = {
  id: string;
  /** Nome do ícone (chave de I[...]). */
  icon: "doc" | "note" | "tag" | "check" | "trending" | "users" | "calendar" | "wallet" | "pkg";
  titulo: string;
  descricao: string;
};

export type DiagnosticoData = {
  contractId: string;

  // Hero strip
  recomendacao: RecomendacaoFinal;
  /** Linha-resumo da recomendação (ex.: "8 cláusulas críticas · risco R$ 4,82 mi · força no mérito 3/5"). */
  recomendacaoResumo: string;
  /** Força do mérito (1-5 estrelas) — solidez da base documental + jurídica. */
  forcaNoMerito: number;
  /** Cenário médio do potencial de desequilíbrio (R$). */
  potencialDesequilibrio: number;
  /** % sobre o valor proposto. */
  potencialDesequilibrioPct: number;
  /** Texto curto sobre o cenário aplicado (ex.: "cenário médio"). */
  cenarioDescricao: string;
  /** Modelo de contrato aplicado (ex.: "Empreitada · Obra Pública"). */
  modeloAplicado: string;
  /** Número de templates disponíveis no banco. */
  templatesDisponiveis: number;

  // Meta bar
  geradoEmISO: string;
  versao: number;
  /** Descrição do modelo + status: "Empreitada Global · Obra Pública · pronto para edição e exportação". */
  modeloDescricao: string;
  paginas: number;

  // Preview do documento
  /** Texto do Resumo Executivo, com marcações em **negrito**. Renderizado com leve formatação. */
  resumoExecutivo: string;
  clausulasRenegociacao: ClausulaRenegociacao[];
  /** "+ N outras cláusulas" — restante linkado no detalhamento da Revisão. */
  clausulasRestantes: number;
  /** Texto curto sobre as premissas a formalizar (geralmente referencia o card de Bases). */
  premissasFormalizar: string;
  /** Cenários (baixo/médio/alto) de potencial desequilíbrio. */
  cenarios: {
    baixo: number;
    baixoDescricao: string;
    medio: number;
    medioDescricao: string;
    alto: number;
    altoDescricao: string;
  };
  /** Bloco final amarelo com a justificativa da recomendação. */
  recomendacaoFinal: string;

  // Coluna direita
  modelosRecomendados: ModeloRecomendado[];
  /** Frase em destaque no mini-chat dark do rodapé. */
  chatAgentQuote: string;
};

// ── Pré-Contrato · Transpasse Orçamentário (M1.4) ─────────────────────

export type StatusTranspasse = "rascunho" | "em-andamento" | "liberado";

/** Linha da tabela de riscos identificados na proposta. */
export type RiscoPlano = {
  id: string;
  risco: string;
  /** Nível de gravidade: alto=danger / medio=warning / baixo=info. */
  nivel: "alto" | "medio" | "baixo";
  /** Categoria de impacto: "Prazo / Custo", "Custo", "Prazo". */
  impacto: string;
  planoMitigacao: string;
};

/** Item do plano de ação da fase inicial (mobilização + 90 dias). */
export type AcaoFaseInicial = {
  id: string;
  ordem: number;
  titulo: string;
  descricao: string;
  /** Texto livre: "Dias 1-15". */
  prazo: string;
};

/** Documento que a Contratada deve emitir nos primeiros meses. */
export type DocumentoObrigatorio = {
  id: string;
  documento: string;
  prazo: string;
  /** "Cláusula 5.2" ou "NR-7 / NR-1". */
  referencia: string;
  status: "pendente" | "emitido" | "vencido";
};

/** Modelo pré-formatado pronto para download. */
export type ModeloPreformatado = {
  id: string;
  titulo: string;
  formato: "DOCX" | "XLSX" | "PDF";
};

/** Item do checklist de liberação. */
export type ChecklistItem = {
  id: string;
  label: string;
  status: "concluido" | "parcial" | "pendente";
  /** Texto "8/10" quando parcial. */
  progresso?: string;
};

export type TranspasseData = {
  contractId: string;
  // Hero (5 cells)
  status: StatusTranspasse;
  /** "Em andamento" · "Liberado" · "Rascunho". */
  statusLabel: string;
  /** % do checklist concluído. */
  progressoPct: number;
  contratoNumero: string;
  contratoLocalizacao: string;
  gestor: { nome: string; designadoEmISO: string };
  reuniao: { dataISO: string; horario: string; participantes: number };
  liberacaoStatus: "bloqueado" | "liberado";
  // Card 1: Resumo
  resumoContrato: {
    cliente: string;
    contrato: string;
    dataAssinaturaISO: string;
    prazoContratual: string;
    valorContratual: string;
    regime: string;
    dataBase: string;
    reajuste: string;
  };
  premissasFormalizadas: string[];
  premissasTotal: number;
  // Card 2: Riscos
  riscos: RiscoPlano[];
  // Card 3: Plano de Ação
  acoesFaseInicial: AcaoFaseInicial[];
  // Card 4: Documentos Obrigatórios
  documentosObrigatorios: DocumentoObrigatorio[];
  documentosObrigatoriosTotal: number;
  // Card 5: Modelos
  modelos: ModeloPreformatado[];
  modelosTotal: number;
  // Card 6: Checklist
  checklist: ChecklistItem[];
  // Card 7: Observações
  observacoes: string[];
};

// ── M2 · Visão Geral do Contrato (entry point, §5.3.1 expandido) ─────

/** Card de farol por bloco de análise (Faturamento, Recursos, etc.). */
export type BlocoFarol = {
  /** Valor principal (ex.: "-15,7%", "+18%", "R$ 12,4 mi"). */
  valor: string;
  nivel: FarolLevel;
  /** Linha descritiva (ex.: "Real R$ 44,1 mi · Contratado R$ 52,3 mi acum."). */
  descricao: string;
  /** Nota de rodapé pequena (ex.: "aderência no mês: 78%"). */
  nota: string;
  /** Quando true, o bloco NÃO tem farol (sem dado bruto) → a UI mostra "PENDENTE" em tom neutro,
   *  NUNCA "Observação" azul (que parece monitoramento ativo sobre área cega). pendente ≠ observação. */
  pendente?: boolean;
};

/** Evento detectado pela IA (alerta pontual). */
export type EventoIA = {
  id: string;
  nivel: FarolLevel;
  titulo: string;
  /** Linha resumida: "há 4h · Agente de Medição · sugestão de impugnação". */
  meta: string;
};

/** Atalho de entregável (linha do "Entregáveis do BM-09"). */
export type EntregavelAtalho = {
  id: string;
  label: string; // "RMA · BM-09"
  acao: string; // "Gerar" ou "Atualizar"
  descricao: string; // "consolidado mensal"
  icon: "doc" | "note" | "tag" | "check" | "calendar" | "users";
};

export type SinteseResumida = {
  cliente: string;
  modalidade: string;
  valorContratado: string; // "R$ 70.664.981"
  saldoFaturar: string; // "R$ 26.553.180"
  assinaturaISO: string;
  terminoPrevistoISO: string;
  prazoLabel: string; // "184 / 540 dias (34%)"
  reajuste: string; // "IPCA · anual"
  gestorObra: string; // "Eng. Marcos Andrade"
  admContratual: string; // "Eng. Carlos Mendonça"
  documentosIndexados: number | null; // null = não indexado ainda (mostra "—", não "0 itens")
  tacsEmNegociacao: number; // 3
};

/**
 * Snapshot mensal de um BM — campos que mudam mês a mês.
 * Usuário troca o BM ativo via 2 dropdowns (Ano + Mês) no topo da tela.
 */
export type BmSnapshot = {
  /** "BM-09". */
  numero: string;
  /** Ano calendário (2026). */
  ano: number;
  /** Mês 1-12 (5 = maio). */
  mes: number;
  /** Semana acumulada do contrato. */
  semana: number;
  dataCorteISO: string;
  desequilibrioAcumulado: number;
  desequilibrioMesAtual: number;
  desequilibrioPctValor: number;
  faturamentoPct: number;
  faturamentoContratadoPct: number;
  prazoDecorridoDias: number;
  situacao: FarolLevel;
  /** true = consolidado sem cobertura suficiente (farolGeral null) — UI não pinta farol. */
  situacaoPendente?: boolean;
  situacaoLabel: string;
  /** Texto longo do Adm Contratual IA — diagnóstico daquele BM. */
  diagnostico: string;
  blocoFaturamento: BlocoFarol;
  blocoRecursos: BlocoFarol;
  blocoProdutividade: BlocoFarol;
  blocoPrazo: BlocoFarol;
  /** 6º bloco (não existia no Geralzão original) — usado na aba Indicadores e Farol. */
  blocoInsumos: BlocoFarol;
  blocoDesequilibrio: BlocoFarol;
  ultimosEventos: EventoIA[];
  /** Frase em destaque no chat dark do rodapé. */
  chatRodapeQuote: string;

  // ── Campos da aba 5.3.1 "Indicadores e Farol" ──
  /** Contagem dos 6 blocos por nível: 3 críticos · 4 risco · 1 obs · 0 conformes. */
  blocosContagem: {
    criticos: number;
    risco: number;
    observacao: number;
    conforme: number;
  };
  /** Aderência no mês: faturado vs. previsto (78%). */
  aderenciaMesPct: number | null; // null = sem faturamento normalizado → "—", não "0%" fabricado
  /** Força no mérito (1-5 estrelas) — solidez documental + jurídica. */
  forcaNoMerito: number;
  /** Texto curto sob as estrelas (ex.: "base documental sólida"). */
  forcaNoMeritoNota: string;
  /** Ação principal recomendada pelo agente (botão da 4ª cell do hero). */
  acaoRecomendada: { titulo: string; cta: string };
  /** Horário em que o diagnóstico foi gerado (ex.: "14:32"). */
  diagnosticoHora: string;
  /** Curvas Liberação × Capacidade × Alocado (análise diferencial). */
  curvas: {
    /** C.8 não normalizado → true → UI mostra "—" (PENDENTE ≠ ZERO), nunca "0%". */
    pendente?: boolean;
    liberacaoPct: number | null;
    liberacaoNota: string;
    capacidadePct: number | null;
    capacidadeNota: string;
    alocadoPct: number | null;
    alocadoNota: string;
    /** Texto do box amarelo abaixo das 3 curvas. */
    diagnostico: string;
  };
  /** Marcos contratuais (status no BM corrente). */
  marcos: Array<{
    id: string;
    titulo: string;
    descricao: string;
    /** Label visível no badge ("CUMPRIDO", "EM RISCO", "+87d"). */
    statusLabel: string;
    statusFarol: FarolLevel;
  }>;
  /** Análise de responsabilidade dos eventos negativos do mês. */
  responsabilidade: {
    contratante: { valor: string; pct: number; eventos: number };
    contratada: { valor: string; pct: number; eventos: number };
    terceiro: { valor: string; pct: number; eventos: number };
    forcaMaior: { valor: string; pct: number; descricao: string };
  };
  /** Sugestões de prompt no chat dark da aba Indicadores. */
  chatSugestoesIndicadores: Array<{ id: string; texto: string }>;

  // ── Aba 5.3.2 "Faturamento" ──
  faturamento: FaturamentoBM;

  // ── Aba 5.3.3 "Recursos (MOD/MOI/EQP)" ──
  recursos: RecursosBM;

  // ── Aba 5.3.4 "Produtividade" ──
  produtividade: ProdutividadeBM;

  // ── Aba 5.3.5 "Prazo e Cronograma" ──
  prazo: PrazoBM;

  // ── Aba 5.3.6 "Insumos" ──
  insumos: InsumosBM;

  // ── Aba 5.3.7 "Curvas Liberação × Capacidade × Alocado" ──
  curvasAnalise: CurvasAnaliseBM;

  // ── Aba 5.3.8 "Análise de Responsabilidade" ──
  analiseResp: AnaliseRespBM;

  // ── Aba 5.3.9 "Panorama do Contrato" ──
  panorama: PanoramaBM;

  // ── Aba 5.3.10 "Condutas Sugeridas e Geração de Documentos" ──
  condutas: CondutasBM;

  // ── Aba 5.3.11 "Plano de Ação" ──
  planoAcao: PlanoAcaoBM;
};

// ── Aba 5.3.2 Faturamento (Curva S, frentes, mês-a-mês) ──────────────

export type CurvaSPonto = {
  /** Rótulo do mês do BM no eixo da curva (ex.: "mai/26"). */
  bm: string;
  /** Acumulado contratado (em milhões de R$). */
  contratado: number;
  /** Acumulado real até o BM corrente (null nos BMs futuros). */
  real: number | null;
  /** Projeção tracejada a partir do BM corrente (null nos BMs do passado). */
  projecao: number | null;
  /** Previsto do MÊS (não acumulado · barra · "Previsto Todo" C.3!C29:C74), em milhões. */
  previstoMes?: number | null;
  /** Real do MÊS (não acumulado · barra · C.3!G29:G74), em milhões. null nos meses não medidos. */
  realMes?: number | null;
};

export type FrenteServico = {
  id: string;
  nome: string;
  /** Já formatado: "R$ 2,40 mi". */
  contratadoLabel: string;
  realLabel: string;
  /** % real ÷ contratado. */
  pct: number;
  farol: FarolLevel;
};

// ── Aba 5.3.3 Recursos (MOD · MOI · EQP) ─────────────────────────────

export type RecursosTipo = "MOD" | "MOI" | "EQP";

/** Barra do comparativo mensal (BM01..BM09): contratado vs. real. */
export type RecursosBarraMensal = {
  bm: string;
  contratado: number;
  real: number;
  corrente?: boolean;
};

/** Ponto da curva acumulada (BM01..BMN): trajetória vs. previsto. */
export type RecursosCurvaAcumulada = {
  bm: string;
  contratado: number;
  real: number;
};

/** Linha da tabela "Resumo Cruzado" (6 linhas: MOD/MOI/EQP × Hh/R$). */
export type RecursosResumoLinha = {
  id: string;
  /** "MOD · Hh", "MOI · R$", etc. */
  grupo: string;
  contratadoLabel: string;
  realLabel: string;
  desvioPct: number;
  farol: FarolLevel;
};

/** Dados específicos de um grupo (MOD | MOI | EQP) — alterna via segmented. */
export type RecursosGrupo = {
  /** Label do segmented: "MOD" / "MOI" / "Equipamentos". */
  label: string;
  /** Unidade: "Hh" / "Hh" / "unid.×mês". */
  unidade: string;
  // 5 KPIs do topo
  contratadoTotalLabel: string;
  contratadoTotalNota: string;
  previstoAteBmLabel: string;
  previstoAteBmNota: string;
  realAlocadoLabel: string;
  realAlocadoNota: string;
  desvioPct: number;
  desvioFarol: FarolLevel;
  desvioNotaLabel: string;
  custoRealLabel: string;
  custoNotaLabel: string;
  // Gráficos
  barrasMensais: RecursosBarraMensal[];
  barrasObservacao: string;
  curvaAcumulada: RecursosCurvaAcumulada[];
  /** Label do último ponto (canto direito do gráfico de linha). */
  curvaUltimoRealLabel: string;
  curvaUltimoContratadoLabel: string;
};

export type RecursosBM = {
  porGrupo: Record<RecursosTipo, RecursosGrupo>;
  /** Texto do banner amarelo de análise cruzada. */
  analiseCruzada: string;
  /** Tabela à direita — 6 linhas (MOD/MOI/EQP × Hh/R$). */
  resumoCruzado: RecursosResumoLinha[];
  /** Box rosa abaixo da tabela. */
  resumoObservacao: string;
  // Chat
  chatQuote: string;
  chatSugestoes: Array<{ id: string; texto: string }>;
};

// ── Aba 5.3.4 Produtividade (HH Real × Contratado × Benchmarks) ──────

/** Valores R$/Hh do comparativo (4 barras horizontais). */
export type ComparativoHH = {
  hhReal: number;
  hhContratado: number;
  benchNacional: number;
  benchGlobal: number;
};

/** Card de indicador preliminar (3 cards entre KPIs e gráfico). */
export type IndicadorPerda = {
  pct: number;
  farol: FarolLevel;
  /** Descrição principal — texto curto explicando o que o número significa. */
  descricao: string;
  /** Nota de método — pequena, em texto-3 (ex.: "indicador preliminar · método: total cost · ver M3.5"). */
  metodoNota: string;
};

export type EvolucaoHHPonto = {
  bm: string;
  real: number;
  contratado: number;
  benchNacional: number;
};

export type FrenteHH = {
  id: string;
  nome: string;
  hhReal: number;
  hhContratado: number;
  /** Desvio % do real vs. contratado. */
  desvioPct: number;
  farol: FarolLevel;
};

export type ProdutividadeBM = {
  comparativo: ComparativoHH;
  perdaVsContratado: IndicadorPerda;
  perdaVsBenchmark: IndicadorPerda;
  quedaRecente: IndicadorPerda;
  evolucao: EvolucaoHHPonto[];
  /** Início da banda destacada "12 semanas · Measured Mile" (ex.: "BM-05"). */
  measuredMileInicio: string;
  /** Fim da banda destacada (geralmente o BM corrente). */
  measuredMileFim: string;
  /** Texto curto abaixo do gráfico de evolução. */
  evolucaoObservacao: string;
  /** Análise textual editável do Adm Contratual IA — pode conter **negrito**. */
  analiseTextual: string;
  frentes: FrenteHH[];
  /** Frase em destaque no chat dark. */
  chatQuote: string;
};

// ── Aba 5.3.5 Prazo e Cronograma ─────────────────────────────────────

/** Ponto da curva de avanço físico (eixo x = dia decorrido). */
export type AvancoFisicoPonto = {
  /** Ordinal 1-based do mês na curva (== mes_num da matriz física por frente · join robusto, não índice). */
  mesNum?: number;
  /** Dia decorrido desde o início do contrato. */
  dia: number;
  /** % acumulado contratado (Curva S). */
  contratado: number;
  /** % real até o BM corrente. null em dias futuros. */
  real: number | null;
  /** Projeção tracejada a partir do BM corrente. null em dias passados. */
  projecao: number | null;
};

/** Evento detectado no Windows Analysis (impacto de cronograma). */
export type WindowsEvento = {
  id: string;
  /** "BM-04 → BM-05". */
  janela: string;
  evento: string;
  /** Impacto em dias (sempre positivo — adiciona tempo). */
  deltaDias: number;
  responsavel: "Contratante" | "Contratada" | "Compartilhado" | "Força maior";
};

/** Marco contratual com data prevista vs. realizada (lista detalhada · 6 itens). */
export type MarcoCronograma = {
  id: string;
  /** "M3 · Conclusão da estrutura". */
  titulo: string;
  /** Texto descritivo do status: "previsto: mês 6 · 92% executado · risco no BM-10". */
  descricao: string;
  /** Label do badge: "CUMPRIDO", "EM RISCO", "ATRASADO", "+87 dias". */
  statusLabel: string;
  statusFarol: FarolLevel;
};

export type PrazoBM = {
  // 4 KPIs do topo
  prazoContratualDias: number;
  inicioISO: string;
  fimContratualISO: string;
  decorridoDias: number;
  decorridoPct: number;
  restantesDias: number;
  tendenciaTerminoISO: string;
  tendenciaFarol?: FarolLevel; // pendente → sem farol (não 'observação' fabricado)
  tendenciaNota: string;
  prorrogacaoDias: number | null;
  /** Forecast por ritmo não calculado → "— pendente" em vez de "0 dias". */
  prorrogacaoPendente?: boolean;
  prorrogacaoFarol?: FarolLevel; // pendente → sem farol (não 'observação' fabricado)
  /** Inclui ★★★★★ — força do mérito da prorrogação. */
  prorrogacaoNota: string;

  // Donut + indicadores (esquerda do card "Prazo Decorrido × Restante")
  avancoFisicoRealPct: number;
  avancoFisicoRealNota: string;
  avancoFisicoPrevistoPct: number;
  avancoFisicoPrevistoNota: string;
  /** Atraso físico acumulado em pontos percentuais (negativo). */
  atrasoFisicoPp: number;
  /** Quando true, o previsto físico está em reconciliação (baseline R0 obsoleto §4.1): a aba
   *  suaviza previsto/atraso (mostra só o real + "em reconciliação"), sem propagar número derivado
   *  de baseline quebrado. */
  fisicoEmReconciliacao?: boolean;
  /** Motivo REAL da pendência do farol físico (vem do calc) — a UI não pode afirmar causa fixa. */
  fisicoEmReconciliacaoNota?: string;
  /** Quando true, o físico REAL não foi medido (input vazio · pré-execução): a aba mostra "—/
   *  pendente" no avanço real em vez de 0,0%, e NÃO plota o ponto Real na curva (seria 0% fabricado). */
  fisicoRealPendente?: boolean;
  riscoNovoAtrasoLabel: string;
  riscoNovoAtrasoFarol?: FarolLevel; // pendente → sem farol (não 'observação' fabricado)
  riscoNovoAtrasoNota: string;
  /** Soma decorrido + restante + prorrogação (para sub do card donut). */
  totalDiasProjecao: number;

  // Curva de avanço físico (gráfico full-width)
  curva: AvancoFisicoPonto[];
  /** Lista de marcadores no gráfico (BM corrente, prazo contratual, tendência). */
  curvaMarcadores: Array<{ dia: number; label: string; cor: "brand" | "danger" | "neutro" }>;

  // Marcos contratuais
  marcosCronograma: MarcoCronograma[];
  marcosResumo: string;

  // Windows Analysis · Caminho Crítico
  windowsEventos: WindowsEvento[];
  /** null = matriz de eventos não normalizada (não cravar "+0 dias" em vermelho). */
  windowsTotalDias: number | null;
  /** Texto da caixa rosa abaixo da tabela. */
  windowsObservacao: string;

  // Chat
  chatQuote: string;
};

// ── Aba 5.3.6 Insumos ────────────────────────────────────────────────

/** Ponto da curva de evolução dos índices (base 100 = assinatura). */
export type IndicePonto = {
  /** "mai/25", "jul/25", ... */
  periodo: string;
  ipca: number;
  incc: number;
  sinapi: number;
  cimento: number;
  aco: number;
};

/** Linha da tabela "Insumos Relevantes". */
export type InsumoLinha = {
  id: string;
  insumo: string;
  unidade: string;
  /** Quantidade comprada acumulada. */
  qtdeComprada: string;
  /** Preço orçado + IPCA contratual (premissa reajustada). */
  precoOrcadoLabel: string;
  /** Preço real médio efetivamente pago. */
  precoRealLabel: string;
  variacaoPct: number;
  /** Impacto financeiro acumulado em R$. */
  deltaRsLabel: string;
  farol: FarolLevel;
};

export type InsumosBM = {
  // 4 KPIs do topo
  insumosMonitorados: number;
  insumosMonitoradosNota: string;
  indiceContratualLabel: string;
  indiceContratualNota: string;
  desvioMedioPp: number;
  desvioMedioFarol: FarolLevel;
  desvioMedioNota: string;
  desequilibrioParametricoLabel: string;
  desequilibrioFarol: FarolLevel;
  desequilibrioNota: string;

  // Gráfico de evolução dos índices
  evolucaoIndices: IndicePonto[];
  /** Variações finais (no BM corrente) — mostradas como labels à direita. */
  variacaoFinal: {
    ipca: number;
    incc: number;
    sinapi: number;
    cimento: number;
    aco: number;
  };
  /** Label do BM corrente exibido no canto direito do gráfico (ex.: "BM09"). */
  evolucaoBmLabel: string;
  /** Texto do banner amarelo abaixo do gráfico. */
  gapTexto: string;

  // Tabela de insumos
  insumosRelevantes: InsumoLinha[];
  /** Total acumulado de desequilíbrio paramétrico (footer da tabela). */
  desequilibrioAcumuladoLabel: string;

  // Análise textual + fórmula paramétrica
  analiseTextual: string;
  formulaTexto: string;
  formulaNota: string;

  // Chat
  chatQuote: string;
};

// ── Aba 5.3.7 Curvas Liberação × Capacidade Produtiva × Alocado ──────

/** Tipo do gargalo identificado pela análise diferencial. */
export type GargaloTipo = "contratante" | "contratada" | "compartilhado" | "ok";

/** Ponto da evolução BM a BM das 3 curvas. */
export type CurvasEvolucaoPonto = {
  bm: string;
  liberacao: number;
  capacidade: number;
  alocado: number;
};

/** Linha da tabela "Análise por Frente". */
export type CurvasFrente = {
  id: string;
  nome: string;
  liberadoPct: number;
  capacidadePct: number;
  alocadoPct: number;
  /** Diagnóstico curto: "sem gargalo", "Contratante · projetos", "leve · interno", etc. */
  gargaloLabel: string;
  farol: FarolLevel;
};

/** Documento que sustenta o pleito de ociosidade indireta. */
export type CurvasDocumento = {
  id: string;
  tipo: "carta" | "ata" | "rdo" | "lista";
  titulo: string;
  /** "de 15/09/2025" ou "reunião 12/02/2026". Opcional pra lista mestra. */
  meta?: string;
  descricao: string;
};

export type CurvasAnaliseBM = {
  // 3 KPIs do topo
  liberacaoPct: number;
  liberacaoNota: string;
  liberacaoFarol: FarolLevel;
  capacidadePct: number;
  capacidadeNota: string;
  capacidadeFarol: FarolLevel;
  alocadoPct: number;
  alocadoNota: string;
  alocadoFarol: FarolLevel;

  // Diagnóstico
  gargaloTipo: GargaloTipo;
  /** Título do banner: "GARGALO IDENTIFICADO NA CONTRATANTE". */
  diagnosticoTitulo: string;
  /** Texto principal do diagnóstico (com **negrito**). */
  diagnosticoTexto: string;
  /** Parágrafo "Hipótese alternativa descartada: ...". Opcional. */
  hipoteseAlternativa?: string;

  // Evolução BM a BM (gráfico de linhas + banda do gap)
  evolucao: CurvasEvolucaoPonto[];

  // Análise por frente
  frentes: CurvasFrente[];
  /** Texto do box rosa abaixo da tabela. */
  frentesObservacao: string;

  // Documentos de sustentação
  documentos: CurvasDocumento[];

  // Chat
  chatQuote: string;
  chatSugestoes: Array<{ id: string; texto: string }>;
};

// ── Aba 5.3.8 Análise de Responsabilidade ────────────────────────────

/** Responsável por um evento negativo. */
export type ResponsavelTipo = "contratante" | "contratada" | "terceiro" | "forcaMaior";

/** Linha da matriz de eventos. */
export type RespEvento = {
  id: string;
  evento: string;
  /** Data textual: "15/09/25", "jan/26", "04/08/25". */
  dataLabel: string;
  /** Valor formatado: "R$ 3.420k", "R$ 1,84 mi". */
  impactoLabel: string;
  responsavel: ResponsavelTipo;
  /** Quantidade de documentos probatórios. */
  docs: number;
};

/** Categoria de impacto na quantificação por tipo. */
export type RespTipoImpacto = {
  id: string;
  /** "Perda de produtividade", "Indireto improdutivo", etc. */
  categoria: string;
  /** Descrição curta: "descontinuidade de frentes · retrabalho". */
  descricao: string;
  valorLabel: string;
  /** Cor de destaque (segue o farol pra coerência visual). */
  farol: FarolLevel;
};

export type AnaliseRespBM = {
  // 4 KPIs do topo
  contratante: { valorLabel: string; pct: number; eventos: number; nota: string };
  contratada: { valorLabel: string; pct: number; eventos: number; nota: string };
  terceiro: { valorLabel: string; pct: number; eventos: number; nota: string };
  forcaMaior: { valorLabel: string; pct: number; eventos: number; nota: string };

  /** Texto da caixa rosa abaixo da barra empilhada. */
  distribuicaoObs: string;

  // Matriz de eventos
  eventos: RespEvento[];
  /** Total de eventos identificados no período (>= eventos.length). */
  eventosTotal: number;
  /** Quantidade de eventos menores não listados. */
  eventosMenoresRestantes: number;

  /** Texto da "Interpretação ADM Contratual IA" — parágrafos separados por \n\n, **negrito**. */
  interpretacao: string;

  // Quantificação por tipo de impacto
  tiposImpacto: RespTipoImpacto[];
  totalConsolidadoLabel: string;

  // Chat
  chatQuote: string;
};

// ── Aba 5.3.9 Panorama do Contrato ───────────────────────────────────

/** Card consolidado de um aspecto (técnico/econômico/físico). */
export type PanoramaAspecto = {
  /** Title em UPPERCASE (ex.: "ASPECTO TÉCNICO"). */
  titulo: string;
  farol: FarolLevel;
  /** Label do farol em UPPERCASE: "RISCO", "CRÍTICO", "OBSERVAÇÃO", "CONFORME". */
  farolLabel: string;
  /** Texto principal (parágrafo único, pode conter **negrito**). */
  texto: string;
  /** Próxima ação recomendada (ex.: "cobrança formal projetos atrasados"). */
  proximaAcao: string;
};

/** KPI pequeno do "Aspecto Técnico · Detalhamento". */
export type PanoramaSubKpi = {
  id: string;
  /** Label em UPPERCASE (ex.: "PROJETOS"). */
  label: string;
  valor: string;
  nota: string;
  farol: FarolLevel;
};

export type ImpactoCategoria = "prazo" | "custo" | "qualidade" | "seguranca" | "escopo";
/** null = sem impacto na categoria (renderiza "—"). */
export type ImpactoNivel = FarolLevel | null;

/** Linha da matriz de impactos · 1 evento × 5 categorias. */
export type MatrizImpactoLinha = {
  id: string;
  evento: string;
  prazo: ImpactoNivel;
  custo: ImpactoNivel;
  qualidade: ImpactoNivel;
  seguranca: ImpactoNivel;
  escopo: ImpactoNivel;
};

/** Linha da matriz de nexo causal · 1 evento-chave. */
export type NexoCausalLinha = {
  id: string;
  fato: string;
  /** Lista textual de documentos (com bullets · separados por · ou \n). */
  documentos: string;
  embasamento: string;
  hipotese: string;
  quantifLabel: string;
  /** Força no mérito 1-5 (renderiza ★★★★★). */
  forcaMerito: number;
};

export type PanoramaBM = {
  aspectoTecnico: PanoramaAspecto;
  aspectoEconomico: PanoramaAspecto;
  aspectoFisico: PanoramaAspecto;
  /** 4 sub-KPIs do detalhamento técnico (Projetos · RDOs · RNCs · Segurança). */
  tecnicoSubKpis: PanoramaSubKpi[];
  /** Linhas da Matriz de Impactos (ordenadas por relevância). */
  matrizImpactos: MatrizImpactoLinha[];
  /** Linhas da Matriz de Nexo Causal (5 eventos-chave). */
  nexoCausal: NexoCausalLinha[];
  /** Texto da faixa inferior — "Adm Contratual IA: estes N eventos somam ...". */
  nexoResumo: string;
};

// ── Aba 5.3.10 Condutas Sugeridas e Geração de Documentos ────────────

/** Sugestão de conduta gerada pela IA — 1 clique vira documento. */
export type Conduta = {
  id: string;
  /** Farol que indica prioridade: critico=urgente, risco=importante,
   * observacao=monitoramento, conforme=baixa. */
  prioridade: FarolLevel;
  titulo: string;
  /** Linha de descrição/contexto curta (pode conter **negrito**). */
  descricao: string;
  /** Label do botão de ação: "Gerar carta", "Executar", "Gerar PPN",
   * "Gerar análise", "Ver", "Gerar". */
  acaoLabel: string;
  /** Tag UPPERCASE adicional (ex.: "URGENTE") — opcional. */
  badgeUrgente?: boolean;
};

/** Ícone usado no header da categoria (chave de I[...]). */
export type CondutaCategoriaIcon = "note" | "pkg" | "doc" | "users" | "check" | "edit";

/** Agrupamento de condutas por categoria. */
export type CondutaCategoria = {
  id: string;
  iconKey: CondutaCategoriaIcon;
  /** "Cartas e Notificações Formais". */
  titulo: string;
  /** Sub-texto curto sob o título. */
  sub: string;
  itens: Conduta[];
};

/** Tipo de documento gerado (define o badge no histórico). */
export type DocTipoTag = "CARTA" | "ATA" | "PARECER" | "PPN" | "TAKE-OFF" | "MEMORANDO";

/** Documento gerado no mês corrente. */
export type DocGerado = {
  id: string;
  /** "13/05". */
  data: string;
  documento: string;
  tipo: DocTipoTag;
};

export type CondutasBM = {
  // 3 KPIs informativos + 1 card de ação
  totalAcoes: number;
  totalAcoesNota: string;
  prioridadesLabel: string;
  prioridadesNota: string;
  docsGerados: number;
  docsGeradosNota: string;
  /** Texto do card vermelho de "GERAR EM LOTE". */
  loteLabel: string;
  loteAcoes: number;

  /** Texto do banner amarelo "PRIORIDADES DESTA SEMANA" (com **negrito**). */
  prioridadesTexto: string;

  /** Categorias de condutas (cada uma com 0+ itens). */
  categorias: CondutaCategoria[];

  // Documentos gerados no mês
  documentosGerados: DocGerado[];
  /** Total no acervo da Biblioteca (link "Ver na Biblioteca"). */
  totalNaBiblioteca: number;

  // Chat dark
  chatQuote: string;
  chatSugestoes: Array<{ id: string; texto: string }>;
};

// ── Aba 5.3.11 Plano de Ação ─────────────────────────────────────────

/** Status de uma linha do plano. */
export type AcaoStatus = "concluida" | "em-andamento" | "pendente" | "atrasada";

/** Linha do Plano de Ação · modelo 5W2H simplificado. */
export type AcaoLinha = {
  /** "A-42", "A-41" ... */
  id: string;
  /** O QUE (ação). */
  acao: string;
  /** POR QUE (justificativa). */
  justificativa: string;
  /** QUEM (responsável). */
  responsavel: string;
  /** QUANDO (prazo DD/MM/YYYY). */
  quando: string;
  /** ONDE (canal/sistema): "Carta formal", "Plataforma", "Módulo 3", etc. */
  onde: string;
  /** ESFORÇO estimado ("4h", "1d", "2h"). */
  esforco: string;
  status: AcaoStatus;
  /** Origem da ação · filtro (ex.: "Faturamento", "Prazo", "Reunião 30/05"). */
  origem: string;
  /** Pré-marcado pra filtro "Esta semana" (na semana do data corte do BM). */
  estaSemana?: boolean;
};

export type PlanoAcaoBM = {
  // 6 KPIs do topo
  totalAcoes: number;
  totalAcoesNota: string;
  concluidasN: number;
  concluidasNota: string;
  emAndamentoN: number;
  emAndamentoNota: string;
  pendentesN: number;
  pendentesNota: string;
  atrasadasN: number;
  atrasadasNota: string;
  slaDiasMedio: number;
  slaNota: string;

  // Progresso (linha + legenda)
  /** % concluído (default = concluidasN / totalAcoes). */
  progressoPct: number;
  /** Texto do subtítulo: "18 concluídas · 14 em andamento · 7 pendentes · 3 atrasadas". */
  progressoNota: string;

  // Filtros · valores únicos extraídos das ações
  responsaveis: string[];
  origens: string[];

  // Linhas (as visíveis na tela — completas geralmente vão para a aba de Histórico)
  linhas: AcaoLinha[];
  /** Total de ações anteriores não exibidas ("+ N ações anteriores · ver histórico"). */
  acoesAnteriores: number;

  // Chat ink (mesmo padrão da tela de Condutas) · opcional · default no View
  chatQuote?: string;
  chatSugestoes?: Array<{ id: string; texto: string }>;
};

// ── M3 Painel de Desequilíbrio · Visão Geral (§6) ────────────────────

/** Categoria de composição do desequilíbrio acumulado. */
export type DesequilibrioCategoria = {
  id: string;
  /** "Perda de Produtividade", "BDI", etc. */
  nome: string;
  /** Texto subtítulo abaixo do nome (métodos / cláusulas / referência). */
  subtitulo: string;
  /** Valor em R$ (number). Será formatado na tela. */
  valor: number;
  /** Cor da barra (segue o farol para consistência visual). */
  farol: FarolLevel;
};

/** Status de cada sub-cenário do M3. */
export type CenarioStatus = "concluido" | "em-andamento" | "pendente" | "nao-aplicavel";

/** Card de cada cenário/método de cálculo (3.1, 3.2, ...). */
export type DesequilibrioCenario = {
  id: string;
  /** "3.1", "3.2 · 3.3". */
  numero: string;
  titulo: string;
  descricao: string;
  /** "R$ 5.628.000" ou "—" quando não calculado. */
  valorLabel: string;
  status: CenarioStatus;
  /** Slug da sub-rota (`/contracts/$id/desequilibrio/{routeKey}`). */
  routeKey: string;
  /** Observação opcional ("3 cenários disponíveis"). */
  observacao?: string;
};

export type DesequilibrioOverview = {
  // Hero strip (4 cells dark)
  totalLabel: string;
  totalMesAtualLabel: string;
  totalPctValorContratual: string;
  prorrogacaoDias: number;
  prorrogacaoNota: string;
  forcaMerito: number;
  forcaMeritoNota: string;
  proximoPassoLabel: string;
  proximoPassoCta: string;

  // Composição
  composicao: DesequilibrioCategoria[];
  composicaoNota: string;

  // Cenários (cards à direita)
  cenarios: DesequilibrioCenario[];

  // Gerador de Claim Consolidado (3.10)
  dossie: {
    rdos: number;
    atas: number;
    cartas: number;
    nexoCausalOk: boolean;
    matrizGerada: string;
  };
  fundamentacao: Array<{ id: string; texto: string; ok: boolean }>;
  quantificacao: Array<{ id: string; texto: string; ok: boolean }>;
  geracaoDocumento: Array<{ id: string; texto: string }>;
  /** Total consolidado label exibido no card de quantificação. */
  consolidadoLabel: string;
  /** Quando true, mostra empty state ("sem desequilíbrio detectado"). */
  semDesequilibrio?: boolean;
};

export type DesequilibrioData = {
  overview: DesequilibrioOverview;
  /** 3.1 Análise de Indiretos · null quando não aplicável. */
  indiretos: IndiretosData | null;
  /** 3.2 Análise de BDI · null quando não aplicável. */
  bdi: BDIAnaliseData | null;
  /** 3.3 Análise de Encargos Sociais · null quando não aplicável. */
  encargos: EncargosData | null;
  /** 3.4 Análise por Valor Agregado (CPU) · null quando não aplicável. */
  valorAgregado: ValorAgregadoData | null;
  /** 3.7 Análise de Preço de Insumos · null quando não aplicável. */
  insumos: InsumosPrecoData | null;
  /** 3.8 Análises Pontuais · null quando não aplicável. */
  pontuais: PontuaisData | null;
  /** 3.10 Gerador de Claim Consolidado · null quando não há claim a montar. */
  geradorClaim: ClaimGeradorData | null;
};

// ── M3.10 · Gerador de Claim Consolidado ─────────────────────────────

export type ClaimEtapaStatus = "concluida" | "em-andamento" | "pendente";

export type ClaimDocumentoIconKey = "doc" | "note" | "edit" | "share" | "tag" | "pkg";

export type ClaimDocumentoGrupo = {
  id: string;
  iconKey: ClaimDocumentoIconKey;
  label: string;
  quantidade: number;
  statusLabel: string;
};

export type ClaimNexoLinha = {
  id: string;
  evento: string;
  documentos: number;
  causaLabel: string;
  impactoLabel: string;
  farol: FarolLevel;
};

export type ClaimDossieData = {
  totalDocumentos: number;
  totalDocumentosNota: string;
  indexadosPct: number;
  indexadosNota: string;
  grupos: ClaimDocumentoGrupo[];
  matrizSubtitulo: string;
  matriz: ClaimNexoLinha[];
};

export type ClaimClausula = {
  id: string;
  numero: string;
  titulo: string;
  trecho: string;
  aplicavel: boolean;
};

export type ClaimReferenciaTipo = "doutrina" | "jurisprudencia" | "norma" | "precedente";

export type ClaimReferencia = {
  id: string;
  tipo: ClaimReferenciaTipo;
  titulo: string;
  fonte: string;
  resumo: string;
};

export type ClaimFundamentacaoData = {
  clausulasSubtitulo: string;
  clausulas: ClaimClausula[];
  referenciasSubtitulo: string;
  referencias: ClaimReferencia[];
  fontesConsultadasLabel: string;
};

export type ClaimMetodoLinha = {
  id: string;
  codigo: string;
  titulo: string;
  metodo: string;
  valorLabel: string;
  pesoPct: number;
};

export type ClaimCenario = {
  id: "alto" | "medio" | "baixo";
  label: string;
  valorLabel: string;
  descricao: string;
  recomendado?: boolean;
};

export type ClaimQuantificacaoData = {
  metodosSubtitulo: string;
  metodos: ClaimMetodoLinha[];
  totalConsolidadoLabel: string;
  totalConsolidadoNota: string;
  cenariosSubtitulo: string;
  cenarios: ClaimCenario[];
};

export type ClaimDocConfig = {
  id: string;
  label: string;
  paginasLabel: string;
  incluir: boolean;
};

export type ClaimDocumentoData = {
  formatoLabel: string;
  templateLabel: string;
  paginasEstimadas: number;
  anexosCount: number;
  config: ClaimDocConfig[];
  /** Estrutura do índice (rótulos das seções do .docx). */
  estruturaDocumento: string[];
  notaTemplate: string;
};

export type ClaimGeradorData = {
  // Header strip
  destinatario: string;
  contratoCodigoLabel: string;
  totalPleitoLabel: string;
  totalPleitoNota: string;
  prazoLabel: string;
  prazoNota: string;
  documentosCount: number;
  documentosNota: string;

  // Estado das 4 etapas
  etapasStatus: [ClaimEtapaStatus, ClaimEtapaStatus, ClaimEtapaStatus, ClaimEtapaStatus];

  // Conteúdo de cada etapa
  dossie: ClaimDossieData;
  fundamentacao: ClaimFundamentacaoData;
  quantificacao: ClaimQuantificacaoData;
  documento: ClaimDocumentoData;
};

// ── M3.8 · Análises Pontuais ─────────────────────────────────────────

export type ChuvaMes = {
  mes: string;
  historico: number;
  real: number;
};

export type ChuvaExcessoLinha = {
  id: string;
  mes: string;
  historicoDias: string;
  realDias: string;
  excessoLabel: string;
  excessoFarol: FarolLevel;
  recursosLabel: string;
  impactoLabel: string;
};

export type OciosidadeEvento = {
  id: string;
  dataLabel: string;
  titulo: string;
  duracaoLabel: string;
  recursosLabel: string;
  impactoLabel: string;
  /** Texto opcional adicional (ex.: "(em análise — força maior?)"). */
  observacao?: string;
  farol: FarolLevel;
};

export type PontuaisData = {
  // 5 KPIs
  impactoTotalLabel: string;
  impactoMesLabel: string;
  impactoPctTotal: string;
  diasChuvaExcepcionalLabel: string;
  diasChuvaNota: string;
  eventosOciosidade: number;
  eventosOciosidadeNota: string;
  farol: FarolLevel;
  farolLabel: string;
  farolNota: string;
  condutaTitulo: string;
  condutaCtaLabel: string;

  // Card esquerdo · Chuvas
  chuvasSubtitulo: string;
  chuvasSerie: ChuvaMes[];
  legendaHistoricoLabel: string;
  legendaRealLabel: string;
  excessoTituloSecao: string;
  excessoLinhas: ChuvaExcessoLinha[];
  subtotalChuvasExcessoLabel: string;
  subtotalChuvasImpactoLabel: string;

  // Card direito · Ociosidade
  ociosidadeSubtitulo: string;
  eventos: OciosidadeEvento[];
  outrosEventosLabel: string;
  outrosEventosValor: string;
  subtotalOciosidadeLabel: string;
  totalM38Label: string;
};

// ── M3.7 · Análise de Preço de Insumos ───────────────────────────────

export type InsumoPrecoLinha = {
  id: string;
  insumo: string;
  qtdContratualLabel: string;
  atualLabel: string;
  variacaoPctLabel: string;
  impactoLabel: string;
  farol: FarolLevel;
};

export type InsumoCriticoBarra = {
  id: string;
  insumo: string;
  contratualPct: number;
  contratualLabel: string;
  realPct: number;
  realLabel: string;
};

export type InsumosPrecoData = {
  // 5 KPIs
  desequilibrioTotalLabel: string;
  desequilibrioMesLabel: string;
  desequilibrioPctTotal: string;
  insumosMonitorados: number;
  insumosMonitoradosNota: string;
  insumosComDesvio: number;
  insumosComDesvioNota: string;
  farol: FarolLevel;
  farolLabel: string;
  farolNota: string;
  condutaTitulo: string;
  condutaCtaLabel: string;

  // Tabela esquerda
  tabelaSubtitulo: string;
  linhas: InsumoPrecoLinha[];
  outrosLabel: string;
  outrosValorLabel: string;
  totalLabel: string;
  formulaTexto: string;
  analiseTexto: string;

  // Card direito (críticos)
  criticosSubtitulo: string;
  criticos: InsumoCriticoBarra[];
  calloutTitulo: string;
  calloutValor: string;
  documentos: string[];
  ctaClaimLabel: string;
};

// ── M3.4 · Valor Agregado (CPU) ──────────────────────────────────────

export type VALinhaHighlight = "danger" | "warning";

export type VACalculoLinha = {
  id: string;
  letra: string;
  descricao: string;
  valorLabel: string;
  highlight?: VALinhaHighlight;
};

export type VABarra = {
  label: string;
  valorLabel: string;
  /** % para largura da barra (0-100). */
  pct: number;
  cor: "blue" | "red";
};

export type VASecao = {
  id: string;
  titulo: string;
  iconKey: "users" | "pkg" | "trending" | "wallet";
  calculo: VACalculoLinha[];
  perdaLinha: VACalculoLinha;
  // Visualização (barras horizontais)
  visualizacaoSub: string;
  barras: VABarra[];
  callout: {
    titulo: string;
    descricao: string;
    farol: FarolLevel;
  };
};

export type ValorAgregadoData = {
  // 5 KPIs
  perdaTotalLabel: string;
  perdaMesLabel: string;
  perdaMetodo: string;
  modRealLabel: string;
  modRealNota: string;
  modPonderadaLabel: string;
  modPonderadaNota: string;
  perdaHHLabel: string;
  perdaHHNota: string;
  farol: FarolLevel;
  farolLabel: string;
  farolNota: string;

  /** Subtítulo da seção de cálculo (com a legenda A) B) C) D=C/B etc.). */
  calculoSubtitulo: string;
  secoes: VASecao[];
  totalLabel: string;

  /** Subtítulo da seção de visualização. */
  visualizacaoSubtitulo: string;
  ctaConfrontarLabel: string;
};

// ── M3.3 · Análise de Encargos Sociais ───────────────────────────────

export type EncargoGrupo = "A" | "B" | "C";

export type EncargoLinha = {
  id: string;
  grupo: EncargoGrupo;
  descricao: string;
  contratualPct: number;
  atualPct: number;
  /** Em pontos percentuais. */
  deltaPp: number;
  farol: FarolLevel;
};

export type EncargosMemoriaLinha = {
  id: string;
  letra: string;
  descricao: string;
  valorLabel: string;
  highlight?: boolean;
};

export type EncargosData = {
  // 5 KPIs
  acumuladoLabel: string;
  acumuladoMesLabel: string;
  acumuladoPctTotal: string;
  contratualPct: number;
  contratualNota: string;
  atualPct: number;
  atualNota: string;
  farol: FarolLevel;
  farolLabel: string;
  farolNota: string;
  condutaTexto: string;
  condutaCta: string;

  // Variações por grupo
  variacoes: EncargoLinha[];
  totalContratualPct: number;
  totalAtualPct: number;
  totalDeltaPp: number;
  totalFarol: FarolLevel;

  // Análise drivers
  drivers: string[];
  /** Banner azul informativo embaixo dos drivers. */
  observacaoInfo: string;

  // Memória de cálculo
  memoria: EncargosMemoriaLinha[];
  documentosVinculados: string[];
  ctaClaimLabel: string;
};

// ── M3.2 · Análise de BDI ────────────────────────────────────────────

export type BDILinha = {
  id: string;
  item: string;
  contratualPct: number;
  realPct: number;
  /** Em pontos percentuais. */
  desvioPp: number;
  farol: FarolLevel;
};

export type BDIMemoriaLinha = {
  id: string;
  letra: string;
  descricao: string;
  valorLabel: string;
  highlight?: boolean;
};

export type BDIAnaliseData = {
  // 5 KPIs
  acumuladoLabel: string;
  acumuladoMesLabel: string;
  acumuladoPctTotal: string;
  bdiContratualPct: number;
  bdiContratualNota: string;
  bdiRealPct: number;
  bdiRealNota: string;
  farol: FarolLevel;
  farolLabel: string;
  farolNota: string;
  condutaTexto: string;
  condutaCta: string;

  // Composição BDI
  composicao: BDILinha[];
  composicaoTotalContratual: number;
  composicaoTotalReal: number;
  composicaoTotalDesvio: number;
  composicaoTotalFarol: FarolLevel;

  // Drivers e atenção
  drivers: string[];
  atencao: string;

  // Memória de cálculo
  memoria: BDIMemoriaLinha[];

  // Fundamentação
  fundamentacao: string[];
  ctaClaimLabel: string;
};

// ── M3.1 · Análise de Indiretos ──────────────────────────────────────

export type IndiretoComposicaoLinha = {
  id: string;
  item: string;
  rsMes: number;
  rsDia: number;
  pesoPct: number;
};

export type IndiretosMemoriaLinha = {
  id: string;
  letra: string; // "A", "B", "C", "D"
  descricao: string;
  valorLabel: string;
  highlight?: boolean; // marca a linha TOTAL
  observacao?: string;
};

export type IndiretosEvolucaoPonto = {
  bm: string;
  valor: number; // em R$
};

export type IndiretosData = {
  // 4 KPIs do topo
  acumuladoLabel: string;
  acumuladoMesLabel: string;
  acumuladoPctTotal: string;
  extensaoDias: number;
  extensaoNota: string;
  custoMensalLabel: string;
  custoMensalNota: string;
  farol: FarolLevel;
  farolLabel: string;
  farolNota: string;
  proximoPassoTexto: string;
  proximoPassoCta: string;

  // Composição da Adm Local
  composicao: IndiretoComposicaoLinha[];
  composicaoTotalRsMes: number;
  composicaoTotalRsDia: number;
  composicaoFonte: string;

  // Memória de cálculo
  memoria: IndiretosMemoriaLinha[];
  memoriaObservacao: string;

  // Evolução mensal
  evolucao: IndiretosEvolucaoPonto[];
  evolucaoNota: string;
  /** Label do último ponto exibido à direita do gráfico ("R$ 3,1 mi"). */
  evolucaoUltimoLabel: string;
};

// ── Biblioteca de Documentos (§5.7) ───────────────────────────────────

export type DocBibTipo =
  | "rdo"
  | "ata"
  | "carta"
  | "boletim"
  | "projeto"
  | "cronograma"
  | "memorando"
  | "rnc"
  | "ppn"
  | "sit"
  | "tac"
  | "parecer"
  | "foto";

export type DocBibStatus = "vinculada" | "arquivo" | "rascunho-ia" | "urgente" | "publicada";

export type DocBibSetor =
  | "mobilizacao"
  | "engenharia"
  | "planejamento"
  | "medicao"
  | "producao"
  | "qualidade-seguranca";

export type DocumentoBiblioteca = {
  id: string;
  /** "CON-042/2025", "RDO-1389". */
  codigo: string;
  tipo: DocBibTipo;
  status: DocBibStatus;
  /** Tag opcional acima do título (ex.: "Cobrança formal · projeto executivo P-23 cobertura"). */
  descricao: string;
  /** Data ISO YYYY-MM-DD. */
  dataISO: string;
  paginas: number;
  autor: string;
  destinatario?: string;
  setor: DocBibSetor;
  /** Pleito vinculado (M3). */
  pleitoId?: string;
  pleitoDocsNoDossie?: number;
  /** Força probatória 1-5. */
  forcaProbatoria?: number;
  /** Quando true, doc foi gerado pela IA. */
  geradoIA?: boolean;
};

export type BibFavorito = {
  id: string;
  label: string;
};

export type BibliotecaData = {
  // 5 KPIs do topo
  totalDocumentos: number;
  totalDocumentosNota: string;
  totalPaginasOCR: number;
  paginasOCRNota: string;
  ultimaAtualizacaoLabel: string;
  ultimaAtualizacaoNota: string;
  geradosPelaIA: number;
  geradosPelaIAPct: number;
  geradosPelaIANota: string;
  vinculadosAPleito: number;
  vinculadosNota: string;

  /** Lista representativa de documentos. Os contadores totais por tipo vêm
   * de `contadoresPorTipo` (totais "reais"), enquanto `documentos` contém
   * só uma amostra representativa pra paginação local. */
  documentos: DocumentoBiblioteca[];

  /** Contadores totais por tipo (mostrados nas chips/sidebar de filtros). */
  contadoresPorTipo: Record<DocBibTipo, number>;
  /** Contadores totais por setor (mostrados na sidebar). */
  contadoresPorSetor: Record<DocBibSetor, number>;
  /** Total de documentos que satisfazem cada tipo nos `documentos[]`. */
  documentosListadosPorTipo?: Partial<Record<DocBibTipo, number>>;

  // Favoritos / pins
  favoritos: BibFavorito[];

  // Chat (busca semântica)
  chatQuote: string;
  chatSugestoes: Array<{ id: string; texto: string }>;
};

// ── Melhorias Documentais (§5.6) ─────────────────────────────────────

/** Linha da tabela "Qualidade Documental por Tipo". */
export type QualidadeTipoLinha = {
  id: string;
  tipo: string; // "RDOs (Diário de Obra)"
  iconKey: "doc" | "note" | "calendar" | "tag" | "check" | "pkg" | "edit" | "trash";
  quantidade: number;
  completudePct: number;
  contemporaneidadePct: number;
  padronizacaoPct: number;
  indicePct: number;
  farol: FarolLevel;
  /** Quando true exibe ⚠ na célula. */
  completudeWarning?: boolean;
  contemporaneidadeWarning?: boolean;
  padronizacaoWarning?: boolean;
};

/** Item de "Gaps Críticos · Risco Direto ao Pleito". */
export type GapCritico = {
  id: string;
  numero: number; // 1, 2, 3...
  titulo: string;
  subtitulo: string; // "3 dias críticos (semana 38)" ou similar
  descricao: string;
  acaoLabel: string; // "Gerar minuta de aditamento"
};

/** Item de "Sugestões de Padronização" (1-clique aplicar). */
export type SugestaoPadronizacao = {
  id: string;
  titulo: string;
  descricao: string;
};

/** Ponto da evolução mensal da qualidade documental. */
export type QualidadeEvolucaoPonto = {
  bm: string;
  qualidadePct: number;
};

export type MelhoriasDocData = {
  // 5 KPIs
  qualidadeGeralPct: number;
  qualidadeGeralFarol: FarolLevel;
  qualidadeGeralNota: string;
  docsAnalisados: number;
  docsAnalisadosNota: string;
  gapsCriticosN: number;
  gapsCriticosNota: string;
  sugestoesAbertasN: number;
  sugestoesAbertasNota: string;
  melhoriasAplicadasN: number;
  melhoriasAplicadasNota: string;

  // Tabela qualidade por tipo
  qualidadePorTipo: QualidadeTipoLinha[];

  // Gaps críticos
  gapsCriticosLista: GapCritico[];

  // Sugestões de padronização
  sugestoesPadronizacao: SugestaoPadronizacao[];

  /** Análise textual da IA (parágrafos separados por \n\n, **negrito**). */
  analiseIA: string;

  // Evolução da qualidade (chart)
  evolucao: QualidadeEvolucaoPonto[];
  /** Benchmark IBAPE (linha tracejada no gráfico). */
  benchmarkPct: number;
  /** Caixa amarela embaixo do gráfico ("Tendência negativa: ..."). */
  evolucaoObservacao: string;
  /** Farol da observação (amarelo = warning, verde = positivo). */
  evolucaoObservacaoFarol: FarolLevel;

  // Chat
  chatQuote: string;
};

// ── Mapa / Retigráfico do Contrato (§5.5) ─────────────────────────────

export type ZonaStatus = "liberado" | "em-execucao" | "impedido" | "nao-iniciada";

/** Uma zona funcional da obra (Z1, Z2, ...) plotada na planta esquemática. */
export type ZonaMapa = {
  id: string; // "Z1", "Z5"
  nome: string; // "Acesso Principal"
  status: ZonaStatus;
  /** Área em m² (já formatada com separador BR: "2.840"). */
  areaLabel: string;
  // Posição no grid (1-based). gridColumn: `${col} / span ${colSpan}`.
  col: number;
  row: number;
  colSpan?: number;
  rowSpan?: number;
  /** Linha de status secundária exibida no card da zona ("liberado 100%", "execução 75%", "impedido 12 dias"). */
  statusLabel?: string;
  /** Pra zonas "destaque" (geralmente a grande central), mostra texto adicional do impedimento. */
  destaqueTexto?: string;
  /** Marca zona como tendo equipe ativa agora (ícone). */
  equipeAtiva?: boolean;
};

export type ImpedimentoLinha = {
  id: string;
  zonaId: string; // "Z5"
  zonaNome: string; // "Terminal de Passageiros"
  causa: string;
  tempoLabel: string; // "8 meses", "31 dias"
  responsavel: string;
  impactoLabel: string; // "R$ 3,42 mi"
};

export type ExecucaoRestritaLinha = {
  id: string;
  zonaId: string;
  zonaNome: string;
  restricao: string;
  /** "42%", "parcial", "75%" */
  pctLabel: string;
};

export type MapaData = {
  // 5 KPIs
  zonasLiberadasN: number;
  zonasLiberadasTotal: number;
  zonasLiberadasNota: string;
  emExecucaoN: number;
  emExecucaoNota: string;
  zonasImpedidasN: number;
  zonasImpedidasTotal: number;
  zonasImpedidasNota: string;
  naoIniciadasN: number;
  naoIniciadasTotal: number;
  naoIniciadasNota: string;
  areaTotalLabel: string; // "38.420 m²"
  areaTotalNota: string;
  /** Sub do header da planta ("Status colorido por zona · clique para detalhe · base: planta de implantação..."). */
  plantaNota: string;
  // Planta
  zonas: ZonaMapa[];
  /** Dimensões do grid (default 6 cols). */
  gridCols: number;
  gridRows: number;
  // Painéis direita
  impedimentos: ImpedimentoLinha[];
  execucaoRestrita: ExecucaoRestritaLinha[];
  // Chat
  chatQuote: string;
  chatSugestoes: Array<{ id: string; texto: string }>;
};

// ── Timeline do Contrato (§5.4) ──────────────────────────────────────

export type TimelineEventoTipo =
  | "bm"
  | "marco"
  | "carta"
  | "ata"
  | "impacto"
  | "projeto"
  | "medicao"
  | "pleito"
  | "rnc"
  | "tac";

export type MarcoStatus = "cumprido" | "em-risco" | "atrasado" | "futuro";

export type TimelineEvento = {
  id: string;
  /** YYYY-MM-DD. */
  dataISO: string;
  tipo: TimelineEventoTipo;
  titulo: string;
  /** Descrição longa pro card direito. */
  descricao?: string;
  responsavel?: string;
  farol: FarolLevel;
  /** Marca o evento como parte do caminho crítico (Windows Analysis). */
  caminhoCritico?: boolean;
  // Apenas pra tipo === "marco":
  marcoNumero?: string;
  marcoStatus?: MarcoStatus;
};

export type TimelineData = {
  inicioISO: string;
  fimContratualISO: string;
  hojeISO: string;
  projecaoFimISO: string;
  // 5 KPIs
  totalEventos: number;
  totalEventosNota: string;
  eventosCriticos: number;
  eventosCriticosPct: number;
  eventosCriticosNota: string;
  marcosCumpridos: number;
  marcosTotal: number;
  marcosNota: string;
  caminhoCriticoDias: number;
  caminhoCriticoNota: string;
  densidadeSemanal: number;
  densidadeNota: string;
  // Eventos (todos plotados na linha do tempo + listados na tabela)
  eventos: TimelineEvento[];
  /** ID do evento selecionado por padrão ao abrir a tela. */
  eventoSelecionadoIdDefault: string;
  // Chat
  chatQuote: string;
  chatSugestoes: Array<{ id: string; texto: string }>;
};

/** Deck "Período · BM corrente" (cards abaixo do gráfico) — derivados da curva (BMs executados).
 *  Inclui o faturado/previsto/aderência do MÊS de corte + projeção por ritmo. A "projeção" NÃO é
 *  Earned Schedule formal (não há série física) — é projeção por ritmo financeiro, rotular como tal. */
export type PeriodoFat = {
  /** Número do BM corrente (posição do corte na série). */
  bmCorrente: number;
  /** Faturado (real) no mês de corte — R$ formatado. */
  faturadoMesLabel: string;
  /** Previsto para o mês de corte — R$ formatado. */
  previstoMesLabel: string;
  /** Aderência do período (faturado ÷ previsto do mês de corte), em %. null se sem real. */
  aderenciaPeriodoPct: number | null;
  /** Ritmo médio dos últimos 3 BMs (R$/mês). */
  ritmo3BmLabel: string;
  /** Projeção de término no ritmo atual (em meses desde o início). */
  projecaoTerminoMeses: number | null;
  /** Mês-calendário do término projetado (ex.: "mar/28") — derivado do mês 1 da série. */
  projecaoTerminoMesLabel?: string | null;
  /** Δ entre projeção e prazo contratual (meses; >0 = ultrapassa o prazo). */
  deltaProjecaoMeses: number | null;
  /** Alerta de prorrogação, ou null se a projeção fecha no prazo. */
  alertaProrrogacao: string | null;
};

export type FaturamentoBM = {
  // 5 KPIs do hero
  contratadoTotalLabel: string;
  contratadoTotalNota: string;
  contratadoAcumuladoLabel: string;
  contratadoAcumuladoNota: string;
  realAcumuladoLabel: string;
  realAcumuladoNota: string;
  desvioAcumuladoPct: number | null; // null = sem curva normalizada → "—", não "0,0%" fabricado
  desvioFarol?: FarolLevel; // LEGADO/Visão Geral — na C.3 o desvio é MAGNITUDE (o farol é a aderência)
  desvioValorLabel: string;
  /** Aderência acum. (real ÷ previsto acum até o BM), em %. null = sem curva → "—". */
  aderenciaAcumuladoPct: number | null;
  /** FAROL OFICIAL da C.3 = aderência acum. (régua 90/85/70). undefined sem dado → sem farol. */
  aderenciaFarol?: FarolLevel;
  /** % do contrato total já executado (real acum ÷ contratado total). Magnitude, sem farol. */
  totalExecutadoPct: number | null;
  saldoFaturarLabel: string;
  /** null = fonte sem valor contratado total → "—" (não "0%" fabricado). */
  saldoFaturarPct: number | null;
  saldoFaturarBmsRestantes: number;
  /** Deck "Período · BM corrente" (caderno SaaS · cards D12:G19) — derivado da curva. null sem dado. */
  periodo: PeriodoFat | null;
  /** Pontos do gráfico de Curva S. */
  curvaS: CurvaSPonto[];
  /** Análise textual do Adm Contratual IA (com **negrito**). */
  analiseTextual: string;
  frentes: FrenteServico[];
  /** Texto do rodapé do card de frentes. */
  frentesObservacao: string;
  chatQuote: string;
  chatSugestoes: Array<{ id: string; texto: string }>;
};

export type VisaoGeralData = {
  contractId: string;
  /** Metadata da obra (não varia por BM). */
  contratoNumero: string;
  prazoTotalDias: number;
  terminoPrevistoISO: string;
  sinteseResumida: SinteseResumida;
  entregaveis: EntregavelAtalho[];
  /** Lista de BMs disponíveis (do mais antigo ao mais recente). */
  bms: BmSnapshot[];
  /** Número do BM corrente (último BM publicado). Default selecionado quando entra na tela. */
  bmCorrente: string;
};

// ── Documento agregador da obra ───────────────────────────────────────
// Implementado por src/lib/mocks/obras/<id>.ts. Campos null = ainda não modelado.

export type ObraData = {
  contractId: string;
  sintese: SinteseObra;
  visaoGeral: VisaoGeralData | null;
  preContrato: {
    revisao: RevisaoDocumental | null;
    bases: BasesData | null;
    diagnostico: DiagnosticoData | null;
    transpasse: TranspasseData | null;
  };
  /** RMA (M2.1.2) — placeholder até atacarmos as 11 abas. */
  rma: null;
  /** Timeline do Contrato (M2.1.3 · §5.4). */
  timeline: TimelineData | null;
  mapa: MapaData | null;
  melhoriasDoc: MelhoriasDocData | null;
  condutas: null;
  planoAcao: null;
  biblioteca: BibliotecaData | null;
  /** M3 Painel de Desequilíbrio — overview + sub-cenários (3.1-3.10). */
  desequilibrio: DesequilibrioData | null;
  /** M4 Check-list da Obra — diagnóstico setorial SASBY. */
  checklist: ChecklistObraData | null;
  /** M5 Finalização do Contrato · null para obras em curso. */
  finalizacao: FinalizacaoData | null;
  /** M-Contábil · AGM (Análise Gerencial Mensal) · null quando obra sem fechamento. */
  contabil: ContabilData | null;
  /** M2.1.8 Vistoria por Imagem · análise por visão computacional. */
  vistoriaImagem: VistoriaImagemData | null;
  /** M2.1.9 Controle Documental · 28 docs esperados em 3 fases · base do dossiê. */
  controleDocumental: ControleDocumentalData | null;
};

// ── M2.1.9 · Controle Documental ─────────────────────────────────────

export type ControleDocStatus = "completo" | "parcial" | "pendente" | "nao-aplica";

export type DocFase = {
  id: "A" | "B" | "C";
  nome: string;
  titulo: string;
  descricao: string;
  total: number;
  completos: number;
  progressoPct: number;
  itensFaltantes: string;
  /** Cor da borda lateral do card · derivada do progresso. */
  tom: "success" | "warning" | "danger";
};

export type DocAreaResponsavel = {
  id: string;
  nome: string;
  responsavel: string;
  iconKey: "wallet" | "doc" | "pkg" | "trending" | "share" | "note" | "users" | "fire" | "tag";
  completos: number;
  parciais: number;
  pendentes: number;
  ctaLabel: string;
  /** Cor da borda lateral do card · derivada do estado. */
  tom: "success" | "warning" | "danger" | "neutral";
};

export type DocEsperado = {
  id: string;
  documento: string;
  descricao: string;
  area: string;
  responsavelInicial: string;
  versaoLabel: string;
  status: ControleDocStatus;
  observacao: string;
  conferidoPor: string;
  /** Quando true, exibe linha com fundo crítico (apólice de seguro, ARTs, etc). */
  critico?: boolean;
  /** ID da fase do agrupamento ("A" / "B" / "C"). */
  fase: "A" | "B" | "C";
};

export type ControleDocumentalChatSugestao = {
  id: string;
  texto: string;
};

export type ControleDocumentalData = {
  // Header
  contratoNome: string;
  contratoCodigo: string;
  contratante: string;
  dataCorteLabel: string;
  totalDocsEsperados: number;
  completudePct: number;

  // 4 KPIs
  completudeGeralLabel: string;
  completudeNota: string;
  docsCriticosCount: number;
  docsCriticosNota: string;
  ultimaSolicLabel: string;
  ultimaSolicNota: string;
  prioridadeTitulo: string;
  prioridadeCtaLabel: string;

  // Análise textual
  analiseTitulo: string;
  analiseTexto: string;

  // 3 fases
  fases: [DocFase, DocFase, DocFase];

  // 8 áreas
  areas: DocAreaResponsavel[];

  // 28 docs (agrupados por fase)
  documentos: DocEsperado[];

  // Cabeçalhos das fases na tabela
  faseTitulos: Record<"A" | "B" | "C", string>;

  // Chat
  chatQuote: string;
  chatSugestoes: ControleDocumentalChatSugestao[];
};

// ── M2.1.8 · Vistoria por Imagem ─────────────────────────────────────

export type VistoriaSensor = "celular" | "drone" | "foto";

export type VistoriaStatus = "em-dia" | "adiantada" | "atencao" | "critica";

export type VistoriaFrente = {
  id: string;
  sensor: VistoriaSensor;
  dataHora: string;
  tom: VistoriaStatus;
  titulo: string;
  meta: string;
  avancoIaLabel: string;
  avancoPrevistoLabel: string;
  statusLabel: string;
  status: VistoriaStatus;
};

export type VistoriaSemanaComp = {
  id: string;
  label: string;
  tom: VistoriaStatus;
  resumoLabel: string;
  observacao: string;
  descricaoVisual: string;
};

export type VistoriaChatSugestao = {
  id: string;
  texto: string;
};

export type VistoriaImagemData = {
  contratoNome: string;
  frentesAtivas: number;
  ultimaAtualizacao: string;
  vistoriasMesLabel: string;
  vistoriasMesNota: string;
  avancoFisicoLabel: string;
  avancoFisicoNota: string;
  frentesDetectadasLabel: string;
  frentesDetectadasNota: string;
  proximaVistoriaTipo: string;
  proximaVistoriaCtaLabel: string;
  analiseTexto: string;
  frentes: VistoriaFrente[];
  comparativoTitulo: string;
  comparativoSubtitulo: string;
  comparativoSemanas: VistoriaSemanaComp[];
  alertaComparativoTexto: string;
  chatQuote: string;
  chatSugestoes: VistoriaChatSugestao[];
};

// ── M-Contábil · AGM (Análise Gerencial Mensal) ──────────────────────

export type ContabilFarol =
  | "conforme"
  | "atencao"
  | "risco"
  | "critico"
  | "favoravel"
  | "construcao";

export type ContabilDimensao = {
  id: string;
  titulo: string;
  farol: ContabilFarol;
  valorLabel: string;
  /** Linha de descrição (composição/breakdown). */
  descricao: string;
  /** Próxima ação sugerida pelo Agente Contábil. */
  proximaAcao: string;
  iconKey: "wallet" | "tag" | "pkg" | "trending" | "share" | "doc" | "note" | "fire";
};

export type ContabilLinhaCapitulo = {
  id: string;
  /** "1.1", "8.4" · "" pra cabeçalhos de seção. */
  codigo: string;
  capitulo: string;
  realizadoPagoLabel: string;
  realizadoApagarLabel: string;
  previstoLabel: string;
  desvioLabel: string;
  /** Quando true, a linha é um cabeçalho de seção (RECEITA BRUTA, CUSTO DA OBRA, etc.). */
  cabecalho?: boolean;
  /** Texto extra no cabeçalho (ex.: "desvio +11,4% vs previsto"). */
  cabecalhoExtra?: string;
  /** Estilo do cabeçalho · success/danger/info/neutral. */
  cabecalhoTone?: "success" | "danger" | "info" | "neutral";
  farol?: ContabilFarol;
  /** Quando string, vira badge à direita (ex.: "3 NFs faltantes"). */
  observacao?: string;
};

export type ContabilApuracao = {
  metodologiaLabel: string;
  custoRealAcumuladoLabel: string;
  custoRealNota: string;
  receitaLiquidaRealLabel: string;
  receitaLiquidaNota: string;
  resultadoRealLabel: string;
  resultadoRealFarol: "success" | "danger";
  resultadoRealNota: string;
  observacaoContabil: string;
};

export type ContabilDocumento = {
  id: string;
  titulo: string;
  origem: string;
  valorLabel: string;
  prazoLabel: string;
  /** "ok" → verde · "Nd" → cinza · "1d"/"2d"/"3d" → amarelo. */
  prazoTone: "ok" | "neutro" | "alerta";
};

export type ContabilProximaAcao = {
  id: string;
  titulo: string;
  meta: string;
  prazoLabel: string;
};

export type ContabilChatSugestao = {
  id: string;
  texto: string;
};

export type ContabilData = {
  // Header
  contratoNome: string;
  contratoCodigo: string;
  contratante: string;
  dataCorteLabel: string;
  mesExecucaoNota: string;
  mesReferencia: string;

  // 4 KPIs do hero
  valorContratoLabel: string;
  valorContratoNota: string;
  receitaBrutaLabel: string;
  receitaBrutaNota: string;
  custoRealLabel: string;
  custoRealNota: string;
  resultadoLiquidoLabel: string;
  resultadoLiquidoMargem: string;

  // 8 dimensões do Painel Multidimensional
  dimensoes: ContabilDimensao[];

  // Análise do Agente Contábil
  analiseTitulo: string;
  analiseTexto: string;
  pontosAtencao: string[];

  // Tabela detalhada por capítulo
  tabelaLinhas: ContabilLinhaCapitulo[];

  // Apuração de Prejuízo Real
  apuracao: ContabilApuracao;

  // Documentos para Upload + Próximas Ações
  documentos: ContabilDocumento[];
  documentosTotalLabel: string;
  proximasAcoes: ContabilProximaAcao[];
  proximasAcoesNota: string;

  // Chat
  chatQuote: string;
  chatSugestoes: ContabilChatSugestao[];
};

// ── M5 · Finalização do Contrato ─────────────────────────────────────

export type FinalizacaoData = {
  /** M5.1 Relatório de Lições Aprendidas · null quando ainda não encerrado. */
  licoes: LicoesData | null;
  /** M5.2 Negociação de Pleitos · null quando não há pleitos vivos. */
  negociacaoPleitos: NegociacaoPleitosData | null;
  /** M5.3 Análise Judicial / Arbitral · null quando não migrou para litígio. */
  analiseArbitral: AnaliseArbitralData | null;
};

// ── M5.3 · Análise Judicial / Arbitral ───────────────────────────────

export type AndamentoStatus = "concluido" | "em-curso" | "proximo" | "previsto";

export type AndamentoItem = {
  id: string;
  titulo: string;
  meta: string;
  status: AndamentoStatus;
  /** Texto exibido à direita do card · "em curso" / "próximo" / "previsto". */
  statusLabel?: string;
};

export type JurisprudenciaTipo = "favoravel-forte" | "favoravel" | "distinguished";

export type JurisprudenciaLinha = {
  id: string;
  fonte: string;
  ementa: string;
  relacao: string;
  relacaoTipo: JurisprudenciaTipo;
  /** 0-5 estrelas. */
  estrelas: number;
};

export type DossieStat = {
  numero: string;
  label: string;
  nota: string;
};

export type Perito = {
  id: string;
  nome: string;
  qualificacao: string;
};

export type ArbitralChatSugestao = {
  id: string;
  texto: string;
};

export type AnaliseArbitralData = {
  // Header
  procedimentoTitulo: string;
  pleitoLabel: string;
  subtitulo: string;

  // 4 KPIs strip ink
  procedimentoNumero: string;
  procedimentoNota: string;
  valorCausaLabel: string;
  valorCausaNota: string;
  proximoPrazoLabel: string;
  proximoPrazoNota: string;
  probabilidadeExitoLabel: string;
  probabilidadeCtaLabel: string;

  // Estratégia jurídica callout
  estrategiaTexto: string;

  // Dossiê
  dossieSubtitulo: string;
  dossieStats: DossieStat[];
  provasChaveTitulo: string;
  provasChave: string[];

  // Andamento
  andamentoSubtitulo: string;
  andamento: AndamentoItem[];

  // Jurisprudência
  jurisprudenciaSubtitulo: string;
  jurisprudencia: JurisprudenciaLinha[];

  // Peritos
  peritosSubtitulo: string;
  peritos: Perito[];
  quesitos: string[];

  // Chat
  chatQuote: string;
  chatSugestoes: ArbitralChatSugestao[];
};

// ── M5.2 · Negociação de Pleitos ─────────────────────────────────────

export type PleitoStatus =
  | "acordado"
  | "em-negociacao"
  | "prescricao-proxima"
  | "travado-arbitragem";

export type PleitoCard = {
  id: string;
  titulo: string;
  subtitulo: string;
  status: PleitoStatus;
  statusLabel: string;
  /** Texto curto à direita do header (ex.: "acordado em 14/04/2027"). */
  headerRightLabel: string;
  headerRightTone?: "danger";

  // 4 colunas de valores
  pretensaoOriginalLabel: string;
  contrapropCtnteLabel: string;
  contrapropDestaque?: "danger" | "muted";
  col3Label: string;
  col3ValorLabel: string;
  col4Label: string;
  col4ValorLabel: string;
  col4Destaque?: "success";

  // Rodapé · texto com possíveis trechos em negrito
  rodapeBoldPrefix?: string;
  rodapeTexto: string;
  rodapeBoldSuffix?: string;
  rodapeFarol?: "success" | "danger" | "info";
};

export type NegTimelineTipoTone = "success" | "danger" | "warning" | "info" | "neutral";

export type NegociacaoTimelineEvento = {
  id: string;
  dataLabel: string;
  evento: string;
  pleito: string;
  tipoLabel: string;
  tipoTone: NegTimelineTipoTone;
};

export type Argumentario = {
  id: string;
  fonte: string;
  resumo: string;
  pleitos: string;
};

export type NegociacaoPleitosData = {
  // 4 KPIs (ink)
  totalPleitosLabel: string;
  totalPleitosNota: string;
  valorAceitoLabel: string;
  valorAceitoNota: string;
  prescricaoProximaLabel: string;
  prescricaoProximaNota: string;
  proximaAcaoTitulo: string;
  proximaAcaoCtaLabel: string;

  // Alerta de prescrição
  alertaPrescricaoTexto: string;

  // Pleitos
  pleitosSubtitulo: string;
  pleitos: PleitoCard[];

  // Timeline
  timelineTitulo: string;
  timelineSubtitulo: string;
  timeline: NegociacaoTimelineEvento[];

  // Argumentário
  argumentarioSubtitulo: string;
  argumentario: Argumentario[];

  // Chat
  chatQuote: string;
};

export type ResultadoFinal = "EQUILIBRADO" | "DESEQUILIBRADO" | "NEUTRO";

export type LicaoItem = {
  id: string;
  numero: string;
  titulo: string;
  descricao: string;
};

export type RecomendacaoFuturo = {
  id: string;
  titulo: string;
  descricao: string;
};

export type RiscoMaterializado = {
  id: string;
  risco: string;
  /** "✓ sim · risco crítico" ou "✗ NÃO mapeado". */
  mapeadoLabel: string;
  mapeado: boolean;
  impactoLabel: string;
  mitigacaoLabel: string;
  mitigacaoFarol: FarolLevel;
};

export type PremissasResumo = {
  total: number;
  corretas: number;
  incorretas: number;
  inconclusivas: number;
  corretasPctLabel: string;
  incorretasPctLabel: string;
  inconclusivasPctLabel: string;
  /** Lista textual das premissas que se mostraram erradas. */
  premissasErradas: string[];
};

export type LicoesChatSugestao = {
  id: string;
  texto: string;
};

export type LicoesData = {
  // Header
  contratoNome: string;
  encerradoDataLabel: string;
  diasExecutados: number;
  subtituloMeta: string;

  // 4 KPIs (strip ink)
  resultadoFinal: ResultadoFinal;
  resultadoFinalLabel: string;
  resultadoFinalNota: string;
  valorFaturadoLabel: string;
  valorFaturadoNota: string;
  pleitosValorLabel: string;
  pleitosNota: string;
  baseConhecimentoLabel: string;
  baseConhecimentoCtaLabel: string;

  // Resumo executivo (callout brand)
  resumoExecutivo: string;

  // Funcionou bem
  funcionouSubtitulo: string;
  funcionouItens: LicaoItem[];

  // Não funcionou
  naoFuncionouSubtitulo: string;
  naoFuncionouItens: LicaoItem[];

  // Riscos materializados (tabela)
  riscosSubtitulo: string;
  riscos: RiscoMaterializado[];

  // Premissas (resumo + erradas)
  premissasSubtitulo: string;
  premissas: PremissasResumo;

  // Recomendações para contratos futuros
  recomendacoesSubtitulo: string;
  recomendacoes: RecomendacaoFuturo[];

  // Chat
  chatQuote: string;
  chatSugestoes: LicoesChatSugestao[];
};

// ── M4 · Check-list da Obra (SASBY) ─────────────────────────────────

/** Apenas 3 níveis são exibidos no M4: Conforme · Atenção · Crítico. */
export type ChecklistFarol = "conforme" | "atencao" | "critico";

export type ChecklistSetor = {
  id: string;
  slug: string;
  codigo: string;
  nome: string;
  statusLabel: string;
  farol: ChecklistFarol;
  diagnostico: string;
  condutaSugerida: string;
};

/** Farol da linha de conduta · 5 níveis (inclui "não se aplica"). */
export type ChecklistCondutaFarol =
  | "conforme"
  | "observacao"
  | "risco"
  | "critico"
  | "nao-se-aplica";

export type ChecklistConduta = {
  id: string;
  acao: string;
  responsavel: string;
  finalidade: string;
  quando: string;
  statusLinha1: string;
  /** 2ª linha opcional do status. */
  statusLinha2?: string;
  farol: ChecklistCondutaFarol;
  /** Quando true, mostra badge "↗ sugestão" na linha. */
  sugestao?: boolean;
};

export type ChecklistSetorDetalhe = {
  slug: string;
  titulo: string;
  subtitulo: string;
  agente: string;
  dataReferenciaLabel: string;

  // Diagnóstico do setor
  statusLabel: string;
  statusFarol: ChecklistFarol;
  itensTotais: number;
  conformeCount: number;
  observacaoCount: number;
  riscoCount: number;
  criticoCount: number;
  naoSeAplicaCount: number;

  // Análise do agente (callout)
  analiseTexto: string;
  analiseFarol: ChecklistFarol;

  // Tabela de condutas
  condutas: ChecklistConduta[];

  // Banner final
  condutasPrioritarias: string[];
};

export type ChecklistCenarioTendente = "Favorável" | "Estável" | "Em alerta" | "Desfavorável";

export type ChecklistObraData = {
  // Diagnóstico Geral
  resumoTexto: string;
  conformesCount: number;
  atencaoCount: number;
  criticosCount: number;
  setoresAvaliados: number;
  cenarioTendente: ChecklistCenarioTendente;
  cenarioTendenteCtaLabel: string;

  // 8 setores
  setores: ChecklistSetor[];
  /** Detalhe de cada setor indexado por slug · null quando ainda não publicado. */
  setoresDetalhe: Partial<Record<string, ChecklistSetorDetalhe>>;

  // Síntese do Contrato (compartilhada com Gestão Contratual)
  contratoNumero: string;
  obraLocal: string;
  cliente: string;
  assinaturaDataLabel: string;
  valorContratadoLabel: string;
  valorContratadoNota: string;
  prazoContratualLabel: string;
  prazoContratualNota: string;
  dataCorteLabel: string;
  dataCorteNota: string;
  docsProcessadosLabel: string;
  docsProcessadosNota: string;
  chatQuote: string;
};

// ── Helpers de cálculo ────────────────────────────────────────────────

/** Dias entre uma data ISO e a data de referência (2026-05-17 por padrão). */
export function diasAteDataLimite(isoDate: string, today = new Date("2026-05-17")): number {
  const dl = new Date(isoDate).getTime();
  const t = today.getTime();
  return Math.round((dl - t) / 86_400_000);
}
