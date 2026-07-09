// Schema do RELATÓRIO de análise por aba (gerado pela IA · Adm Contratual IA). É o contrato entre o
// gerador (backend Python, fase seguinte) e o renderizador (AnaliseView). A IA escreve a NARRATIVA
// (sumário, prosa, pontos, recomendações, farol); os DADOS (indicadores, série do gráfico, tabela)
// vêm dos read-models reais — o gerador ancora os números e um validador rejeita citação não-ancorada.

export type RelatorioFarol = "conforme" | "observacao" | "risco" | "critico";
export type RelatorioTom = "danger" | "warning" | "info" | "success";

export interface RelatorioGrafico {
  tipo: "curva";
  unidade?: string;
  legenda?: string;
  /** real/previsto podem ser null (ex.: a curva REAL para após o corte → gap no gráfico). */
  serie: { m: string; previsto: number | null; real: number | null }[];
}

export interface RelatorioTabela {
  titulo?: string;
  colunas: string[];
  linhas: Array<Array<string | number>>;
  /** índice da coluna de "desvio" (destacada em vermelho), se houver. */
  colDesvio?: number;
}

export interface RelatorioPonto {
  tom: RelatorioTom;
  titulo: string;
  texto: string;
}

export interface RelatorioIndicador {
  label: string;
  valor: string;
  hint?: string;
}

/** Os DADOS do relatório (parte determinística, vinda do read-model da aba). O front coleta isto via
 * um ADAPTER por aba e manda pro gerador; a IA escreve a narrativa ancorada nesses números. */
export interface RelatorioDados {
  titulo: string;
  farol: RelatorioFarol;
  indicadores: RelatorioIndicador[];
  grafico: RelatorioGrafico | null;
  detalhamento: RelatorioTabela | null;
  /** tabelas ADICIONAIS (ex.: marcos do cronograma, ranking de desvios, série mensal) — deixam o
   * relatório mais completo. Renderizadas após o detalhamento principal e entram no contexto da IA. */
  tabelas?: RelatorioTabela[];
  /** versão de extração lida (staleness). */
  extracaoVersion?: number;
}

/** Uma SEÇÃO de bloco no relatório CONSOLIDADO (RMA inteiro) — cada bloco (Faturamento, Recursos…)
 * vira uma página própria com seus KPIs + gráfico + a análise da IA daquele bloco. Composta a partir
 * do relatório por-aba já gerado (paridade total: mesmos números, mesma análise da tela). */
export interface RelatorioSecao {
  aba: string;
  titulo: string;
  farol: RelatorioFarol;
  /** subtítulo curto (1 linha) — a leitura-relâmpago do bloco. */
  resumo?: string;
  indicadores: RelatorioIndicador[];
  grafico: RelatorioGrafico | null;
  /** a análise da IA daquele bloco (1-3 parágrafos). */
  prosa: string[];
  detalhamento: RelatorioTabela | null;
  /** tabelas adicionais do bloco (após o detalhamento principal). */
  tabelas?: RelatorioTabela[];
  /** legenda sob a tabela quando ela foi truncada no consolidado (ex.: "12 de 32 — ver aba Insumos"). */
  detalhamentoNota?: string;
  pontosAtencao: RelatorioPonto[];
}

export interface RelatorioAba {
  aba: string;
  titulo: string;
  farol: RelatorioFarol;
  /** 1-2 parágrafos, separados por "\n\n". */
  sumarioExecutivo: string;
  indicadores: RelatorioIndicador[];
  leitura: { prosa: string[]; grafico: RelatorioGrafico | null };
  detalhamento: RelatorioTabela | null;
  /** tabelas adicionais (após o detalhamento principal). */
  tabelas?: RelatorioTabela[];
  pontosAtencao: RelatorioPonto[];
  recomendacoes: string[];
  /** SÓ no consolidado (RMA inteiro): uma seção por bloco do RMA. Vazio/ausente no relatório por-aba. */
  secoes?: RelatorioSecao[];
  meta: {
    geradoEm: string;
    modelo: string;
    status: "ok" | "needs_review" | "generating" | "error";
    fatosHash?: string;
    extracaoVersion?: number;
  };
}
