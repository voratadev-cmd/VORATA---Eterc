# REFINO-UX-RMA — análise das 13 abas (layout · exibição · organização)

> **Pedido do dono (05/jul/2026)**: melhorar exibição/organização/gráficos das abas do RMA
> **sem remover nenhuma informação** e sem mudanças drásticas. Este doc é o artefato de
> ALINHAMENTO (método: JTBD → descasamentos → propostas → alinhar → executar).
>
> Produzido por workflow multi-agente (13 analistas de aba + revisor-chefe transversal,
> ultracode): **127 achados**, 8 inconsistências entre abas, 7 propostas vetadas pelo
> revisor por violarem as regras do projeto, 8 quick wins transversais.
> Cada aba traz o INVENTÁRIO do que exibe hoje — a garantia formal contra remoção.

---

## Sumário executivo

| Aba                     | Achados | Alto | Notas                                                                                      |
| ----------------------- | ------- | ---- | ------------------------------------------------------------------------------------------ |
| Visão Geral             | 10      | 2    | Veredito do hero não carrega o farol — classe morta `vg-hero-${situacao}` e Crítico idênti |
| C.2 Indicadores e Farol | 10      | 4    | Aba ignora o seletor de período do RMA (?bm) — inconsistente com C.3/C.4                   |
| C.3 Faturamento         | 10      | 4    | Farol oficial da tela enterrado na última posição do segundo deck                          |
| C.4 Recursos            | 10      | 3    | Ranking 'Maiores desvios de alocação' é coleção de ~100+ funções sem busca, ordenação nem  |
| C.5 Prazo e Cronograma  | 10      | 1    | Ponto 'Real' quase invisível na curva e sem marcador da data de corte                      |
| C.6 Insumos             | 10      | 4    | KPIs live enterrados sob 5 faixas de texto — o headline da aba não salta                   |
| C.7 Produtividade       | 10      | 3    | KPI de Aderência não carrega o farol que ele mesmo dispara                                 |
| C.8 Curvas              | 9       | 3    | Legenda promete 'tracejado = previsão' mas a previsão real (Contratado/Liberado pós-BM) de |
| C.9 Chuvas              | 10      | 3    | Apuração (o dinheiro) enterrada sob dois gráficos de baseline estático                     |
| Responsabilidade        | 10      | 3    | Aba morre em notFound para toda obra real — único caminho vivo é o registry de mocks, que  |
| C.10 Panorama           | 10      | 3    | Snapshot de KPIs do obra_panorama existe no read-model e não aparece na tela               |
| C.11 Condutas           | 9       | 3    | Coleção de 15 cards longos sem busca, ordenação nem paginação — e o toolkit canônico já ex |
| C.12 Plano de Ação      | 9       | 1    | Quadro de 15 tarefas sem busca, ordenação, filtro nem paginação                            |

---

## Transversal (revisor-chefe)

### Inconsistências entre abas

**T1 · KPI cards com 4 anatomias diferentes para o mesmo tipo de dado**

- Abas: C.3 Faturamento (Deck 1 sem chip), C.4 Recursos (ícone sem chip, sem hover), C.11 Condutas (sem chip lucide), C.12 Plano de Ação (dot+label mini), Responsabilidade (FarolCard sem ícone), C.8 Curvas (dot de série custom), C.10 Panorama (snapshot ausente)
- Proposta: Extrair UM componente RmaKpi canônico (chip quadrado r-sm/surface-2 com lucide no topo-esquerdo → rótulo → valor grande tabular-nums → sub discreto; hover lift 2px; variantes hero/tinted via color-mix — exemplar /desequilibrio/indiretos) e migrar as 7 abas. Visão Geral e o Deck 2 da C.3 já são a referência. Cada analista propôs esse mesmo fix isoladamente — fazer como componente compartilhado evita 7 implementações que vão divergir de novo.

**T2 · Vocabulário e apresentação do farol divergem em 7 abas — inclusive níveis renomeados que nenhum analista flagrou**

- Abas: C.4 Recursos ('Em conformidade/Observar/Alerta/Defasado' — recursos.tsx L906-909, CONFIRMADO), Visão Geral ('OBS'), C.9 Chuvas ('Atenção'), C.3 Faturamento (hint nomeia cores 'verde/azul/amarelo/vermelho'), C.5 Prazo (legenda órfã), C.7 Produtividade (seção inteira de critérios), C.2 Indicadores (nota de régua textual)
- Proposta: Duas frentes: (1) grep + troca por farolLabel/farolToBadge de src/lib/mocks/contracts.ts em TODO Badge/label de farol — mata OBS/Atenção/Alerta/Defasado de uma vez ('Pendente' permanece só como ausência de dado, nunca 5º nível); (2) componente FarolRegua compartilhado (4 pills: dot 8px por token + nome canônico + faixa numérica da tela) posicionado como rodapé compacto da seção que o usa, substituindo as 5 apresentações distintas de régua.

**T3 · Cor da série 'Real' nos gráficos: 3 analistas propõem 3 cores diferentes, e 2 telas hoje usam danger fixo**

- Abas: Visão Geral (propõe var(--brand)), C.4 Recursos (propõe navy --c6-navy pattern), C.7 Produtividade (propõe var(--text)), C.6/C.9 (já usam navy local)
- Proposta: Decidir a convenção ANTES de executar qualquer aba, num chartTokens/vars compartilhado: Contratado/Previsto = var(--info) linha / var(--text-4) barra; Real = navy via var local --rma-navy com override dark (padrão --c6-navy já validado); futuro/projeção = mesma cor tracejada; danger RESERVADO a desvio/excedente/farol. Aplicar a mesma decisão nos 3 achados — se cada aba seguir sua proposta local, a inconsistência atual (Real=danger) é trocada por outra pior (Real=3 cores).

**T4 · Tooltip e legenda de gráfico: cada aba tem implementação própria e 3 usam o default do Recharts (fora dos tokens, quebra no dark)**

- Abas: C.4 (VA com tooltip default), C.7 (posicionamento default), C.9 (Gráfico C sem legenda, D com formatter cru), C.8 (tooltip lista séries soltas), C.3, C.2 (footer-swap no lugar de tooltip), Responsabilidade (title nativo)
- Proposta: Criar ChartTooltip e ChartLegend compartilhados no DS: pt-BR (toLocaleString), tabular-nums, swatches cheia/tracejada/barra como amostras reais de linha, dots de farol, tokens-only. Os 7 achados individuais de tooltip/legenda viram chamadas do mesmo par de componentes. Incluir a convenção de eixo temporal: rótulo de calendário 'mmm/aa' no tick (C.5 hoje usa 'M1…M46'), nº do mês no tooltip.

**T5 · Toolbar de coleção: o toolkit canônico existe e só 2 abas do RMA usam — 8 analistas propuseram soluções bespoke**

- Abas: C.3 (drill), C.4 (maiores desvios), C.6 (tabela multifonte), C.9 (apuração), C.10 (nexo), C.11 (catálogo), C.12 (quadro), Responsabilidade (matriz)
- Proposta: Rollout único de useColecao + ColToolbar/ColPag/ColVazio (src/lib/hooks/useColecao.ts + src/lib/rma/colecao.tsx — hoje só produtividade/prazo/normalizacao usam) em todas as 8, com chips/selects específicos no slot extra que o ColToolbar já aceita. Exceções documentadas no código: C.6 sem paginação (subtotais por categoria + rodapé '✓ bate com a PQ' dependem do corpo contínuo — busca e sticky columns sim) e totais sempre calculados sobre o conjunto completo, rotulados.

**T6 · Seletor de período (?bm) respeitado, ignorado ou inacessível dependendo da aba — e 4 ParamBars diferentes para o mesmo conceito**

- Abas: C.2 Indicadores (ignora ?bm), Responsabilidade (aceita ?bm só por URL manual), C.3/C.4 (respeitam), C.6/C.7 (barras de parâmetros próprias: ifd-pbar, prod-param-bar)
- Proposta: useRmaCorte() universal em toda aba com corte + um componente RmaParamBar compartilhado (Data de corte · BM corrente · Horizonte + slots por aba) no slot direito do header — unifica FatParamBar, ifd-pbar, prod-param-bar e a ParamBar solta da C.2, e resolve o seletor ausente da Responsabilidade de graça.

**T7 · A 'voz' da análise IA muda de roupa por aba: card escuro ink, card claro com tag brand, ou stub**

- Abas: C.8/C.10/C.11 (card escuro 'Leitura/Diagnóstico'), VG/C.3/C.7/C.9/C.12/Responsabilidade (card claro tag brand), C.2/C.4 (stub pendente)
- Proposta: Um AnaliseIaCard único (claro, tag brand UPPERCASE, FormattedText com negrito, estado pendente honesto embutido) para tudo que é Adm Contratual IA; o card escuro fica reservado ao diagnóstico DERIVADO do dado (não-IA), sempre como <div> (gotcha DS: <Card> em fundo --ink quebra no build). Alinhar com o dono se as duas identidades coexistem — hoje a distinção IA×derivado é acidental, não intencional.

**T8 · Erro mascarado como pendência ou sem retry em 4 abas — viola 'erro ≠ pendente' e o padrão de estados**

- Abas: C.2 (hooks secundários viram PanelPendente), C.8 (e2 engolido vira EmptyState de normalização), C.12 (diz 'tente recarregar' sem botão), C.3 (select de recorte silencioso)
- Proposta: Padrão único ErroCard (EmptyState + Badge danger + Button outline 'Tentar de novo' via refetch) e regra escrita: erro NUNCA renderiza como EmptyState de pendência/normalização — pendência é ausência honesta de dado, erro é falha recuperável. Os 4 achados individuais já apontam isso; consolidar num componente evita a 4ª variação.

### Quick wins transversais (atacam várias abas de uma vez)

1. Rollout do toolkit useColecao + ColToolbar/ColPag/ColVazio (já existe em src/lib/hooks/useColecao.ts e src/lib/rma/colecao.tsx) nas 8 abas que propuseram toolbar bespoke — busca com debounce+clear, ordenação, paginação 8-12, empty filtrado e contador saem de UMA passada, com exceções documentadas (C.6 sem paginação por causa dos subtotais e do gate '✓ bate com a PQ')
2. ChartTooltip + ChartLegend compartilhados no DS (pt-BR, tabular-nums, swatches cheia/tracejada/barra, dots de farol, tokens-only) + convenção única de cor de série (Real = navy --rma-navy com override dark; Previsto/Contratado = info/text-4; danger só para desvio) — mata de uma vez os 3 tooltips default do Recharts, as 6 legendas custom divergentes e o conflito de 3 cores propostas para 'Real'
3. Varredura de farolLabel/farolToBadge: grep por 'OBS', 'Atenção', 'Alerta', 'Defasado', 'Observar', 'Em conformidade' e troca pelos helpers canônicos de src/lib/mocks/contracts.ts — corrige VG, C.4, C.9 e o mapa duplicado de eventos da VG numa tarde; 'Pendente' permanece apenas como ausência de dado
4. Passada única de literais chumbados: grep por 'BM 03', 'mar/26', '112 mm', contrato/corte/marco da C.6, narrativa semi-hardcoded da C.8 e IDX_HINT → derivar tudo do read-model. É o quick win de maior risco evitado: são números que passam a MENTIR na próxima obra/BM. Incluir aqui o wrapper overflow-x da matriz de nexo da C.10 (corte de conteúdo <900px)
5. Varredura de glifos → lucide/spans: ⚠ ▸ ┊ ①②③ ▲▼ ● ✓ em C.2/C.3/C.6/C.8/C.9 (TriangleAlert, ChevronRight, amostra tracejada em CSS, TrendingUp/Down, span dot 8px) — um grep, consistência imediata, e o fix da C.6 propaga de graça pra D.5 que compartilha componente
6. ErroCard padrão (EmptyState + Badge danger + Button outline retry via refetch) aplicado em C.2, C.3 (select de recorte), C.8, C.12 e nos gates raiz — junto com a regra escrita 'erro nunca renderiza como EmptyState de pendência'
7. Receita de Skeleton com forma real (param bar fina → deck de KPIs → painéis 300-400px → bloco de tabela) documentada uma vez e replicada — 10 das 13 abas foram flagradas com skeleton genérico; são ~10 linhas de JSX por aba reusando classes existentes
8. RmaParamBar compartilhada + useRmaCorte universal — unifica as 4 barras de parâmetros existentes (C.2, C.3, C.6, C.7), conserta a C.2 ignorando ?bm e entrega o seletor de BM da Responsabilidade com o mesmo componente _[entregue parcialmente: RmaParamBar adotada em C.2/C.3/C.6; picker global habilitado p/ Indicadores; o seletor de BM da Responsabilidade segue local e o picker global desabilitado nela — gate em rma.tsx]_

### Propostas VETADAS pelo revisor (não executar)

- ✗ **[C.4 Recursos]** OMISSÃO dos analistas: nenhum dos 10 achados corrige o mapa local de recursos.tsx L906-909 que renomeia os 4 níveis do farol para 'Em conformidade / Observar / Alerta / Defasado' (confirmado no código)
  - Motivo: Viola a Regra do Farol §2 (níveis fixos Conforme/Observação/Risco/Crítico, nada de variantes) e §8 (usar farolLabel, não duplicar mapas). A onda de refino da C.4 DEVE incluir a troca pelos helpers canônicos — aprovar os 10 achados sem este é perpetuar a pior violação da aba.
- ✗ **[C.8 Curvas]** GapCards tingidos pelo responsável: 'temGap → tom do responsável (danger p/ Contratante, warning p/ Contratada, info p/ execução)' no fundo do card
  - Motivo: Cria um terceiro eixo semântico de cor em fundo de card: danger passaria a significar 'Crítico' numa aba e 'Contratante' na vizinha — e contradiz frontalmente a proposta da aba Responsabilidade (achado 5: a pill é a ÚNICA portadora da cor da parte; valores neutros). Ajustar: card neutro + Badge do responsável (a pill já carrega o tom); o destaque 'MAIOR GAP' via color-mix brand (padrão canônico de card ativo) está aprovado.
- ✗ **[C.10 Panorama]** Barra segmentada fina colorida DENTRO da célula CONSOLIDADO como micro-sumário da distribuição do farol
  - Motivo: Barra colorida fina dentro de card lê como tarja — exatamente o visual vetado pelo dono (jun/2026), ainda que carregue dado. Cortar essa variante e adotar a alternativa que o próprio analista oferece: chips '2 Conforme · 2 Risco · 2 Sem dado' ao lado do rótulo da seção, ou a barra FORA do card, como elemento de dado com legenda e tooltip.
- ✗ **[C.6 Insumos]** Variante 'o presethint pode virar title/tooltip dos botões Melhor/Pior cenário'
  - Motivo: Move instrução operacional sempre-visível para hover-only — esconder informação sem caminho descobrível viola a regra de não remover/esconder. Adotar a alternativa que o próprio achado oferece: presethint permanece visível, colado no grupo de presets com margin ajustada. O disclosure do ifd-srcinfo pode ficar (texto integral a 1 clique, rótulo explícito 'como os números são formados').
- ✗ **[C.9 Chuvas]** Paleta categórica dos CAL 1–6 incluindo var(--vault)
  - Motivo: --vault é token de DOMÍNIO ('seguro/sigiloso' — Vault) — usá-lo como cor categórica de gráfico viola 'cor por intenção' e contamina a semântica quando o produto exibir conteúdo Vault de verdade. O resto da paleta está ok (brand, brand-600, info, ink-600 e text-3 existem em tokens.css); substituir o vault por --ink-700 ou criar token de paleta categórica em tokens.css antes de usar (regra de ouro).
- ✗ **[C.12 Plano de Ação]** Variante 'porQue vira linha própria com line-clamp: 2 + title= com o texto completo no hover'
  - Motivo: line-clamp + title nativo esconde texto contratual (o POR QUÊ do 5W2H) atrás de hover não-descobrível e inacessível por teclado/touch. Exigir a variante melhor que o próprio analista oferece: linha expansível com chevron abrindo o detalhe 5W2H completo (progressive disclosure real, conteúdo íntegro a 1 clique).
- ✗ **[C.3 Faturamento]** Badge no header com '● Risco · aderência 78,2%' — glifo ● textual dentro do Badge
  - Motivo: Contradiz a limpeza que a própria onda propõe na C.2 ('trocar o ● textual por span de 8px'): o Badge já porta a cor via tone, o caractere ● é ruído duplicado e inconsistente entre screen readers. Cortar o glifo; formato 'Risco · aderência 78,2%'. Vale como regra da varredura de glifos para todas as abas.

### Ordem de execução sugerida

- 1. Responsabilidade — único bug bloqueante do conjunto (aba morre em notFound para TODA obra real) + única violação viva do veto de tarja (barrinha 4px); ambos os fixes são baixo esforço.
- 2. Visão Geral — porta de entrada do RMA e a tela mais vista; 7 dos 10 achados são baixo esforço e é onde as convenções unificadas (farol, cor de série) ficam mais visíveis primeiro.
- 3. C.2 Indicadores — aba-síntese do farol com dois bugs de confiança (Badge 'Conforme' hardcoded contradizendo o card, erro mascarado como pendência) + ?bm ignorado; credibilidade do farol protege todas as outras.
- 4. C.3 Faturamento — aba ⭐ de maior uso diário; farol herói + toolbar do drill são alto impacto, e ela assenta a referência de ChartTooltip/legenda/Curva S que C.5 e C.8 vão copiar.
- 5. C.6 Insumos — literais chumbados (contrato/corte/BM/narrativas) quebram qualquer outra obra em produção; mover os KPIs pro topo é 1 movimento; contexto v53 ainda fresco na equipe.
- 6. C.4 Recursos — vocabulário de farol inventado nos Badges (veto/omissão) + ressalvas de conservação carregadas e invisíveis (dado escondido) + toolbar do ranking via toolkit.
- 7. C.11 Condutas — o toolkit useColecao encaixa direto (esforço baixo declarado pelo próprio analista) e o Badge 'Em curso' cravado corrige dado errado que também alimenta a Visão Geral.
- 8. C.5 Prazo — refinos de leitura (ReferenceLine do corte, rótulos de calendário, toolbar) que reaproveitam os padrões já assentados nas abas 2-7; nada bloqueante.
- 9. C.8 Curvas — legenda que promete tracejado e não entrega + narrativa semi-hardcoded pedem correção, mas os achados são médio esforço e dependem da convenção de cores/tooltip já fechada.
- 10. C.12 Plano de Ação — toolbar + full-width (remover o cap 1320px) + KPIs canônicos; médio esforço que colhe os componentes compartilhados prontos.
- 11. C.10 Panorama — os 2 bugs urgentes ('BM 03' e overflow da matriz) saem ANTES, na passada de literais dos quick wins; o snapshot novo e o grid 2-col ficam para esta posição.
- 12. C.7 Produtividade — a aba mais madura (já usa a toolbar canônica); achados são polish de gráfico e microcopy, impacto real menor.
- 13. C.9 Chuvas — reordenação e rodapé de totais valem, mas é a aba de menor tráfego e o headline segue estruturalmente bloqueado em RDO diário (fase 2 não construída) — refinar por último.

---

## Análise por aba

### Visão Geral (RMA · M2.1.2)

**JTBD**: Porta de entrada do RMA: o gerente de contrato (e o diretor) abre a Visão Geral para responder em ~30 segundos "como está o contrato neste BM — qual a situação geral, onde está crítico, quanto é o desequilíbrio e o que preciso fazer agora" — e daí saltar para a aba/tela especializada (Faturamento, Prazo, D.0, Condutas).

<details><summary><b>Inventário (o que a tela exibe hoje — nada disto sai)</b></summary>

- Hero navy: veredito Situação Geral + nº do BM + sub 'N de M frentes em estado crítico/avaliadas' (HeroStrip, L175-243)
- Hero · 3 métricas de contexto: Desequilíbrio acumulado (R$ + % do valor · D.0, pendente honesto), Faturamento do período (% + contratado no corte), Prazo decorrido (X/Y dias + término previsto)
- Grid de 5 cards de farol ordenados por severidade — Faturamento, Recursos, Produtividade, Prazo, Desequilíbrio — cada um com chip de ícone tingido, label de nível UPPERCASE, valor tabular, descrição e nota (BlocoFarolGrid, L316-354)
- Painel Composição do Desequilíbrio (D.0 · M3): KPI total acumulado + % do contrato, KPI resultado provável + % recuperação (D.11), barras ranqueadas por categoria (tela D.x, nome, barra, R$ cheio, % do total), linha 'Sem desequilíbrio apurado: …' (ComposicaoDesequilibrioPanel, L359-426)
- Card Diagnóstico do Adm Contratual IA: tag + Badge 'números a revisar', texto situaçãoGeral, pontos com Badge por tom, recomendação; fallback slim 'Pendente' (DiagnosticoCard, L253-289)
- Sub-tab Desempenho: 4 mini-gráficos — Curva de Faturamento (área contratado + linha real + projeção tracejada + ReferenceLine do corte + ReferenceDot + footer com pills de legenda e GAP), Alocação de Recursos (barras horizontais MOI/MOD/EQP contratado×real), Prazo Contratual e Desvio (donut decorrido/restante com % no centro), Liberação de Frentes (donut liberado + pill executado; estado pendente honesto quando C.8 ausente)
- Sub-tab Marcos & Ações: até 8 marcos C.5 (data, categoria·trecho, % concluído, Badge de status derivado por corte) + aviso 'Mostrando X de Y'; lista completa de Condutas C.11 (Badge de prioridade, gatilho, categoria·cláusula·documento); EmptyStates honestos (MarcosAcoesTab, L790-891)
- Sub-tab Síntese do Contrato: 12 pares label/valor — cliente, modalidade, valor contratado, saldo a faturar, assinatura, término previsto, prazo decorrido, reajuste, gestor, adm contratual, documentos indexados, TACs (SinteseTab, L895-927)
- Sub-tab Eventos & Entregáveis: eventos IA (tag de farol + título + meta) e grid de entregáveis-atalho, ambos com EmptyState honesto quando vazios (EventosEntregaveisTab, L947-1017)
- Estados: Skeleton com forma do conteúdo (VgSkeleton), EmptyState de erro com retry, EmptyState 'não normalizada'

</details>

**1. Veredito do hero não carrega o farol — classe morta `vg-hero-${situacao}` e Crítico idêntico a Conforme** · `hierarquia` · impacto 🔴 alto · esforço baixo

- Problema: HeroStrip (L192) monta `className={`vg-hero vg-hero-${bm.situacao}`}`, mas NENHUM `.vg-hero-critico/-risco/-observacao/-conforme` existe no CSS (só `.vg-hero-acao.vg-acao-*` em patterns.css, que é outro elemento, usado pela aba Indicadores). Resultado: o dado mais importante da tela — a Situação Geral — é texto branco sobre navy igual em todos os níveis. Um contrato Crítico e um Conforme abrem visualmente idênticos; o farol só aparece 200px abaixo, nos 5 cards.
- Proposta: Dar sinal de farol ao veredito sem tarja (regra dura): (a) dot de 8px na cor `FAROL_COLOR[bm.situacao]` ao lado de `vg-hero-verdict-value` + (b) tingir levemente o label 'Situação Geral' ou o value com a cor semântica via `color-mix(in srgb, var(--danger|warning|info|success) 70%, var(--on-accent))` nos modificadores `.vg-hero-critico` etc. que já são emitidos e hoje estão mortos. Aproveitar e apagar/usar a classe resolve o CSS morto. Nada muda de conteúdo, só o veredito passa a saltar.

