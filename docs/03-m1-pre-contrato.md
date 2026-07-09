# Módulo 1 — Pré-Contrato

> Fonte: [PRODUCT.md §4](PRODUCT.md). Tudo que acontece **antes da assinatura** do contrato.

## Propósito

Identificar riscos, mapear premissas, validar produtividades orçadas e construir o **Plano de Ação** que será entregue ao gestor responsável pela execução. Resultado: ou recomendação de prosseguir, renegociar ou recusar, e — quando prossegue — as **bases iniciais do RMA** já parametrizadas.

> Problema que resolve: a maior parte das construtoras hoje não faz diagnóstico contratual sistemático antes de assinar — entram em obras com riscos não mapeados e premissas frágeis. Quando o problema aparece na execução, não há base documental pra pleito.

## Onde fica na arquitetura

- **Posição**: pré-execução
- **Inputs**: documentos da concorrência (edital, contrato, projetos básicos, planilha de quantidades, procedimentos, anexos)
- **Outputs**:
  - Relatório de Revisão Documental (para a equipe de proposta)
  - Diagnóstico do Contrato (para a diretoria)
  - Transpasse (para o gestor que vai tocar a obra)
  - **Bases do RMA** (curvas de faturamento previsto, histogramas MOD/MOI/EQP, marcos contratuais, valores de referência) — alimenta M2
- **Agentes responsáveis**:
  - **Agente de Orçamento** — Bases do Negócio (1.2): produtividades, preços, BDI, premissas. Consulta Orsafáscio, SINAPI, dissídios, contratos similares
  - **Adm Contratual IA** — Revisão Documental (1.1) e Diagnóstico (1.3). Lê contrato como advogado-engenheiro. Gera Transpasse e modelos

## Telas e rotas

| Rota                             | Sub-módulo                    | Estado      |
| -------------------------------- | ----------------------------- | ----------- |
| `/contracts/$id/pre/revisao`     | 1.1 Revisão Documental        | ✅ Completo |
| `/contracts/$id/pre/bases`       | 1.2 Bases do Negócio          | ⚪ Stub     |
| `/contracts/$id/pre/diagnostico` | 1.3 Diagnóstico do Contrato   | ⚪ Stub     |
| `/contracts/$id/pre/transpasse`  | 1.4 Transpasse e Documentação | ⚪ Stub     |

## 1.1 Revisão Documental (✅ implementada)

Primeira análise da plataforma. Submete docs da concorrência ao agente de IA.

### Análises produzidas

- **Compatibilidade Projeto × Planilha** — divergências, omissões, itens sem especificação
- **Riscos Contratuais** — cláusulas desfavoráveis, distribuição de risco, gatilhos de penalidade
- **Obrigações Contratuais Mapeadas** — o que a Contratada deve fazer + prazos + comprovações
- **Análise Técnica dos Projetos** — adequação a normas, exequibilidade, omissões
- **Análise dos Procedimentos** — clareza, exequibilidade, risco de não-conformidade
- **Questionamentos para a Contratante** — perguntas técnicas para a fase de esclarecimentos

### Entregáveis

- Relatório de Revisão Documental
- Lista de pontos de atenção classificados por farol
- Lista de questionamentos sugeridos

### Mocks

- [src/lib/mocks/pre-contrato.ts](../src/lib/mocks/pre-contrato.ts) — `RevisaoDocumental`, `ConcorrenciaDocument`, `Analise`, `PontoCritico`, `ChatSugestao`, `SintesePreContrato`

### Layout implementado

Breadcrumb · PageHeader (com ações Exportar + Gerar Relatório) · **Hero strip escuro** com 4 KPIs (Pontos de Atenção · Documentos Carregados · Análises Concluídas · Próximo Passo) · Grid 3-colunas (`Docs | Análises | Chat+Críticos`) · **Síntese do Contrato** no rodapé (5 KPIs: Valor · Prazo · Data-limite · Docs processados · Recomendação do Agente).

## 1.2 Bases do Negócio (⚪ stub)

Análise da **proposta e premissas** que sustentam o orçamento.

> Aqui mora um dos riscos mais subestimados: muitos contratos entram em desequilíbrio porque as premissas da proposta estavam erradas desde o início.

### Análises produzidas

- Mapeamento e validação de **premissas** (produtividades, jornadas, composições de equipe, índices de consumo, prazos de fornecedores)
- Análise de **produtividades orçadas** vs. mercado (Orsafáscio, SINAPI, contratos similares geograficamente próximos)
- Análise de **preços unitários** — detectar subdimensionados/superdimensionados
- Análise do **BDI** — composição, alíquotas de encargos, riscos cobertos, margens
- Identificação de **premissas frágeis** que precisam ser registradas formalmente

### Base de dados

- Orsafáscio (via API — sugestão)
- Banco interno de contratos similares anteriores (geográfica)

## 1.3 Diagnóstico do Contrato (⚪ stub)

Documento gerado a partir de 1.1 + 1.2. Um clique → diagnóstico consolidado com:

- Resumo executivo de riscos e oportunidades
- Cláusulas que merecem renegociação
- Premissas que precisam ser registradas formalmente
- Estimativa preliminar do potencial de desequilíbrio se riscos se materializarem
- **Recomendação clara**: assinar como está · renegociar · recusar

## 1.4 Transpasse e Documentação Gerada (⚪ stub)

Documento de passagem entre time de orçamento (ganhou) e time de execução (vai tocar a obra).

### Conteúdo

- Resumo do contrato + proposta com premissas formalizadas
- Principais riscos + como mitigá-los
- Plano de Ação para mobilização + primeiros 90 dias
- Documentos que a Contratada precisa emitir nos primeiros meses
- **Modelos pré-formatados** prontos para uso

### Geração das bases do RMA ⭐

> Funcionalidade crítica. A IA lê contrato + planilha + cronograma + histograma, popula automaticamente todas as bases contratadas do RMA do M2 (curvas de faturamento previsto, histogramas MOD/MOI/EQP, marcos, valores de referência). Elimina semanas de cadastro manual quando a obra começa.

## Componentes DS usados / a criar

- **Já usado em 1.1**: `PageHeader`, `Badge`, `Card`+`CardHeader`/`CardTitle`/`CardSub`, `Col`+`Grid`, `Button`, `I` (icons)
- **A criar em 1.2-1.4**:
  - `Stepper` (1.4 tem etapas: extração → enriquecimento → validação → geração das bases)
  - Comparador de tabelas Projeto × Planilha (custom — não generalizar até precisar)
  - Visualizador de cláusulas com anotação inline (1.1/1.3)

## Próximos passos

1. **1.2 Bases do Negócio** — segunda análise mais valiosa do M1, tela com cards de premissas, gauge de BDI, comparativo de produtividades
2. **1.3 Diagnóstico** — tela "executivo" curta, output do agente, com recomendação destacada
3. **1.4 Transpasse** — wizard de geração de bases do RMA (link de saída pra M2)
