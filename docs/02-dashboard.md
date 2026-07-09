# Dashboard — Portfólio Executivo

> Fonte: [PRODUCT.md §3](PRODUCT.md). Tela inicial da plataforma. Pública pra todas as personas, com escopo filtrado conforme permissão.

## Propósito

Visão executiva consolidada de **todos os contratos sob administração** do cliente. Porta de entrada para diretores e donos verem o estado do portfólio antes de mergulhar em um contrato específico.

## Onde fica na arquitetura

- **Posição**: tela inicial, fora do ciclo de vida do contrato
- **Inputs**: dados agregados de todos os contratos (todos os módulos)
- **Outputs**: links pra contratos específicos (M2.1.1 Síntese ou módulo do alerta)
- **Agentes responsáveis**: Adm Contratual IA consolida os alertas; cada Agente Setorial pode disparar alertas que aparecem aqui

## Telas e rotas

| Rota | Finalidade          | Estado      |
| ---- | ------------------- | ----------- |
| `/`  | Dashboard portfólio | ✅ Completo |

## Componentes da tela (do doc)

### 3.1.1 KPIs de topo — 5 cards

1. **Contratos ativos** — total + variação mensal
2. **Valor administrado** — soma dos valores contratuais
3. **Desequilíbrio acumulado** — soma do M3 de cada contrato + variação mensal
4. **Alertas críticos** — eventos em status crítico que demandam ação
5. **Qualidade documental média** — agregado da qualidade dos docs da obra (completude, contemporaneidade, padronização)

### 3.1.2 Mapa das Obras

- Visualização geográfica (pinos por obra, cor = farol consolidado)
- Identifica rapidamente onde estão os pontos críticos
- Implementação atual: SVG inline do Brasil (d3-geo + IBGE geojson)

### 3.1.3 Alertas da IA

- Lista de eventos detectados pelos agentes
- Cada alerta: nível (farol) · contrato · descrição · agente · tempo
- Click leva à tela onde o evento foi identificado

### 3.1.4 Qualidade Documental (KPI + tela dedicada futura)

Medida sobre 4 tipos de doc:

- **Atas de reunião** — presença, completude, registro contemporâneo
- **RDOs** — preenchimento diário, registro de impactos, classificação
- **Cronogramas** — atualização, caminho crítico, registro de desvios
- **Relatórios mensais/semanais** — periodicidade, padronização, profundidade

> Regra de negócio: "documentação ruim hoje significa pleito fraco amanhã" — alertar quando cair.

### 3.1.5 Resumo dos Contratos (tabela)

Colunas: nome+localização · cliente · valor contratual · prazo decorrido/restante · % faturamento + desvio · desequilíbrio acumulado · farol consolidado

## Personalização por persona

| Persona                 | Escopo da Dashboard                          |
| ----------------------- | -------------------------------------------- |
| **Diretor/Dono**        | Portfólio inteiro                            |
| **Gerente de Contrato** | Apenas contratos sob sua responsabilidade    |
| **Jurídico**            | Destaque para contratos em pleito ou disputa |

> Hoje só modelamos visão Diretor — permissões por persona ficam pra quando auth chegar.

## Mocks usados

- [src/lib/mocks/contracts.ts](../src/lib/mocks/contracts.ts) — 12 contratos com `lat`, `lng`, `farol`, `valorContratual`, `desequilibrioAcumulado`, `qualidadeDocumental`, `faturamentoDesvioPct`
- [src/lib/mocks/alerts.ts](../src/lib/mocks/alerts.ts) — 7 alertas plausíveis
- [src/lib/mocks/brazil-states.geojson.json](../src/lib/mocks/brazil-states.geojson.json) — IBGE simplificado (~98KB)

## Componentes DS usados

`PageHeader` · `KpiRow` + `KpiCard` · `Grid` + `Col` · `Card` + `CardHeader`/`CardTitle`/`CardSub`/`CardLink` · `Badge` · `DataTable` + `DataTableColumn`

Componente custom inline (não promovido ao DS): `BrazilMap` (d3-geo + svg) e `AlertaItem` (lista com border-left opt-in via `with-stripe`).

## Critérios de Farol consolidado por contrato

> Provisório. Definitivo virá com Critérios configuráveis por contrato (Settings).

| Nível      | Quando                                                                    |
| ---------- | ------------------------------------------------------------------------- |
| Crítico    | Qualquer KPI do RMA em crítico OU desequilíbrio > 10% do valor contratual |
| Risco      | Algum KPI em risco, nenhum em crítico                                     |
| Observação | Algum KPI em observação                                                   |
| Conforme   | Todos os KPIs em conforme                                                 |

## O que falta

- [ ] Tela dedicada de **Qualidade Documental** com breakdown por tipo de doc
- [ ] Permissões por persona (depende de auth)
- [ ] Atualização em tempo real (depende de backend + websockets)
- [ ] Mapa interativo com filtros (Mapbox/MapLibre quando justificar)