**2. Mini-gráfico de Recursos: série Real sempre em --danger, tooltip sem pt-BR/unidade e subtítulo que descreve outro gráfico** · `grafico` · impacto 🟡 médio · esforço baixo

- Problema: MiniRecursosChart (L586-646): (1) a barra 'Real' usa `fill="var(--danger)"` fixo (L635) — vermelho semântico gritando mesmo quando a alocação real está abaixo/ok, violando 'cor por intenção' e destoando da Curva de Faturamento onde Real = brand; (2) o Tooltip não tem `formatter` (compare com o da Curva, L507-516) → números crus sem `toLocaleString("pt-BR")` e sem unidade (Hh / unid.×mês), sendo que a unidade existe em `bm.recursos.porGrupo[tipo].unidade`; (3) o subtítulo diz 'qtde mensal por grupo' (L600) mas o gráfico plota o ACUMULADO final (último ponto da curvaAcumulada, L589).
- Proposta: (1) Real = `var(--brand)` como default e `var(--danger)` só por `<Cell>` condicional quando `real > contratado` do grupo (farol de verdade, não cor fixa); ajustar a pill `vg-grafico-foot-pill-d` na mesma condição. (2) Adicionar `formatter` no Tooltip com `toLocaleString("pt-BR")` + unidade do grupo (a unidade já vem no read-model). (3) Corrigir o sub para 'contratado × real acumulado até o BM'. Nenhum dado sai; três sinais errados são corrigidos.

**3. GAP do faturamento sempre vermelho — `desvioFarol` já vem no bridge e é ignorado** · `dado-subaproveitado` · impacto 🟡 médio · esforço baixo

- Problema: O footer da Curva de Faturamento imprime `GAP {f.desvioAcumuladoPct}%` com `.vg-grafico-foot-gap { color: var(--danger) }` fixo no CSS (visao-geral.css L681-686). O tipo `FaturamentoBM` que a tela recebe já carrega `desvioFarol?: FarolLevel` e `aderenciaAcumuladoPct` (obras/types.ts L2106-2111) — o farol oficial calculado pela mesma régua da C.3 — e a Visão Geral joga isso fora, pintando de Crítico até um desvio Conforme.
- Proposta: Colorir o GAP com `FAROL_COLOR[f.desvioFarol]` (fallback `var(--text-2)` quando undefined) via a mesma técnica de CSS var inline usada nos cards de farol (`style={{ "--farol": … }}`), e acrescentar ao lado a aderência acumulada já disponível: `GAP -x% · aderência y%`. Zero fetch novo; o footer passa a contar a mesma história do card Faturamento acima.

**4. Condutas C.11 renderizam TODAS, sem cap, sem ordenação por prioridade — assimetria com os marcos ao lado** · `tabela` · impacto 🔴 alto · esforço baixo

- Problema: Em MarcosAcoesTab, os marcos têm tratamento premium: sort por criticidade, cap `MARCOS_VISIVEIS = 8`, contador 'X em risco' e microcopy 'Mostrando X de Y — veja todos na aba Prazo' (L788-854). As condutas, logo abaixo (L868-881), renderizam o array inteiro na ordem `ordem` do workbook: uma obra com 15-20 condutas produz um paredão de cards com as urgentes potencialmente no meio da lista — exatamente a coleção 5+ itens que a regra do projeto manda ordenar/limitar.
- Proposta: Espelhar o padrão dos marcos: ordenar por `prioTone` (urgente → importante → preventiva → resto, o helper já existe na L780), cap em 6-8 visíveis e rodapé 'Mostrando X de Y — priorizando urgentes. Veja todas na aba Condutas' (rota /contracts/$id/condutas já existe). Aproveitar o `status` da conduta (Sugerida/Em redação/Aceita — já carregado pelo read-model e não exibido) como `<Badge tone="neutral">` ao lado da prioridade. Nada é removido: a lista completa continua a 1 clique, e o dado `status` que hoje se perde aparece.

**5. Donut de Prazo promete 'Desvio' no título mas só mostra decorrido/restante — e o avanço físico-financeiro já está carregado** · `grafico` · impacto 🟡 médio · esforço médio

- Problema: MiniPrazoChart (L648-697): o título é 'Prazo Contratual e Desvio', mas o gráfico só tem decorrido × restante — o desvio prometido não existe no card. A comparação que daria sentido ao card (tempo decorrido % vs avanço financeiro real %) usa dados que a tela JÁ tem no mesmo objeto: `bm.faturamentoPct` (avanço real) vs `p.decorridoPct`. Detalhe extra: o donut de Liberação tem `role="img"` + aria-label (L726-727) e o de Prazo não — inconsistência de acessibilidade entre gêmeos.
- Proposta: Sem mudar a forma do card: (a) adicionar no footer uma terceira pill 'avanço real {bm.faturamentoPct}% vs {decorridoPct}% do prazo' (ou um segundo arco fino no donut com o avanço real, cor brand) — é o desvio físico-financeiro que o título promete, com dado já em memória; (b) se preferir não plotar, corrigir o título para 'Prazo Contratual' (microcopy honesto); (c) copiar o `role="img"`/aria-label do donut vizinho.

**6. Composição do Desequilíbrio sem navegação para as telas D.x e sem o vigente/quitado que o read-model entrega** · `navegacao` · impacto 🟡 médio · esforço baixo

- Problema: Cada linha do ranking exibe a tela de origem ('D.1', 'D.2'…, L403) como texto morto, sendo que todas têm rota viva em /contracts/$id/desequilibrio/\*. Quem quer entender a maior categoria precisa sair da aba e achar o item no menu. Além disso, `painel.resumo` traz `vigenteRs` e `quitadoRs` (desequilibrioPainel.ts L93-94) que a seção não mostra — num contrato com Quitação Trimestral (Cláusula 30) esse é o próximo dado que o jurídico pergunta.
- Proposta: (a) Adicionar um `<CardLink>`/link 'Abrir painel D.0 →' no header do vg-comp apontando para a tela-mãe do M3, e transformar o chip `vg-comp-bar-tela` em `<Link>` para a rota da respectiva tela (D.1→indiretos, D.2→bdi, D.3→encargos, D.4→valor-agregado, D.6→pontuais) com hover sublinhado; (b) no bloco de KPIs, acrescentar linha discreta 'vigente {fmtBRLmi} · quitado {fmtBRLmi}' em `--text-3`. Só adiciona atalho e um dado já carregado.

**7. Sub-tabs escondem o sinal de risco: marcos atrasados e condutas urgentes invisíveis até o clique** · `hierarquia` · impacto 🟡 médio · esforço médio

- Problema: Os labels das 4 sub-tabs (L124-129) são texto puro ('Marcos & Ações', 'Eventos & Entregáveis'). O nº de marcos atrasados/em risco (`emRisco`, calculado na L810) e o nº de condutas urgentes só aparecem DEPOIS de clicar — na porta de entrada do RMA, o gerente pode fechar a tela sem saber que há 3 marcos atrasados dormindo numa tab não selecionada.
- Proposta: O `TabItem.label` do DS já aceita `ReactNode` (Tabs.tsx L5-8): computar `emRisco` e `nUrgentes` no VgConteudo (os arrays `marcos`/`condutas` já estão no escopo) e renderizar contadores discretos no label — ex.: 'Marcos & Ações' + `<Badge tone="danger">3</Badge>` quando emRisco>0 (sem badge quando 0; nunca badge verde decorativa). Mesma técnica para condutas urgentes. Não muda estrutura nenhuma; só faz a tab avisar o que guarda.

**8. Skeleton com blocos fora de ordem vs o conteúdo real — o swap dá salto de layout que o próprio comentário promete evitar** · `estados` · impacto ⚪ baixo · esforço baixo

- Problema: VgSkeleton (L157-171) renderiza hero(92) → card 130px (diagnóstico) → 5 blocos → card 184 (composição) → detalhe; mas o VgConteudo real renderiza hero → BlocoFarolGrid → ComposicaoDesequilibrioPanel → DiagnosticoCard → tabs (L114-117). O comentário do skeleton (L154-156) afirma 'mesmas alturas/colunas… sem salto de layout', mas a ordem diverge (diagnóstico está na posição 2 do skeleton e na posição 4 do conteúdo), então o swap desloca os 5 cards de farol ~146px para baixo.
- Proposta: Reordenar os filhos do VgSkeleton para espelhar o conteúdo: hero(92) → blocos(160×5) → composição(184) → diagnóstico(130) → detalhe(300). Uma troca de 2 linhas que entrega o fade suave que o comentário descreve.

**9. Eventos IA com mapa de farol duplicado (classes .vg-evento-\* próprias) em vez do Badge/helpers canônicos — e 'OBS' abrevia nível fixo** · `consistencia` · impacto ⚪ baixo · esforço baixo

- Problema: EventosEntregaveisTab usa `EVENTO_TONE` + `.vg-evento-tag/.vg-evento-critico…` (tsx L940-945 + css L454-480) — um segundo mapa farol→cor co-localizado, duplicando o que `<Badge tone>`/`farolToBadge` (regra 8 do Farol no CLAUDE.md) já resolvem; o arquivo ainda define localmente `FAROL_COLOR`/`FAROL_LABEL` (L40-52) com 'OBS' como label de Observação — abreviação fora dos 4 nomes fixos do Sistema de Farol, usada tanto nos cards de bloco quanto nas tags de evento.
- Proposta: Trocar a tag custom do evento por `<Badge tone={farolToBadge(e.nivel)}>` (mesmo visual, ~30 linhas de CSS a menos e um mapa a menos para divergir), e trocar 'OBS' por 'OBSERVAÇÃO' no FAROL_LABEL (cabe no `vg-bloco-nivel` de 9.5px uppercase; se apertar em 5 colunas, reduzir letter-spacing, não o nome do nível). `FAROL_COLOR` local pode ficar (é cor por token, não Badge), mas importado de um único lugar se já existir equivalente.

**10. Liberação de Frentes: 'executado' só como pill de rodapé e `maiorGapRs` carregado mas nunca exibido** · `dado-subaproveitado` · impacto ⚪ baixo · esforço médio

- Problema: MiniLiberacaoChart (L700-761): o subtítulo anuncia 'liberado × executado vs contratado', mas o donut plota só liberado/a-liberar; o executado (`c8.alocadoPct`) vira uma pill de texto no rodapé — o cruzamento visual liberado×executado (a tesoura que denuncia frente liberada sem produção) não é desenhado. O read-model ainda entrega `maiorGapRs` e `contratadoAcumCorte` (curvasC8.ts L20-23) que a tela descarta. (Capacidade fica de fora por decisão consciente — comentário L699 — não propor.)
- Proposta: Adicionar um segundo arco fino concêntrico no mesmo PieChart (innerRadius menor, cor `var(--brand)`) com o executado — dois anéis: liberado (success) fora, executado (brand) dentro, centro mantém '% liberado'. No rodapé, acrescentar 'maior gap {fmtBRLmi(c8.maiorGapRs)}' em `--text-3` quando não-nulo. O card ganha exatamente o que o subtítulo já promete, com dado que já chega de graça.

### C.2 Indicadores e Farol

**JTBD**: Gerente de contrato e diretor abrem a C.2 para responder em ~30 segundos "a obra está saudável neste BM?": um farol consolidado (pior bloco) + 4 blocos (Faturamento, Prazo, Recursos, Insumos) com o porquê de cada nível, para decidir onde aprofundar (C.3–C.6) e o que reportar no RMA. É a tela-farol de consolidação, não de análise profunda.

<details><summary><b>Inventário (o que a tela exibe hoje — nada disto sai)</b></summary>

- Header local: título 'Indicadores e Farol' + subtítulo descritivo
- Barra de parâmetros (ParamBar): Data de corte · BM corrente · Horizonte em BMs
- Banner consolidado (pior bloco): nível de farol + mensagem contextual
- Card de bloco 1 · Faturamento: % avanço realizado grande + footer (acum/total em R$ mi + desvio p.p.) + Badge de farol
- Card de bloco 2 · Prazo: % decorrido grande + footer (dias decorridos/total + desvio p.p.) + Badge de farol
- Card de bloco 3 · Recursos: mini-lista MOD/MOI/EQP com % alocado + footer (desvio p.p. ou pendente) + Badge de farol
- Card de bloco 4 · Insumos: status ('Dentro do índice'/'Acima do IPCA') + footer (monitorados · acima do IPCA · desvio médio) + Badge de farol
- Nota da régua (Conforme ≥ −1 · Observação −3 a −1 · Risco −8 a −3 · Crítico < −8 · consolidado = pior bloco)
- Painel Curva de Faturamento: legenda 4 séries + ComposedChart (linhas acum. real/prevista, barras mensais previsto/real, 2 eixos Y) + footer dinâmico (resumo do BM corrente ou ponto em hover com aderência do mês e GAP p.p.)
- Painel Alocação de Recursos: 3 grupos (MOD/MOI/EQP) × 3 barras (contratado total / contratado até BM / real, com pendente = trilho vazio) + legenda de cores
- Painel Prazo: ProgressRing dias decorridos + linhas Prazo decorrido/restante (% e dias) + tabela (avanço físico real/prev · avanço financeiro real/prev · atraso físico acum.) + box de projeção de término (meses, Δ vs baseline, mensagem de mobilização/Windows)
- Bloco Análise de Insumos/Materiais: Badge de farol + 4 KPIs (insumos monitorados · valor contratado · desvio médio ponderado · repasse real) + DataTable Curva ABC top-8 (descrição, classe, % do total, preço orçado, preço real pago pendente '—') + nota do índice contratual/normativa
- Bloco Análise IA: badge 'IA' + pendente honesto (análise não gerada para o BM)
- Estados: Skeleton com forma aproximada · EmptyState de erro · EmptyState de obra sem normalização · PanelPendente por painel (recursos/prazo/insumos)

</details>

**1. Aba ignora o seletor de período do RMA (?bm) — inconsistente com C.3/C.4** · `navegacao` · impacto 🔴 alto · esforço médio

- Problema: O RmaPeriodoPicker é global do shell RMA (rma.tsx), mas indicadores.tsx L114 chama useFaturamentoBm(contractId) SEM o override, enquanto faturamento.tsx L51 e recursos.tsx L84 passam useRmaCorte(). Resultado: o usuário troca o BM no picker e a C.2 continua mostrando o corte default silenciosamente — data de corte, faróis, curva e recursos ficam dessincronizados das abas vizinhas.
- Proposta: Passar useRmaCorte() para useFaturamentoBm (o mesCorte devolvido já alimenta ParamBar e acumAteCorte, então boa parte da tela rebobina de graça). Para o desvioFatPp, estender fetchFaturamentoCalc/useFaturamentoCalc para aceitar corteBmOverride (calcularFaturamento já suporta via opts.corteBmOverride — é só plumbing, mesmo padrão de fetchFaturamentoBm). Nenhum dado muda no default (?bm ausente = comportamento atual).

**2. Farol de Insumos contraditório: Badge hardcoded 'Conforme' vs card que pode dizer 'Observação'** · `consistencia` · impacto 🔴 alto · esforço baixo

- Problema: InsumosBlock L881-883 renderiza <Badge tone="success">● Conforme</Badge> fixo e a nota L930-934 afirma 'farol Conforme', mas computeBlocos L1122 calcula nivel = 'observacao' quando excedente.acimaTeto.length > 0. Com itens acima do IPCA, o card do topo diz Observação e a seção de baixo diz Conforme — contradição de farol na MESMA tela, em dado real de R$611mi.
- Proposta: Extrair o nível num helper único (mesma expressão de computeBlocos: nAcimaIpca > 0 ? 'observacao' : 'conforme') e usar farolToBadge/farolLabel no header do bloco. Nota vira condicional: quando Observação, 'N itens acima do IPCA acionam repasse (cl. 8.8)'; quando Conforme, mantém o texto atual dos preços reais não lançados.

**3. Erro dos hooks secundários mascarado como pendência + erro raiz sem botão de retry** · `estados` · impacto 🔴 alto · esforço médio

- Problema: IndConteudo L211-215 lê só .data de useFaturamentoCalc/useRecursos/usePrazoBm/useInsumos/useInsumoExcedente. Se qualquer um FALHA (rede/RLS), data=undefined cai no PanelPendente 'ainda não normalizado' (L587, L712, L869) — erro vira mentira de pendência, violando a regra da casa erro≠pendência. E o EmptyState de erro raiz (L122-126) diz 'Tente recarregar' sem oferecer ação.
- Proposta: Propagar isError de cada hook e renderizar variante de erro do PanelPendente ('Não foi possível carregar recursos/prazo/insumos' + link 'Tentar de novo' chamando refetch()). No gate raiz, usar a prop action do EmptyState (já existe no DS): action={<Button variant="outline" onClick={() => fatBm.refetch()}>Tentar de novo</Button>}.

**4. Curva descarta a série de projeção e a linha de corte que o dado já carrega** · `dado-subaproveitado` · impacto 🔴 alto · esforço baixo

- Problema: A curvaS do bridge (bridgeFaturamento L173) traz o campo projecao (forecast acumulado) por BM, e a C.3 Faturamento plota essa linha (faturamento.tsx L609) + ReferenceLine no corte (L552). O CurvaPanel da C.2 (L465-503) plota só contratado/real/barras e joga a projeção fora — o gráfico fica 'incompleto' vs a irmã: não dá pra ver onde o real termina e a tendência começa, nem onde está o corte num horizonte de dezenas de BMs.
- Proposta: Adicionar <Line dataKey="projecao" strokeDasharray tracejada (mesma convenção visual da C.3) + <ReferenceLine x={rótulo do BM de corte}> com stroke var(--border-strong) e label discreta 'Corte'. Legenda ganha as duas entradas. Zero remoção — só séries já presentes no dado carregado.

**5. Eixos do gráfico sem unidade e tooltip suprimido (footer-swap esconde o resumo do BM corrente)** · `grafico` · impacto 🟡 médio · esforço baixo

- Problema: YAxis esquerdo (L445-452) tem tickFormatter (v)=>`${v}` sem indicar que é R$ mi; o direito (L453-460) nem sinaliza que é a escala mensal das barras. O Tooltip (L461-464) é content={() => null}: o detalhe do ponto vai pro footer (CurvaFooter), que TROCA de conteúdo no hover — o resumo fixo do BM corrente desaparece enquanto o mouse passeia, e o valor lido fica longe do cursor.
- Proposta: Manter o footer FIXO com o resumo do BM corrente e mover o detalhe do ponto para um tooltip flutuante Recharts formatado pt-BR (fmtMiVal/fmtPp, mesmos campos de hoje: real/previsto do mês, aderência, acum., GAP). Nos eixos, rótulo discreto 'R$ mi (acum.)' / 'R$ mi (mês)' via label ou tick com sufixo. Alternativa mínima sem tooltip: footer com duas linhas (fixa + linha de hover).

**6. Horizonte longo esmaga as barras mensais — falta zoom/range no painel da curva** · `grafico` · impacto 🟡 médio · esforço médio

- Problema: O ParamBar mostra horizonte de N BMs (dezenas na BR-101) e o CurvaPanel espreme tudo em ~1.6fr de coluna com height 210: as barras Previsto/Real do mês ficam com 2-3px, ilegíveis e sem hover útil, justamente a série que sustenta a 'Aderência do mês' do footer.
- Proposta: Segmented compacto no ind-pan-head ('12 BMs · 24 BMs · Tudo', default Tudo — nada some) fatiando a curva client-side em volta do corte, ou <Brush> do Recharts com janela inicial nos últimos 24 BMs. Só zoom de leitura; dado íntegro.

**7. Tabela ABC: top-8 sem contador do total, sem ordenação/busca, e classe ABC toda verde** · `tabela` · impacto 🟡 médio · esforço médio

- Problema: L845 faz .slice(0, 8) da curvaAbcValor sem dizer quantos itens existem no total — o usuário não sabe que há mais nem consegue vê-los (o read-model já carrega a lista completa). DataTable sem ordenação/busca contraria a regra de coleções 5+. E .ind-abc-cls (css L545-548) pinta TODA classe (A, B e C) com var(--success) bold — verde sugere farol 'Conforme', mas classe ABC é concentração de valor, não julgamento.
- Proposta: Header da coluna vira 'Principais materiais (Curva ABC) · 8 de N' + link 'Mostrar todos' que expande com paginação client-side (8/página) e busca com clear + ordenação (% do total default · A-Z · classe). Coluna '% do total' ganha micro-barra inline (trilho var(--surface-3), fill var(--info)) — leitura Pareto imediata do dado existente. Classe vira peso neutro: A em var(--text) bold, B/C em var(--text-3) (ou <Tag> neutra), sem verde semântico.

**8. Micro-tipografia hardcoded abaixo da escala do DS no painel de Recursos e legendas** · `consistencia` · impacto 🟡 médio · esforço baixo

- Problema: indicadores.css usa font-size cru fora dos tokens: 10px nas legendas (L285, L404), 10px no sublabel (L347), 9.5px nos rótulos de barra .ind-bk (L357) e 10.5px nos valores .ind-vv (L384). Abaixo do menor token (--fs-12), ilegível em monitor denso e inconsistente com o resto do app — é o painel mais 'apertado' da tela.
- Proposta: Subir para var(--fs-12) (rótulos, valores e legendas) ajustando as larguras fixas .ind-bk (76px→~92px) e .ind-vv (46px→~56px); se algum precisar ficar menor que fs-12, criar token de exceção em tokens.css em vez de px solto. Nenhum conteúdo muda, só legibilidade e aderência à escala.

**9. ParamBar como linha solta e '●' textual nos Badges/banner** · `hierarquia` · impacto 🟡 médio · esforço baixo

- Problema: O ind-head (L148-156) é flex space-between mas só ocupa o lado esquerdo; a ParamBar (L272-300) vem como linha independente logo abaixo, gastando uma faixa vertical inteira antes do banner — o farol consolidado (a informação nº1 da tela) só aparece na 3ª faixa. Além disso, o banner (L321) e os Badges (L356, L882) usam '●' como caractere de texto: lido por screen reader, baseline desalinhada e fora do padrão dot 8px do DS.
- Proposta: Mover a ParamBar para o slot direito do ind-head (mesma linha do título — o espaço já existe e é o padrão das outras abas com ações no header), subindo banner e cards uma faixa. Trocar o '●' textual por <span aria-hidden> de 8px com border-radius pill e background currentColor — mesmo visual, semanticamente limpo.

**10. Prazo: box de projeção com classe 'danger' pintada de warning e desvio do card sem qualificação** · `microcopy` · impacto ⚪ baixo · esforço baixo

