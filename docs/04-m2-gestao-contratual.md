# Módulo 2 — Gestão Contratual ❤️ CORAÇÃO

> Fonte: [PRODUCT.md §5](PRODUCT.md). Onde o usuário passa a **maior parte do tempo** durante a execução do contrato.

## Propósito

Administração contratual contínua durante a execução. Aqui mora o **RMA mensal** (Relatório Mensal de Acompanhamento) — entregável mais importante do módulo — e todas as análises macro que sustentam a operação diária.

## Onde fica na arquitetura

- **Posição**: durante a execução do contrato
- **Inputs**:
  - Bases iniciais geradas pelo M1.4 (curvas previstas, histogramas, marcos, valores de referência)
  - Documentos da obra ao longo do tempo (RDOs, atas, cartas, BMs, projetos revisados)
  - Output dos Agentes Setoriais do M4 (especialmente Engenharia, Planejamento, Medição, Produção)
- **Outputs**:
  - Dados consolidados que alimentam **M3 (quantificação de desequilíbrio)**
  - Status que aparece na Dashboard de cada contrato
  - Documentos produzidos vão pra Biblioteca
- **Agentes responsáveis**:
  - **Adm Contratual IA** — gera o RMA, escreve análises textuais, sugere condutas, atende chat
  - **Agente de Medição** — aba 5.3.2 Faturamento
  - **Agente de Planejamento** — abas 5.3.5 Prazo e 5.4 Timeline
  - **Agente de Engenharia** — abas 5.5 Mapa Retigráfico e 5.6 Melhorias Documentais
  - **Agente de Produção** — aba 5.3.3 Recursos e 5.3.4 Produtividade

## Estrutura do módulo (do doc §5.1)

Duas grandes áreas:

1. **Visão Geral das Obras** — Síntese + todas as abas do RMA + telas paralelas
2. **Biblioteca de Documentos** — arquivo de tudo que foi produzido

## Telas e rotas

| Rota                           | Sub-módulo                              | Estado  |
| ------------------------------ | --------------------------------------- | ------- |
| `/contracts/$id`               | 2.1.1 Síntese do Contrato (entry point) | ⚪ Stub |
| `/contracts/$id/rma`           | 2.1.2 **RMA Mensal** ⭐ (11 abas)       | ⚪ Stub |
| `/contracts/$id/timeline`      | 2.1.3 Timeline do Contrato              | ⚪ Stub |
| `/contracts/$id/mapa`          | 2.1.4 Mapa / Retigráfico                | ⚪ Stub |
| `/contracts/$id/melhorias-doc` | 2.1.5 Melhorias Documentais             | ⚪ Stub |
| `/contracts/$id/condutas`      | 2.1.6 Condutas e Documentos             | ⚪ Stub |
| `/contracts/$id/plano-acao`    | 2.1.7 Plano de Ação                     | ⚪ Stub |
| `/contracts/$id/biblioteca`    | 2.2 Biblioteca de Documentos            | ⚪ Stub |

> **Decisão pendente sobre o RMA**: o doc descreve 11 abas dentro do RMA. A Sidebar atual lista alguns desses itens em paralelo (Timeline, Mapa, Melhorias, Condutas, Plano de Ação). Provavelmente o caminho certo é: **RMA = uma rota com 11 abas internas via `Tabs` do DS**; Timeline, Mapa, Melhorias, Condutas, Plano e Biblioteca seguem como sub-rotas paralelas (não-RMA) na Sidebar.

## 2.1.1 Síntese do Contrato (entry point)

Cabeçalho com dados essenciais do contrato:

- Cliente · Valor · Prazo · Datas-chave
- Documentos contratuais indexados
- Equipe responsável + contatos

> A mesma Síntese é compartilhada com o **M4 Check-list** (aparece no rodapé daquela tela).

## 2.1.2 RMA — Relatório Mensal de Acompanhamento ⭐

Gerado a cada mês a partir de dados consolidados. **11 abas paralelas**:

### 5.3.1 Indicadores e Farol — aba de entrada

- Card de **situação geral** com diagnóstico textual do agente sênior
- Status por bloco (Faturamento, Recursos, Produtividade, Prazo, Desequilíbrio), cada um com seu farol
- Acesso direto a cada aba detalhada

### 5.3.2 Faturamento

- **Curva S** contratado vs. realizado, com gap sombreado e projeção até o fim
- Cards: Contratado Total · Contratado Acumulado até a data de corte · Real Acumulado · Saldo a Faturar
- Indicador de desvio em % com farol
- Indicador de **aderência do mês** (faturado no mês ÷ previsto pro mês)
- **Projeção de término** no ritmo atual — quando passa do prazo contratual, **dispara alerta automático com sugestão de claim de prorrogação**
- **Seletor de visão**: "Todo o faturamento" vs. "Apenas serviços" (exclui mobilização, canteiro, manutenção) — quando muda, tudo recalcula
- Tabela de Faturamento Previsto mês a mês
- Análise textual automática editável
- Análise por **frente de serviço** (subseção)

**Critérios do farol de Faturamento (configuráveis):**
| Nível | Desvio |
|---|---|
| Conforme | até −1% |
| Observação | −1% a −5% |
| Risco | −5% a −15% |
| Crítico | acima de −15% |

### 5.3.3 Recursos (MOD/MOI/EQP)

Por categoria:

- Total do contrato (do histograma contratual do M1)
- Real alocado até data de corte
- % alocado vs. previsto
- Comparativo mensal (barras Contratado × Real)
- Evolução BM a BM (linha)
- Alocação em reais (custo)
- **Análise cruzada**: quando recursos > faturamento → indício de **perda de produtividade** que deve ir pro M3

