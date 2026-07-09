# Módulo 3 — Painel de Desequilíbrio

> Fonte: [PRODUCT.md §6](PRODUCT.md). Onde a plataforma cumpre uma das promessas mais valiosas: **quantificar continuamente** o desequilíbrio econômico-financeiro em **todos os cenários**.

## Propósito

Quantificação econômico-financeira do contrato, em todos os métodos e cenários, calculada **desde o primeiro mês** — não sob demanda quando o cliente decide entrar com pleito (que frequentemente é tarde demais).

> Inversão da lógica de mercado: ao invés de calcular quando precisa, calcula sempre. Quando o cliente decide pleitear, **todo o material está pronto**.

## Onde fica na arquitetura

- **Posição**: durante a execução (paralelo ao M2), e ativado intensamente perto de pleitos
- **Inputs**:
  - Bases do RMA (M2) — curvas, histogramas, BMs
  - Dados de Recursos/Produtividade do M2 (5.3.3, 5.3.4)
  - Análise de Responsabilidade do M2 (5.3.8) — nexo causal pra fundamentar
  - Windows Analysis do M2 (5.3.5) — extensão de prazo
  - Documentos da Biblioteca
- **Outputs**:
  - Valor de **Desequilíbrio Acumulado** que aparece no KPI da Dashboard
  - **Claim consolidado em .docx** (3.10) — entregável final
  - Memórias de cálculo separadas por método (Word/Excel)
- **Agentes**: Adm Contratual IA orquestra, com apoio dos agentes setoriais (Medição, Planejamento) e da Base de Conhecimento (AACE, IBAPE, Jusbrasil)

## Telas e rotas

| Rota                                          | Sub-módulo                   | Estado  |
| --------------------------------------------- | ---------------------------- | ------- |
| `/contracts/$id/desequilibrio/indiretos`      | 3.1 Indiretos                | ⚪ Stub |
| `/contracts/$id/desequilibrio/bdi`            | 3.2 BDI                      | ⚪ Stub |
| `/contracts/$id/desequilibrio/encargos`       | 3.3 Encargos Sociais         | ⚪ Stub |
| `/contracts/$id/desequilibrio/valor-agregado` | 3.4 Valor Agregado           | ⚪ Stub |
| `/contracts/$id/desequilibrio/total-cost`     | 3.5 Total Cost               | ⚪ Stub |
| `/contracts/$id/desequilibrio/measured-mile`  | 3.6 Measured Mile            | ⚪ Stub |
| `/contracts/$id/desequilibrio/insumos`        | 3.7 Preço de Insumos         | ⚪ Stub |
| `/contracts/$id/desequilibrio/pontuais`       | 3.8 Análises Pontuais        | ⚪ Stub |
| `/contracts/$id/desequilibrio/gerador-claim`  | 3.10 **Gerador de Claim** ⭐ | ⚪ Stub |

> Falta uma tela **/desequilibrio** raiz (visão consolidada §6.1+§6.2) com Resumo + Composição. Adicionar quando for atacar M3.

## 6.1 Resumo do Desequilíbrio (topo da visão consolidada)

- **Desequilíbrio acumulado total** (R$)
- **Variação do mês**
- **% do desequilíbrio** sobre o valor contratual
- **Prorrogação estimada** (dias) — vinda do Windows do M2
- **Força no mérito** — solidez da base documental + jurídica (escala 1-5 estrelas)
- **Botão "Próximo passo"** → leva ao Gerador de Claim

## 6.2 Composição por Categoria

Gráfico de barras horizontal: como o desequilíbrio se distribui entre custos diretos · indiretos · BDI · perda de produtividade · variação de insumos · atraso de pagamento · chuvas · ociosidade.

## 6.3 Cenários e Métodos Calculados

### 3.1 Análise de Indiretos

Extensão de custos indiretos (administração local, canteiro) em função do prazo decorrido **além do contratual**.

- **Base**: docs contábeis do canteiro, planilha de indiretos contratada, dias de extensão

### 3.2 Análise de BDI

Componentes do BDI a reequilibrar:

- **Administração Central** — extensão pela prorrogação
- **Encargos Sociais** (→ tela própria 3.3) — variação de alíquotas (ex.: reoneração progressiva Lei 14.973/24)
- **Garantias bancárias** e seguros estendidos
- **Outros itens do BDI**
- **Impostos** — variação de alíquotas
- **Lucro** — impacto financeiro proporcional

### 3.3 Encargos Sociais

Tela dedicada por causa da complexidade legislativa atual (reoneração).

### 3.4 Valor Agregado (AACE 25R-03)

**Custo previsto × variação do avanço**, comparado com horas reais alocadas.

> Já tem fórmula modelada em Excel S15 (v1) — reaproveitar.