- Problema: (a) css L494-497: .ind-pbox.tone-danger usa var(--warning-bg)/var(--warning) — a classe diz danger, o token diz warning, e o projTone (tsx L728-729) inventa escala própria neutral/danger/success fora dos 4 níveis do farol. (b) O footer do card Prazo (L1058) mostra 'desvio −X p.p.' com o MESMO número do card Faturamento (ambos usam desvioFatPp) sem dizer que é o desvio FINANCEIRO emprestado — parece bug de copy-paste para quem compara os dois cards.
- Proposta: Renomear/alinhar: delta>0 → classe tone-warning com tokens warning (Risco), delta<0 → tone-success (Conforme), delta≈0 → neutral — vocabulário do farol de 4 níveis, sem inventar nível novo. No footer do card Prazo, microcopy 'desvio fin. −X p.p.' (e title/tooltip 'farol pelo desvio financeiro; físico a medir') deixando explícita a proveniência enquanto o avanço físico está pendente.

### C.3 Faturamento

**JTBD**: Como gerente do contrato (e diretor no fechamento do RMA), preciso responder em segundos se a obra está faturando no ritmo contratado até o BM de corte, quanto falta a faturar e onde (disciplina × frente) está o gap — para cobrar medição, repriorizar frentes e fundamentar prorrogação/Pleito com a aderência oficial (régua 90/85/70).

<details><summary><b>Inventário (o que a tela exibe hoje — nada disto sai)</b></summary>

- Header local: título "Faturamento" + subtítulo (FatHeader, L119-134)
- Barra de parâmetros: BM corrente · Data de corte · Horizonte N BMs (FatParamBar, L138-158)
- Deck 1 · 6 KPIs de acumulado: Contratado Total, Contratado Acum. até BM, Real Acum. até BM, Desvio Acumulado (% + TrendIndicator + R$), Saldo a Faturar (% + meses restantes), % Total Executado (FatKpis, L173-236)
- Curva S (ComposedChart): barras mensais Previsto/Real (eixo dir.) + linhas Prev. acum./Real acum./Projeção (eixo esq.) + ReferenceLine "data de corte" + legenda custom + hint de hover (CurvaSCard, L404-623)
- Tooltip rico da curva: previsto/real do mês, acumulados, aderência do mês, desvio acumulado (CurvaTooltip, L349-402)
- Controle de recorte da curva: Segmented Por Disciplina/Por Frente + Select de item (Todos + 15 disciplinas ou 17 frentes, série mensal própria via serie_mes paginado) (L493-514)
- Resumo BM a BM: tabela lateral com todos os BMs (BM · Previsto · Real · Ader.), header sticky, linha corrente destacada (warning-bg), linha TOTAL com Σ e aderência no denominador do corte (ResumoBmCard, L629-706)
- Deck 2 · 6 cards de período/projeção: Faturado no mês, Previsto p/ o mês, Aderência no período, Ritmo médio 3 BM, Projeção por ritmo (Δ vs prazo tingido pelo sinal), FAROL Aderência acum. até o corte — o farol oficial da tela (FatProjecaoDeck, L252-335)
- Alerta de prorrogação (aside condicional warning, L327-332)
- Drill Faturamento Disciplina × Frente: Segmented de modo, tabela expansível pai→filho (cruzamento auxiliar_C.3), macro-grupos nas frentes, colunas Contratado/Acum.BM/Real/Aderência/Farol (Badge), linha TOTAL, hint de rodapé com a régua (DrillSection+DrillTabela, L768-1023)
- Análise do período · Adm Contratual IA com **negrito** (AnaliseTextualCard, L712-723)
- Estados globais: Skeleton de loading, EmptyState de erro, EmptyState "não normalizado", CardErro com retry por seção do drill (L56-75, L104-115, L1058-1077)

</details>

**1. Farol oficial da tela enterrado na última posição do segundo deck** · `hierarquia` · impacto 🔴 alto · esforço baixo

- Problema: O card "FAROL · ADERÊNCIA ACUM." — que o próprio código chama de "o farol oficial da tela" (comentário L239-241) — é o 6º card do Deck 2 (L315-325), abaixo da Curva S e do Resumo BM a BM. No primeiro viewport o usuário vê 6 KPIs neutros idênticos e nenhum veredito; o sinal mais importante da aba exige scroll e não tem destaque algum sobre os 5 vizinhos size="sm".
- Proposta: Sem mover blocos: (a) ecoar o farol no header local — um <Badge tone={FAROL_TONE[fat.aderenciaFarol]}> ao lado do h2 em FatHeader (ex.: "● Risco · aderência 78,2%"), passando fat como prop; (b) dentro do Deck 2, mover o card de farol para a 1ª posição e dar tratamento herói canônico: fundo/borda tingidos via color-mix(in srgb, var(--warning|danger|...) X%, var(--surface)) conforme o tom do farol (nunca tarja de borda). Nenhuma informação sai do lugar semanticamente — só o veredito passa a saltar primeiro.

**2. Deck 1 sem chips de ícone — inconsistente com o Deck 2 e com o KPI canônico** · `consistencia` · impacto 🟡 médio · esforço baixo

- Problema: Os 6 FarolCard do Deck 1 (FatKpis, L177-233) não passam `icon`, enquanto os 6 do Deck 2 usam icon="wallet|calendar|trending|repeat|clock". Resultado: a primeira dobra é uma parede de 6 cards cinzas idênticos sem âncora visual, e a tela contradiz o padrão canônico do projeto (chip com ícone no topo-esquerdo, exemplar /desequilibrio/indiretos) dentro da própria página.
- Proposta: Adicionar `icon` aos 6 cards do Deck 1 usando chaves já existentes do mapa I do DS (mesma família do Deck 2): ex. Contratado Total→doc/briefcase, Contratado Acum.→calendar, Real Acum.→wallet, Desvio→trending, Saldo a Faturar→clock, % Executado→percent/target (o que existir no mapa). Mantém accent="neutral" e todos os textos; só ganha a âncora visual do padrão.

**3. Eixo direito da Curva S sem unidade e legenda sem mapa de eixos** · `grafico` · impacto 🔴 alto · esforço baixo

- Problema: O YAxis das barras mensais (yAxisId="mes", L540-547) formata o tick como número cru (`${v}`), sem "R$ mi", enquanto o esquerdo mostra "R$ 600 mi". Com dois eixos em escalas ~60× diferentes (acumulado ~611mi × mensal ~10mi), nada na legenda custom (L466-490) diz qual série lê em qual eixo — risco real de leitura errada num contrato de R$611mi.
- Proposta: (a) tickFormatter do eixo direito → `${v} mi` (fs-11 var(--text-4) já diferencia do esquerdo); (b) na legenda custom, sufixar os grupos: "Previsto (mês · eixo dir.)" / "Real (mês · eixo dir.)" e "Prev. acum. (eixo esq.)" — ou um separador visual entre os dois grupos de legenda com micro-rótulos "Acumulado" / "No mês". Tudo tokens, nada de série removida.

**4. Card de projeção rotula "Earned Schedule" que o próprio código diz não ser — e "mês 107" é abstrato** · `microcopy` · impacto 🔴 alto · esforço baixo

- Problema: O sub do card PROJEÇÃO POR RITMO (L312) diz "vs prazo · Earned Schedule (cronograma ganho)", mas o comentário do deck (L239-241) e do tipo PeriodoFat (types.ts L2076-2077) afirmam explicitamente que NÃO é Earned Schedule (não há série física; é projeção por ritmo financeiro). Num produto que alimenta Pleito/Claim, rotular método técnico errado é passivo jurídico. Além disso o valor "mês 107" não diz quando é isso no calendário.
- Proposta: Trocar o sub para "+61,4 meses vs prazo contratual · projeção por ritmo financeiro (média 3 BMs)". Opcionalmente enriquecer o valor com a data estimada derivada dos rótulos da própria curva ("mês 107 · ~out/33") — os pontos curvaS já trazem "mai/26" etc., é só somar meses ao primeiro rótulo; se o parse falhar, mantém só "mês 107" (nunca fabrica).

**5. Resumo BM a BM abre no BM-01 e esconde o BM corrente** · `tabela` · impacto 🟡 médio · esforço baixo

- Problema: A tabela lateral tem os 46 BMs em .fat-resumo-scroll (css L398-406) e destaca a linha corrente com warning-bg (L662), mas o scroll inicia no topo — o mês que o gerente veio ver (o corrente, ~linha 5-46 dependendo do corte) pode ficar fora de vista e nada indica que há destaque lá embaixo.
- Proposta: Ref na linha `corrente` + useEffect com scrollIntoView({ block: "center" }) no mount (behavior "auto" — respeita prefers-reduced-motion), rolando o container .fat-resumo-scroll até o BM corrente. Todos os BMs continuam acessíveis por scroll; só a posição inicial passa a ser a útil.

**6. Aderência do Resumo BM a BM já é calculada linha a linha mas não acende farol** · `dado-subaproveitado` · impacto 🟡 médio · esforço baixo

- Problema: Cada linha calcula `ader` (L655-659) e o TOTAL calcula aderTotal (L636), mas a coluna "Ader." exibe só o % cru — o usuário precisa comparar mentalmente 46 números contra a régua 90/85/70 que a própria tela usa no drill e no farol oficial (classificarPorRegra já importado, L34). O dado do farol existe e é subaproveitado.
- Proposta: Adicionar um dot 8px (padrão de farol do projeto) antes do % em cada linha medida, colorido via classificarPorRegra("faturamento_aderencia_acumulada", ader) → var(--success|info|warning|danger); meses sem real seguem "—" sem dot (pendente ≠ zero). No TOTAL, um title/hint explicando o denominador ("Σ real ÷ Σ previsto até o corte — mesma base do farol oficial"), que hoje só vive em comentário de código (L630-631).

**7. Drill Disciplina × Frente (15-17 linhas + filhos) sem busca nem ordenação** · `tabela` · impacto 🔴 alto · esforço médio

- Problema: DrillSection (L768-806) rende 15 disciplinas ou 17 frentes (+ macro-grupos e filhos expandíveis) sempre na ordem fixa do template. Para achar "Pavimentação" ou o pior farol, o usuário escaneia tudo. A regra dura do projeto exige busca + ordenação em qualquer coleção 5+ — e esta é a coleção central de decisão da aba.
- Proposta: Toolbar acima da tabela, dentro do fat-d2-head: Input de busca (debounce 250ms, clear ×, placeholder "Buscar disciplina ou frente…") que filtra pais E filhos (pai cujo filho casa permanece e auto-expande), com contador "X de 15 disciplinas"; Select compacto de ordenação: "Ordem do template" (default) · "Maior contratado" · "Pior aderência". Empty filtrado próprio com ação "Limpar busca". A linha TOTAL permanece fixa somando o conjunto completo (não o filtrado, rotulado) — nada é removido, só reordenado/filtrado sob demanda.

**8. Linhas expansíveis do drill inacessíveis por teclado e carets em glifo de texto** · `navegacao` · impacto 🟡 médio · esforço baixo

- Problema: A linha clicável é um div com onClick (L989-993) sem role="button", tabIndex ou handler de teclado — impossível expandir via Tab/Enter e sem focus ring (regra do projeto: focus visível em todo controle interativo). Os carets ▾/▸ (L995) e o "▸" do hint (L801) são glifos de texto, quando o padrão do projeto é lucide-react.
- Proposta: Nas linhas com filhos: role="button", tabIndex={0}, onKeyDown (Enter/Espaço), aria-expanded={aberta}, e :focus-visible com box-shadow: var(--ring) no .fat-d2-row.clicavel. Substituir o glifo por <ChevronRight size={14}/> do lucide com transform: rotate(90deg) em .aberta e transition via var(--easing). Zero mudança de layout.

**9. Hint da régua nomeia cores ("verde/azul/amarelo/vermelho") em vez do vocabulário do Farol** · `microcopy` · impacto ⚪ baixo · esforço baixo

- Problema: O rodapé do drill (L800-804) explica a régua como "verde ≥ 90% · azul ≥ 85% · amarelo ≥ 70% · vermelho < 70%" — diverge do vocabulário canônico (Conforme/Observação/Risco/Crítico) usado no Badge da coluna ao lado, e falha para daltônicos/dark-mode onde "a cor" não é auto-evidente.
- Proposta: Reescrever: "Aderência = real ÷ contratado-acum. · ● Conforme ≥ 90% · ● Observação ≥ 85% · ● Risco ≥ 70% · ● Crítico < 70%", com os dots como spans coloridos via tokens semânticos (não caractere ●) — o nome do nível carrega o significado, a cor só reforça. Aproveitar e tirar o itálico (fat-d2-hint) para casar com o resto das notas da tela.

**10. Select de recorte da curva mascara loading/erro e o Skeleton global não espelha a página** · `estados` · impacto 🟡 médio · esforço baixo

- Problema: Dois gaps de estado: (1) CurvaSCard usa useFaturamentoSerieMes (L414-417) mas, enquanto carrega, o Select mostra só "Todos (visão geral)" e, se a query falhar, os 32 recortes somem em silêncio — erro mascarado como ausência, exatamente a área cega que o projeto veta ("falha alto"). (2) FatSkeleton (L104-115) mostra 6 cards + 1 bloco de 320px, mas a página real tem param bar, grid 2 colunas [curva|resumo], segundo deck de 6 e o drill — o loading não tem a forma do conteúdo final (regra nº4 do CLAUDE.md).
- Proposta: (1) No isLoading da série: Select disabled com item único "Carregando recortes…"; no isError: nota fs-12 var(--danger) ao lado do controle ("Recortes indisponíveis · Tentar de novo") com botão ghost de refetch — a curva geral continua funcionando. (2) Estender FatSkeleton: linha fina 24px (param bar) → 6×88 → grid minmax 1.9fr/1fr com dois blocos ~340px → 6×72 → bloco 360 (drill). Só skeleton, sem custo de dado.

### C.4 Recursos (RMA · /contracts/$contractId/rma/recursos)

**JTBD**: O gerente de contrato abre a aba pra responder: "a mobilização real de MOD/MOI/EQP está aderente ao plano contratado até o BM — e há indício de improdutividade (mais recurso pro mesmo avanço de faturamento) que alimente o pleito no M3?" O jurídico usa os mesmos números (Total Cost ajustado, Valor Agregado, ranking de desvios por função) como base contemporânea do Measured Mile/Claim.

<details><summary><b>Inventário (o que a tela exibe hoje — nada disto sai)</b></summary>

- Header local: título 'Recursos · MOD / MOI / Equipamentos' + subtítulo + Segmented MOD/MOI/EQP + Badge de conservação (Conservação OK / Em revisão)
- Banner honesto 'Sem alocação real em {cat}' quando !temReal (rec-aviso, L171-182)
- Seção 'Por categoria — acumulado até o BM': 3 KPI cards MOD/MOI/EQP com aderência % grande, Badge de farol de alocação (Pendente/Em conformidade/Observar/Alerta/Defasado ± abaixo/acima), Total contrato, Contratado BM, Real BM, Diferença, Δ Total Cost + nota explicativa da régua (RecKpis, L243-316)
- Seção 'Histograma de alocação · {cat} · mês a mês' com segundo Segmented + Card 'Curva de efetivo': barras mensais contratado/real + linhas acumuladas em eixo direito, toggle Acum.(qtde)/Custo(R$), legenda custom, tooltip custom rico (RecCurvaEfetivo, L1068-1236)
- Card 'Resumo · {cat}': tabela 2×3 Qtde/R$ × Contr./Real/Desvio acumulado até o BM (RecResumoCat, L320-362)
- Card 'Maiores desvios de alocação': tabela por função/equipamento (Recurso, Contr., Real, Δ em R$ acum) com scroll 320px e header sticky + nota de snapshot quando ?bm override (RecMaioresDesvios, L366-421)
- Banner 'Cruzamento faturamento × recursos · indício de improdutividade?': aderência de faturamento vs recursos por categoria + veredito + ponteiro pro Módulo 3 (RecCruzamento, L655-724)
- Card 'Total Cost + ajuste pelo avanço': tabela 7 colunas (Grupo, Contratado, Real, Desvio, Contr. ajust., Desvio ajust., Farol) × MOD/MOI/EQP em qtd e R$ + linha TOTAL + nota metodológica AACE 25R-03 (RecTotalCost, L749-882)
- Card 'Composição da equipe': barras de participação por quantidade (contratado × real) por categoria + legenda + nota do %Real condicionado a todas medidas (RecComposicao, L923-999)
- Seção 'Valor Agregado (AACE 25R-03) · perda de produtividade': Badge de farol total + gráfico de linhas Custo real × VA medido (acum., R$ mi) + tabela MOD/EQP/TOTAL (VA medido, Real alocado, Perda, % sobre PV) + nota 'VA por serviço medido' (RecValorAgregado, L453-612)
- Card 'Análise do Período — Adm Contratual IA' (pendente honesto, RecIaStub L425-440)
- Estados: loading Skeleton, erro com retry, empty 'Recursos ainda não normalizados', empties parciais (sem histograma / ranking pendente / VA pendente / série mensal pendente)

</details>

**1. Ranking 'Maiores desvios de alocação' é coleção de ~100+ funções sem busca, ordenação nem contador** · `tabela` · impacto 🔴 alto · esforço médio

- Problema: RecMaioresDesvios (recursos.tsx L366-421) despeja TODAS as funções/equipamentos do detalhe (41 MOD + 66 EQP + dezenas de MOI, via detalheParaDesvios L63-77) numa tabela de scroll 320px (.rec-md-scroll) sem busca, sem alternativa de ordenação (só |Δ| fixo), sem contador e sem empty filtrado — violação direta da regra de coleção 5+ do CLAUDE.md. Irônico: o comentário do topo do arquivo (L5) promete 'busca/ordenação/paginação' que não existem no código. Achar 'GUINDASTE 500T' exige rolar às cegas. O título tampouco diz a categoria ativa (troca com o Segmented mas o header fica igual).
- Proposta: Toolbar compacta dentro do card: Input de busca (debounce 250-300ms, clear ×, placeholder 'Buscar função ou equipamento…'), contador 'N de M funções' no CardSub, e Segmented/Select de ordenação (|Δ| — default · Δ+ overspend · Δ− subalocação · A-Z). Manter o scroll com header sticky (funciona bem) e adicionar empty filtrado distinto com ação 'Limpar busca'. Título vira 'Maiores desvios de alocação · {cat.label}' (mesmo padrão do card Resumo ao lado).

**2. Ressalvas de conservação são carregadas, têm CSS pronto, e nunca aparecem — e o Badge diz 'Conservação OK' mesmo com ressalva** · `dado-subaproveitado` · impacto 🔴 alto · esforço baixo

- Problema: O read-model monta data.ressalvas (recursos.ts L283-297: 'MOI: histograma soma X; lista detalha Y (parcial)', 'custo R$ vem do histograma, fonte não traz R$ por função') e o recursos.css já tem .rec-ressalvas/.rec-ressalvas-head/.rec-ressalvas-list prontos (L61-83, CSS morto) — mas o .tsx nunca renderiza o bloco. Pior: o Badge do header (L144-145) mostra 'Conservação OK' sempre que status !== needs_review, contrariando o contrato documentado no próprio read-model (recursos.ts L97-99: ressalvas não-vazias → 'Conservação parcial'). Numa plataforma onde 'erro de valor = milhões', esconder a ressalva de que o R$ do MOI é agregado é um furo de honestidade.
- Proposta: Renderizar o aside .rec-ressalvas (fundo --info-bg, head uppercase 'Ressalvas de conservação' + lista) logo abaixo do header quando ressalvas.length > 0, e o Badge passar a três estados: 'Em revisão' (warning) · 'Conservação parcial' (info, quando há ressalvas) · 'Conservação OK' (success). Zero dado novo — só ligar o que já existe.

**3. Curva de efetivo não marca o corte do BM nem o pico de mobilização — dois dados que a tela já tem** · `grafico` · impacto 🔴 alto · esforço baixo

- Problema: A página inteira acumula 'até o BM' (KPIs, Resumo, Total Cost), mas o histograma (RecCurvaEfetivo, L1068-1236) não mostra ONDE o BM está na linha do tempo — o usuário não distingue visualmente passado medido de futuro planejado. E o read-model calcula picoQtde/picoLabel por categoria (recursos.ts L67-69, 235-238) que NENHUM componente exibe: o pico de mobilização é exatamente o número que o gerente usa pra planejar canteiro/alojamento.
- Proposta: No ComposedChart: <ReferenceLine x={periodoLabel do corte} stroke='var(--brand)' strokeDasharray='4 4' label='BM' /> (o corte já está disponível no componente-pai, L86 — só passar como prop) e um ReferenceDot/label discreto no mês do pico. Complementar com 'Pico: {fmtQtde(cat.picoQtde)} em {cat.picoLabel}' no CardSub da Curva de efetivo ou como linha extra do card Resumo. Nada muda de lugar; o gráfico ganha as duas âncoras de leitura.

**4. Gráfico do Valor Agregado usa tooltip default do Recharts (fora dos tokens, quebra dark) e não mostra a Perda — o número que dá nome à seção** · `grafico` · impacto 🟡 médio · esforço baixo

- Problema: RecValorAgregado (L533-539) usa <Tooltip formatter> default: caixa branca com estilos inline do Recharts, fora do DS e ilegível em dark mode — enquanto o histograma logo acima tem tooltip custom rico (.rec-tip). O tooltip mostra Real e VA mas NÃO a diferença (Perda = Real − VA), que é a razão de ser da seção 'perda de produtividade'. Detalhes: tickFormatter `R$ ${v} mi` (L531) imprime decimal com ponto ('R$ 2.5 mi', não pt-BR), e a nota 'VA por serviço medido' (L595-607) trunca nomes de serviço em 2 palavras num parágrafo corrido.
- Proposta: Reusar o padrão RecCurvaTooltip com as classes .rec-tip: 3 linhas — Custo real alocado, VA medido, e 'Perda no ponto' (real − va, em --danger quando > 0) — todas formatBRLAbbreviated. tickFormatter com toLocaleString('pt-BR'). A nota de serviços vira lista de Tags/linhas curtas ('CFTV · 12.480 un') com title= no nome completo, mantendo todo o conteúdo.

**5. Segmented MOD/MOI/EQP duplicado controlando o mesmo estado** · `poluicao` · impacto 🟡 médio · esforço baixo

- Problema: O mesmo useState tipo é controlado por DOIS Segmented idênticos: um no header da aba (L157-166) e outro no head da seção do histograma (L196-205). Competição visual, custo de escaneio (o usuário precisa perceber que são o mesmo controle) e manutenção dupla — mudou um, esquece o outro.
- Proposta: Manter UM Segmented — o da seção do histograma, que fica colado no conteúdo que ele troca (KPIs são cross-categoria e não dependem dele). No header, no lugar do controle, fica só o Badge de conservação. Alternativa igualmente válida: manter só o do header e a seção mostrar '· {cat.label}' no título (já mostra). Nenhuma informação é removida — é um controle redundante.

**6. KPI cards fogem do padrão canônico (ícone sem chip, sem hover-lift)** · `consistencia` · impacto 🟡 médio · esforço baixo

- Problema: Os 3 cards de RecKpis (L263-312; .rec-c04-kpi no CSS L421-493) colocam o ícone solto inline dentro do rótulo (.rec-c04-kpi-ic é só um grid transparente) e o card não tem hover — destoando do padrão canônico do CLAUDE.md (chip quadrado var(--r-sm)/var(--surface-2) no topo-esquerdo + rótulo → valor grande → sub, hover lift 2px + borda + sh-sm), cujo exemplar é /desequilibrio/indiretos. Numa suíte onde as outras abas reformadas seguem o template, a C.4 parece de outra geração.
- Proposta: Só CSS + 1 wrapper: .rec-c04-kpi-ic vira chip 28-32px com background var(--surface-2) e border-radius var(--r-sm); adicionar ao .rec-c04-kpi transition + :hover { transform: translateY(-2px); border-color: var(--border-strong); box-shadow: var(--sh-sm); } com @media (prefers-reduced-motion) desligando o transform. Estrutura interna (aderência grande, dl de stats, Δ Total Cost) permanece intacta.