### 5.3.4 Produtividade

- Comparativo **Hora-Homem** (HH real · HH contratado · benchmark nacional · benchmark global) — herdado da v1
- Evolução mensal do HH
- Indicadores preliminares de perda de produtividade (cálculo detalhado no M3)

### 5.3.5 Prazo e Cronograma

- Prazo decorrido × prazo restante (gauge donut)
- Curva de avanço físico contratado × real
- **Marcos contratuais** com status (cumprido/atraso/risco)
- **Windows Analysis** — caminho crítico, eventos que impactaram o término
- Tendência de término baseada no ritmo real

### 5.3.6 Insumos

- Variação de preços de insumos relevantes
- Gráficos comparativos: índice contratual vs. índices reais (INCC, SINAPI, setoriais)
- Cálculo do desequilíbrio decorrente → **M3.7**

### 5.3.7 Curvas: Liberação × Capacidade Produtiva × Alocado

Três curvas sobrepostas:

- **Liberação** — o que está liberado (projetos recebidos + frentes desimpedidas pela Contratante)
- **Capacidade Produtiva** — o que a equipe alocada consegue produzir (produtividade real)
- **Alocado** — o que está sendo efetivamente executado

> Diagnóstico: se Liberação abaixo das outras → gargalo na **Contratante** (projetos atrasados). Se Capacidade abaixo → problema interno de produtividade.

### 5.3.8 Análise de Responsabilidade

Classificação dos eventos negativos por responsável: **Contratante · Contratada · terceiro · força maior**. Apresenta:

- Matriz eventos × responsabilidade
- Quantificação dos impactos por responsável
- Fundamentação documental por classificação

> **Base para pleitos**. Sem ela, não há como provar nexo causal.

### 5.3.9 Panorama do Contrato

Visão consolidada do mês em 3 aspectos:

- Ordem **técnica**
- Ordem **econômica**
- Ordem **física**

Complementada por:

- **Matriz de Impactos** — eventos do mês classificados por categoria
- **Matriz de Nexo Causal** — fato → documento que comprova → embasamento contratual → hipótese de desequilíbrio → quantificação

### 5.3.10 Condutas Sugeridas e Geração de Documentos

Conjunto **aberto** de entregáveis sugeridos pela IA:

- **Take-off** automatizado a partir de novos projetos
- **Pedidos de preço novo** pra serviços extra-escopo
- **Cartas** (cobrança, notificação, registro de evento, impugnação de glosa)
- Comentários e sugestões de anotação em RDO/ata
- Análises de cláusula contratual aplicáveis
- Plano de Ação atualizado

> Lista aberta — a plataforma precisa suportar entregáveis novos sem reprogramação.

### 5.3.11 Plano de Ação

Documento estruturado. Para cada ponto de atenção: o quê · por quê · quem · quando · onde · esforço · status.

## 2.1.3 Timeline do Contrato

Aba paralela ao RMA:

- Linha do tempo com todos os eventos
- Marcos contratuais e status
- Cronograma físico previsto × real
- **Caminho crítico** destacado

## 2.1.4 Mapa / Retigráfico

Overview geográfico/topográfico da obra. Mostra o que está **liberado** para executar e o que está **impedido** (projeto, área não desimpedida, licença). Atualizado pelos Agentes de Engenharia e Planejamento. "Radar visual" do estado da obra.

## 2.1.5 Melhorias Documentais

Aba dedicada à qualidade da documentação produzida. Para cada tipo (atas, RDOs, cronogramas, relatórios) lista sugestões de melhoria.

> Regra de negócio (repetida do Dashboard): "documentação ruim hoje = pleito fraco amanhã".

## 2.2 Biblioteca de Documentos

**Arquivo de tudo produzido durante o contrato** — cartas, claims, take-offs, atas, RDOs, cronogramas impactados, pareceres, análises. Organizado por data/tipo/setor/evento. Pesquisável. Lista aberta — todo entregável gerado vai pra cá automaticamente.

## Mocks atuais

- [src/lib/mocks/contracts.ts](../src/lib/mocks/contracts.ts) — campos do contrato (valor, prazo, faturamento, desequilíbrio, farol)

> **Faltam mocks** para: RMA mensal (todos os dados das 11 abas), Timeline (eventos, marcos), Mapa/Retigráfico (frentes liberadas/impedidas), Biblioteca (lista de docs gerados).

## Componentes DS usados / a criar

- **Existem**: `Tabs`, `KpiRow`+`KpiCard`, `Card`, `DataTable`, `Badge`, `ProgressBar`, `ProgressRing`, `Sparkline`, `Grid`+`Col`
- **A criar/avaliar**:
  - `CurvaS` (gráfico contratado × realizado com gap sombreado) — Recharts
  - `Gauge`/`Donut` (prazo) — Recharts
  - `Histograma` MOD/MOI/EQP barras mensais — Recharts
  - **Matriz de Nexo Causal** — table custom com 5 colunas
  - Marcos contratuais (`Milestone` card vertical)

## Próximos passos (em ordem de valor)

1. **2.1.1 Síntese do Contrato** — porta de entrada de toda a M2 e M4. Pequena. Libera as outras.
2. **2.1.2 RMA Mensal** com `Tabs`. Começar pelas abas que dão mais retorno: **Indicadores+Farol** (5.3.1) + **Faturamento** (5.3.2) — herdadas/evoluídas da v1
3. Resto das abas do RMA em ordem (Recursos · Produtividade · Prazo · Insumos · ... · Plano de Ação)
4. Timeline, Mapa Retigráfico, Melhorias, Biblioteca em segunda onda