### 3.5 Total Cost

Comparação direta entre **histograma contratual e real alocado** (MOD + Equipamentos). Mostra diferença em horas e em reais.

### 3.6 Measured Mile (Milha Aferida)

Análise de **produtividade real** ao longo dos meses (R$ medido por hora-homem alocada). Identifica períodos de queda e atribui a eventos contemporâneos documentados.

> 3.4 + 3.5 + 3.6 são **três métodos paralelos** de quantificação de perda de produtividade. Cliente vê os três e escolhe o mais favorável, ou apresenta média/intervalo.

### 3.7 Preço de Insumos

Desequilíbrio decorrente da variação de preços (cimento, aço, brita, combustível, MO) **acima do índice contratual**. Aplica a **fórmula paramétrica do contrato** sobre as quantidades efetivamente compradas.

### 3.8 Análises Pontuais

Eventos pontuais documentados:

- **Chuvas** acima da média histórica — dias improdutivos + ociosidade
- **Ociosidade documentada** — recursos parados por culpa da Contratante
- **Greves, manifestações, paralisações externas**
- **Retrabalho** por mudança de projeto

### 3.9 Análises Econômico-Financeiras (não tem rota dedicada hoje — agrupar na consolidada)

- **Atraso de pagamentos** — juros, correção monetária, custo de capital de giro
- **Capital de giro adicional**
- **Custos financeiros de garantias estendidas**

## 6.4 Gerador de Claim Consolidado (3.10) ⭐

**Funcionalidade ápice do módulo.** Reúne todas as análises e produz um **pleito completo** com fundamentação técnica, jurídica e quantificação. Wizard em **4 etapas**:

### Etapa 1 — Dossiê Probatório

A IA varre todos os documentos do contrato (RDOs, atas, cartas, e-mails, fotos, registros), monta o **dossiê probatório**:

- Indexa cada documento
- Classifica por evento
- Gera a **Matriz de Nexo Causal** completa (mesma do M2.5.3.9)

### Etapa 2 — Fundamentação

- Mapeia cláusulas contratuais aplicáveis
- Cita doutrina e jurisprudência (**Jusbrasil**)
- Referencia normas técnicas (**AACE**, **IBAPE**)
- Busca precedentes em câmaras arbitrais

### Etapa 3 — Quantificação

- Consolida o valor total a partir de todas as análises 3.x
- Gera planilhas de cálculo separadas por método
- Memórias de cálculo detalhadas
- **Cenários de valor** (alto/médio/baixo) para suportar negociação

### Etapa 4 — Geração do Documento

- Produz **Word final formatado** com índice, capa, sumário, anexos
- Templates baseados em pleitos vencedores em casos similares (banco curado)
- Documento pronto pra envio à Contratante

## Mocks atuais

- Apenas o campo `desequilibrioAcumulado` em [src/lib/mocks/contracts.ts](../src/lib/mocks/contracts.ts)

> **Faltam mocks para tudo**: composição por categoria, valores por método (3.4/3.5/3.6), insumos com variação, eventos pontuais, dossiê probatório, fundamentação jurídica.

## Componentes DS usados / a criar

- **Existe**: `KpiRow`+`KpiCard`, `Card`, `Tabs`, `ProgressRing`, `Sparkline`
- **A criar/avaliar**:
  - **Stepper** (essencial pro Gerador de Claim 4 etapas)
  - **Bars horizontal** (Composição por Categoria) — Recharts
  - **Star rating** (Força no Mérito 1-5)
  - **Calculator/MemoryCard** — exibir memória de cálculo por método
  - **DocumentPreview** — visualizar .docx gerado antes do download
  - **JurisprudenceCard** — citação Jusbrasil com link

## Critérios de Farol no M3 (a definir por contrato)

> Provisório. Define quando a tela acende vermelho.

| Nível      | Desequilíbrio sobre valor contratual |
| ---------- | ------------------------------------ |
| Conforme   | até 1%                               |
| Observação | 1% a 5%                              |
| Risco      | 5% a 10%                             |
| Crítico    | acima de 10%                         |

## Próximos passos (priorização)

1. **3.4 Valor Agregado** primeiro (já tem fórmula Excel S15 modelada)
2. **3.1 Indiretos** + **3.2 BDI** + **3.3 Encargos** — mais fáceis matematicamente
3. **3.5 Total Cost** + **3.6 Measured Mile**
4. **3.7 Insumos** + **3.8 Pontuais**
5. **Tela raiz consolidada** (Resumo + Composição) — quando 3.4+3.1+3.2+3.3 estiverem prontas
6. **3.10 Gerador de Claim** — wizard que orquestra tudo (precisa de tudo pronto)