**7. Banner do Cruzamento faturamento × recursos é uma parede de prosa com os números afogados** · `hierarquia` · impacto 🟡 médio · esforço baixo

- Problema: RecCruzamento (L692-723) espreme num único parágrafo: aderência do faturamento, as 3 aderências por categoria, o veredito (indício/sem indício/não medido) e o ponteiro pro Módulo 3. O dado central do JTBD da aba — 'recursos X% vs faturamento Y%' — está no meio de texto corrido, e as aderências por categoria viram uma string colada ('MOD 98% · MOI —% · EQP 102%') sem alinhamento tabular.
- Proposta: Manter 100% do conteúdo, reorganizando em 3 camadas dentro do mesmo aside: (1) linha de stats com pares rótulo→valor em tabular-nums (Faturamento · MOD · MOI · EQP, cada um num mini-item com dt/dd, o consolidado de recursos em destaque); (2) o veredito em UMA frase com <strong> (a lógica dos 3 ramos L703-718 já existe); (3) o ponteiro 'Quantificação no Módulo 3 · Painel de Desequilíbrio' como linha final em var(--text-3). Mesmo fundo info/warning, mesma honestidade.

**8. Catálogo por função baixado e descartado: qtde contratada×real e R$ full-contrato por função nunca aparecem** · `dado-subaproveitado` · impacto 🟡 médio · esforço médio

- Problema: A tela baixa data.itens (obra_recursos, todas as funções — o tipo RecursoItem é importado na L39 e nunca usado) e o detalhe por função (recursosDetalhe.ts) com contratadoQtde, realQtde, unidade e contratadoRs full-contrato — mas detalheParaDesvios (L69-76) descarta tudo exceto 3 colunas de R$ até o BM. O gerente vê que 'ESCAVADEIRA +635k' desviou, mas não vê se foi por quantidade (mais máquinas·mês) ou por custo — distinção que muda a narrativa do pleito. nItens/catalogoParcial/catalogoAusente também não aparecem em lugar nenhum.
- Proposta: Sem criar tela nova: (a) tabela de desvios ganha 2 colunas compactas 'Qtde C.' e 'Qtde R.' (dados já no payload de detalheParaDesvios — basta não descartá-los no map) OU, se apertar, um tooltip/linha expandível por função com qtde + unidade + R$ full-contrato; (b) CardSub ganha '{nItens} {plural}' ('41 funções'); (c) quando catalogoAusente, nota 'catálogo por função pendente de normalização' em vez do fallback silencioso pro ranking global. Combina com a toolbar do achado 1.

**9. Série 'Real' pintada de danger por definição — vermelho vira ruído em vez de sinal** · `grafico` · impacto 🟡 médio · esforço baixo

- Problema: No histograma, barras e linha do Real usam var(--danger) (L1202, 1224; legenda/tooltip idem no CSS L272-284, 338, 350) e no gráfico de VA o Custo real também é danger (L543). Real ≠ ruim: o veredito é do farol/desvio ajustado, não da série. Quando a alocação estiver Conforme, a tela continuará gritando vermelho — e dilui o vermelho legítimo dos desvios (.rec-tc-neg, .rec-md-pos), que aí sim significa overspend.
- Proposta: Real = navy/ink via var local (padrão --c6-navy já usado nas outras abas de gráfico), Contratado permanece cinza (--text-4 barras / --info linha). Danger fica reservado a desvio/overspend/farol. Ajustar as 6 classes de legenda/tooltip no CSS (rec-legend-bar-r, rec-legend-line-r, rec-tip-sq-r, rec-tip-ln-r, rec-va-sw-real) e os 3 stroke/fill no tsx — mudança puramente de token, nenhuma série some.

**10. Skeleton de loading não espelha a forma final da tela** · `estados` · impacto ⚪ baixo · esforço baixo

- Problema: O loading (L93-104) renderiza 4 skeletons de KPI na grade .rec-kpis de 4 colunas + 1 bloco único de 360px — mas a tela real tem 3 KPI cards (grade .rec-c04-kpis de 3), depois o grid do histograma (1.7fr chart + coluna de 2 cards) e mais 2 tabelas. O CLAUDE.md pede 'Skeleton com forma do conteúdo final'; o layout salta quando o dado chega (4→3 colunas).
- Proposta: Trocar para: 3 skeletons na grade rec-c04-kpis, um skeleton alto (~340px) em grid 1.7fr/1fr com dois skeletons menores empilhados à direita (Resumo + desvios), e um bloco largo (~200px) pro Total Cost/Composição. Só JSX no branch isLoading + 2 classes de altura no CSS.

### C.5 Prazo e Cronograma

**JTBD**: O Gerente de Contrato (e o Jurídico que monta o Pleito de prorrogação) abre a C.5 a cada fechamento de BM para responder em segundos: a obra está atrasada FISICAMENTE? Quantos pp, o que puxa o atraso (disciplina, frente, marco contratual) e quanto custa cada mês de extensão (Adm Local + BDI-prazo) — o insumo do nexo temporal do Pleito.

<details><summary><b>Inventário (o que a tela exibe hoje — nada disto sai)</b></summary>

- Header: título 'Prazo e Cronograma · C.5' + data de corte + BM (nº e rótulo do mês) + Badge do farol do desvio físico agregado + subtítulo explicativo (físico ≠ financeiro, fonte)
- Deck 1 'Decorrido': % decorrido grande + stats Prazo (meses), = dias, Início (OS), Término, Decorrido (dias)
- Deck 2 'Avanço físico': % real grande + Badge farol + sub (real/previsto) + stats Previsto, Real, Atraso acum., Desvio
- Deck 3 'Projeção & ritmo': valor grande '—' (projeção suprimida) + stats Ritmo nec., Ritmo recente, Δ vs contratual, Prorrogação + nota de supressão (~20% do prazo)
- Curva física Previsto × Real (LineChart 46 meses, legenda custom, tooltip pt-BR, rodapé-resumo do BM: previsto 1,65% · real 0,50% · atraso −1,15 pp)
- Marcos contratuais — resumo: donut SVG por status (Em risco/No prazo/Atrasados/Cumpridos) + contadores + próximo vencimento
- Marcos contratuais — detalhe: chips de categoria + toolbar busca/ordenação (data, status) + tabela (Categoria, Trecho/Obra, Data-limite, % concl., Farol Badge) + paginação 8/pág + empty filtrado
- 'O que está atrasado' por disciplina/frente: toggle Disciplina|Frente + tabela (% Prev, % Real, Δ pp, Status Badge) + nota '% dentro de cada grupo'
- Caminho crítico — Windows Analysis: EmptyState honesto (aguardando .mpp R0/R1)
- Legenda do farol do desvio físico (faixas em pp, 4 níveis)
- Análise IA (tag ANÁLISE DE PRAZO · ADM CONTRATUAL IA + prose ancorada nos números)
- Calculadora de impacto de extensão (input meses × [Adm Local D.1 + BDI-prazo D.2] → impacto R$ mi + nota metodológica)
- Estados: Skeleton de loading, EmptyState de erro com retry e de 'não normalizado'

</details>

**1. Ponto 'Real' quase invisível na curva e sem marcador da data de corte** · `grafico` · impacto 🔴 alto · esforço baixo

- Problema: CurvaCard (~L496-558): o Real acum. é UM único dot r=3 a 0,50% num eixo Y de 0–100% — some no canto inferior esquerdo do gráfico de 46 meses. Não há ReferenceLine vertical no mês de corte, embora TODAS as abas refinadas marquem o corte (faturamento.tsx L552 'data de corte', visao-geral.tsx L518, curvas, insumos, produtividade). O leitor não encontra 'onde a obra está' no gráfico principal da aba.
- Proposta: Adicionar <ReferenceLine x={corteMesNum} stroke='var(--text-3)' strokeDasharray='3 3' label={{value:'data de corte', position:'top'}}/> (padrão idêntico ao da C.3, tokens-only) e reforçar o dot do real (r≈4.5 + stroke var(--surface)) com <Label> '0,50%' ao lado do ponto. Nada é removido — o dado atual só passa a ser encontrável.

**2. Eixo X em 'M1…M46' quando o read-model já carrega os rótulos de calendário** · `dado-subaproveitado` · impacto 🟡 médio · esforço baixo

- Problema: A curva plota só mesNum e formata `M${v}` no tick (L511) e 'Mês 3' no tooltip (L528), mas dmes.mesesAxis (useFaturamentoDisciplinaMes) já traz `label` pronto ('mar/26'…'dez/29') — informação em memória que a tela joga fora. Cruzar 'M3' com a data-limite '15/09/2026' dos marcos exige conta de cabeça.
- Proposta: Em derivarFisico (que já itera mesesAxis, L174), carregar `label` no ponto da curva; tick vira 'mar/26' e o tooltip 'M3 · mai/26'. Zero fetch novo, zero informação removida (o nº do mês continua no tooltip).

**3. Deck 'Avanço físico' mostra cada número duas vezes** · `poluicao` · impacto 🟡 médio · esforço baixo

- Problema: Decks L406-421: o real aparece no valor grande E no stat 'Real'; o previsto no sub E no stat 'Previsto'; e o atraso em DOIS stats com valor idêntico — 'Atraso acum.' (L418) e 'Desvio' (L419) são ambos fmtPp(fisico?.atrasoPp). São 6 células para 3 números — densidade sem informação.
- Proposta: Manter big=real e sub 'previsto 1,65% até o BM 3'; nos stats, manter Previsto / Real / Atraso acum. e trocar a duplicata 'Desvio' por 'Aderência' (realOverallPct÷prevOverallPct, ex. 30,4%) — derivado dos mesmos campos já carregados, nada fabricado. Nenhum valor some; some só a repetição literal.

**4. Deck 'Projeção & ritmo' tem um travessão gigante como herói** · `hierarquia` · impacto 🟡 médio · esforço baixo

- Problema: L427: o elemento de maior peso visual do 3º deck é '—' em fs-32 (projeção suprimida), enquanto o dado decisório REAL do deck — ritmo necessário 2,31%/mês vs ritmo recente 0,17%/mês — fica espremido em stats fs-12. O olho é atraído para a ausência e ignora o alerta de ritmo.
- Proposta: Promover o ritmo pro slot grande (ex.: big = ritmo necessário '%/mês' com sub 'vs recente X%/mês' em tom danger quando abaixo) e mover 'Projeção de término: — (suprimida até ~20% do prazo; hoje 6,7%)' para uma linha de stat + a nota que já existe. A supressão honesta continua dita — só deixa de ser o herói do card.

**5. Tabela 'O que está atrasado' (15 disciplinas) sem toolbar de coleção** · `tabela` · impacto 🟡 médio · esforço baixo

- Problema: AtrasadosCard (L774-858) renderiza todas as linhas de uma vez, sem busca, sem ordenação alternativa (fixa: pior Δ primeiro) e sem paginação — a regra do CLAUDE.md manda coleção 5+ ter busca e 10+ ter paginação, e a PRÓPRIA aba já aplica o padrão nos marcos via useColecao (L674). Em meia coluna (grid 1fr/1fr), 15 linhas alongam o card e desalinham com o Caminho Crítico ao lado.
- Proposta: Envolver as linhas com useColecao: busca 'Buscar disciplina ou frente…', ordenações 'Pior Δ (pp)' (default) + 'Nome A–Z' + '% real', perPage 8 + ColPag, resetKey={view} para zerar página ao alternar Disciplina/Frente. Componentes ColToolbar/ColPag/ColVazio já prontos — é o mesmíssimo padrão dos marcos.

**6. Legenda do farol órfã, longe das tabelas que a usam, com faixas ambíguas** · `hierarquia` · impacto ⚪ baixo · esforço baixo

- Problema: FarolLegenda (L881-899) é uma faixa solta renderizada DEPOIS de marcos+atrasados — quem lê o Badge 'Crítico' na tabela de atrasados precisa descobrir a legenda 2 seções abaixo. E o texto 'Observação −5 a −1 · Risco −15 a −5' deixa os limites ambíguos (−5 é Observação ou Risco?), sendo que o código é fechado (FAROL_FISICO_PP: >= −1 Conforme; >= −5 Observação; >= −15 Risco).
- Proposta: Mover a legenda pro rodapé do AtrasadosCard (junto do .prz-obs que já existe ali) — é a única seção que usa esse farol além do deck — e reescrever os intervalos espelhando o código: 'Conforme ≥ −1 · Observação de −1 a −5 · Risco de −5 a −15 · Crítico abaixo de −15 (pp, real − previsto)'. Nenhuma faixa é removida, só reposicionada e desambiguada.

**7. Chips de categoria dos marcos sem contagem e sub '% concluído por BM (pendente)' críptico** · `microcopy` · impacto ⚪ baixo · esforço baixo

- Problema: MarcosDetalhe L716-727: os chips ('TODAS', 'OAE', 'Sinistros de Talude'…) não dizem quantos marcos cada categoria tem — o usuário filtra no escuro. O section-sub '% concluído por BM (pendente)' (L713) não explica que a coluna INTEIRA de % concl. está '—' aguardando medição por marco; parece bug, não pendência honesta.
- Proposta: Chip com contador ('Sinistros de Talude · 5', mesmo padrão de pílula, contagem via useMemo sobre marcos); sub vira '24 marcos · % concluído por marco ainda não medido (input por BM)'; e a célula '—' ganha title='Medição por marco pendente — entra com o BM'. Informação só ganha contexto, nada sai.

**8. Marco sem data-limite viraria NaN silencioso na contagem do donut** · `consistencia` · impacto ⚪ baixo · esforço baixo

- Problema: MarcosResumo L571-575: counts só inicializa as 4 chaves com rótulo ('No prazo', 'Em risco', 'Atrasado', 'Cumprido'); um marco com dataLimite null recebe status 'pendente' → label '—' (MARCO_STATUS_LABEL) → c['—']++ vira NaN e o marco não entra em nenhum segmento/linha. O centro do donut diria '24 marcos' e a soma da legenda daria menos — divergência silenciosa. Hoje a BR-101 tem todas as datas, mas o read-model (prazoMarcos.ts) permite null.
- Proposta: Adicionar bucket 'Sem data-limite' (dot var(--text-4), segmento var(--surface-3)) inicializado no counts e exibido na legenda só quando n>0 — total do donut volta a ser conferível em qualquer obra futura. Sem mudança visual no caso atual.

**9. Skeleton de loading não espelha a forma final da tela** · `estados` · impacto ⚪ baixo · esforço baixo

- Problema: L283-294: o loading é 3 retângulos de 150px + 1 de 320px. A tela real tem header (título+meta+Badge), 3 decks ~220px, grid 2 colunas 1.55fr/1fr (curva + donut) e tabela de marcos — a regra 4 do CLAUDE.md pede 'Skeleton com forma do conteúdo final, nunca genérico'. O flash de troca é perceptível.
- Proposta: Compor o skeleton nos MESMOS containers já existentes: uma linha de header (Skeleton 24px largura ~340px + linha de meta), .prz-decks com 3 Skeletons de 210px, .prz-grow com par 320px/280px e um bloco de 260px pra tabela. Só reuso de classes prz-\* — sem CSS novo.

**10. Deck 'Decorrido' não mostra 'Restantes' nem barra de progresso — dado já carregado** · `dado-subaproveitado` · impacto 🟡 médio · esforço baixo

- Problema: usePrazoBm entrega prazo.restantesDias e tendenciaTerminoISO (término planejado do cronograma) — bridgePrazo.ts L54/L119 — e a tela não exibe nenhum dos dois: o Deck 1 (L391-404) tem Início/Término/Decorrido, mas quem decide quer 'quanto falta'. O decorrido 6,7% também é só número, sem representação visual, num deck que é exatamente sobre passagem de tempo.
- Proposta: Adicionar stat 'Restantes: N dias' pareado com 'Decorrido' (vira grade 2×3, o wide já existe) e uma ProgressBar fina do DS sob o valor grande com decorridoPct — dado 100% em memória, zero fetch, zero remoção. Se couber, 'Término planejado (cronograma)' como sexto stat quando divergir do contratual.

### C.6 Insumos

**JTBD**: Permitir que o gerente de contrato e o jurídico escolham, insumo a insumo, a base de índice mais defensável (118 fontes × 30 insumos FD) e vejam em tempo real quanto da alta excede o IPCA (cláusula 8.8) — separando repasse real (medido no BM) de potencial (se tudo medido) — para fundamentar o reequilíbrio que alimenta a D.5.

<details><summary><b>Inventário (o que a tela exibe hoje — nada disto sai)</b></summary>

- Título da aba + sub com Contrato/Corte/BM + pill '● valores c/ BDI' (insumos.tsx L456-461)
- Barra de parâmetros ifd-pbar: Marco reequilíbrio OS · Fonte PQ+BM · IPCA período com '← linha divisória (8.8)' (L462-473)
- Banner ifd-srcinfo: explicação da origem PQ/BM e do fechamento com a PQ (L475-480)
- Seção 'Escolha a base de cada insumo': hint + 5 presets (Tudo mercado / Tudo DNIT / Recomendado / Melhor / Pior cenário) + presethint (PresetsInsumosFd)
- 4 KPI cards live com flash: Contrato FD c/ BDI · Acima do IPCA · Repasse real (medido) · Potencial (CardsInsumosFd)
- Painel Curva ABC: Pareto top-14 (barras % por classe A/B/C + linha % acumulado) + hint + legenda de swatches (GraficoAbc)
- Painel Evolução dos índices: 6 sub-views por família (Setoriais DNIT/Diesel/CBUQ/Concreto/Aço/Agregados) + toggle Escala cheia/Aproximar + hint por família + LineChart base 100 mar→mai com linha IPCA tracejada + legenda de swatches (GraficoIndices)
- Painel Reequilíbrio: barras horizontais Δ% dos 30 insumos × ReferenceLine do IPCA, vermelho=excede/verde=absorvido, labels à direita (GraficoExcedente)
- Tabela multifonte 15 colunas com toggle Curva ABC / Ordem da PQ, seletor de base por linha (● recomendada), tag 'N bases', subtotais por categoria, rodapé TOTAL escuro com '✓ bate com a PQ' e % medido + nota metodológica (TabelaMultifonte)
- Linkbox D.5: Repasse real + Potencial total live + botão 'Abrir D.5 →' (c6-linkbox)
- Card IA 'Análise (fonte PQ + BM, c/ BDI)' com badge e ação editar (c6-chat)

</details>

**1. KPIs live enterrados sob 5 faixas de texto — o headline da aba não salta** · `hierarquia` · impacto 🔴 alto · esforço baixo

- Problema: A ordem atual é título → c6-sub → ifd-pbar → ifd-srcinfo → secttl → hint dos presets → 5 botões → presethint → SÓ ENTÃO os 4 KPI cards (insumos.tsx L456-499). Os números que respondem o JTBD (Repasse real 10.246,94 · Potencial 977.825) aparecem abaixo da dobra em 1080p, contrariando o template consolidado das abas RMA ('snapshot no topo → seções → coleção', como a C.3 Faturamento faz com FatParamBar → FatKpis).
- Proposta: Mover <CardsInsumosFd> para logo após a ifd-pbar (antes do ifd-srcinfo e dos presets), sem tocar em nada dentro dele. Os presets permanecem onde estão — o ValorLive já pisca (ifd-flash) quando um preset recalcula, então o olho é puxado de volta pros cards. Ajustar o hintIntro dos presets com meia frase 'os cards acima recalculam em tempo real' para manter o vínculo.

**2. Contrato, corte, BM e marco chumbados no JSX — quebram em qualquer outra obra** · `consistencia` · impacto 🔴 alto · esforço baixo

- Problema: O c6-sub imprime 'AFL-GOE-147/2024 · CW45641', 'Corte: 31/05/2026', 'BM: 3 (mai/2026)' como texto literal, e a pbar imprime 'OS (mar/2026)' e 'mar/26' hardcoded (insumos.tsx L458-472, colunaOsLabel L548). Mas o read-model já carrega reeq.dataOs, reeq.dataVerificacao, reeq.dataVerificacaoReeq (insumosFd.ts L179-183) — e a D.5 irmã já usa fmtDataBr(dados.reeq.dataOs) corretamente. Se a obra Sorriso abrir esta aba com v53 normalizado, verá o cabeçalho da BR-101.
- Proposta: Derivar tudo do dado: marco = fmtDataBr(reeq.dataOs), corte = fmtDataBr(reeq.dataVerificacao), colunaOsLabel e o 'base 100 = mar/26' dos títulos a partir do mês de dataOs; código do contrato via useObra/useSinteseContrato (padrão das outras abas). Layout idêntico, zero informação removida — só a fonte muda de literal para reeq.\*.

**3. Narrativas com números chumbados que vão desatualizar (IDX_HINT, card IA, sub dos KPIs)** · `consistencia` · impacto 🔴 alto · esforço médio

- Problema: Três lugares carregam percentuais/valores baked no copy: (1) IDX_HINT com '+23,4%', '+42,9%', 'SINAPI +3,6%' etc. (insumos.tsx L197-208); (2) o parágrafo do card IA com 'R$ 96,82 mi' e 'R$ 148.379' (L597-604); (3) o kf 'brita+bica (BM03) · c/ BDI' fixo no KPI compartilhado (InsumosFdShared.tsx L179). Quando o v54 chegar com jun/26, os gráficos atualizam mas o texto mente — numa tela onde 'erro nos valores = milhões'.
- Proposta: Interpolar do mesmo dado que alimenta os gráficos: IDX_HINT vira template que computa min/max delta das séries da família exibida (já resolvidas em GraficoIndices.series); o card IA usa fmtMi2(dados.totalFdBdi) e fmtBRL0(dados.totalMedidoBdi); o kf do KPI de repasse lista dinamicamente insumos.filter(x => x.qtdMedida > 0).map(nome). O tom editorial das frases se mantém — só os números viram expressões.

**4. Curva ABC corta 16 insumos em silêncio e o tooltip não mostra R$** · `grafico` · impacto 🟡 médio · esforço baixo

- Problema: GraficoAbc faz arr.slice(0, 14) (insumos.tsx L64) sem nenhuma indicação de que 16 insumos ficaram fora — a linha de acumulado termina em ~9X% e o leitor não sabe por quê. Ticks do eixo X em fontSize 8 com nomes truncados a 24 chars em -45° são ilegíveis (L86-87). O tooltip só mostra %, mas valorContratoBdi de cada insumo já está no dataset ordenado e não é exibido (dado carregado e não usado no gráfico).
- Proposta: Acrescentar uma 15ª barra agregada '+16 demais (C)' com o % restante, fechando o acumulado em 100% — informação a mais, não a menos. Subir ticks para fontSize 10 (com truncagem a ~18 chars, nome completo no tooltip). Tooltip passa a mostrar 'R$ X,XX mi · Y,Y% do FD · acumulado Z%' usando o valorContratoBdi que já está em memória. Legenda de swatches ganha o item 'linha = % acumulado'.

**5. Gráfico Δ%×IPCA: 640px fixos para 30 barras, labels 8.5px e tooltip que ignora o cálculo que a tela já faz** · `grafico` · impacto 🟡 médio · esforço baixo

- Problema: GraficoExcedente usa height 640 fixo (insumos.tsx L354) → ~19px por barra com LabelList em fontSize 8.5 (L409) e ticks do eixo Y em 9px (L379) — abaixo do piso de legibilidade num monitor normal. O tooltip só ecoa 'Δ% real', mas excedente (Δ−IPCA), repasse real e potencial por insumo já são computados por linhaCalc/fonteSelecionada para a tabela — o hover do gráfico é o lugar natural de responder 'quanto vale esta barra em R$'.
- Proposta: Altura derivada: linhas.length \* 26 + 60 (acomoda filtros futuros e mantém respiro); ticks a 10-11px. Tooltip enriquecido com 3 linhas: 'Δ% +4,20% · Excedente +2,53 p.p. · Potencial R$ 812.000' (reusar linhaCalc — zero query nova). Acrescentar micro-legenda sob o gráfico: swatch vermelho 'excede o IPCA — gera repasse (8.8)' / verde 'absorvido pela contratada', espelhando o padrão de swatches dos outros dois painéis.

**6. Tabela de 30 linhas × 15 colunas sem busca e sem coluna fixa no scroll horizontal** · `tabela` · impacto 🔴 alto · esforço médio

- Problema: TabelaMultifonte tem toggle de visão mas nenhuma busca (regra do projeto: coleção 5+ → busca com debounce+clear), e como as 15 colunas estouram a largura (ifd-wraptable overflow-x, insumos-fd.css L249), ao rolar para ver Repasse/Potencial o usuário perde o NOME do insumo — a única âncora da linha. 30 insumos × 6 famílias é exatamente o caso 'e se tivesse 80 itens?'.
- Proposta: No ifd-tblhead (que já tem flex space-between), acrescentar Input de busca compacto com ícone, debounce 250ms, clear ×, placeholder 'Buscar insumo ou categoria… ex.: CBUQ' e contador 'N de 30 insumos'; empty filtrado próprio com 'Limpar busca'. Congelar as colunas # e Insumo com position: sticky; left dentro do ifd-wraptable (funciona no container overflow-x; dar background var(--surface) + sombra sutil à direita). Rodapé TOTAL permanece sempre calculado sobre os 30 (com nota 'totais sempre dos 30 insumos') — filtrar a vista nunca altera o gate '✓ bate com a PQ'. Sem paginação: os subtotais por categoria e o rodapé dependem do corpo contínuo.

**7. Cinco faixas de texto explicativo consecutivas antes do primeiro número** · `poluicao` · impacto 🟡 médio · esforço baixo

- Problema: Entre o título e os KPIs há: c6-sub, ifd-pbar, ifd-srcinfo (4 linhas), hint dos presets e presethint — todos em 11.5-13px cinza, competindo entre si (insumos.tsx L457-493). O ifd-srcinfo em particular repete o que a nota da tabela detalha melhor lá embaixo. É a principal fonte de sensação de tela 'carregada'.
- Proposta: Sem apagar uma palavra: transformar o ifd-srcinfo num disclosure colapsado por padrão — uma linha com ícone Info (lucide) + 'Valores com BDI, conforme o contrato · como os números são formados ▾' que expande para o texto integral (details/summary estilizado ou useState). O presethint pode virar title/tooltip dos botões Melhor/Pior cenário OU permanecer visível — mas com margin-top reduzida para colar visualmente no grupo de presets, separando-o do bloco seguinte com --s-6.

**8. Linha do IPCA usa só 2 pontos quando a série mensal inteira está carregada** · `dado-subaproveitado` · impacto 🟡 médio · esforço médio

- Problema: GraficoIndices calcula ipcaPts com apenas mar/26 e mai/26 (insumos.tsx L213-217), mas serieIpca vem completa do read-model (obra_ipca_serie, mensal desde os cenários M1 de 2024). O ponto de abr/26 existe e é descartado — a 'linha divisória' vira uma reta artificial, e quando os demais meses das fontes chegarem o gráfico já deveria estar preparado para eixo multi-mês.
- Proposta: Construir o eixo X a partir dos meses de serieIpca entre dataOs e o corte (hoje: mar, abr, mai) e plotar o IPCA normalizado a 100 em todos eles; as fontes, que só têm valorOs/valorAtual, continuam com pontos apenas nas pontas (Recharts liga com connectNulls). O hint 'ao receber os demais meses, a trajetória se completa' passa a ser visivelmente verdade para o IPCA desde já.

**9. Skeleton genérico não tem a forma da tela final** · `estados` · impacto ⚪ baixo · esforço baixo

- Problema: O loading renderiza 3 retângulos (120/340/480, insumos.tsx L426-431) que não lembram a estrutura real — regra do projeto pede 'Skeleton com forma do conteúdo final'. A C.3 Faturamento já faz certo (FatSkeleton com grid de 6 cards + painel).
- Proposta: Espelhar a anatomia: 1 barra fina (pbar, ~44px) + grid de 4 Skeletons 88px (KPIs) + linha de 5 pílulas (presets) + 2 painéis 340/380 + 1 bloco alto 520 (tabela). ~10 linhas de JSX reaproveitando o padrão do FatSkeleton; estados de erro e empty já estão bons (retry presente, empty honesto sem dado fabricado).

**10. Microcopy: 'Acima do IPCA: 30' sem denominador e glifos ▲▼ no lugar de lucide** · `microcopy` · impacto 🟡 médio · esforço baixo

- Problema: O KPI 'Acima do IPCA' mostra o número seco (InsumosFdShared.tsx L165) — '30' só é alarmante se o leitor souber que o universo é 30; o denominador (dados.insumos.length) está em memória. Os presets usam os glifos '▲ Melhor cenário' / '▼ Pior cenário' (L118-122) quando o padrão do projeto é ícone lucide (os demais botões da própria tela já usam LineChartIcon/ZoomIn/BarChart3).
- Proposta: KPI passa a exibir '30 de 30' (valor grande '30' + sufixo 'de 30 insumos' no kf, mantendo o ValorLive no numerador); trocar ▲/▼ por <TrendingUp size={13}/> e <TrendingDown size={13}/> — os tons success/danger dos botões .best/.worst já existem no CSS e permanecem. Ganho colateral: a mudança vale automaticamente para a D.5, que compartilha o componente.

### C.7 Produtividade

**JTBD**: O Gerente de Contrato (e o Jurídico, via M3.4) abre a aba para responder: "cada HH gasto está rendendo o R$/HH que o contrato previa? Se não, quanto do desvio é ritmo da Contratada × falta de liberação da Contratante — e isso já é base de pleito?" A aba ancora o farol de aderência (95/85/70) e alimenta o Valor Agregado / Measured Mile do Módulo 3.

<details><summary><b>Inventário (o que a tela exibe hoje — nada disto sai)</b></summary>

- Header local: título 'Produtividade · R$/HH + física' + subtítulo + Badge do farol de aderência (ou 'Pendente') — L164-177
- Faixa de parâmetros: Métrica · Base do HH · Câmbio (benchmark) · Total Cost/Milha → Módulo 3 (D.4) — L180-202
- Rótulo de seção '1 · Produtividade financeira (R$/HH)' — L204
- 5 KPIs FarolCard: Contratada do período · Real acumulado (hero ink) · Real no mês · Aderência acum. · Meta do projeto — L205-241
- Gráfico de linhas 'R$/HH no tempo — Real × Contratada' com meta tracejada (ReferenceLine), legenda própria, tooltip custom pt-BR e nota de rodapé — RhhChart L599-698
- Card 'Posicionamento da produtividade': BarChart horizontal (Contratada · Real · Bmk ATERPA · Bmk setor) + 2 stats (HH contratado acum. / HH real acum.) + nota com múltiplos e farol de benchmark — Posicionamento L702-803
- Rótulo de seção '2 · Produtividade física por serviço × trecho' — L261-264
- Tracker físico: chips de filtro Disciplina/Trecho + tabela de 11 colunas (Disciplina, Serviço, Trecho, Un, Contratada, Medida, % físico, CPU un/h, Real un/h, Aderência, Farol) + nota metodológica — FisicaTracker L339-423
- Detalhe do cálculo por equipamento: 8 stats (CPU, equip. principal, qtd executada, dias c/ serviço, equip/dia, equip-horas, produtiv. real, aderência+farol) + nota — DetalheCalc L426-472
- Ponte Utilização × Liberação (C.8 · D.6): 4 stats (% liberado, % aproveitamento, % capacidade, ociosidade HH) + tabela de impedimentos (D.6) + nota de honestidade — Ponte L496-570
- Análise do período · Adm Contratual IA: parágrafo financeira + parágrafo física, mesmo padrão da C.3 — AnaliseCard L820-860
- Critérios do farol de produtividade: 4 cards (Conforme ≥95% · Observação 85-95% · Risco 70-85% · Crítico <70%) — L275-297
- Série mensal · faturado × HH × R$/HH: Card com toolbar canônica (busca+ordenação+paginação 12/pág via useColecao) + DataTable de 6 colunas — SerieCard L863-962
- Estados: loading (5 skeletons + bloco 320px), erro com retry, empty 'ainda não normalizada' — L92-137

</details>

**1. KPI de Aderência não carrega o farol que ele mesmo dispara** · `hierarquia` · impacto 🔴 alto · esforço baixo

- Problema: O farol da aba É a aderência acumulada (95/85/70), mas o card 'ADERÊNCIA ACUM.' (L227-233) usa accent="neutral" — visualmente idêntico aos cards informativos ao lado. O farol só aparece num Badge pequeno no header (L172-176), longe do número que o justifica. O indicador mais importante da tela não salta.
- Proposta: Passar a prop farol do FarolCard (que já renderiza dot + label 'Conforme/Observação/Risco/Crítico' no canto do card — FarolCard.tsx L117-120) no card de Aderência, mapeando p.farolAderencia via um FAROL_TO_PROP ('Conforme'→'conforme' etc.). O Badge do header permanece (redundância boa). Zero informação removida; o driver do farol passa a ser o card com cor.

**2. Tracker físico (13 linhas × 11 colunas) sem a toolbar canônica e sem empty filtrado** · `tabela` · impacto 🔴 alto · esforço médio

- Problema: FisicaTracker (L339-423) usa <table> crua com chips Disciplina/Trecho, mas sem busca, ordenação nem paginação — a migration confirma 13 linhas na BR-101 (regra do projeto: coleção 5+ ganha os três). Pior: se a combinação de chips zerar o resultado, o tbody fica vazio em silêncio (visible.length===0 não tem tratamento, L357-359).
- Proposta: Envolver as linhas no useColecao já compartilhado (mesmo da SerieCard): busca por serviço/trecho/disciplina, ordenações 'Ordem da PQ' (default) + 'Menor aderência' + 'Maior contratada', paginação 10/página; os chips entram no slot extra do ColToolbar (o próprio componente já aceita), com resetKey={disc+trk}. Quando visible.length===0 com filtro ativo, renderizar ColVazio com ação 'Limpar filtros'. Nenhuma coluna sai.

**3. Gráfico R$/HH: meta sem rótulo, tooltip que descarta dado já carregado e eixo X a 9px/-50°** · `grafico` · impacto 🔴 alto · esforço baixo

- Problema: (1) A ReferenceLine da meta (L660-667) não tem label — o valor só existe no subtítulo, obrigando o olho a ir e voltar. (2) O RhhPonto (L573) descarta faturadoRs, hhReal e aderencia que o read-model já entrega por mês (produtividadeEconomica.ts) — o tooltip (L574-598) mostra só 2 números onde poderia contar a história do mês. (3) Ticks do eixo X a fontSize 9 rotacionados -50° com ~46 meses (L645-651) ficam no limite da legibilidade.
- Proposta: (1) Adicionar label na ReferenceLine: label={{ value: `Meta ${fmtRsHh(metaRsHh)}`, position: 'insideTopRight', fill: 'var(--text-3)', fontSize: 10 }}. (2) Estender RhhPonto com faturado/hhReal/aderencia e acrescentar 3 linhas no RhhTooltip (Faturado, HH real, Aderência do mês) — dado já baixado, só não exibido. (3) Subir tick para fontSize 10 e mirar ~12 ticks (interval = Math.ceil(dados.length/12)); o tooltip cobre o mês exato.

**4. Gráfico Posicionamento incompleto e inconsistente com o gráfico vizinho** · `grafico` · impacto 🟡 médio · esforço baixo

- Problema: No BarChart (L736-777): eixo X sem prefixo R$ (tickFormatter `(v)=>`${v}`` na L749, enquanto o line chart ao lado usa `R$ ${v}`); tooltip é o default do Recharts com formatter de name vazio (L759-769) — destoa do tooltip rico .prod-tip do RhhChart; a barra 'Contratada' é cinza (var(--text-3), L727-728) mas a MESMA série é azul var(--info) no gráfico ao lado — o leitor precisa re-decodificar cores entre dois gráficos irmãos; a meta do projeto não aparece; labels 'Bmk ATERPA'/'Bmk setor' abreviados sem necessidade (YAxis width 86).
- Proposta: (1) tickFormatter=`R$ ${v}` no eixo X. (2) Trocar o tooltip default por content custom reusando as classes .prod-tip. (3) Cell da Contratada → var(--info), Real → var(--text), benchmarks → var(--text-4) (código de cor único na aba). (4) ReferenceLine x={metaRsHh} tracejada var(--text-3) — mesma semântica do line chart. (5) LabelList com fmtRsHh na ponta das 4 barras (são só 4; o valor visível dispensa hover) e YAxis width 110 com 'Benchmark ATERPA'/'Benchmark setor' por extenso.

**5. Seção 'Critérios do farol' pesa uma seção inteira para conteúdo estático — e está no lugar errado** · `poluicao` · impacto 🟡 médio · esforço baixo

- Problema: Os 4 cards de critério (L275-297 + .prod-criterios no CSS L271-308) ocupam ~120px de altura para dizer 4 faixas fixas — competindo visualmente com dados reais. E estão posicionados DEPOIS da Análise IA e da seção física, embora expliquem o farol da seção 1 (financeira): o leitor cruza a tela inteira para achar a régua.
- Proposta: Sem remover nada: converter os 4 cards numa faixa única compacta de 4 pills inline (dot 8px colorido pelo token + 'Conforme ≥ 95%' em fs-12 tabular) e reposicioná-la como rodapé da seção 1 — logo após o grid gráfico+posicionamento (após L258), antes do rótulo da seção 2. Os 4 níveis, faixas e cores permanecem 100%; o bullet '●' textual vira <span> dot (consistente com o status-dot do FarolCard).

**6. Faixa de parâmetros subaproveita o que o read-model já carrega (BM corrente, jornadas, gate de qualidade) e tem link morto** · `dado-subaproveitado` · impacto 🟡 médio · esforço baixo

- Problema: getProdutividadeParams baixa bmCorrente, jornadaModHMes, jornadaMoiHMes, valorTotalContratado e faturadoAcumRs — nenhum aparece na tela. getProdutividadeEconomica calcula status ('needs_review' quando o gate Σ HH não fecha) e eixoRealVazio — também invisíveis. E o item 'Total Cost / Milha → Módulo 3 (D.4)' (L198-201) é texto morto quando existe rota real (/desequilibrio/valor-agregado).
- Proposta: (1) Acrescentar à prod-param-bar: 'BM corrente: nº X' e 'Jornada: MOD Yh · MOI Zh/mês' (contexto que explica o denominador do R$/HH). (2) Se data.serie.status !== 'ok', exibir <Badge tone="warning">Precisa revisão</Badge> ao lado do Badge do header — honestidade do gate, hoje engolida. (3) Trocar o texto 'Módulo 3 (D.4)' por <Link> do TanStack para ../desequilibrio/valor-agregado com ícone arrowRight — a afordância que o texto já promete.

**7. Série mensal não mostra a coluna de aderência que já vem do banco** · `tabela` · impacto 🟡 médio · esforço baixo

- Problema: A DataTable da SerieCard (L899-962) tem 6 colunas, mas m.aderencia (razão real÷contratada do mês, já tipada em ProdutividadeEconomicaMes e baixada em toda linha) não vira coluna — o usuário precisa dividir de cabeça 'Real R$/HH' por 'Contratada R$/HH'. As ordenações param em Cronológico/Mais recente.
- Proposta: Adicionar 7ª coluna 'Aderência' (align right, fmtPct, prod-cell-pend quando null) — dado já disponível, zero fetch novo — e uma 3ª ordenação 'Menor aderência' (meses problemáticos primeiro). Cabe na grade atual reduzindo levemente as widths de HH previsto/HH real.

**8. Microcopy com jargão interno e câmbio truncado por toFixed(0)** · `microcopy` · impacto 🟡 médio · esforço baixo

- Problema: (1) Subtítulo do gráfico diz 'não achatado' (L622) — jargão do time de dados, opaco para Diretor/Jurídico. (2) Info do KPI de aderência diz '95/85/70' seco (L231). (3) 'Bmk ATERPA'/'Bmk setor' abreviados na UI (L722-723, L793-794). (4) Câmbio renderizado com p.cambio.toFixed(0) (L194): um câmbio real de 5,42 vira 'US$ 1 = R$ 5' — perde precisão num parâmetro de benchmark.
- Proposta: (1) 'não achatado' → 'comparação mês a mês, não pela média' (a nota de rodapé L689-695 já explica; o subtítulo deve ecoar). (2) '95/85/70' → 'faixas 95 · 85 · 70%'. (3) 'Benchmark' por extenso onde couber (o achado do Posicionamento já ajusta o YAxis). (4) Câmbio via p.cambio.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) — 'US$ 1 = R$ 5,42'.

**9. Skeleton de loading não espelha a forma final da página** · `estados` · impacto ⚪ baixo · esforço baixo

- Problema: O loading (L92-103) renderiza 5 retângulos de KPI + um bloco único de 320px — mas a tela final tem faixa de parâmetros, grid assimétrico 1.7fr/1fr (gráfico + posicionamento), tracker, ponte e tabela. O 'salto' de layout na hidratação é visível (regra do projeto: Skeleton com a forma do conteúdo final).
- Proposta: Compor o skeleton com: barra de 48px (param bar) → 5 KPIs (~92px, já existe) → div.prod-grow com Skeleton 320px + Skeleton 320px (reusa o grid CSS existente) → Skeleton 260px (tracker). São ~6 linhas de JSX reutilizando classes que já estão no produtividade.css.

**10. Detalhe do cálculo trava no primeiro serviço medido — sem seletor quando houver mais de um** · `dado-subaproveitado` · impacto ⚪ baixo · esforço baixo

- Problema: DetalheCalc (L427) escolhe UMA linha de data.detalhe (find do primeiro medido ?? detalhe[0]) e descarta as demais. Hoje a BR-101 tem 1 linha (Trecho 1), mas o array é plural por design ('cresce a cada medição') — na 2ª medição normalizada, o dado chega ao browser e a tela o esconde.
- Proposta: Quando detalhe.length > 1, renderizar chips (reusar ChipRow, já pronto na própria aba) ou um Select compact no prod-section-head para alternar o serviço exibido; com 1 item, comportamento idêntico ao atual. Nada muda visualmente hoje, e a tela deixa de engolir dado amanhã.

### C.8 Curvas

**JTBD**: Gerente de contrato e Jurídico abrem a aba para responder "de quem é a responsabilidade pelo desvio entre Contratado e Executado" — decompondo a cadeia Contratado → Liberado → Capacidade → Executado em 3 gaps (Contratante não liberou · Contratada não mobilizou · perda de produtividade) — e usar isso como base de pleito de prorrogação/reequilíbrio e de decisão operacional (registrar impedimentos no Mapa C.14, mobilizar equipe).

<details><summary><b>Inventário (o que a tela exibe hoje — nada disto sai)</b></summary>

- Header da aba: título 'Aderência das Curvas · C.8' + subtítulo explicativo das 4 curvas (cur-head, L132-142)
- Banner de aviso do corte no BM ('⚠ Corte no BM XX...', cur-warn, L144-148)
- Rótulo de seção 'As 4 curvas — posição acumulada no BM (label do período)' (L150)
- 4 KPI cards de curva: Contratado / Liberado / Capacidade / Executado — dot da cor da série + valor em 'mi' (title com R$ cheio) + sub contextual (CurvaKpi, L151-171)
- Card do gráfico: título 'Curvas acumuladas (R$)...', legenda custom 4 itens + nota '┊ tracejado = futuro/previsão', Segmented 'Foco no BM × Contrato inteiro' + hint, LineChart Recharts 400px com 6 séries (4 cheias + capacidadeFut/executadoFut tracejadas), ReferenceLine 'BM XX · hoje', tooltip pt-BR, eixo Y em 'mi' (CurvasChart, L485-658)
- Seção 'Diagnóstico de responsabilidade — os 3 gaps': 3 GapCards ①②③ (Contratado→Liberado / Liberado→Capacidade / Capacidade→Executado) com valor em mi ou 'sem gap', responsável em UPPERCASE e descrição condicional (GapCard, L177-215)
- Seção 'Leitura por frente (BM atual)': tabela em grid 5 colunas — Frente, Contratado, Possível (liberado), Real, Aderência real÷possível com barra+% — ~10 frentes físicas (12 no banco menos Adm Local/Insumos transversais) + linha TOTAL + EmptyState alternativo + nota explicativa Possível/Real (FrenteLeitura, L217-233, 319-364)
- Seção 'Responsabilidade pelo desvio (Contratado − Executado)': tabela Responsável (Badge danger/warning), Origem do desvio, Valor (R$), % do desvio, barra de participação + linha 'Desvio total' + nota 'Como é calculado' (RespDesvio, L235-246, 367-439)
- Card escuro (div/aside, fundo --ink) 'Leitura das curvas': diagnóstico narrativo com maior gap, % executado/capacidade e conexão com o Mapa C.14 (Diagnostico, L248-253, 442-483)
- Estados: loading (4 skeletons de KPI + gráfico + tabela), erro de leitura (EmptyState framed + Badge danger), vazio 'Aguardando normalização' (L60-102)

</details>

**1. Legenda promete 'tracejado = previsão' mas a previsão real (Contratado/Liberado pós-BM) desenha linha cheia — e as séries \*Fut nunca desenham nada** · `grafico` · impacto 🔴 alto · esforço baixo

- Problema: A nota da legenda (L525, '┊ tracejado = futuro / previsão') não corresponde ao que o gráfico desenha. As séries capacidadeFut/executadoFut (L618-653) dependem de capacidadeAcum/executadoAcum pós-BM, que o read-model corta como NULL ('NULL pós-BM', curvasSerieMes.ts L20-23) — logo essas séries têm no máximo 1 ponto (o próprio BM) e nunca formam linha. Enquanto isso, Contratado e Liberado pós-BM — que SÃO previsão, como o próprio banner avisa — seguem em linha cheia (L590-607). No zoom 'Contrato inteiro', a distinção real×previsão simplesmente não existe visualmente.
- Proposta: Aplicar o split cheio/tracejado que já está escrito para as \*Fut às séries que de fato têm futuro: derivar contratadoFut/liberadoFut (mesNum >= bm) e desenhá-las com o mesmo padrão strokeDasharray='5 4' + strokeOpacity 0.55 + legendType='none', mantendo o trecho até o BM cheio. Manter capacidadeFut/executadoFut como estão (não custam nada e reativam sozinhas se um dia houver carry). A nota da legenda passa a ser verdadeira sem mudar uma palavra.

**2. previstoServicosAcum é acumulado pelo read-model e não aparece em lugar nenhum da aba** · `dado-subaproveitado` · impacto 🟡 médio · esforço médio

- Problema: curvasSerieMes.ts calcula deterministicamente previstoServicosAcum (acumulado de C.3 'Previsto Serviços', L49-61) e o próprio comentário do arquivo documenta o destino: 'alimenta o gráfico da aba Curvas... com toggle Total (financeiro) × Produção (apenas serviços)'. O grep confirma: nenhuma tela consome o campo. O gerente perde a comparação Contratado-total × Previsto-só-serviços que revelaria quanto do previsto é produção física vs. verba transversal.
- Proposta: Adicionar na toolbar do gráfico (ao lado do Segmented de zoom, L528-543) um FilterChip/Toggle 'Mostrar Previsto Serviços' que liga uma 5ª linha fina (stroke var(--text-4) ou tom vault, strokeWidth 1.6) com item próprio na legenda custom. Zero query nova, zero remoção — só expõe um dado que a série já carrega em toda visita.

**3. Tooltip do gráfico lista séries soltas, duplica 'Capacidade/Capacidade (prev.)' no mês do BM e não mostra os 3 gaps do mês** · `grafico` · impacto 🟡 médio · esforço médio

- Problema: O Tooltip usa formatter genérico (L563-575): no mês do BM as séries capacidade+capacidadeFut e executado+executadoFut aparecem duplicadas com o mesmo valor; a ordem segue a declaração das <Line>, não a cadeia lógica; e o dado mais valioso do hover — os Δs Contratado−Liberado, Liberado−Capacidade, Capacidade−Executado naquele mês — não aparece, embora seja derivável dos mesmos 4 pontos já presentes no payload.
- Proposta: Trocar por um tooltip custom (prop content) que: (a) deduplica \*Fut (mesmo dataKey base); (b) ordena na cadeia Contratado → Liberado → Capacidade → Executado com o dot da cor de cada curva (mesmo visual da legenda); (c) acrescenta um bloco separado por Divider com os 3 gaps do mês em fmtMi, rotulados ①②③ como os GapCards. Tokens-only (surface/border/r-sm já usados no contentStyle atual).

**4. Tabela 'Leitura por frente' (~10 linhas) sem ordenação/busca e escondendo 2 colunas que o read-model já entrega (Responsável e R$/HH)** · `tabela` · impacto 🔴 alto · esforço médio

- Problema: FrenteLeitura (L319-364) renderiza ~10 frentes físicas (12 no banco, migration 20260606000010) sem nenhuma toolbar — viola a regra do projeto de coleções 5+ (ordenação mínima). Pior: getCurvasFrentes carrega responsabilidade e produtividadeRsHh (curvasC8.ts L56-63) e a tela joga fora os dois — justamente numa aba cujo JTBD é atribuir responsabilidade. O gapDominanteRs só entra implícito no cálculo de 'Real'. E os headers numéricos ('Contratado', 'Possível', 'Real') não declaram unidade, enquanto a tabela irmã RespDesvio escreve 'Valor (R$)'.
- Proposta: (1) Toolbar compacta acima da tabela: Input de busca com clear (placeholder 'Buscar frente… ex.: Trecho 03') + Select de ordenação — 'Ordem da fonte' (default), 'Pior aderência', 'Maior contratado'; TOTAL permanece fixo no rodapé fora do sort. (2) Duas colunas novas com dado já carregado: 'Responsável' com Badge (danger=Contratante / warning=Contratada, os mesmos tons da tabela RespDesvio) e 'R$/HH' tabular. (3) Headers com unidade: 'Contratado (R$)', 'Possível (R$)', 'Real (R$)'. Grid --cols do CSS (L286) só ganha 2 tracks.

**5. GapCards com tinta fixa por variante: um gap milionário da Contratante apareceria verde; e o maiorGapRs carregado não destaca o card dominante** · `consistencia` · impacto 🔴 alto · esforço baixo

- Problema: As variantes .cur-gap-contratante/-contratada/-exec têm cor chumbada no CSS (curvas.css L240-276): o card ① é sempre tinta success, independente de haver gap. Hoje coincide (gap ① = 0), mas no fluxo que a própria tela ensina ('ao registrar impedimentos no Mapa C.14, a parte da Contratante sobe'), um gap de milhões de responsabilidade da Contratante seria exibido em verde — semanticamente invertido. Além disso, o campo maiorGapRs vem no CurvasC8 (curvasC8.ts L51) e não é usado: o gap dominante — a resposta da aba — não tem destaque visual nenhum entre os 3 cards iguais.
- Proposta: (1) Tornar a tinta condicional ao estado no GapCard: temGap → tom do responsável (danger p/ Contratante, warning p/ Contratada, info p/ execução) via classe cur-gap-on-<tom>; sem gap → card neutro (surface) com valor 'sem gap' em success, como já faz. São 3 classes CSS novas + 1 ternário. (2) Marcar o card cujo valor == maiorGapRs como herói: Badge 'MAIOR GAP' no cur-gap-top + fundo/borda um degrau mais tingidos via color-mix — o padrão canônico de card ativo, sem tarja de borda.

**6. Erro na leitura das frentes (e2) é engolido e vira EmptyState de 'pendente' — erro exibido como pendência** · `estados` · impacto 🟡 médio · esforço baixo

- Problema: L57 destrutura isError: e2 de useCurvasFrentes, mas o guard de erro só checa e1 || e3 (L73). Se obra_curvas_frentes falhar, frentes ?? [] produz fisicas = [] e a tela mostra 'Leitura por frente pendente... quando a matriz C.8 for normalizada' (L222-225) — exatamente a confusão erro≠pendência que o próprio read-model combate ('falha de leitura não pode virar não normalizado silencioso — falhe alto', curvasC8.ts L37). O skeleton de loading também não cobre os 3 gap cards nem a 2ª tabela (L60-72).
- Proposta: (1) Dentro do Card da seção, if (e2) renderizar um estado de erro próprio: EmptyState com ícone I.close, texto 'Não foi possível carregar a leitura por frente' e Button outline 'Tentar de novo' chamando refetch do useQuery — distinto do empty de normalização. (2) Completar o skeleton: + 3 blocos de ~120px (gaps) e 2 de ~160px (tabelas), espelhando a forma final da página.

**7. Emoji e glifos tipográficos fazendo papel de ícone: '⚠' no banner, '▸' no responsável, '┊' na legenda, '①②③' nos gaps** · `microcopy` · impacto ⚪ baixo · esforço baixo

- Problema: O banner usa '⚠' como ícone (L145) — emoji como ícone de UI é banido pelas regras do projeto (lucide é o default). '▸' prefixa o responsável no GapCard (L310), '┊' representa linha tracejada na legenda (L525) e '①②③' são passados como prop num para dentro do chip .cur-gap-num que já é um chip estilizado (L206-216 do CSS) — o glifo unicode circulado briga com o círculo do próprio chip.
- Proposta: (1) Banner: layout flex com TriangleAlert (lucide, 15px, cor do strong atual) à esquerda do texto — texto intacto. (2) GapCard: num vira '1'/'2'/'3' simples (o chip já dá a forma); no tooltip do gráfico proposto, usar a mesma numeração. (3) Legenda: substituir '┊' por um span 18×3px com repeating-linear-gradient(90deg, var(--text-4) 0 4px, transparent 4px 8px) — uma amostra real de linha tracejada, igual às amostras cheias .cur-cleg-ln. (4) '▸' sai ou vira ChevronRight 12px; o rótulo UPPERCASE colorido já carrega a semântica.

**8. KPIs das 4 curvas não mostram os % vs contratado que o read-model já entrega (liberacaoPct/capacidadePct/alocadoPct)** · `dado-subaproveitado` · impacto 🟡 médio · esforço baixo

- Problema: getCurvasC8 retorna liberacaoPct, capacidadePct e alocadoPct prontos (fração×100, curvasC8.ts L44-46), usados na Visão Geral mas ignorados aqui — na aba onde a cascata percentual mais importa. O sub do KPI 'Liberado' hoje é um binário textual ('= contratado (tudo liberado)' / 'abaixo do contratado', L162) quando o dado exato existe; 'Capacidade' e 'Executado' têm subs genéricos sem quantificação.
- Proposta: Enriquecer o sub de cada KPI com o % já carregado, em tabular-nums: Liberado → '100% do contratado · tudo liberado'; Capacidade → 'X% do contratado · teto da equipe alocada'; Executado → 'X% do contratado · realizado (RDO)'. Opcionalmente aproximar a geometria do KPI canônico: chip quadrado r-sm fundo surface-2 no topo-esquerdo contendo o dot da cor da curva (preserva o vínculo cor-série que é a força do design atual) + rótulo ao lado. Nenhum texto atual é removido — só ganha o número.

**9. Narrativa do card escuro 'Leitura das curvas' é semi-hardcoded e passa a mentir quando o dado mudar** · `consistencia` · impacto 🟡 médio · esforço baixo

- Problema: Diagnostico (L470-480) calcula maior/resp dinamicamente, mas a prosa em volta é fixa: 'as frentes estão liberadas (Liberado = Contratado = X)', 'a Contratante não é o gargalo agora', 'falta equipe, não falta produtividade'. São afirmações verdadeiras só no estado atual do dado (gapCL=0, executado colado na capacidade). Quando impedimentos forem registrados no C.14 — fluxo que o próprio parágrafo incentiva — Liberado cai abaixo do Contratado e o card afirmará uma igualdade falsa ao lado do maior gap recalculado, contradizendo a si mesmo.
- Proposta: Condicionar os 3 trechos ao dado, mantendo tom e tamanho: (a) se liberado >= contratado manter a frase atual, senão 'há {fmtMi(gapCL)} de frente não liberada — o gap ① está aberto'; (b) 'falta equipe, não falta produtividade' só quando gapLCap > gapCapE, senão inverter; (c) o fecho sobre o Mapa C.14 vira condicional ('se você registrar…' → 'com os impedimentos registrados…' quando gapCL > 0). Mesma estrutura de <strong>, nenhum insight removido — o texto passa a ser verdadeiro em todos os estados.

### C.9 Chuvas

**JTBD**: O gerente de contrato e o jurídico verificam, mês a mês, se a chuva real registrada no RDO excedeu o baseline contratual de dias >5 mm e quantos dias/quanto R$ são pleiteáveis pelo método sem compensação de déficit — transformando chuva em Pleito defensável, com a evidência (mm do RDO × média histórica INMET) pronta para anexar.

<details><summary><b>Inventário (o que a tela exibe hoje — nada disto sai)</b></summary>

- Header da aba: título 'Análise de Chuvas · C.9' + subtítulo do método + Badge de farol geral (Risco/Conforme)
- KPI 1 — Dias >5mm Proposta (acum) com contagem de meses medidos
- KPI 2 — Dias >5mm Real/RDO (acum)
- KPI 3 — Δ acumulado (net) com farol conforme/crítico
- KPI 4 — Dias a cobrar (Σ excessos) com pleiteável R$ 279.804,80 e farol
- Gráfico A — barras proposta × real por mês, chips de seleção de ano, barra do real colorida pelo farol do mês
- Faixa de veredito (chv-verd) com a frase-síntese do painel
- Legenda do Gráfico A (Proposta / Real conforme / Real excesso)
- Gráfico B — Evidência: barras de chuva real mm (RDO) × linha baseline média 2020–2024 (INMET Macaé A608)
- Rodapé narrativo do Gráfico B (mai/26 112 mm vs ~55 de baseline)
- Gráfico C — dias de chuva por mês: totais × impeditivos >5mm (baseline da proposta) + somas anuais no subtítulo
- Gráfico D — dias praticáveis por calendário CAL 1–6 (6 linhas) + totais/ano por CAL no rodapé
- Tabela 'Apuração mês a mês — sem compensar' (Mês / Prev >5mm / Real >5mm / Excedente / Pleiteável) + total dias e R$ no subtítulo
- Legenda de critérios do farol por mês (Conforme / Atenção / Sem RDO)
- Card 'Leitura do Painel · Adm Contratual IA' (texto)
- Estados: skeleton de loading, erro com retry, empty 'aguardando normalização', empty da apuração

</details>

**1. Apuração (o dinheiro) enterrada sob dois gráficos de baseline estático** · `hierarquia` · impacto 🔴 alto · esforço baixo

- Problema: A ordem atual (ChuvasAba, linhas 168–176) é: Gráfico A → Gráfico B → grid com Gráficos C e D → ApuracaoCard. C e D são dados IMUTÁVEIS da proposta (baseline de dias de chuva e calendários CAL) — não mudam mês a mês — mas ficam acima da tabela de apuração, que é onde vive o pleiteável R$ 279.804,80. O usuário rola por dois gráficos de referência antes de chegar no dinheiro.
- Proposta: Reordenar sem remover nada: KPIs → Gráfico A → ApuracaoCard → Gráfico B (evidência mm) → grid C+D. Dar ao par C+D um micro-título de agrupamento acima do .chv-grow (ex.: 'Referência do baseline — proposta contratual', em .chv-section-sub) sinalizando que são dados de contrato, não de acompanhamento. Isso alinha a leitura ao fluxo do JTBD: excedeu? → quanto custa? → prova → referência.

**2. Pleiteável MOD / EQP e HH ociosas carregados e nunca exibidos** · `dado-subaproveitado` · impacto 🔴 alto · esforço baixo

- Problema: O read-model (chuvasPainel.ts, linhas 200–209) carrega totais.mod, totais.eqp e totais.hhOciosas da seção 'auxiliar_D.6 Chuva — Totais', mas a tela só usa pleiteavelRs e excedenteDias (no subtítulo do ApuracaoCard, linhas 521–524). A composição do pleiteável — argumento central de um Pleito de ociosidade — está no banco e invisível.
- Proposta: No ApuracaoCard, adicionar uma linha de rodapé de totais abaixo da tabela (ou strip acima dela): 'Σ Excedente: N dias · HH ociosas: X · Pleiteável: R$ 279.804,80 (MOD R$ … + EQP R$ …)', com tabular-nums e var(--text-2), valores fortes em var(--text). Nenhum layout novo — é uma linha .chv-tabela-row de rodapé com border-top var(--border-strong).

**3. Tooltip do Gráfico A ignora Δ do mês e 'a cobrar acumulado' que a série já traz** · `dado-subaproveitado` · impacto 🟡 médio · esforço baixo

- Problema: serieMensal carrega delta e cobrarAcum por mês (chuvasPainel.ts, linhas 143–144) e a tela nunca os usa — o GraficoDiasAno (linhas 191–193) só mapeia prop/real/farol, e o Tooltip (linha 233–242) mostra apenas os dois valores crus. O sintese.deltaNet e sintese.realVsProposta (linhas 214–218 do resolver) também estão órfãos.
- Proposta: Trocar o formatter por um Tooltip com content custom (padrão já usado em outras abas): mês/ano no título, linhas 'Proposta N dias · Real N dias · Δ +N · A cobrar (acum): N', com dot colorido do farol do mês. Zero mudança visual no gráfico; o hover passa a contar a história completa do mês. Os textos de sintese não usados podem alimentar o info dos KPIs 2 e 3 (hoje genéricos: 'evidência diária (RDO)').

**4. Gráfico B (Evidência) sem legenda, sem unidade no eixo e com colisão de anos latente** · `grafico` · impacto 🔴 alto · esforço médio

- Problema: GraficoEvidencia (linhas 278–361) tem 2 séries (barras Real RDO + linha tracejada Baseline 2020–24) e NENHUMA legenda — o leitor depende do subtítulo. O eixo Y não indica 'mm' (tickFormatter identidade, linha 321). Pior: realPorMes é indexado só pelo mês-calendário sem ano (linhas 287–294) — num contrato de 52 meses, quando existir mar/26 E mar/27 medidos, o segundo sobrescreve o primeiro em silêncio e o gráfico mostra um mix de anos sem dizer qual.
- Proposta: (1) Adicionar legenda no mesmo padrão .chv-legend já existente no Gráfico A (barra --info 'Real (RDO)' + traço --text-3 'Baseline 2020–24'); (2) tickFormatter={(v) => `${v} mm`} no eixo Y; (3) reusar os chips de ano do Gráfico A (mesmo .chv-chip, estado próprio) filtrando o real pelo ano selecionado — resolve a colisão e mantém 100% do dado acessível.

**5. Narrativa 'Mai/26 choveu 112 mm' chumbada no TSX — vai ficar obsoleta no próximo BM** · `microcopy` · impacto 🟡 médio · esforço baixo

- Problema: O rodapé do Gráfico B (chuvas.tsx, linhas 354–358) hardcoda 'Mai/26 choveu 112 mm contra ~55 de baseline (≈ 2× a média)'. Quando jul/26 ou ago/26 entrarem no RDO, o texto continuará apontando pra mai/26 mesmo que outro mês vire o destaque — microcopy congelada numa tela de dado vivo.
- Proposta: Derivar a frase do dado: pegar o mês medido com maior razão chuvaMmReal/baseline (ou o último medido) e montar '{Mês} choveu {X} mm contra ~{Y} de baseline (≈ {razão}× a média)' com toLocaleString pt-BR; fallback pro texto explicativo fixo da segunda frase ('O RDO grava a chuva diária…'), que é atemporal e pode ficar. Alternativa mais barata: usar sintese.realVsProposta, que já vem do workbook e hoje não é exibido.

**6. Gráfico C: barra navy com var(--ink) direto quebra no dark e falta legenda** · `grafico` · impacto 🟡 médio · esforço baixo

- Problema: GraficoDiasChuva usa fill="var(--ink)" na barra de impeditivos (linha 412). O token --ink (#142948) não tem override dark — no tema escuro a barra navy some contra o fundo. É exatamente o gotcha que o projeto já resolveu no insumos.css com --c6-navy: var(--ink) + override [data-theme="dark"] { --c6-navy: var(--text) }. Além disso o gráfico tem 2 séries e nenhuma legenda visual, e o Tooltip (linhas 393–401) não formata unidade ('total: 8' em vez de '8 dias').
- Proposta: Declarar --c9-navy no topo do chuvas.css espelhando o padrão do insumos.css (com override dark) e usar fill="var(--c9-navy)"; adicionar .chv-legend com os dois quadradinhos ('Dias de chuva' / 'Dias >5 mm'); formatter={(v) => `${v} dias`} no Tooltip. Três edits pontuais, ganho direto de consistência com as abas irmãs.

**7. CAL 1–6 pintados com cores de farol (danger/warning/success) numa tela onde essas cores SÃO farol** · `consistencia` · impacto 🟡 médio · esforço baixo

- Problema: CAL_COR (linhas 424–431) usa var(--danger), var(--warning), var(--info), var(--success) como paleta CATEGÓRICA para tipos de calendário — na mesma tela em que o Gráfico A colore barras por farol e a legenda de critérios usa os mesmos tons com significado de status. CAL 1 em vermelho lê como 'crítico' quando é só 'serviço mais sensível à chuva'; a semântica de cor da tela fica ambígua.
- Proposta: Trocar CAL_COR por uma paleta categórica de tokens sem carga de status: var(--brand), var(--brand-600) ou --c9-navy (do achado anterior), var(--info), var(--vault), var(--ink-600), var(--text-3) — mantendo o traço dasharray do CAL 4 e o rodapé .chv-caltot como legenda (dots acompanham automaticamente, pois usam o mesmo array). Se quiser preservar a ideia de 'sensibilidade', ordenar a paleta do mais escuro (CAL 1, mais sensível) ao mais claro (CAL 6). Adicionar formatter `${v} dias` no Tooltip do LineChart (linhas 470–477).

**8. Três nomes para o mesmo estado de farol: 'Atenção', 'Risco' e 'Real excesso'** · `consistencia` · impacto 🟡 médio · esforço baixo

- Problema: O mesmo estado (real > proposta) aparece como 'Risco' no Badge do header (linha 133) e no KPI farol="risco" (linha 164), como 'Real excesso' na legenda do Gráfico A (linha 270) e como 'Atenção' na legenda de critérios (CriteriosFarol, linha 588). 'Atenção' não existe no sistema de Farol do produto (níveis fixos: Conforme/Observação/Risco/Crítico — regra dura do CLAUDE.md); o farolTone (linha 36) pode continuar aceitando a string 'atenç' vinda do workbook, mas a UI não deve exibi-la.
- Proposta: Unificar a cópia exibida: CriteriosFarol passa a 'Risco · real > proposta (excedente a cobrar)' e a legenda do Gráfico A passa a 'Real com excesso (Risco)' ou mantém 'Real excesso' adicionando '(Risco)'. O parser farolTone fica como está (tolerante à fonte). Um usuário que cruza esta aba com o restante do produto passa a ver um vocabulário só.

**9. Tabela de apuração vai crescer até ~52 linhas sem filtro, paginação nem linha de total** · `tabela` · impacto 🟡 médio · esforço médio

- Problema: ApuracaoCard (linhas 507–577) lista todo mês com real OU prev preenchido — e o workbook pré-preenche o prev do futuro (comentário na linha 509–510), então a tabela tende a dezenas de linhas onde a maioria mostra '—' nas colunas Real/Excedente/Pleiteável (poluição de traços). A regra do projeto pede toolbar em coleções 5+; os totais só existem no microcopy do subtítulo, longe do fim da coluna que somam.
- Proposta: (1) Segmented compacto no header da seção: 'Meses medidos' (default) | 'Todos os meses' — nada é removido, só o default fica limpo; (2) linha de rodapé Σ com Excedente total e Pleiteável total alinhados às respectivas colunas (casa com o achado do MOD/EQP); (3) quando 'Todos' passar de 12 linhas, paginação client-side 12/página no padrão canônico ('Mostrando A–B de N'). O empty filtrado ('nenhum mês medido ainda') reaproveita o EmptyState existente com texto próprio.

**10. Veredito sempre em amarelo-warning e skeleton que não espelha a página** · `estados` · impacto ⚪ baixo · esforço baixo

- Problema: Dois estados visuais desalinhados: (1) a faixa .chv-verd é estilizada fixa com warning-bg/warning (chuvas.css, linhas 121–132) — se o veredito da obra for positivo (diasACobrar = 0), a frase 'conforme' aparece dentro de um alerta amarelo; (2) o skeleton de loading (linhas 73–84) renderiza 4 blocos de 92px + um de 320px, mas a página real tem 4 gráficos, tabela e faixa de IA — na troca de obra o layout 'pula'.
- Proposta: (1) Classe modificadora .chv-verd.ok com success-bg/success aplicada quando k.diasACobrar === 0 (a cor passa a acompanhar o Badge do header, que já é dinâmico); (2) completar o skeleton com a forma real: 4×92 (KPIs) + 300 (Gráfico A) + 270 (Gráfico B) + grid 2-col com 2×250 (C e D) + 260 (tabela), reusando <Skeleton> — espelha a densidade final e elimina o salto de layout.

### Responsabilidade (RMA · 5.3.8 · Análise de Responsabilidade)

**JTBD**: Gerente de Contrato e Jurídico abrem a aba para responder: "do impacto negativo deste BM, quanto é atribuível à Contratante (base de Pleito), quanto é da Contratada, de Terceiro ou Força Maior — e quais eventos, com que prova documental, sustentam cada atribuição?". É a ponte entre o RMA mensal e a construção do Claim (M3.10).

<details><summary><b>Inventário (o que a tela exibe hoje — nada disto sai)</b></summary>

- Header local — título 'RMA · Análise de Responsabilidade · {BM}' + subtítulo de propósito (RespHeader, L86-98)
- 4 KPIs hero em FarolCard com accent fixo por responsável: CONTRATANTE (danger) / CONTRATADA (warning) / TERCEIRO (info) / FORÇA MAIOR (neutral) — valorLabel + nota (KpisHero, L111-140)
- Card 'Distribuição do Impacto por Responsável · {BM}' — barra horizontal empilhada CSS com label '{RESP} {pct}%' dentro de cada segmento + title nativo no hover (DistribuicaoCard, L144-198)
- Estado vazio da barra: faixa success 'Sem eventos negativos no período · cenário limpo'
- Box de observação da distribuição (.rsp-obs, fundo danger-bg) com texto distribuicaoObs e negritos em --danger
- Card 'Matriz de Eventos × Responsabilidade · {BM}' — tabela ID · Evento · Data · Impacto R$ (colorido pelo responsável) · Resp. (pill tingida via color-mix) · Docs, sub com 'N eventos negativos identificados · ordenação por impacto financeiro' (MatrizCard/EventoLinha, L202-279)
- Rodapé da matriz: '+ N eventos de menor impacto · ver listagem completa' (link href=#listagem)
- Empty da matriz: ícone check + 'Nenhum evento negativo identificado no período.'
- Card 'Interpretação · Adm Contratual IA' — tag brand UPPERCASE + parágrafos com **negrito** via FormattedText (InterpretacaoCard, L283-295)
- Card 'Quantificação por Tipo de Impacto' — sub 'Detalhamento dos {totalConsolidadoLabel}'; lista de tipos com barrinha vertical 4px na cor do farol + categoria + descrição + valor colorido pelo farol; empty 'Sem impactos no período.' (QuantTipoCard/TipoImpactoLinha, L299-335)

</details>

**1. Aba morre em notFound para toda obra real — único caminho vivo é o registry de mocks, que está vazio** · `estados` · impacto 🔴 alto · esforço baixo

- Problema: O loader (responsabilidade.tsx L25-31) faz `if (!visao) throw notFound()` sobre getVisaoGeral, que lê OBRAS_BY_ID — registry VAZIO (src/lib/mocks/obras/index.ts L18). Resultado: para BR-101 e as demais obras reais, a aba inteira vira o `EmConstrucao` genérico do notFoundComponent de rma.tsx L42. Nenhum estado próprio: sem Skeleton, sem empty honesto, sem erro+retry. As abas irmãs já são 'real-tolerantes' (condutas.tsx documenta o padrão: 'Sem notFound 404'; faturamento.tsx tem isLoading→Skeleton / isError→EmptyState com retry / !data→EmptyState honesto).
- Proposta: Replicar o padrão de condutas.tsx sem tocar na view existente: loader devolve `{ visao: visao ?? null }` (sem throw); no componente, `visao == null` renderiza RespHeader + EmptyState framed próprio ('Análise de responsabilidade ainda não normalizada — os eventos negativos desta obra ainda não foram classificados por responsável'), mantendo o título e o contexto da aba visíveis. Quando o read-model real chegar, o mesmo ponto recebe Skeleton com a forma final (4 cards + barra + tabela) e erro com retry. Nada da tela atual muda para obra com dado.

**2. Barrinha lateral colorida de 4px nos itens de Quantificação viola o veto do dono a tarja em card** · `consistencia` · impacto 🔴 alto · esforço baixo

- Problema: `.rsp-quant-item` é um mini-card (surface-2 + radius) com `.rsp-quant-bar` — barra vertical de 4px na cor do farol colada à esquerda (responsabilidade.css L288-302, TipoImpactoLinha L325). É exatamente o padrão 'barra/borda colorida de destaque em card' banido no CLAUDE.md ('vale pra qualquer card futuro') e que o template consolidado das abas RMA já substituiu por 'Badge/dot/barra de progresso (sem border-left)'.
- Proposta: Trocar a tarja por dot de farol de 8px antes da categoria (padrão de dot da Regra do Farol §7) ou `<Badge tone>` compacta ao lado do valor — o valor continua colorido pelo farol (t.farol é farol legítimo) e nenhuma informação some; só muda o portador da cor. Grid do item vira `minmax(0,1fr) auto` com o dot inline na linha da categoria.

**3. Barra empilhada mente na proporção, corta rótulo e não tem legenda nem tooltip de verdade** · `grafico` · impacto 🔴 alto · esforço médio

- Problema: `.rsp-bar-seg` tem `min-width: 60px` (css L91) — segmento de 3% é esticado a 60px e a proporção visual deixa de ser honesta; o rótulo interno 'CONTRATANTE 61,2%' tem `overflow: hidden` e simplesmente corta em segmentos médios; `color: #fff` é hex hardcoded (viola tokens-only) com contraste fraco sobre --warning/--info no light; o único detalhe no hover é o `title` nativo (L183) — lento, sem estilo, sem R$. Não existe legenda persistente: a semântica de cor só vive dentro dos próprios segmentos.
- Proposta: Manter a barra, completá-la: (a) legenda logo abaixo — dot 8px + nome + valorLabel + pct + nº de eventos, tudo já disponível em a.{resp} (valorLabel/pct/eventos); (b) dentro do segmento, exibir apenas o % e só quando pct ≥ ~10 (senão vazio, a legenda cobre); (c) min-width cai para 4px para a proporção ser real; (d) trocar #fff por token (ex.: `var(--surface)` ou label fora do segmento) e enriquecer o title com 'R$ X · N eventos' enquanto não houver tooltip custom.

**4. Matriz de eventos sem toolbar (filtro/ordenação/paginação) e com link 'ver listagem completa' morto** · `tabela` · impacto 🟡 médio · esforço médio

- Problema: A matriz é uma coleção potencialmente 10+ (eventosTotal ≥ eventos.length; o rodapé admite '+N eventos de menor impacto') sem nada da regra de coleção do CLAUDE.md: sem filtro por responsável, ordenação fixa ('por impacto financeiro'), sem paginação. Pior: o link 'ver listagem completa' aponta para `href="#listagem"` (L239) e não existe elemento com id 'listagem' em lugar nenhum — âncora morta que finge navegação. Em ≤720px a grade fixa de 6 colunas (css L157) espreme a coluna Evento sem wrapper de overflow.
- Proposta: Adicionar toolbar leve acima da tabela: FilterChips por responsável com contador (Todos · Contratante · Contratada · Terceiro · F. Maior), Select compacto de ordenação (Impacto ↓ default · Data · Docs) e paginação client-side 8-10/página quando 10+ linhas — com empty filtrado próprio ('Nenhum evento deste responsável · Limpar filtro'). O link morto: enquanto a listagem completa não existir como dado, virar texto honesto '+ N eventos de menor impacto não listados neste corte' (sem <a>); quando existir, expandir a própria tabela. Envolver a tabela em wrapper com overflow-x para telas estreitas.

**5. Coluna 'Impacto R$' pintada com a cor do responsável colide com a semântica de farol** · `consistencia` · impacto 🟡 médio · esforço baixo

- Problema: EventoLinha L263 pinta o valor financeiro com RESP_COLOR do responsável — os mesmos tons que o Sistema de Farol usa para criticidade. 'R$ 1,84 mi' em laranja lê-se como 'Risco', quando ali laranja significa 'Contratada'; azul lê-se 'Observação' quando significa 'Terceiro'. A pill na mesma linha já carrega a cor do responsável — a célula de valor duplica o código de cor e cria ambiguidade.
- Proposta: Valor de impacto em `var(--text)` semibold tabular neutro (padrão das demais tabelas financeiras do RMA); a pill segue sendo a única portadora da cor do responsável. Não remove informação — a cor era redundante com a pill da própria linha — e reduz a saturação de danger/warning na tela.

**6. Box de observação sempre vermelho satura a tela de danger independentemente do conteúdo** · `poluicao` · impacto 🟡 médio · esforço baixo

- Problema: `.rsp-obs` é hardcoded `background: var(--danger-bg)` com strong em `--danger` (css L118-129). Somado ao KPI Contratante danger, ao segmento danger da barra, aos valores danger da tabela e às pills danger, a tela fica monocromática de alarme — e num cenário limpo (barra success 'cenário limpo') o box continuaria vermelho, contradizendo o próprio estado ao lado.
- Proposta: Tom do box passa a ser derivado, não fixo: default neutro (`var(--surface-2)`, strong em `var(--text)`); tingir via `color-mix(in srgb, var(--danger) X%, var(--surface))` apenas quando a Contratante dominar a distribuição (ex.: pct ≥ 50) — mesmo mecanismo aprovado para card com farol. O texto distribuicaoObs permanece integral.

**7. Nº de eventos por responsável e chatQuote existem no dado e não aparecem em pixel nenhum** · `dado-subaproveitado` · impacto 🟡 médio · esforço baixo

- Problema: AnaliseRespBM carrega `a.{contratante|contratada|terceiro|forcaMaior}.eventos` (types.ts L986-989) — quantos eventos sustentam cada atribuição, informação central para pleito — e a tela não exibe em lugar algum (o adapter de relatório já usa como hint, a tela não). `a.chatQuote` (L1009) também é carregado e ignorado pelo responsabilidade.tsx.
- Proposta: FarolCard já tem prop `hint`: passar '{N} eventos' nos 4 KPIs (vira '62,3% do impacto · 4 eventos' sem layout novo) e repetir o contador na legenda da barra (achado do gráfico). chatQuote pode virar bloco de citação dentro do card Interpretação — citação é a única exceção permitida do veto de bordas (.chat-panel-quote), e conecta a análise à conversa com a Adm Contratual IA.

**8. Rota aceita ?bm= mas não há seletor de BM na tela — parâmetro só alcançável por URL manual** · `navegacao` · impacto 🟡 médio · esforço médio

- Problema: validateSearch trata `?bm=` (L18-24) e getBm resolve o snapshot, o título até mostra bm.numero — mas nenhum controle na tela permite trocar de BM. Faturamento tem barra de parâmetros (FatParamBar/useRmaCorte) e o template das abas prevê o corte de período; aqui o histórico BM a BM existe em visao.bms e fica inavegável.
- Proposta: Select compacto de BM nas actions do RespHeader (populado de visao.bms, label 'BM-07 · fev/26'), sincronizando com ?bm via navigate — preserva o deep-link que já funciona e destrava comparação entre medições sem nenhuma mudança estrutural. Helpers listAnosBms/listMesesBms já existem no barrel de obras.

**9. Sub do card Distribuição descreve o tipo de gráfico e promete R$ que a barra não mostra** · `microcopy` · impacto ⚪ baixo · esforço baixo

- Problema: O subtítulo 'Barras horizontais empilhadas · valores em R$ milhões' (L162) é auto-referente (diz O QUE o gráfico é, não o que responde) e falso na segunda metade: a barra exibe apenas percentuais, nenhum valor em R$ aparece no bloco.
- Proposta: Trocar por microcopy de leitura: 'Participação de cada responsável no impacto total do período'. Com a legenda proposta exibindo valorLabel por responsável, a promessa de R$ passa a ser verdadeira — e o sub pode ganhar o total: '... · total {totalConsolidadoLabel}' (dado já disponível).

**10. KPIs hero sem ícone — chip canônico do FarolCard não utilizado, destoa das abas maduras** · `hierarquia` · impacto ⚪ baixo · esforço baixo

- Problema: KpisHero (L114-137) não passa a prop `icon` que o FarolCard suporta (chip do padrão canônico de KPI); Faturamento e as demais abas refinadas usam o chip com ícone, e aqui os 4 cards ficam só com label UPPERCASE — visualmente mais 'crus' que o resto do RMA e sem âncora de escaneabilidade entre os 4 responsáveis.
- Proposta: Adicionar `icon` por responsável usando o mapa I existente (ex.: contratante=flag, contratada=users, terceiro=link, forcaMaior=shield — ou registrar equivalentes lucide se preferir stroke consistente). Uma linha por card, zero mudança de dado, alinha ao exemplar /desequilibrio/indiretos.

### C.10 Panorama

**JTBD**: O gerente de contrato (e o diretor) abre o Panorama pra responder em segundos: "como o contrato fecha o mês nas 6 dimensões, qual é a pior, e cada desvio já tem fato → documento → responsável pronto pro Módulo 3 quantificar?". É a antessala do pleito: consolida o farol multidimensional e a matriz de nexo causal que alimenta a quantificação de desequilíbrio.

<details><summary><b>Inventário (o que a tela exibe hoje — nada disto sai)</b></summary>

- Header da aba: título 'Panorama do Contrato · C.10' + subtítulo explicando a régua (pior das seis; cinza = sem dado, não verde)
- Rótulo de seção 'Farol multidimensional consolidado'
- Farol row: 6 células clicáveis (ícone lucide + nome da dimensão + dot colorido + nível) — Liberações de Área, Projetos, Preços e Quantidades, Interferências, Suprimentos/Material, Clima — com scroll suave até o card correspondente
- Célula CONSOLIDADO (fundo ink, valor grande + sub 'pior das 6 · BM 03')
- Rótulo 'Detalhe por dimensão' + 6 DimensaoCard: título com ícone, Badge de farol (ou 'Sem dado' neutral), grid de KPIs 3 col (label / valor tabular / fonte em itálico), bloco de análise em prosa, crosslinks (ícone Link2, cor brand), cláusulas (ícone ScrollText)
- Rótulo 'Matriz de Nexo Causal' + nota explicativa (fato → documento → responsável → hipótese; quantificação no Módulo 3)
- NexoTable: grid 7 colunas — Frente/disciplina, Desvio, Causa, Responsável (Badge por parte), Documento, Hipótese, Farol (Badge) — ou EmptyState 'Sem desvios relevantes no período.'
- Diagnóstico — card escuro (ink) com síntese executiva derivada: consolidado, focos de atenção, dimensões sem dado, conformes, ponte pro Módulo 3
- Estados: skeleton de loading (header + 7 células + 1 bloco), EmptyState de erro com Badge danger, EmptyState 'aguardando normalização'

</details>

**1. Snapshot de KPIs do obra_panorama existe no read-model e não aparece na tela** · `dado-subaproveitado` · impacto 🔴 alto · esforço médio

- Problema: getPanorama (src/lib/supabase/panorama.ts L156-165) devolve nAvaliados, pctAreasLiberadas, diasParadosAcum, frentesImpedidasRs e status — e PanoramaAba (panorama.tsx L100-135) não renderiza NENHUM deles; a tela usa só consolidado/dimensoes/nexo. A cobertura parcial (hoje 4/6 no BR-101) fica implícita no cinza, e métricas de contexto (dias parados acumulados, R$ de frentes impedidas, % de áreas liberadas) já pagas pela query somem.
- Proposta: Inserir uma KpiRow de snapshot entre o header e o farol row, no padrão canônico (chip quadrado r-sm/surface-2 com ícone lucide + rótulo + valor grande tabular-nums + sub discreto): 'Dimensões avaliadas 4/6', 'Áreas liberadas X%', 'Dias parados acum. N', 'Frentes impedidas R$ X'. Null → '—' com sub 'sem dado' (honestidade: pendente ≠ zero). Segue o template consolidado das abas RMA (snapshot → seções → coleção) sem tocar em nada do que já existe.

**2. 'BM 03' hardcoded na célula CONSOLIDADO — quebra em qualquer outra obra/mês** · `microcopy` · impacto 🔴 alto · esforço baixo

- Problema: FarolRow (panorama.tsx L163) imprime o literal 'pior das 6 · BM 03'. O período não vem do dado: em Sorriso ou no próximo BM do BR-101 a tela mentiria a competência. Além disso, com cobertura parcial (2 dimensões sem dado) o 'pior das 6' é impreciso — o consolidado é a pior das 4 avaliadas (invariante do pipeline: só fica verde com 6/6).
- Proposta: Trocar o sub por dado real: usar nAvaliados do read-model — 'pior de 4/6 avaliadas' — e, se quiser manter a competência, expor o BM/competência da row de obra_panorama no getPanorama (a row mais recente já é lida) em vez do literal. Esforço de minutos, elimina um número potencialmente errado em produção.

**3. Matriz de Nexo estoura e CORTA conteúdo abaixo de ~900px (overflow: hidden)** · `responsivo` · impacto 🔴 alto · esforço baixo

- Problema: .pan-nexo (panorama.css L295-305) define 7 colunas cujos mins somam ~790px + gaps (~72px) + padding, com 'overflow: hidden' e nenhum breakpoint. Abaixo de ~900px de viewport o grid não encolhe (minmax trava no mínimo) e o overflow hidden literalmente decepa as colunas Hipótese/Farol — perda real de informação, o oposto da regra 'não remover nada'.
- Proposta: Envolver a matriz num wrapper com overflow-x: auto e min-width interna (padrão de tabela larga já usado no app), mantendo o border-radius no wrapper. Alternativa em 880px: reflow pra formato empilhado (cada desvio vira um card com pares label/valor), como já fazem outras abas do RMA em telas estreitas.

**4. NexoTable sem contador, filtro nem ordenação — não escala quando os desvios acumularem** · `tabela` · impacto 🟡 médio · esforço médio

- Problema: NexoTable (panorama.tsx L208-246) renderiza tudo em ordem de chegada, sem contador de linhas, sem filtro por Responsável/farol e sem ordenação. A matriz cresce a cada BM (todo desvio amarelo/vermelho entra); a regra do projeto exige toolbar em coleções 5+ itens. O respTone já classifica Contratante/Contratada/outro — o eixo de filtro mais valioso pro Jurídico (desvios do Contratante = base de Pleito) já existe no dado.
- Proposta: Adicionar ao rótulo da seção o contador ('Matriz de Nexo Causal · N desvios') sempre; e, quando houver 5+ linhas, FilterChips por Responsável (Contratante/Contratada/Ambos) e por farol, com ordenação default 'farol crítico primeiro' e estado empty-filtrado distinto ('Nenhum desvio com esse filtro' + Limpar filtro). Paginação client-side 8-10/página só quando passar de 10. Nenhuma linha some — só ganham controle.

**5. Distribuição do farol não é visível de relance — o usuário conta células de cabeça** · `grafico` · impacto 🟡 médio · esforço baixo

- Problema: A aba não tem nenhum elemento gráfico-resumo além dos dots individuais. Pra saber 'quantas conforme, quantas em risco, quantas cegas' o olho precisa varrer as 6 células. O componente Diagnostico (panorama.tsx L258-262) JÁ computa emRisco/conformes/semDado — o dado derivado existe, só não tem forma visual.
- Proposta: Micro-sumário visual sem novo bloco: uma barra segmentada fina (6 segmentos na ordem das dimensões, cada um tingido pelo token do nível — success/info/warning/danger/text-4) dentro da célula CONSOLIDADO ou à direita do rótulo 'Farol multidimensional consolidado', com tooltip pt-BR por segmento (nome da dimensão + nível). Alternativa ainda mais leve: chips '2 Conforme · 2 Risco · 2 Sem dado' no rótulo da seção. É derivação do que já está na tela, zero informação nova ou removida.

**6. 6 cards de dimensão empilhados full-width: prosa de 160+ caracteres e poço de scroll** · `poluicao` · impacto 🟡 médio · esforço baixo

- Problema: pan-dimlist (panorama.css L191-195) empilha os 6 DimensaoCard em coluna única full-width. Na convenção full-width do app, num monitor 1600px+ o bloco .pan-dim-analise vira linha de 160+ caracteres (viola a medida interna de prosa 72-90ch da convenção de layout) e a seção consome ~6 × 200px de scroll até chegar na matriz de nexo — que é o clímax da aba.
- Proposta: (a) max-width: 90ch no .pan-dim-analise (e no .pan-dim-clausula) — legibilidade imediata; (b) .pan-dimlist vira grid de 2 colunas com align-items: start em ≥1280px, caindo pra 1 coluna em 1100px (breakpoint existente). Encurta a página pela metade, aproxima a matriz de nexo do fold, e nenhum campo dos cards é tocado.

**7. Tipografia abaixo do limiar de leitura (9px/9.5px) fora da escala do DS** · `consistencia` · impacto ⚪ baixo · esforço baixo

- Problema: .pan-dk-f (fonte do KPI) usa 9px itálico e .pan-fcell-consol-sub usa 9.5px (panorama.css L251-256 e L185-188) — abaixo do confortável e fora da escala do DS (que começa em --fs-12; detalhes geométricos aceitam menos, mas 9px de texto corrido de proveniência é ilegível em densidade padrão). A proveniência do dado ('fonte: BM 03', etc.) é informação de confiança — não pode ser o texto mais sacrificado da tela.
- Proposta: Subir as captions pra 10.5-11px, remover o itálico e manter a hierarquia via cor (var(--text-4)), alinhando ao padrão de caption das outras abas RMA. Ajuste puramente de CSS, 4 seletores.

**8. color-mix com 'white' hardcoded e variante 'observacao' faltando no consolidado** · `consistencia` · impacto ⚪ baixo · esforço baixo

- Problema: panorama.css L176-184: as cores do valor grande do CONSOLIDADO usam color-mix(in srgb, var(--success|warning|danger) 70-75%, white) — 'white' cru viola a regra tokens-only (o token correto é var(--on-accent), definido exatamente pra texto sobre preenchimento saturado). E falta o caso .pan-fcell-consol.pan-f-observacao: se o consolidado fechar em Observação, o valor cai no branco puro sem a tinta info — inconsistente com os outros 3 níveis.
- Proposta: Trocar 'white' por var(--on-accent) nos 3 seletores e adicionar .pan-fcell-consol.pan-f-observacao com color-mix de var(--info). Dois minutos de edição, fecha o ciclo dos 4 níveis fixos do farol.

**9. Skeleton não espelha a página real e o scroll-to-card não dá feedback de chegada** · `estados` · impacto ⚪ baixo · esforço baixo

- Problema: O loading (panorama.tsx L71-83) mostra header + 7 células + UM bloco de 180px — a página real tem 6 cards de dimensão + matriz + diagnóstico, então o layout 'pula' na hidratação. E o clique na célula do farol (scrollDim, L46-50) rola até o card mas não sinaliza qual card é o destino — com 6 cards visualmente idênticos, o usuário perde o alvo.
- Proposta: (a) Skeleton com a forma real: 7 células + 3 blocos de ~150px (cards) + 1 bloco largo (matriz); (b) após o scrollIntoView, aplicar classe transitória no card alvo com fundo color-mix(in srgb, var(--brand) 6%, var(--surface)) esvaindo em ~1.2s via var(--easing), com respeito a prefers-reduced-motion (sem animação, só o fundo estático breve). Microinteração barata que fecha o loop farol→detalhe.

**10. Crosslinks pintados de brand com ícone de link — mas não são clicáveis (affordance falsa)** · `navegacao` · impacto 🟡 médio · esforço médio

- Problema: .pan-dim-links (panorama.css L270-277) usa cor var(--brand) + ícone Link2, a linguagem visual universal de 'clique aqui' — mas o elemento (panorama.tsx L193-197) é um div com texto puro. O usuário clica e nada acontece. As referências apontam pra abas que EXISTEM como rotas (C.9 Chuvas, C.5 Prazo, D.x do Painel de Desequilíbrio).
- Proposta: Parsear as referências conhecidas no texto de crosslinks (padrão C.x/D.x já canônico no produto) e renderizá-las como <Link> reais pras rotas correspondentes do contrato; trechos não mapeáveis permanecem como texto em var(--text-3) (sem fingir link). O texto integral continua exibido — só ganha navegação de verdade onde há destino.

### C.11 Condutas (RMA)

**JTBD**: O Gerente de Contrato (com apoio do Jurídico) decide quais condutas formalizar junto à Arteris e em que ordem: cada conduta vira um documento protocolado (carta, esclarecimento, pedido formal) que preserva a posição da ATERPA para futuros Pleitos. A aba precisa responder rápido "o que protocolar agora, por quê, com que base contratual — e o que já está andando".

<details><summary><b>Inventário (o que a tela exibe hoje — nada disto sai)</b></summary>

- Header da aba: título 'Condutas e Documentos · C.11' + subtítulo explicativo (destinatário/documento/base contratual → vira tarefa na C.12)
- Rótulo de seção 'Panorama das condutas'
- KPI 'Total de condutas' (sub 'fase inicial da obra')
- KPI 'Urgentes' (valor em danger, sub 'ação imediata')
- KPI 'À Arteris (externo)' (valor em warning, sub 'cartas / protocolos')
- KPI 'No Plano de Ação' (valor 0 cravado, sub 'vinculadas à C.12')
- Rótulo de seção 'Catálogo de condutas'
- Barra de filtros: Select de prioridade (Urgente/Importante/Preventiva) + Select de destinatário (Arteris/Interno) + contador 'X de Y'
- Lista de 15 cards de conduta, cada um com: título (gatilho) · meta com ícone lucide + destinatário + responsável · Badge de prioridade · campo 'Documento a protocolar' · campo 'Base contratual' · box tingido 'Motivo / contexto' · linha 'resultado esperado' · footer com prazo + Badge 'Em curso' + botão 'Enviar ao Plano de Ação' (desabilitado)
- Empty filtrado (EmptyState 'Nenhuma conduta com esse filtro')
- Card escuro 'Leitura das condutas' (diagnóstico derivado: total, urgentes, dirigidas à Arteris, lógica encadeada, distinção C.15/C.12)
- Estados: loading (4 Skeletons de KPI + 1 bloco 360px) · erro (EmptyState + Badge 'Erro de leitura') · empty inicial ('Nenhuma conduta normalizada')

</details>

**1. Coleção de 15 cards longos sem busca, ordenação nem paginação — e o toolkit canônico já existe no projeto** · `tabela` · impacto 🔴 alto · esforço baixo

- Problema: CondutasRealView.tsx L118-157 renderiza os 15 cards em coluna única com apenas 2 Selects de filtro. Cada card tem ~6 blocos internos (título, meta, 2 campos, motivo, resultado, footer) → a página vira um scroll de ~4.000px sem como achar 'a conduta da OS' ou reordenar por prioridade. Viola a regra nº1 do CLAUDE.md (coleção 5+ itens = busca+ordenação; 10+ = paginação). O arquivo já importa normTxt de @/lib/rma/colecao, mas ignora useColecao/ColToolbar/ColPag/ColVazio — o padrão que prazo.tsx (L30, L674, L728, L768) e produtividade.tsx já usam.
- Proposta: Adotar o toolkit compartilhado: `useColecao(lista, { busca: c => [c.gatilho, c.documento, c.clausula, c.motivo, c.destinatario, c.responsavel].join(' '), ordenacoes: [ordem sugerida (default), prioridade (urgente→preventiva), dias em aberto (desc)], filtro: fPrio/fDest via resetKey })` + `<ColToolbar placeholder="Buscar por gatilho, documento ou cláusula…" extra={<os 2 Selects atuais>}>` + `<ColPag rotulo="condutas">` (8/página) + `<ColVazio artigo="Nenhuma" rotulo="conduta">` no lugar do EmptyState de filtro. Nada some — os filtros atuais viram o slot `extra` da toolbar, e o contador 'X de Y' já é coberto pelo ColPag ('1–8 de 15 condutas').

**2. Badge 'Em curso' cravado no footer ignora o status real que o read-model já carrega** · `dado-subaproveitado` · impacto 🔴 alto · esforço baixo

- Problema: CondutaCard L247: `<Badge tone="info">Em curso</Badge>` é hardcoded para as 15 condutas — mas getCondutas (src/lib/supabase/condutas.ts L23) seleciona `status` do banco ('Sugerida' / 'Em redação' / 'Aceita', estágio operacional do workbook). A tela afirma um estágio que o dado não diz: viola a regra de honestidade (o gate de paridade inclusive emite contagem_por_status que a tela não materializa).
- Proposta: Trocar o Badge fixo por um mapeado do dado: `status→tone` (Sugerida=info · Em redação=warning · Aceita=success · null=neutral com label 'Sugerida'). Mesmo mapa alimenta o achado dos KPIs. Zero informação removida — o footer passa a mostrar o estágio verdadeiro de cada conduta.

**3. KPI 'No Plano de Ação' cravado em 0 em vez de derivado do status** · `consistencia` · impacto 🟡 médio · esforço baixo

- Problema: L114: `<CondKpi label="No Plano de Ação" valor={0} …/>` — número fixo no código. Se o workbook marcar qualquer conduta como 'Aceita', o KPI mente. O sub do KPI 'Total' ('fase inicial da obra', L106) também é microcopy cravada que não sobrevive à evolução da obra.
- Proposta: Derivar: `kpis.noPlano = lista.filter(c => normTxt(c.status ?? '') === 'aceita').length` (mesmo normTxt já importado). Se 0, o KPI continua mostrando 0 — só que agora honesto. No sub do Total, trocar 'fase inicial da obra' por algo derivável ('catálogo v46' ou o breakdown 'X internas · Y à Arteris').

**4. 15 boxes tingidos de warning empilhados — parede amarela que dilui a semântica do farol** · `poluicao` · impacto 🔴 alto · esforço baixo

- Problema: Todo card renderiza `.cnd-motivo` com `background: var(--warning-bg)` + borda warning (CSS L175-196), independente da prioridade. Com 15 cards, são 15 blocos amarelos idênticos em sequência: o warning deixa de sinalizar 'Risco' (Regra do Farol: warning = nível Risco) e vira textura de fundo — e as 3 condutas realmente urgentes não saltam mais que as preventivas.
- Proposta: Neutralizar o box de motivo para `var(--surface-2)` + borda `var(--border)` + título em `var(--text-3)` (mantendo ícone Target e o texto integral), e reservar o tinto: warning-bg apenas quando prioridade = Importante e danger-bg leve (`color-mix(in srgb, var(--danger) 6%, var(--surface))`) quando Urgente. A cor volta a carregar informação (prioridade) em vez de ruído — nenhum texto é tocado.

**5. categoria e diasAberto chegam do banco e nunca aparecem na tela** · `dado-subaproveitado` · impacto 🟡 médio · esforço baixo

- Problema: getCondutas seleciona `categoria` e `dias_aberto` (condutas.ts L39) e o tipo Conduta os expõe (L17, L26), mas CondutasRealView não renderiza nenhum dos dois. 'Aberta há N dias' é exatamente o dado que ordena a urgência operacional; categoria agruparia o catálogo (projeto/medição/prazo…).
- Proposta: No meta do card (L205-212), acrescentar `<Tag>{c.categoria}</Tag>` quando presente; no footer, ao lado do prazo, 'aberta há {diasAberto} dias' em tabular-nums (`var(--text-3)`), com plural correto ('há 1 dia'). Incluir categoria no texto pesquisável da busca (achado 1) e, se os valores forem consistentes, como 3ª ordenação/filtro.

**6. Filtro de prioridade compara case-sensitive enquanto o Badge normaliza — filtro pode esvaziar em silêncio** · `consistencia` · impacto 🟡 médio · esforço baixo

- Problema: L45: `if (fPrio && c.prioridade !== fPrio) return false` compara o valor cru do banco com 'Urgente'/'Importante'/'Preventiva' capitalizados do Select. Já o tom do Badge usa `PRIO_TONE[normTxt(c.prioridade)]` (L17-21, L197) — a própria tela admite que a grafia do workbook varia. Se o banco tiver 'URGENTE' ou 'urgente', o Badge colore certo mas o filtro retorna zero resultados sem erro.
- Proposta: Uniformizar: `normTxt(c.prioridade ?? '') !== normTxt(fPrio)`. Uma linha, elimina a divergência entre os dois caminhos de leitura do mesmo campo.

**7. KPIs fora do padrão canônico (sem chip lucide) e Panorama sem nenhum visual de distribuição** · `grafico` · impacto 🟡 médio · esforço médio

- Problema: CondKpi (L165-193) é label→valor colorido→sub, sem o chip quadrado com ícone lucide do padrão canônico (/desequilibrio/indiretos, regra do CLAUDE.md). E a aba não tem nenhum elemento gráfico: o template consolidado das abas RMA é 'snapshot + coleção + Badge/dot/barra', mas a distribuição prioridade×destinatário só existe como texto no diagnóstico escuro.
- Proposta: (a) Alinhar CondKpi ao canônico: chip `var(--r-sm)`/`var(--surface-2)` com lucide no topo-esquerdo (ClipboardList=total, TriangleAlert=urgentes, ArrowUpRight=Arteris, CheckCircle2=plano), valor grande tabular, hover lift já existente — sem tarja, chip tingido nos tonais. (b) Abaixo dos KPIs, uma barra de distribuição empilhada em CSS puro (segmentos proporcionais Urgente/Importante/Preventiva com `var(--danger)/var(--warning)/var(--info)`, legenda pt-BR com contagens '3 urgentes · 7 importantes · 5 preventivas' e `title` por segmento). É dado já em memória (kpis), não é informação nova.

**8. Botão 'Enviar ao Plano' cru fora do DS, com seta literal e motivo do disabled escondido no title** · `microcopy` · impacto ⚪ baixo · esforço baixo

- Problema: L248-250: `<button className="cnd-btn" disabled title="Workflow de envio entra em breve">→ Enviar ao Plano de Ação</button>` — botão custom em vez do `<Button>` do DS, seta '→' como caractere no label (o projeto usa lucide para iconografia) e a explicação do porquê está desabilitado só aparece em hover de tooltip, que muitos usuários nunca veem em botão disabled.
- Proposta: Trocar por `<Button variant="ink" size="sm" disabled>` com ícone lucide (Send ou ArrowRight) + label 'Enviar ao Plano de Ação', e um hint visível ao lado em `var(--text-4)` fs-11: 'workflow de envio em breve'. Remove o CSS `.cnd-btn` duplicado do DS (L233-248 do .css).

**9. Skeleton não espelha a forma final e seções respiram só 12px** · `estados` · impacto ⚪ baixo · esforço baixo

- Problema: Loading (L54-65) renderiza 4 blocos de 84px + 1 bloco de 360px — o conteúdo final tem header, rótulos de seção, toolbar de filtros e cards de ~220px; o 'salto' na troca é visível. E `.cnd { gap: var(--s-3) }` (CSS L3-7) usa 12px uniforme entre TUDO — Panorama, Catálogo e Diagnóstico se colam; o CLAUDE.md pede `--s-6` para separação de seções (o `.cnd-sec` compensa com negative margin, L41, um hack frágil).
- Proposta: (a) Skeleton com a forma real: 1 linha larga (header) + 4 KPIs 84px + 1 linha fina (toolbar) + 3 blocos de ~200px (cards). (b) `margin-top: var(--s-6)` no `.cnd-sec` (removendo o negative-margin), mantendo `--s-3` intra-seção — Panorama/Catálogo/Diagnóstico ganham respiro sem mudar nada de conteúdo.

### C.12 Plano de Ação (RMA)

**JTBD**: O gerente de contrato abre a C.12 no fechamento do BM para saber quais ações corretivas (consolidadas das condutas da C.11 em tarefas 5W2H) estão atrasadas ou críticas, quem responde por cada uma e até quando — para cobrar execução e manter a rastreabilidade que protege o pleito. O diretor bate o olho no farol da aba e nas contagens para decidir se precisa intervir.

<details><summary><b>Inventário (o que a tela exibe hoje — nada disto sai)</b></summary>

- Header: título 'Plano de Ação · C.12' + subtítulo com métricas inline (Total, % concluídas, SLA médio em dias, vinculadas à C.11) + Badge de farol da aba à direita
- KpiBar: 6 mini-cards com dot colorido + valor (Tarefas atrasadas · Vencendo < 7 dias · Críticas atrasadas · Em andamento · A fazer · Concluídas) — contagens GRAVADAS no Resumo (snapshot do BM)
- Quadro de tarefas: header de seção (título + contador 'N ações' + legenda 5W2H) + tabela de 7 colunas: ID (mono), Tarefa (título + meta-linha com origem/por quê/vinculação), Responsável (+ pílula frente/trecho), Prazo (dd/mm/aaaa + flag 'atrasada' derivada), Urgência (Badge), Status (Badge), Esforço
- Realce de linha atrasada: fundo var(--danger-bg) via .pa-row-late (derivado prazo vs hoje, concluída nunca atrasa)
- Empty interno do quadro: 'Sem tarefas no período · Aguardando condutas da C.11'
- Nota 'Gatilhos automáticos': parágrafo explicativo com ícone fire (plataforma cria/atualiza tarefas sozinha)
- Seção 'Leitura do Plano · Adm Contratual IA': tag brand uppercase + parágrafo de narrativa (leituraIA)
- Estados: loading (6 skeletons de KPI + 1 de 320px), erro/empty combinados num EmptyState com Badge 'Aguardando C.12 normalizada'
- Dados carregados pelo read-model: tarefas[] (11 campos), resumo (13 campos, incluindo farolCriterio que hoje NÃO é exibido), leituraIA

</details>

**1. Quadro de 15 tarefas sem busca, ordenação, filtro nem paginação** · `tabela` · impacto 🔴 alto · esforço médio

- Problema: QuadroTarefas (PlanoAcaoView.tsx L160-192) despeja as 15 linhas reais (T-01..T-15 na BR-101) direto, sem toolbar. Viola a regra dura do CLAUDE.md para coleções 5+/10+: não dá pra achar a tarefa de um responsável, isolar as 6 críticas nem ordenar por prazo — o gerente escaneia na unha. E se a obra crescer pra 40 tarefas a tela quebra ('teste dos 80 itens').
- Proposta: Toolbar no pa-section-head: (1) Input de busca com ícone, debounce 250-300ms, clear ×, placeholder 'Buscar por tarefa, responsável ou origem…', contador reativo no pa-section-sub ('N de 15 ações'); (2) Select compact de ordenação — default Prazo ↑, alternativas Urgência, Status, ID; (3) FilterChips por status (Todas · A Fazer · Em Andamento · Concluídas) com contagem em cada chip; (4) paginação client-side 10/página quando >12 linhas ('Mostrando 1-10 de 15'). Empty filtrado distinto com botão 'Limpar busca'. Bônus premium: os 6 KPI cards viram atalhos clicáveis que aplicam o filtro correspondente (clicar 'Críticas atrasadas' filtra urgência=Crítica + atrasada). Nenhuma coluna nem linha sai.

**2. KPI cards fora do padrão canônico (dot+label, sem chip lucide, sem sub, sem hover)** · `consistencia` · impacto 🟡 médio · esforço médio

- Problema: pa-kpi (PlanoAcaoView.css L46-75, TSX L135-157) é um retângulo com dot de 8px + label 11px + valor — sem o chip quadrado com ícone lucide, sem sub discreto e sem hover lift do padrão canônico definido no CLAUDE.md (exemplar /desequilibrio/indiretos). Destoa das abas já refinadas do RMA e desperdiça a chance de dar contexto ('6 críticas' de quantas?).
- Proposta: Converter os 6 mini-cards pro padrão canônico: chip r-sm com fundo tingido via color-mix(in srgb, var(--tom) 12%, var(--surface-2)) + ícone lucide (AlertTriangle/danger, Clock/warning, OctagonAlert/danger, Loader2/info, ListTodo/neutro, CheckCircle2/success) → valor grande tabular-nums → sub discreto com proporção ('6 de 15 · 40%', derivado de resumo.total já carregado). Hover: lift 2px + border escurece + var(--sh-sm). O dot atual pode sobreviver no sub como reforço de cor. Zero informação removida — só ganha contexto e consistência.

**3. farolCriterio é carregado e nunca exibido — o Badge 'Risco' fica sem justificativa** · `dado-subaproveitado` · impacto 🟡 médio · esforço baixo

- Problema: planoAcao.ts L140 popula resumo.farolCriterio, mas a view não renderiza em lugar nenhum. Na BR-101 o farol é 'Risco' por julgamento (6 críticas abertas — o critério literal daria Conforme, per manifest de paridade): exatamente o contexto que o diretor precisa pra confiar no Badge do header (L99). Hoje o farol aparece 'seco'.
- Proposta: Sob o Badge de farol no pa-head, exibir o critério como microcopy em var(--text-4) fs-11 ('Critério: 6 críticas abertas') + title= com o texto completo no hover do Badge. Se nulo, não renderiza nada. É dado já disponível no read-model — uma linha de JSX.

**4. Aba sem nenhuma visualização — distribuição por status e % concluídas só em número/prosa** · `grafico` · impacto 🟡 médio · esforço médio

- Problema: A tela não tem gráfico algum. resumo.aFazer/emAndamento/concluidas (14/1/0 na BR-101) e pctConcluidas ficam espalhados entre 6 cards e o subtítulo em prosa (L91-94) — não existe uma leitura visual de 'quanto do plano anda'. SLA médio e % concluídas em <b> no meio do parágrafo são fáceis de perder.
- Proposta: Faixa de distribuição fina entre a KpiBar e o Quadro: uma stacked bar horizontal única (CSS puro, sem Recharts — 3 segmentos flex com width proporcional) com cores por token (--text-3 A Fazer, --info Em Andamento, --success Concluídas), legenda inline com contagens tabulares ('A Fazer 14 · Em Andamento 1 · Concluídas 0') e title= por segmento. Ao lado, ProgressBar do DS para pctConcluidas com rótulo '0% concluídas' + 'SLA médio: — dias' (honesto quando null, como hoje). Nada sai do subtítulo — a faixa é redundância visual intencional.

**5. max-width: 1320px no container viola a convenção full-width do app** · `hierarquia` · impacto 🟡 médio · esforço baixo

- Problema: .pa-main tem max-width: 1320px (PlanoAcaoView.css L8), contra a convenção consolidada do projeto (app enche a largura; blocos densos ganham medida INTERNA). Em monitor largo a aba encolhe à esquerda enquanto as irmãs refinadas do RMA enchem a tela — a tabela de 7 colunas é justamente quem mais se beneficia do espaço (título + meta-linha da tarefa hoje disputam 2.6fr).
- Proposta: Remover o cap do .pa-main. Manter as medidas internas onde prosa: pa-sub já tem 70ch (ok); dar max-width ~90ch ao .pa-ia-texto e ao .pa-gatilho para não virarem linha-de-100-caracteres. A tabela fica fluida (colunas fr absorvem o ganho, principalmente a coluna Tarefa).

**6. Meta-linha da célula Tarefa concatena origem + justificativa + vinculação num fio de 11px** · `poluicao` · impacto 🟡 médio · esforço médio

- Problema: TarefaRow L203-207 espreme origem ('C.11 #2'), porQue (justificativa em prosa, potencialmente longa) e vinculacao numa única linha 11px separada por '·'. Justificativas longas quebram em 3-4 linhas, desalinham a grade (rows de alturas muito diferentes) e os três dados de natureza distinta se fundem num borrão cinza — o 'POR QUÊ' do 5W2H, que é argumento de pleito, fica ilegível.
- Proposta: Manter os 3 dados com hierarquia: origem e vinculação viram pílulas pequenas (mesmo estilo da .pa-frt já existente — mono, surface-2, pill), e o porQue vira linha própria com line-clamp: 2 + title= com o texto completo no hover (ou, melhor: linha expansível com chevron que abre o detalhe 5W2H completo — POR QUÊ em prosa, vinculação, frente/trecho — progressive disclosure). Nada é removido; o texto integral continua acessível a 1 hover/clique.

**7. Prazo sem distância relativa — quanto falta é conta mental** · `microcopy` · impacto ⚪ baixo · esforço baixo

- Problema: fmtDate (L11-15) mostra só dd/mm/aaaa. O comentário L32-33 explica corretamente por que a flag 'vencendo ≤7d' não vai na linha (não contradizer o snapshot gravado do Resumo) — mas hoje a linha não dá NENHUMA noção de distância: o gerente calcula de cabeça se 10/08/2026 é semana que vem ou mês que vem. CLAUDE.md pede datas relativas quando ajudam.
- Proposta: Sob a data, hint neutro em var(--text-4) fs-11 com a distância ('em 12 dias' / 'há 3 dias'), renderizado só quando prazo existe. É informação de calendário, não farol — não conflita com a contagem 'Vencendo < 7 dias' do card (que segue sendo o snapshot oficial). A flag 'atrasada' atual permanece intocada.

**8. Tabela de 7 colunas sem breakpoint — esmaga abaixo de 1100px** · `responsivo` · impacto ⚪ baixo · esforço médio

- Problema: A grid da tabela (CSS L112: 56px 2.6fr 1.3fr 1.1fr 0.9fr 1.1fr 0.7fr) é fixa em qualquer largura; o responsivo da aba só reflowa os KPIs (L251-263). Em ≤880 as colunas Responsável/Urgência/Status viram tiras de 60-80px com Badges quebrando em 2 linhas.
- Proposta: Em ≤880, colapsar cada linha em card empilhado: grid-template-columns 1fr, header da tabela some (display:none) e cada célula ganha label inline uppercase em var(--text-4) via ::before ou span (padrão já usado nas abas refinadas do RMA). Primeira linha do card = ID + título + Badges de urgência/status; segunda = responsável, prazo, esforço. Toda coluna continua visível, só reorganizada.

**9. Erro sem botão de retry (diz 'Tente recarregar' mas não oferece o botão)** · `estados` · impacto ⚪ baixo · esforço baixo

- Problema: L58-76 trata isError e empty no mesmo bloco: quando isError, o EmptyState diz 'Erro ao ler os dados… Tente recarregar' mas não renderiza ação nenhuma — o usuário precisa dar F5 na página inteira. CLAUDE.md exige estado de erro com 'mensagem clara + botão de retry'.
- Proposta: Separar o ramo de erro: EmptyState com Button variant='outline' 'Tentar novamente' chamando refetch() (o useQuery do usePlanoAcao já expõe; basta desestruturar no L44). O empty legítimo ('Plano de Ação pendente · Aguardando C.12 normalizada') permanece exatamente como está — ele é o EmptyState honesto correto.
