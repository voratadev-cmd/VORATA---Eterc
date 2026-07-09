# REFINO-UX-DESEQUILIBRIO — análise das 8 telas do M3 (layout · exibição · organização)

> **Pedido do dono (06/jul/2026)**: o mesmo refino aplicado ao RMA, agora no Painel de
> Desequilíbrio — **sem remover nenhuma informação**, sem mudança drástica. Persona dominante:
> Jurídico preparando Pleito/Claim — a régua de microcopy aqui é DEFENSABILIDADE.
> Método: JTBD → descasamentos → propostas → ALINHAR → executar (ondas com revisor adversarial).
>
> Workflow multi-agente (8 analistas + revisor-chefe): **79 achados** (31 de impacto alto),
> 12 inconsistências entre telas (e vs o padrão já assentado nas abas C), 9 vetos
> (4 parciais), 10 quick wins. Restrição-mestra do M3: **a D.0 é âncora de reconciliação —
> nenhuma proposta muda VALOR nem quebra o cross-check com as telas filhas.**
> Companion do refino RMA: [REFINO-UX-RMA.md](rma/REFINO-UX-RMA.md) (fundações ChartKit/
> ErroCard/toolkit já existem — aqui é ADOÇÃO).

---

## Sumário executivo

| Tela                                       | Achados | Alto | Destaque                                                                                        |
| ------------------------------------------ | ------- | ---- | ----------------------------------------------------------------------------------------------- |
| D.0 Painel de Desequilíbrio                | 10      | 3    | Chuva pendente invisível na composição + três estados conflados (pendente ≠ zero ≠ não apurado) |
| D.1 Indiretos                              | 10      | 4    | Erro de leitura renderizado como EmptyState sem retry — viola ERRO ≠ PENDÊNCIA                  |
| D.2 BDI                                    | 10      | 4    | Erro mascarado como pendência no estado de falha                                                |
| D.3 Encargos Sociais                       | 10      | 3    | Tela sem nenhum gráfico: composição Proposta × Real merece leitura visual por grupo (A/B/D + to |
| D.4 Valor Agregado / Perda de Produtividad | 10      | 4    | Tela sem nenhum gráfico — a série mensal do VA já é carregada (com acumulados derivados 'p/ o g |
| D.5 Insumos (Reajuste/Reequilíbrio)        | 10      | 5    | Sem snapshot no topo — os números-resposta do JTBD ficam enterrados                             |
| D.6 Análises Pontuais                      | 10      | 5    | Leitura IA 100% chumbada com a BR-101 — narrativa deve ser DERIVADA do dado                     |
| 3.10 Gerador de Claim Consolidado (M3.10,  | 9       | 4    | Estado de erro mascarado como pendência — adotar ErroCard com retry                             |

---

## Transversal (revisor-chefe)

### Inconsistências (entre telas D e vs abas C refinadas)

**T1 · ErroCard: 13 arquivos C adotam, ZERO telas D adotam — erro mascarado como pendência em toda a família**

- Telas: D.0, D.1, D.2, D.3, D.4, D.5, D.6, 3.10
- Proposta: Onda única e mecânica: em cada tela, desestruturar { error, refetch } do useQuery e trocar o branch de erro por <ErroCard mensagem={error?.message} onRetry={() => refetch()} /> (já no barrel @/components/ds). EmptyState fica reservado a !data (pendência honesta de normalização). Inclui matar o window.location.reload() da D.3. ~3 linhas por tela, zero risco de regressão de dado.

**T2 · Farol em 3 dialetos: D.3/D.4 usam farolToBadge/farolLabel (correto), D.1 e D.6 chumbam Badge success '● Conforme', D.2 duplica com FAROL_TOM local**

- Telas: D.1, D.2, D.6
- Proposta: Um dialeto só: farolToBadge/farolLabel de @/lib/mocks/contracts em todas. D.6 mapeia params.farol (que o produtor popula) em vez do tone fixo (pontuais.tsx:94 mente se o farol mudar). D.2 apaga FAROL_TOM e normaliza acento UMA vez na borda do read-model (bdiDeseq.ts). D.1: ver veto — não fabricar pseudo-farol de recOk. Glifo '●' sai em todas (dot de 8px via span quando precisar).

**T3 · ChartKit com adoção zero no M3: D.2 tem tooltip/legenda bespoke (.d2-tt/.d2-leg) e as outras 7 têm séries carregadas sem nenhum gráfico**

- Telas: D.0, D.1, D.2, D.3, D.4, D.5, D.6
- Proposta: Toda visualização nova do M3 nasce em ChartTooltip/ChartLegend/CHART_SERIE_COR com a convenção das C: Real=navy, Contratado=info, Meta/régua=warning tracejada, projeção SEMPRE tracejada, danger só no semanticamente ruim. Migrar o bespoke da D.2 (e o split medido/projetado da curva); D.4 copia o ComposedChart pronto de rma/recursos.tsx; D.6 (chuva mensal/diária), D.5 (IPCA com ReferenceDots) e D.3 (grupos A/B/D) seguem o mesmo kit. Proibido nascer um segundo dialeto de tooltip/legenda no diretório.

**T4 · Coleções 5+ sem o toolkit canônico: D.1 (29 grupos), D.3 (27 rubricas), D.4 (~54 funções) — as C refinadas já usam useColecao/ColToolbar/ColPag/ColVazio**

- Telas: D.1, D.3, D.4
- Proposta: Adotar o toolkit com uma regra de família NÃO negociável: linha TOTAL e subtotais computados do conjunto CHEIO e fixados fora de paginação/filtro (a reconciliação com a memória de cálculo e com a D.0 fica sempre visível). D.1 e D.4 ganham busca+ordenação+paginação; D.3 fica sem paginação (a composição íntegra é o artefato) mas ganha busca + FilterChip 'Só divergentes (N)'. Empty filtrado ≠ empty inicial, com 'Limpar busca'.

**T5 · KPI card canônico (exemplar /indiretos) não replicado nas irmãs — e D.4 usa danger como 'método ativo'**

- Telas: D.2, D.4, D.5, D.6
- Proposta: Padrão único da família: chip quadrado lucide em surface-2 + rótulo → valor tabular-nums → sub; card herói/ativo via color-mix(in srgb, var(--brand) X%, var(--surface)) + chip tingido — NUNCA tom de farol para 'ativo' (danger/warning ficam reservados ao farol). D.2 adiciona os chips lucide ao Kpc; D.4 migra card/linha ativos de danger para brand-herói; D.5 ganha o snapshot de 3 KPIs no padrão; D.6 promove 'Pendente (não somado)' a herói brand.

**T6 · Reconciliação com a D.0 (âncora): cada filha resolve de um jeito — banner recOk na D.1, comentário morto na D.4, linkbox ausente na D.5 (a C.6 tem), chip Origem morto no 3.10, '=' sem guarda na D.6**

- Telas: D.0, D.4, D.5, D.6, 3.10
- Proposta: Extrair TELA_DEST + a escala de tons de composição do index.tsx para um módulo compartilhado do M3 (ex.: src/lib/deseqNav.ts) e padronizar a 'linha de reconciliação': asserção com tolerância < R$ 0,01 (o recOk da D.1 é a referência) + valor da parcela no painel + Link navegável para /desequilibrio. D.4 exibe desequilibrioVA já carregado; D.5 replica o linkbox da C.6; 3.10 faz o chip D.x virar Link; D.6 adiciona o guard Σ parcelas = custo do evento e Σ eventos = pendenteTotalRs.

**T7 · Literais da BR-101 chumbados em narrativa — endêmico em 6 das 8 telas ('chuva mai/26', ARTERIS/ATERPA, 'OS de 09/03', 'BM3'/'R$ 6.095.937', 'CBUQ via CAP', leitura IA inteira da D.6)**

- Telas: D.0, D.1, D.2, D.4, D.5, D.6
- Proposta: Regra única codificada do refino RMA: narrativa DERIVADA do dado já carregado, frase a frase condicional, com fallback genérico quando o campo não existe; atribuição causal só quando vier de campo normalizado; nomes de parte viram vocabulário canônico Contratante/Contratada (ou o nome vindo de deseqContexto). Gate de saída da onda: grep por 'ARTERIS|ATERPA|mai/26|09/03|BM3|CBUQ|6.095' no diretório desequilibrio/ retorna vazio.

**T8 · Estados pendente ≠ zero ≠ não apurado tratados diferente entre a mãe e o gerador: D.0 tem lista colapsável (mas confla os três), 3.10 esconde em prosa, D.4 mostra Milha pendente como R$ 0,00**

- Telas: D.0, D.4, 3.10
- Proposta: Padrão compartilhado: valorRs === 0 → 'R$ 0 · apurado, sem desequilíbrio'; null → 'não apurado'; pendente com valor → Badge warning com o número. O <details> 'categorias sem desequilíbrio apurado' da D.0 vira o componente/padrão que o 3.10 replica sob a linha TOTAL. D.4 remove o ?? 0 da Milha ('—' + 'aguardando baseline').

**T9 · Controles bespoke onde o DS já resolve: .dq-abtn (D.0), gc-gerar-btn/gc-nav (3.10), inputs crus da calculadora (D.2), toggle hand-rolled (D.3)**

- Telas: D.0, D.2, D.3, 3.10
- Proposta: Button variant primary/ink/outline do barrel (disabled + 'em breve' nos handlers inexistentes), Input do DS com tabular-nums na calculadora, Segmented (com keynav ARIA de graça) no toggle Histograma/CPU — e o mesmo Segmented serve o toggle MOD/MOI do gráfico proposto da D.3. Apagar o CSS bespoke correspondente.

**T10 · Glifos e emoji como ícone em 6 telas (▸ → ● ⏳ ▸/▾ 📉 📅 👷 🧮 📋 ⚠️) — regra lucide já assentada nas C**

- Telas: D.0, D.1, D.2, D.3, D.4, D.6
- Proposta: Varredura única por grep no diretório, troca 1:1 por lucide 12-14px (ChevronRight/ChevronDown, ArrowRight, Hourglass, Calendar, HardHat, Calculator, ClipboardList, TriangleAlert, TrendingDown, CalendarRange) + dot de farol como span 8px com background em token. No .pnt-memo da D.6, remover também o border-left brand (tarja vetada) → fundo color-mix 4-6% brand.

**T11 · Cabeçalhos fora da convenção 'D.x — Nome': D.3 usa 'Encargos Sociais · D.3' e D.5 nem tem o prefixo ('Reajuste e reequilíbrio dos insumos')**

- Telas: D.3, D.5
- Proposta: Unificar h2 em 'D.x — Nome' (padrão de D.0/D.1/D.2/D.4) e alinhar os meta titles no mesmo eixo (conferir se a convenção é 'D.x' ou '3.x' e aplicar uma só nos dois lugares).

**T12 · RmaParamBar (padrão das C) proposta avulsamente em D.3 e D.5 — sem regra de família para 'parâmetro vs KPI'**

- Telas: D.3, D.5
- Proposta: Codificar a regra antes de executar: KPI row = números com farol/decisão (3-5 cards no padrão canônico); RmaParamBar sob o header = parâmetros e bases (regime, base de MOD, datas-marco, IPCA período, saldo). D.3 move REGIME/ADERÊNCIA pra barra (informação preservada, colada ao contexto); D.5 expõe ali os campos hoje mortos (aniversário do reajuste, reajuste já concedido). Se a regra valer pra dois, vale pra família — documentar no padrão do M3.

### Quick wins transversais

1. Onda ErroCard nas 8 telas: desestruturar { error, refetch } e trocar o branch de erro (~3 linhas/tela, inclui matar o window.location.reload da D.3) — nivela erro ≠ pendência na família inteira num PR só
2. Varredura de glifos: grep '▸|→|●|⏳|📅|👷|🧮|📋|⚠️|📉' em desequilibrio/ e troca 1:1 por lucide + dot 8px — cosmético, meia jornada pro diretório inteiro
3. Matar os 3 desvios de farol: FAROL_TOM local da D.2 → farolToBadge/farolLabel; Badge chumbado da D.6 → params.farol mapeado; Badge chumbado da D.1 → remover/needs_review (conforme veto)
4. Botões DS: .dq-abtn (D.0) e gc-nav/gc-gerar-btn (3.10) viram <Button> do barrel com disabled + 'em breve' nos inertes; apagar CSS bespoke
5. formatBRLCents nas parcelas do 3.10 (L249) — Σ parcelas reconcilia ao centavo com o TOTAL e com o teto da D.0, mudança de 1 formatter
6. D.4: remover '?? 0' da Milha Aferida (pendente vira '—' + 'aguardando baseline') e adicionar a linha de reconciliação com desequilibrioVA já carregado + Link pra D.0
7. D.5: copiar o linkbox da C.6 (classes .c6-linkbox já provadas) com o repasse M2 real + 'Abrir D.0' — reconciliação com a âncora em ~20 linhas
8. Extrair TELA_DEST + escala de composição do index.tsx pra src/lib/deseqNav.ts — destrava os links do 3.10, a barra empilhada e a troca do BAR_TONE farol→navy de uma vez
9. Strings de microcopy: 'editável na D.11' (rota inexistente), 'Vigente · T em aberto', '9 reais vs 4 previstos' (lê-se R$), fallback '46' meses e ARTERIS/ATERPA→Contratante/Contratada na D.1 — só troca de strings
10. Wrapper overflow-x:auto + min-width nas tabelas largas (D.1 grupos, D.3 composição, D.6 fichas) — responsivo honesto sem esconder coluna

### Propostas VETADAS/limitadas pelo revisor

- ✗ **[D.1]** Badge do header derivado de recOk/status ('Reconciliado com o D.0' / 'Divergência com o D.0' / 'Em revisão')
  - Motivo: Farol fabricado no slot do farol — aprendizado codificado: farol só de campo que o produtor POPULA. recOk já tem casa (o banner de divergência L116) e status de reconciliação não é farol. Correção: se o read-model não traz farol da D.1, o header fica SEM Badge (ou Badge warning apenas quando status==='needs_review'); jamais um pseudo-verde derivado que compete com o farol canônico das irmãs D.3/D.4.
- ✗ **[D.1]** Trocar o conteúdo do KPI 4 ('Método ativo') por '% do desequilíbrio total (D.0)'
  - Motivo: D.1 é o EXEMPLAR canônico do M3 e a proposta substitui informação visível de primeira dobra — mudança drástica no template que as outras copiam. Versão segura e aditiva: '% do D.0' entra como SUB do KPI 1 (herói) ou 6º card; substituir o card só com decisão explícita do dono.
- ✗ **[D.1]** Opção (b) do achado dos cenários D.10: 'enxugar o select/tipo' do hook
  - Motivo: Remove dado carregado juridicamente relevante (cenários que alimentam o Pleito) em vez de exibi-lo — viola o pedido do dono de não remover informação. Executar a opção (a): strip discreto 'Cenários que alimentam o Pleito (D.10) — não somam à D.1'.
- ✗ **[D.4]** 'ou cortar as 2 queries do hook (recursos, prod)'
  - Motivo: Remoção de fetch sem mapear consumidores primeiro — aprendizado raio-de-impacto: hooks/read-models são compartilhados (caso real: getRecursos serve mais de uma tela). Preferir a alternativa de exibir a cobertura de meses medidos; corte só após grep de consumidores + tsc + OK do dono.
- ✗ **[D.2]** Vertente (b) da narrativa causal: mover 'mobilização lenta · OS de 09/03' para campo causa_raiz populado pelo workbook-motor
  - Motivo: Acopla o refino de front-end (100% desta fase) a mudança de schema + motor de normalização — trava a onda inteira num pré-requisito de backend. Aplicar JÁ a vertente (a) (frase derivada do sub-faturamento provável na própria curva); o campo normalizado vira item de backlog de normalização com decisão própria.
- ✗ **[D.0]** Colapsar a Quitação trimestral em card + <details>
  - Motivo: Veto PARCIAL: ok para a tabela dos 8 trimestres (expansor navegável é permitido), mas o aviso de quitação tácita (30.7, fundo danger) e o prazo da reunião do trimestre aberto NÃO podem entrar no colapso — é risco jurídico com prazo correndo, precisa ficar na primeira dobra. O card do trimestre aberto deve carregar prazo + status + ressalvas à vista.
- ✗ **[3.10]** Barra 100% empilhada 'em CSS puro' com tons próprios
  - Motivo: Veto PARCIAL: aprovada somente consumindo a MESMA escala de magnitude compartilhada com a D.0 (o módulo deseqNav.ts com a nova escala de intensidades de navy) — se nascer com paleta própria, cria o segundo dialeto de cor de composição no M3 no mesmo PR que corrige o primeiro.
- ✗ **[D.3]** Alternativa responsiva '≤880px mostra um par Proposta × Real por vez via Segmented'
  - Motivo: Veto PARCIAL: esconde metade das colunas atrás de interação (informação fora da vista por default) quando a primeira opção do próprio achado — wrapper com overflow-x + min-width — preserva as 6 colunas honestamente. Adotar o scroll; a alternativa só com pedido explícito do dono.
- ✗ **[D.2]** Default da calculadora de redução como '90% do PV' quando não há cenário do workbook
  - Motivo: Veto PARCIAL: 90% é um número inventado que pode ser lido como cenário oficial numa tela jurídica. Aceito apenas se o campo vier visivelmente rotulado 'valor de exemplo — edite' E a linha 'Cenário do workbook: Δ R$ X' tiver precedência quando populada; ideal é semear do dado (PV − deltaReducaoRs) e, sem ele, campo com placeholder em vez de valor pré-aplicado.

### Ordem de execução sugerida

- 1 · Onda transversal mecânica nas 8 telas (todos os quick wins: ErroCard, glifos→lucide, farol helpers, Buttons DS, formatBRLCents, ??0→'—', microcopy) — risco quase nulo, nivela a língua ANTES de mexer em layout, e é onde a D.1 pode ser tocada com segurança
- 2 · Fundação compartilhada do M3: src/lib/deseqNav.ts (TELA_DEST + escala de magnitude em intensidades de navy) — pré-requisito de D.0 e 3.10, meio dia de trabalho
- 3 · D.0 (a mais vista, âncora de tudo): três estados pendente≠zero≠não-apurado, chuva derivada do read-model, quitação colapsada respeitando o veto do 30.7, barra empilhada ChartKit, BAR_TONE farol→navy, microcopy jurídica
- 4 · D.2 (única com gráfico): migração do bespoke pro ChartKit + split medido/projetado tracejado + neutralização da causal 'OS de 09/03' — estanca o dialeto de chart antes que as irmãs ganhem gráficos e o copiem
- 5 · D.4: ComposedChart copiado de recursos.tsx, linha de reconciliação D.0, literais BM3/R$6.095.937 derivados, danger→brand-herói no método ativo, useColecao nas 54 funções — muito impacto com dado já carregado
- 6 · D.6: leitura IA 100% derivada (maior risco jurídico de narrativa chumbada da família), farol real, colunas de evidência (mm/custo-dia), guards de reconciliação, lucide/memo sem tarja
- 7 · D.5: snapshot canônico no topo, RmaParamBar com campos mortos do reeq, gráfico IPCA, memória de cálculo auditável, herói brand nos cenários — tela já compartilha motor com a C.6, refino incremental
- 8 · D.3: gráfico de composição por grupo + série mensal MOD, toolkit nas 27 rubricas, consolidação KPI+RmaParamBar (com a regra de família do item 12 das inconsistências), Segmented — já é a mais alinhada, ganhos aditivos
- 9 · 3.10: <details> de categorias espelhando a D.0 refeita, chips Origem navegáveis via deseqNav, barra de composição com a escala compartilhada, stepper por prontidão — depende dos passos 2 e 3, e é a vitrine final do M3
- 10 · D.1 estrutural por último (exemplar — cuidado redobrado): gráfico divergente de métodos, useColecao nos 29 grupos com TOTAL fixo, strip dos cenários D.10 (opção a), e as duas decisões vetadas (KPI 4, Badge do header) levadas ao dono com o padrão já provado nas irmãs

---

## Análise por tela

### D.0 Painel de Desequilíbrio — src/routes/\_app/contracts/$contractId/desequilibrio/index.tsx (+ index.css)

**JTBD**: Jurídico + gerente de contrato, preparando o pleito trimestral (Cláusula 30) e o Claim consolidado, precisam responder em segundos: quanto posso pleitear (teto defensável), de onde vem cada real (composição reconciliável 1:1 com D.1–D.6), quanto provavelmente recupero, e que ação o rito exige AGORA (reunião devida, ressalvas, prazo de 90 dias) — com números que batem com as telas filhas e procedência auditável, porque esta tela vira anexo de pleito e erro custa milhões.

<details><summary><b>Inventário (o que a tela exibe hoje — nada disto sai)</b></summary>

- Header da tela: título 'D.0 — Painel de Desequilíbrio' + subtítulo (porta de entrada do M3)
- Hero Resumo: teto pleiteável total (R$ 6,4mi) + % do Valor Contratual + PV compacto
- Hero: Resultado provável (total × % recuperável, com hint 'editável na D.11')
- Hero: Vigente · T em aberto (= total) e Já quitado (= 0)
- Contexto de mérito: 3 chips 'a definir' (Prorrogação estimada/Windows Analysis, Força no mérito, Exposição a contrapleitos D.9)
- Composição por categoria: barra proporcional + valor + % por categoria apurada (D.2 BDI, D.1 Indiretos, D.4 Perda), com nº da tela D.x
- Nota de chuva pendente (R$ 279.805 mai/26, fora do total) — condicional, hoje morta na composição
- Lista colapsável 'categorias sem desequilíbrio apurado' (D.3, D.6, D.7, D.8...)
- Linha TOTAL da composição (R$ + 100,0%)
- Memo Excedente de Insumos (D.5) — faixa tracejada success, faturamento direto fora do teto
- Cenários e métodos calculados: 6 cards (D.1, D.2, D.3, D.4, D.6, D.5) com método, descrição, valor, nota/pendente e link 'Ver 3.x →'
- Ações: Gerar Relatório de Desequilíbrio · Iniciar Claim Consolidado → 3.10 · Exportar Composição · Conversar com a Adm Contratual IA
- Quitação trimestral: rito Cláusula 30 em 3 passos numerados (reunião 30.1 → termo 30.2/30.3 → relatório 30.4)
- Tabela de quitação: 8 trimestres × 7 colunas (Trim., Período, Valor deseq., Fim do trim., Prazo reunião, Reunião, Termo de Quitação), linha aberta destacada
- Callout do trimestre aberto (T1 encerrou em X — reunião devida até Y + pontos a ressalvar)
- Aviso de quitação tácita (30.7) em fundo danger
- Leitura IA (parágrafo do painel)
- Estados: Skeleton 3 blocos · EmptyState de erro · EmptyState 'não normalizado'

</details>

**1. Chuva pendente invisível na composição + três estados conflados (pendente ≠ zero ≠ não apurado)** · `estados` · impacto 🔴 alto · esforço baixo

- Problema: A nota '+ R$ 279.805 pendente (chuva mai/26)' só renderiza dentro do map de `apuradas` (index.tsx L155-180, gate `c.tela === 'D.6'` na L172), mas D.6 = 0 na BR-101 (composição real = só D.1+D.2+D.4, cf. comentário do desequilibrio.ts e oráculo de paridade) → cai no filtro `semDeseq` (L149) e a nota NUNCA renderiza; o pleito potencial de R$ 279.805 some da seção-âncora e só sobrevive discreto num card de cenário. Pior: a lista colapsada rotula TUDO que é `(valorRs ?? 0) === 0` como '— não apurado' (L195), conflando 0 apurado (D.3: método rodou, sem desequilíbrio), null (D.7/D.8: não apurado) e D.6 (tem R$ 279.805 aguardando validação). No card de cenário o D.3 vira 'R$ 0,00' (L246) — a mesma grandeza com duas leituras jurídicas diferentes na mesma tela.
- Proposta: 1) Mover a nota de chuva pra fora do map: renderizar após a lista quando `p.pendentes.chuvaPendenteRs != null`, ancorada à seção (a informação já existe no read-model). 2) Na lista recolhida, distinguir os três estados: `valorRs === 0` → 'R$ 0 · apurado, sem desequilíbrio'; `valorRs == null` → 'não apurado'; D.6 com pendente → Badge tone=warning com o valor do dado. 3) No card de cenário, aplicar a mesma regra (zero apurado ≠ '—'). Nada é removido — os três estados ficam MAIS visíveis e defensáveis.

**2. Literais da BR-101 chumbados: 'chuva mai/26' e '5 dias reais × 3 previstos'** · `literal-chumbado` · impacto 🔴 alto · esforço medio

- Problema: index.tsx L174: 'pendente (chuva mai/26)' — mês da BR-101 chumbado no JSX, renderiza errado pra qualquer outra obra. desequilibrioPainel.ts L74-77 (CENARIO_META D.6): descrição 'mai/26: 5 dias reais × 3 previstos = 2 de excedente (fração 0,4)' — números e data de UMA obra dentro de copy que se apresenta como 'copy de domínio' e vai pra tela de todas as obras. Num documento que embasa pleito, uma data/quantidade de outra obra é vulnerabilidade de credibilidade.
- Proposta: Derivar mês/dias da seção `auxiliar_D.6 Chuva — Totais` que o read-model JÁ lê (L150, chuvaTotais) — expor mês de referência e dias no tipo `pendentes` e interpolar na copy ('ociosidade por chuva {mes}: {reais} dias reais × {previstos} previstos'); quando os campos não existirem, cair pra copy genérica ('ociosidade por chuva — pendente de validação na D.6'). Mesmo padrão já aplicado no refino RMA (narrativas derivadas do dado).

**3. Quitação trimestral pesada — e o desenho anti-poluição já existe órfão no CSS** · `poluicao` · impacto 🔴 alto · esforço medio

- Problema: A seção Quitação empilha 4 blocos sempre abertos: rito de 3 passos + tabela de 8 trimestres × 7 colunas + callout que REPETE os dados do T1 já destacados na tabela (linha warning, L320-371) + aviso de tácita. É o bloco mais alto da tela, e a informação acionável ('tenho ação agora?') fica no MEIO. O próprio index.css já tem o padrão pronto e não usado por nenhum TSX (verificado por grep): `.dq-tab-card*` (card do trimestre aberto, L446-503) e `.dq-crono*` (cronograma colapsável, L506-537). Bonus: em ≤880px o CSS esconde as colunas de ação (Prazo reunião/Reunião/Termo, L745-748) — justamente o que o jurídico precisa.
- Proposta: Adotar o desenho já especificado no CSS: card do trimestre aberto no topo (trimestre, valor, fim, prazo da reunião, status, ressalvas — grid 4 colunas) + `<details>` 'Cronograma completo — 8 trimestres (Cláusula 30)' colapsado com a tabela inteira dentro (padrão idêntico ao `dq-sem-deseq` que a própria tela já usa). O callout deixa de duplicar o T1 e vira o corpo do card. Nenhuma linha/coluna removida — os 8 trimestres continuam a 1 clique, e no mobile o card preserva as datas de ação que a tabela esconde.

**4. Erro renderizado como EmptyState sem retry — fundação ErroCard não adotada** · `adocao-fundacao` · impacto 🟡 médio · esforço baixo

- Problema: index.tsx L50-55: `isError` cai num `EmptyState` neutro ('Tente recarregar a página') — visualmente idêntico à pendência 'não normalizado' logo abaixo (L56-62). Viola a regra codificada erro ≠ pendência: numa tela onde erro = milhões, falha de RLS/rede não pode parecer 'ainda não tem dado'. A fundação `ErroCard` (Badge danger + mensagem técnica + retry) existe em src/components/ds/ErroCard e nenhuma tela do M3 a adotou ainda — D.0, como âncora, deveria ser a primeira.
- Proposta: Extrair `error` e `refetch` do useQuery (o hook já os expõe) e trocar o branch de erro por `<ErroCard mensagem={error?.message} onRetry={() => refetch()} />`. Três linhas, zero risco.

**5. Dado carregado e não exibido: BMs/relatório da quitação, observação do memo, procedência do PV** · `dado-subaproveitado` · impacto 🟡 médio · esforço medio

- Problema: O read-model carrega e a tela ignora: (a) `quitacaoTrimestral[].bms`, `.status` e `.relatorio` (desequilibrioPainel.ts L109-118) — o rito passo 3 fala do 'relatório pormenorizado' mas a tabela não mostra o status dele, nem quais BMs compõem cada trimestre (rastreabilidade do pleito); (b) `memoInsumos.observacao` (L120, populada na L172-177) — a faixa do memo D.5 mostra só o valor; (c) `valorContratadoFonte` (L137), que o próprio read-model documenta como 'para rotular com honestidade': o hero diz '% do Valor Contratual · R$ 611,4 mi' sem dizer se o denominador é o valor contratual da obra ou o PV da curva de faturamento — procedência do denominador é exatamente o que um contraditório ataca.
- Proposta: (a) BMs como sub-linha discreta (--text-4) da célula Período e coluna/campo 'Relatório pormenorizado' no card do trimestre aberto (casa com o achado da Quitação); (b) observação do memo como linha --fs-12 dentro da faixa `dq-apart` (ou title/tooltip); (c) sufixo no `dq-hero-pct`: '· PV: valor contratual da obra' vs '· PV: curva de faturamento', derivado de `valorContratadoFonte`. Só adiciona informação que já está paga no fetch.

**6. Barras de composição usam cores de farol para magnitude (D.2 = warning, D.4 = info)** · `grafico` · impacto 🟡 médio · esforço baixo

- Problema: BAR_TONE (index.tsx L29-33) pinta D.2→var(--warning), D.4→var(--info), D.1→var(--ink), com comentário admitindo 'magnitude, NÃO farol' — mas no produto os tons semânticos SÃO a linguagem do farol (regra dura do CLAUDE.md): o jurídico lê a maior parcela do pleito (BDI, 48%) como 'Risco' e a Perda como 'Observação', sem que exista farol algum ali. Contradiz também a convenção CHART_SERIE_COR do ChartKit (warning = Meta/Referência, danger só quando ruim).
- Proposta: Escala categórica de uma matiz só: 3 intensidades de navy via `color-mix(in srgb, var(--ink) 100%/70%/45%, var(--surface))` (dark-safe, mesmo truque do KPI herói canônico) — a barra proporcional + o % impresso já comunicam magnitude sem pedir cor emprestada ao farol. Manter var(--border-strong) pros demais. Troca de 3 strings no BAR_TONE.

**7. Tela sem nenhum gráfico: composição e funil do teto pedem uma visualização com ChartKit** · `grafico` · impacto 🟡 médio · esforço medio

- Problema: O dono pediu 'gráficos mais completos' e a D.0 — justamente a tela-síntese — não tem nenhum: a proporção entre categorias só é comparável lendo 3 barras em linhas separadas (cada uma relativa ao total, mas visualmente desconectadas), e a relação teto → resultado provável → quitado do hero é só numérica. As fundações ChartTooltip/ChartLegend/CHART_SERIE_COR existem e a D.0 não usa nada delas.
- Proposta: Sem mudança drástica: (1) uma única barra 100% empilhada (Recharts BarChart horizontal, ~48px) no topo da seção Composição, segmentos D.2/D.1/D.4 nas intensidades de navy do achado anterior, `<ChartTooltip prefixo="R$"/>` + `<ChartLegend/>`, com o memo D.5 como item de legenda 'à parte do teto' — as barras por linha continuam como estão (nada sai); (2) opcional, no hero: micro barra dupla teto × resultado provável (mesma técnica), tornando o fator de recuperação visível. Reaproveita 100% do dado já carregado.

**8. Microcopy jurídico críptico: 'Vigente · T em aberto', 'editável na D.11' (rota inexistente), '% sobre o contrato pendente'** · `microcopy` · impacto 🟡 médio · esforço baixo

- Problema: index.tsx L114: 'Vigente · T em aberto' — 'T' não é vocabulário canônico (trimestre? tela?); L109: '% recuperável · editável na D.11' promete edição num lugar que não existe como rota (TELA_DEST L20-27 não tem D.11, nenhum arquivo de rota d.11) — beco sem saída pro usuário; L98: fallback '% sobre o contrato pendente' lê como se o CONTRATO estivesse pendente, quando pendente é o PV. Em tela que embasa claim, cada rótulo precisa ser defensável e sem ambiguidade.
- Proposta: 'Vigente (trimestres em aberto)' · 'fator de recuperação — definido no bloco D.11 · Pleitos' (sem 'editável' até existir a tela; quando existir, virar Link) · '% do Valor Contratual — indisponível (PV não normalizado)'. Só troca de strings.

**9. Ações com botões bespoke (.dq-abtn) em vez do Button do DS — e 3 dos 4 são inertes** · `consistencia` · impacto 🟡 médio · esforço baixo

- Problema: index.tsx L391-406 + index.css L644-680: a seção Ações reimplementa o Button do DS (primary/ink/outline) como `.dq-abtn`, contra a regra 'sem reinventar componentes' — sem focus ring do DS, sem estados disabled. E 'Gerar Relatório de Desequilíbrio', 'Exportar Composição' e 'Conversar com a Adm Contratual IA' são `<button type="button">` sem onClick: numa tela jurídica, botão que promete gerar relatório e não faz nada mina a confiança no restante.
- Proposta: Trocar por `<Button variant="primary">`, `<Button variant="ink" asChild>` (Link do claim) e `<Button variant="outline">` do barrel do DS; nos handlers ainda não implementados, `disabled` + sub-texto 'em breve' (ou ligar o chat ao painel do Adm Contratual IA que já existe no produto). Apagar o CSS bespoke correspondente.

**10. Glifos de texto como ícone: '▸', '→', '●' — regra lucide não aplicada** · `consistencia` · impacto ⚪ baixo · esforço baixo

- Problema: index.tsx L184-186: caret '▸' textual no summary de categorias; L300: seta '→' entre passos do rito; L257: 'Ver 3.x →' nos links dos cards; L341: '● Reunião devida' com bolinha textual. A regra codificada do projeto é lucide sempre, nunca glifo/emoji como ícone de UI — e o glifo não respeita stroke/tamanho do resto da iconografia (o `I` do DS continua válido onde já usado, como I.flag/I.lock desta tela).
- Proposta: `<ChevronRight size={12}/>` no summary (a rotação via transform já existe no CSS), `<ArrowRight size={13}/>` no rito e nos links 'Ver 3.x', e o dot do status como `<span>` de 8px com `background: var(--warning)` (padrão de dot de farol do produto). Cosmético, meia hora.

### D.1 Indiretos — src/routes/\_app/contracts/$contractId/desequilibrio/indiretos.tsx (+ indiretos.css)

**JTBD**: Como Jurídico / gerente de contrato montando o Pleito, preciso saber quanto de desequilíbrio de Administração Local a obra acumula (R$ 2.491.837 pelo método ativo M2.2), entender por que esse método governa frente aos outros 3 (sinais e bases diferentes), e conseguir defender a memória de cálculo até o grupo de custo (29 grupos, Δ Qtd e Δ Custo) — com a garantia de que o número reconcilia ao centavo com o Painel D.0 que ancora o Claim.

<details><summary><b>Inventário (o que a tela exibe hoje — nada disto sai)</b></summary>

- Header: título "D.1 — Custos Indiretos (Administração Local)" + Badge "● Conforme" (estático)
- Subtítulo explicativo do under-recovery (Adm Local incorrida × boletim medido; 4 métodos; ativo governa)
- 3 chips de referência inertes: "Adm Local (detalhe)", "Canteiro", "MOI" (title "em breve")
- Banner condicional de divergência D.1 × categoria D.1 do Painel D.0 (asserção recOk ao centavo)
- 5 KPI cards (padrão canônico chip+rótulo→valor→sub): Desequilíbrio do método ativo (herói brand), % sobre o PV (sub: PV em mi), Adm Local mensal cheio, Método ativo, Meses decorridos (BM corrente / prazo)
- Basebar com 4 células: Adm Local cheio (prazo meses), Gasto acumulado, Medido pela ARTERIS (boletim), Real alocado
- Tabela de 4 métodos clicáveis (M2 histograma, M2.1 real×medido, M2.2 gasto×medido ATIVO, M3 contábil pendente): comparação, desequilíbrio ± colorido, tag ATIVO, coluna "ver"
- Hint "Clique em um método para ver o cálculo detalhado abaixo"
- Painel de detalhe do método selecionado: memória de cálculo (valorA/valorB rotulados por método + linha-resultado DESEQUILÍBRIO em faixa ink), pendbox p/ M3 (balancetes/AGM), nota "método ativo governa o D.0"
- Tabela dos 29 grupos da Adm Local (só no M2): Qtd Contr./Real/Δ Qtd, Custo Contr./Real/Δ Custo colorido + linha TOTAL reconciliada com valorA/valorB do método (não soma crua)
- Card "Leitura da D.1" (2 parágrafos IA com valores interpolados: total, % PV, explicação da divergência de sinais entre métodos)
- Estados: Skeleton (header + 5 KPIs + basebar + tabela), EmptyState de erro (sem retry), EmptyState "D.1 ainda não normalizada" (pendência)
- Carregado pelo hook mas NÃO exibido: totalDesequilibrio (D.0), valorContratado, contratadoAcum, custoDireto, cenários D.10 (reducaoPct/reducaoEscopo/extensaoMeses/desequilibrioExtensao), defensabilidade e obs por método (null no banco), status needs_review

</details>

**1. Erro de leitura renderizado como EmptyState sem retry — viola ERRO ≠ PENDÊNCIA** · `estados` · impacto 🔴 alto · esforço baixo

- Problema: indiretos.tsx L66-71: `isError` cai num `<EmptyState framed title="Não foi possível carregar…">` visualmente idêntico ao estado de pendência (L72-78, "D.1 ainda não normalizada"). O read-model foi desenhado para falhar alto (indiretos.ts L92-95: "erro = milhões"), mas a tela mascara a falha como ausência de dado e não oferece retry. O ErroCard (src/components/ds/ErroCard/ErroCard.tsx) existe exatamente pra isso (Badge danger + botão) e o useQuery já expõe refetch/error.
- Proposta: Trocar o branch de erro por `<ErroCard mensagem={error?.message} onRetry={() => refetch()} />` (desestruturar `error` e `refetch` do useIndiretosView). Manter o EmptyState atual só para `!data` (pendência honesta). 3 linhas de mudança, zero informação removida.

**2. Badge "● Conforme" chumbado no header — farol fabricado, sempre verde** · `consistencia` · impacto 🔴 alto · esforço baixo

- Problema: indiretos.tsx L101: `<Badge tone="success">● Conforme</Badge>` é estático — não deriva de campo nenhum. As irmãs já refinadas derivam do dado e omitem quando null (encargos.tsx L62-73 via farolToBadge/farolLabel; valor-agregado.tsx L64-76 via farolTotal). Aqui a tela mostraria "Conforme" mesmo com o banner vermelho de divergência D.1×D.0 ativo (L116-124) e mesmo com `status === "needs_review"` (indiretos.ts L130-131, computado e nunca exibido). O glifo "●" dentro do Badge também foge do padrão (nenhuma irmã usa).
- Proposta: Derivar o badge do que o produtor popula: `recOk === false` → `<Badge tone="danger">Divergência com o D.0</Badge>`; `ind.status === "needs_review"` → `<Badge tone="warning">Em revisão</Badge>`; caso contrário `<Badge tone="success">Reconciliado com o D.0</Badge>` (a asserção recOk já existe em L90). Usar farolToBadge/farolLabel de @/lib/mocks/contracts se preferir os 4 rótulos canônicos; remover o glifo "●".

**3. Nomes das partes da BR-101 chumbados em texto (ARTERIS/ATERPA) + fallback "46" meses** · `literal-chumbado` · impacto 🔴 alto · esforço baixo

- Problema: indiretos.tsx L105 ("boletim medido pela ARTERIS"), L173 (label do basebar "Medido pela ARTERIS (boletim)"), L220-221 ("o que a ATERPA incorre… a medição da ARTERIS reconhece") — nomes reais da contratante/contratada da BR-101 chumbados em microcopy; em qualquer outra obra a tela mente. L166: `${ind.prazoMeses ?? 46}` usa o prazo da BR-101 como fallback silencioso — se prazo_meses vier null, exibe "46 meses" fabricado.
- Proposta: Substituir pelos termos canônicos do vocabulário (CLAUDE.md): "medido pela Contratante (boletim)", "o que a Contratada incorre". Fallback do prazo vira `?? "—"` (o `fmtInt` da própria tela já trata null assim). Se quiser o nome real no futuro, carregar via deseqContexto (que já traz `nome`), nunca literal.

**4. "Leitura da D.1" afirma sinais dos métodos como fato fixo — narrativa não derivada** · `literal-chumbado` · impacto 🟡 médio · esforço baixo

- Problema: indiretos.tsx L223-228: "o histograma e o real × medido comparam o real (abaixo do contratado/medido, por isso negativos)" — a negatividade de M2/M2.1 é propriedade do dado corrente da BR-101 (−1,37M / −2,22M no snapshot), não da definição do método. Numa obra em que o real supere o contratado, o parágrafo fica falso dentro de uma tela que alimenta Pleito (defensabilidade importa). Mesma frase assume M3 pendente ("depende do razão").
- Proposta: Derivar as cláusulas dos campos: montar a frase a partir de `ind.metodos` — p/ cada método não-ativo, interpolar "negativo"/"positivo" de `Math.sign(desequilibrioRs)` e só citar o contábil como pendente se `pendente === true`. A estrutura dos 2 parágrafos e todos os valores interpolados (fmtMi/fmtPct) permanecem.

**5. Tabela dos 29 grupos da Adm Local sem busca/ordenação/paginação (coleção 5+ sem toolkit)** · `tabela` · impacto 🟡 médio · esforço medio

- Problema: indiretos.tsx L383-440 (ItensTabela): 29 linhas × 7 colunas renderizadas de uma vez, sem busca, sem ordenação (só a `ordem` do banco) e sem paginação — contra o padrão canônico do projeto (useColecao + ColToolbar/ColPag/ColVazio, já usados na tabela de 98 recursos do 3.4 e na Curva ABC do 3.7). Pra achar o grupo que mais estoura, o jurista escaneia 29 linhas no olho. Agravante responsivo: `.ind-tablewrap { overflow: hidden }` (indiretos.css L193-198) só vira `overflow-x: auto` ≤720px — entre ~721 e 1100px a tabela de 7 colunas pode clipar sem scroll.
- Proposta: Adotar useColecao (searchText = grupo; sorts: |Δ Custo| desc como default, Δ Qtd, ordem do plano, A-Z; pageSize 10) + ColToolbar/ColPag/ColVazio. A linha TOTAL já é computada do conjunto cheio (totQtd + m.valorA/valorB, L384-391 e L426-434) — mantê-la fixa fora da paginação preserva a reconciliação ao centavo com a memória de cálculo e o D.0. Mover `overflow-x: auto` pro wrapper em todas as larguras + `min-width` na tabela. Nenhuma linha some — só ficam navegáveis.

**6. Zero gráfico numa tela cujo coração é comparar 4 métodos — barra divergente resolve** · `grafico` · impacto 🔴 alto · esforço medio

- Problema: A tela compara 4 quantificações lado a lado (M2 −1,37M · M2.1 −2,22M · M2.2 +2,49M ativo · M3 pendente) apenas em texto tabular (L178-204). O contraste de sinal e magnitude — o argumento central do porquê o método ativo governa — não tem representação visual nenhuma, sendo que o pedido do dono é "gráficos mais completos" e o ChartKit (src/components/ds/ChartKit/ChartKit.tsx) já dá tooltip/legenda/cores canônicas prontos.
- Proposta: Adicionar ao lado (ou acima) da tabela de métodos um BarChart horizontal divergente ancorado no zero (Recharts, já no package.json): barra do método ativo em CHART_SERIE_COR.real (navy), demais em CHART_SERIE_COR.contratado (info), `<ChartTooltip prefixo="R$">` e ChartLegend; M3 pendente entra como faixa vazia rotulada "pendente" (pendente ≠ 0, convenção do próprio ChartKit). Clique na barra seleciona o método (mesmo setSel). Opcional de baixo custo: barra proporcional inline na célula Δ Custo dos grupos (top |Δ| salta ao olho sem tirar nada da tabela).

**7. Hook carrega "% do desequilíbrio total (D.0)" e a tela nunca mostra; KPI 4 duplica o KPI 1** · `dado-subaproveitado` · impacto 🟡 médio · esforço baixo

- Problema: useIndiretosView.ts L12-17 carrega `totalDesequilibrio` ("denominador do % do total e do farol acumulado") e `valorContratado` — a tela não usa nenhum dos dois (grep: só `categoriaD1Rs` é lido). Enquanto isso o KPI 4 "Método ativo" (indiretos.tsx L149-154) repete informação que já está no sub do KPI 1 (L135: "M2.2 — …"), na tag ATIVO da tabela e no detalhe. Também carregados e invisíveis: `contratadoAcum` (base do M2, só aparece disfarçado como valorB na memória) e `custoDireto` (lugar nenhum).
- Proposta: Trocar o conteúdo do KPI 4 por "% do desequilíbrio total (D.0)" = d1 / totalDesequilibrio (sub: fmtMi do total) — nenhuma informação sai da tela (método ativo permanece em 3 lugares) e a D.1 passa a se ancorar explicitamente na D.0. Basebar ganha uma 5ª célula "Contratado acum. (histograma)" com `ind.contratadoAcum` (o flex-wrap do .ind-basebar já absorve) e `custoDireto` como sub da célula do Adm Local cheio.

**8. Cores ±: vermelho/verde sem legenda, e verde nos métodos negativos sugere "conforme"** · `microcopy` · impacto 🟡 médio · esforço baixo

- Problema: indiretos.css L274-281: `.ind-pos` = var(--danger) e `.ind-neg` = var(--success), aplicados tanto na tabela de métodos (L296) quanto nos Δ Custo dos grupos (L421). Nenhuma legenda explica a semântica. Nos GRUPOS a leitura é natural (Δ>0 = estouro real = ruim). Nos MÉTODOS é enganosa: M2.1 em verde (−2,22M) parece "boa notícia/conforme", quando significa apenas que aquela base não sustenta o pleito — leitura perigosa pra quem monta o Claim.
- Proposta: Na tabela de métodos, exibir valores negativos em tom neutro (var(--text-2)) mantendo o vermelho para under-recovery positivo, e acrescentar uma linha-legenda discreta (--fs-11, --text-4) sob a tabela: "vermelho = under-recovery (base do Pleito) · neutro = base não indica desequilíbrio". Manter vermelho/verde na tabela de grupos, onde a semântica desvio-de-custo é correta. Nada é removido; só a cor deixa de sugerir farol onde não há.

**9. Chips "Adm Local (detalhe) / Canteiro / MOI" com cara de link e comportamento morto** · `poluicao` · impacto ⚪ baixo · esforço baixo

- Problema: indiretos.tsx L108-115 + indiretos.css L38-59: três chips com ícone Link2 e visual de pílula navegável, mas `cursor: default` e ação nenhuma — o "em breve" só existe no title (hover). Affordance falsa logo abaixo do título: o jurista clica esperando o detalhe por componente e nada acontece.
- Proposta: Manter os três rótulos (não remover informação) mas tirar a affordance de link: trocar Link2 por Hourglass/Clock (lucide), acrescentar sufixo visível "· em breve" no próprio chip e opacidade reduzida (ou usar o <Tag> do DS em tom muted). Quando as âncoras existirem, viram Link de verdade.

**10. Cenários do pleito (D.10) carregados e invisíveis + comentário do header desatualizado** · `dado-subaproveitado` · impacto 🟡 médio · esforço baixo

- Problema: indiretos.ts L58-62 / L147-150 carregam `reducaoPct` (10%), `reducaoEscopo` (R$ 12,7 mi), `extensaoMeses` (6), `desequilibrioExtensao` (R$ 16,5 mi) — populados no banco (confirmado em scripts/fase0-bm/d1_mundo_atual.json) e não exibidos em lugar nenhum desde que o v46 align removeu a calculadora (commit 69aa4f5). O comentário do header (indiretos.tsx L5) ainda descreve a "Calculadora (extensão/redução)" que não existe mais na tela. Obs.: `defensabilidade`/`obs` dos métodos também são carregados mas o produtor NÃO popula (null no snapshot) — para esses, só exibição condicional, nunca coluna fixa fabricada.
- Proposta: Duas opções a validar com o dono: (a) strip discreto no fim da página "Cenários que alimentam o Pleito (D.10) — não somam à D.1" com os 4 valores em células estilo basebar; ou (b) se a remoção da calculadora foi decisão firme, enxugar o select/tipo e corrigir o comentário L5. Para defensabilidade/obs: renderizar coluna/nota apenas quando `metodos.some(m => m.defensabilidade != null || m.obs)` — farol/estrela só de campo que o produtor popula.

### D.2 BDI — src/routes/\_app/contracts/$contractId/desequilibrio/bdi.tsx (+ bdi.css)

**JTBD**: Jurídico + gerente de contrato quantificando o BDI tempo-dependente incorrido sem remuneração — quanto é recuperável ao acelerar o faturamento e quanto estabiliza como BDI não recuperado imputável à Contratante — com base defensável (6 rubricas com conservação tripla R$ 3.058.491, curva 46 meses real × régua de equilíbrio) para fundamentar Pleito/Claim de reequilíbrio e simular cenários de extensão de prazo/redução de escopo na negociação.

<details><summary><b>Inventário (o que a tela exibe hoje — nada disto sai)</b></summary>

- Cabeçalho: título 'D.2 — BDI (Bonificação e Despesas Indiretas)' + subtítulo explicativo do mecanismo + Badge de farol (bdi.tsx:92-102)
- 5 KPIs tingidos por tom: Desequilíbrio BDI acumulado (herói, tom do farol) · % sobre o PV · Custo mensal (tempo) · + projeção (extensão) · Meses decorridos BM/total (bdi.tsx:106-141)
- Basebar com 5 parâmetros: Preço de Venda (PV) · BDI declarado · Custo Direto (CD) · Custo Indireto (CI) · Medição acum. até BM (bdi.tsx:143-158)
- Tabela de 6 rubricas tempo-dependentes × 5 colunas (% do PV · Valor no contrato · Gasto teórico acum. · Remunerado acum. · Desequilíbrio) + linha TOTAL reconciliada com params (bdi.tsx:273-322)
- Nota de escopo: Riscos/Eventuais, Correção Inflacionária e Impostos ficam fora (reajuste → D.6) (bdi.tsx:165-168)
- Curva de perda dupla 46 meses (real × régua de equilíbrio teórica) com legenda bespoke, ReferenceLine no BM corrente, tooltip rico bespoke com gasto/mês e remunerado/mês (bdi.tsx:469-557) + fallback single-curve em área com ReferenceDot no BM (bdi.tsx:325-414)
- Narrativa da curva: desequilíbrio hoje, quanto se recupera, saldo que estabiliza (não recuperado imputável à Contratante) (bdi.tsx:176-192 / 197-201)
- Calculadora de cenários — card 'Redução de escopo' (input valor final → ΔPV, ΔCD, Δ BDI não remunerado) e card 'Extensão de prazo' (inputs meses + valor final take-off → overhead/mês, overhead da extensão, escopo adicional/reduzido) com hints explicativos (bdi.tsx:566-676)
- Card IA 'Leitura da D.2' com 2 parágrafos derivados (total, maiores rubricas Adm Central e Lucro/Bonificação, régua teórica vs real, custo/mês de extensão) (bdi.tsx:214-237)
- Estados: Skeleton 3 blocos (bdi.tsx:57-65) e EmptyState 'BDI ainda não disponível' compartilhado entre erro e pendência (bdi.tsx:66-77)

</details>

**1. Erro mascarado como pendência no estado de falha** · `estados` · impacto 🔴 alto · esforço baixo

- Problema: bdi.tsx:66 trata `isError || !data` num único EmptyState 'BDI ainda não disponível... aguardando processamento do workbook'. Se o fetch quebrar (rede/RLS), o jurídico lê que 'a obra ainda não foi normalizada' — mentira operacional numa tela que fundamenta Pleito. A regra ERRO ≠ PENDÊNCIA já está codificada no ErroCard do DS (src/components/ds/ErroCard/ErroCard.tsx, exportado no barrel linha 25) e as irmãs D.1/D.3/D.4/D.6 já separam os dois ramos. O Skeleton (bdi.tsx:57-65) também é genérico: 3 barras que não espelham a grade de 5 KPIs + basebar + tabela + curva.
- Proposta: Separar os ramos: `isError` → `<ErroCard mensagem={error.message} onRetry={() => refetch()} />` (o hook já expõe refetch via useQuery); `!data` mantém o EmptyState honesto atual. Ajustar o Skeleton para a forma real: linha de 5 blocos KPI + barra fina (basebar) + bloco de tabela + bloco 320px da curva.

**2. Tooltip/legenda bespoke da curva → migrar pro ChartKit (candidato já flagado) + cores fora da convenção de série** · `adocao-fundacao` · impacto 🔴 alto · esforço medio

- Problema: Três desvios no mesmo bloco: (1) CurvaTooltip bespoke (bdi.tsx:427-467 + bdi.css:218-253) e legenda d2-leg bespoke (bdi.tsx:490-499) duplicam o que ChartTooltip/ChartLegend do DS já fazem — este era o candidato explícito da onda 2; (2) o fallback PerdaChart usa o Tooltip default do Recharts com contentStyle inline e sem legenda (bdi.tsx:372-381); (3) cores contra a convenção CHART_SERIE_COR: a série Real usa var(--brand) laranja (bdi.tsx:549) quando Real=navy, e a régua teórica usa var(--success) (bdi.tsx:539) quando Meta/Referência=warning — success verde sugere 'conforme' numa curva que representa perda. Agravante: a prosa chumba os nomes de cor ('verde tracejada', 'laranja' em bdi.tsx:179-186), que quebram silenciosamente em qualquer migração de cor.
- Proposta: Trocar CurvaTooltip por `<Tooltip content={<ChartTooltip titulo={(l,p)=>...BM+medido/previsto} formatter={...} nomes={{real:'Perda real acum.', teorica:'Régua de equilíbrio'}}/>}` — as linhas extras Gasto/mês e Remunerado/mês entram via titulo/função ou permanecem como payload adicional (nada se perde); legenda vira `<ChartLegend items={[{label, tipo:'linha'|'tracejada', cor: CHART_SERIE_COR.real|meta}]}>` mantendo os valores em negrito ao lado; aplicar o mesmo ChartTooltip no fallback. Real → CHART_SERIE_COR.real (navy), régua → CHART_SERIE_COR.meta (warning tracejada). Nas notas, substituir nomes de cor por referência à legenda ('a régua tracejada', 'a curva cheia'). Apagar .d2-tt* e .d2-leg* do CSS.

**3. Trecho projetado da curva real desenhado como linha sólida (projeção indistinguível do medido)** · `grafico` · impacto 🔴 alto · esforço medio

- Problema: A curva real cobre os 46 meses com stroke sólido único (bdi.tsx:545-552), mas só até o BM corrente é medição real — dali em diante computeBdiCurvaPerda usa o previsto (bdiDeseq.ts:199-207, flag `medido` por ponto já existe). A convenção do refino ('Projeção = tracejada na mesma cor do Real'; 'Projeção só na foto corrente') não é aplicada: visualmente o gráfico afirma como realizado um trecho que é projeção — exatamente o tipo de ambiguidade que a Contratante ataca num Claim. Hoje só o tooltip sussurra '· previsto' (bdi.tsx:439-440). O fallback PerdaChart tem o mesmo problema em área única, e seu tooltip mostra só 'Perda acum.' apesar de perda[] carregar gastoTeoricoMesRs/remuneradoMesRs/perdaMesRs.
- Proposta: Dividir a série real em duas dataKeys derivadas da flag `medido`: `realMedido` (sólida, navy, termina no BM corrente) e `realProjetado` (tracejada, mesma cor, começa no BM corrente — duplicar o ponto de junção para continuidade). A ReferenceLine do BM corrente vira a fronteira visual natural. Legenda ganha o item 'Projeção (tracejada)'. No fallback, mesmo split usando o índice do bmCorrente, + tooltip com as 3 colunas mensais já carregadas.

**4. Imputação causal chumbada da BR-101 na narrativa jurídica: 'mobilização lenta · OS de 09/03'** · `literal-chumbado` · impacto 🔴 alto · esforço baixo

- Problema: bdi.tsx:190-191 chumba no texto da curva: 'é o BDI não recuperado, imputável à Contratante (mobilização lenta · OS de 09/03)'. A data da Ordem de Serviço e a causa ('mobilização lenta') são fatos específicos da BR-101 escritos em código — em qualquer outra obra a tela afirmaria um Nexo Causal falso, num texto que alimenta diretamente a fundamentação do Pleito. Nenhum campo do read-model carrega essa informação (obra_bdi_deseq não tem campo de causa/OS).
- Proposta: Derivar ou neutralizar: (a) curto prazo, reescrever a frase só com o que o dado prova — 'estabiliza em R$ X: é o BDI não recuperado pelo sub-faturamento dos primeiros meses' (o sub-faturamento inicial É derivável da própria curva: meses com realRs < contratadoRs no início); (b) estrutural, mover a atribuição causal para um campo normalizado (ex.: `obs`/`causa_raiz` em obra_bdi_deseq, populado pelo workbook-motor) e renderizar só quando presente. A informação da BR-101 não some — passa a vir do banco da obra, onde é verdadeira.

**5. Calculadora: default R$ 500.000.000 chumbado, emojis 📉/📅 como ícone e inputs crus fora do DS** · `literal-chumbado` · impacto 🟡 médio · esforço baixo

- Problema: Três desvios no bloco Calculadora: (1) o cenário de redução nasce com '500.000.000' hardcoded (bdi.tsx:580) — escala da BR-101 (PV 611 mi); numa obra de PV 20 mi o exemplo é absurdo e o resultado abre negativo; (2) `<h4>📉 Redução de escopo</h4>` e `<h4>📅 Extensão de prazo</h4>` (bdi.tsx:614, 643) usam emoji como ícone de UI — banido pelas regras (lucide é o default); (3) inputs crus `<input>` com CSS próprio (bdi.tsx:617, 646, 650 + bdi.css:281-296) em vez do Input do DS. Além disso o read-model já carrega os cenários normalizados do workbook — `deltaReducaoRs` (bdiDeseq.ts:33) e `mesesExtensao`/`projecaoExtensaoRs` — que poderiam semear os defaults, mas deltaReducaoRs nunca é usado na tela.
- Proposta: Semear defaults do dado: extensão inicia com `p.mesesExtensao` (hoje '6' chumbado coincide, mas deve derivar) e redução com o cenário do workbook quando existir (PV − deltaReducaoRs) ou 90% do PV como fallback proporcional. Trocar emojis por lucide (TrendingDown, CalendarRange) no padrão chip do DS. Migrar os inputs para `<Input>` do DS mantendo tabular-nums. O hint 'valores de exemplo, edite os campos' continua válido e fica mais honesto.

**6. Dado carregado e não exibido: tipo/obs/incorrido-mês das rubricas e cenários normalizados dos params** · `dado-subaproveitado` · impacto 🟡 médio · esforço medio

- Problema: O read-model busca e a tela descarta: (1) por rubrica — `tipo`, `incorridoMesRs` e `obs` (bdiDeseq.ts:101, tipos em 37-48) não aparecem na tabela; incorrido/mês é justamente a decomposição do KPI 'Custo mensal (tempo)' = SUM das rubricas, e `obs` é onde vive a justificativa defensável por rubrica; (2) nos params — `deltaReducaoRs` (cenário de redução normalizado pelo workbook) nunca é mostrado nem reconciliado com a calculadora; (3) na curva — `perdaTeoricaFinalRs` (prova de que a régua fecha ≈ 0), `remTotalRs` e `pvRs` do compute ficam invisíveis, embora sejam os insumos da auditoria da curva.
- Proposta: Sem nova query: (a) adicionar coluna 'Incorrido/mês' na tabela de rubricas (6 linhas, cabe) — o TOTAL dela reconcilia à vista com o KPI Custo mensal (tempo); (b) `obs`/`tipo` como title/tooltip na célula da rubrica (ou linha expansível), sem alargar a grade; (c) na calculadora de redução, linha de referência 'Cenário do workbook: Δ R$ {deltaReducaoRs}' quando populado, ancorando a simulação no número normalizado; (d) micro-rodapé da curva: 'Régua fecha em {perdaTeoricaFinalRs ≈ R$ 0} · PV da curva {pvRs}' — vira prova de consistência para o Claim.

**7. FAROL_TOM local duplica o helper canônico farolToBadge/farolLabel** · `consistencia` · impacto 🟡 médio · esforço baixo

- Problema: bdi.tsx:44-51 define um Record próprio Conforme/Observação/Risco/Crítico (com variantes sem acento como gambiarra de robustez), violando a Regra do Farol #8 ('use farolToBadge/farolLabel — não duplicar mapas'). As irmãs encargos.tsx:12 e valor-agregado.tsx:13 já importam o helper de @/lib/mocks/contracts, então a D.2 é a divergente no próprio módulo M3.
- Proposta: Remover FAROL_TOM e usar `farolToBadge`/`farolLabel` importados; se o farol do banco pode vir sem acento, normalizar UMA vez na borda do read-model (getBdiDeseq, onde o campo já é tratado em bdiDeseq.ts:93) em vez de tolerar variantes na camada de UI.

**8. Números-chave do Pleito enterrados em prosa densa e referências cruzadas não navegáveis** · `hierarquia` · impacto 🟡 médio · esforço medio

- Problema: A tríade que o jurídico leva pro Claim — desequilíbrio hoje (3,06 mi) / quanto se recupera / quanto estabiliza como não recuperado — existe só no meio de um parágrafo com 7 trechos em bold (bdi.tsx:176-192), computada inline (`p.desequilibrioRs - curvaPerda.perdaRealFinalRs`). O leitor precisa parsear texto pra achar o número do pedido. E as referências cruzadas são texto morto: 'reajuste vai à D.6' (bdi.tsx:167), 'simulável na calculadora acima' (bdi.tsx:235), 'o KPI acima' (bdi.tsx:178) — nenhuma navega.
- Proposta: Promover a tríade a uma mini stat-strip de 3 valores derivados acima da curva (padrão basebar já existente na tela: label pequeno + valor tabular): 'Desequilíbrio no BM{n}' · 'Recuperável (projeção)' · 'Não recuperado (estável)' — e encurtar a prosa para o mecanismo (nenhuma informação sai, só muda de forma). Transformar 'vai à D.6' em <Link> do router para ../pontuais e 'simulável na calculadora' em âncora/scroll para o bloco.

**9. KPI cards sem o chip lucide do padrão canônico do M3** · `consistencia` · impacto ⚪ baixo · esforço medio

- Problema: O Kpc local (bdi.tsx:243-261 + bdi.css:47-103) renderiza label→valor→sub com fundo tingido pelo tom — o tingimento é permitido pelas regras, mas falta o elemento identitário do padrão canônico definido pelo exemplar /desequilibrio/indiretos: chip quadrado lucide (r-sm, surface-2) ao lado do rótulo, e herói via color-mix brand/tom leve. Resultado: a D.2 parece de outra família visual dentro do próprio Painel de Desequilíbrio.
- Proposta: Alinhar o Kpc ao exemplar: chip lucide por KPI (Scale/Wallet para o desequilíbrio, Percent, CalendarClock para meses, TrendingUp para projeção), mantendo o tom do farol no herói via color-mix leve como já faz (border-color já usa color-mix — só padronizar a intensidade do fundo com o exemplar). Nenhum dado muda; 5 KPIs continuam os mesmos.

**10. Selo de conservação invisível na UI e arredondamento a R$ inteiro sem nota de procedência** · `microcopy` · impacto 🟡 médio · esforço baixo

- Problema: A força jurídica da tela — conservação tripla conferida pelo gate (Σ rubricas == total == pico da curva, R$ 3.058.491) — vive só em comentário de código (bdi.tsx:1-6, bdiDeseq.ts:6). Na UI nada diz que os três números reconciliam. E fmtBRL faz Math.round por célula (bdi.tsx:33-34): a soma visual das 6 linhas arredondadas pode divergir do TOTAL exibido em alguns reais (o TOTAL usa params, bdi.tsx:314-317), dando munição de 'número não fecha' justamente na tabela-prova.
- Proposta: Micro-rodapé de procedência sob a tabela (padrão d2-note já existente): 'Conservação conferida: Σ das 6 rubricas = total do BDI não remunerado = pico da curva no BM{n} · valores exibidos arredondados a R$ 1'. Uma linha, deriva do dado (comparação com tolerância < R$ 1 antes de afirmar, à la reconciliação recOk da D.1 indiretos.tsx:88-90), e transforma o gate interno em argumento defensável visível.

### D.3 Encargos Sociais — src/routes/\_app/contracts/$contractId/desequilibrio/encargos.tsx (+ encargos.css

**JTBD**: Jurídico e gerente de contrato preparando Pleito/Claim precisam responder: a alíquota de encargos sociais real divergiu da proposta (mudança legislativa = fato do príncipe)? Em qual rubrica, quanto vale em R$ sobre qual folha-base (e sob qual base de MOD — Histograma ou CPU), e quanto valeria num cenário de reoneração da Lei 14.973/24? Os números precisam ser rastreáveis às fontes normalizadas (seções D.3/C.4) e reconciliar com o consolidado D.0 — a tela é insumo direto de quantificação defensável, onde erro = milhões.

<details><summary><b>Inventário (o que a tela exibe hoje — nada disto sai)</b></summary>

- Header: título 'Encargos Sociais · D.3' + subtítulo explicativo (Proposta × Real, reoneração Lei 14.973/24, nome da obra) + Badge de farol (farolToBadge/farolLabel)
- KPI 1 — FarolCard 'DESEQUILÍBRIO DE ENCARGOS' (R$, accent warning/neutral, info condicional pendente/medido/Real=Proposta)
- KPI 2 — FarolCard '% SOBRE O PV' (pctSobrePV + PV compacto como denominador)
- KPI 3 — FarolCard 'FOLHA-BASE (MOD + MOI)' toggle-aware (recalcula com a base Histograma/CPU selecionada)
- KPI 4 — FarolCard 'ADERÊNCIA' (statusLabel 'Aderente' · Proposta × Real)
- KPI 5 — FarolCard 'REGIME' (regime INSS sobre folha)
- Tabela de composição: 27 rubricas + linhas-cabeçalho de grupo (A/B/D) × MOD Proposta / MOD Real / MOI Proposta / MOI Real + dot de status por linha (aderente/divergente, tint --warning-bg na linha divergente) + linha TOTAL ENCARGOS (mensalista) com os 4 totais
- Card 'Folha-base e desequilíbrio (vigente)': toggle MOD Histograma/CPU · MOD folha (base selecionada) · MOI folha (Adm Local) · Folha-base total · Δ Alíquota (p.p.) · Desequilíbrio em destaque · hint com as fontes do split (recursos mobilizados e MOD CPU do contrato, em R$ compactos)
- Card 'Simulação (cenário)': input Δ alíquota em p.p. · desequilíbrio simulado (folha selecionada × Δ) · hint com exemplos +1 p.p. por base (Histograma e CPU)
- Notebox Lei 14.973/24: explicação da reoneração progressiva até 2028 + fato do príncipe + cronograma CPRB quando gravado (cprbCronograma)
- Leitura da D.3 · Adm Contratual IA: narrativa condicional derivada (pendente / aderente com alíquotas MOD-MOI / divergente com R$ e folha-base)
- Estados: Skeleton (5 KPIs + 2 seções) · erro (EmptyState + reload) · pendência de normalização (EmptyState 'aguardando D.3')

</details>

**1. Erro renderiza como pendência: EmptyState + window.location.reload() em vez de ErroCard + refetch** · `adocao-fundacao` · impacto 🟡 médio · esforço baixo

- Problema: encargos.tsx:35-52 — o isError renderiza um EmptyState framed visualmente idêntico ao estado de pendência ('Composição ainda não normalizada') logo abaixo. A regra do refino RMA (ErroCard.tsx: 'erro NUNCA renderiza como pendência') existe justamente pra isso: mascarar falha de fetch como ausência honesta de dado mente pro jurídico que 'ainda não tem dado'. O retry usa window.location.reload() (perde todo estado da SPA) em vez do refetch do react-query, e a mensagem técnica do erro é descartada.
- Proposta: Trocar o bloco isError por <ErroCard mensagem={error.message} onRetry={() => refetch()} /> (o hook useEncargos já expõe ambos via useQuery — basta desestruturar error e refetch em encargos.tsx:28). Nenhuma das telas irmãs do M3 adota ErroCard ainda — D.3 vira a primeira e o padrão replica.

**2. Tela sem nenhum gráfico: composição Proposta × Real merece leitura visual por grupo (A/B/D + total)** · `grafico` · impacto 🔴 alto · esforço medio

- Problema: A tela é 100% tabela + linhas de texto — zero gráficos, sendo que o dado é perfeito pra comparação visual: 27 rubricas com 4 alíquotas cada (composicao em encargos.ts:114-130) e totais MOD/MOI Proposta × Real. Hoje o jurídico precisa varrer 27 linhas de percentuais pra formar a intuição de 'onde a alíquota concentra' e 'quanto Real desgrudou da Proposta'.
- Proposta: Adicionar (sem remover a tabela) um painel de barras horizontais agrupadas acima dela: subtotais por grupo (A, B, D — derivados por soma das rubricas de cada grupo) + TOTAL, série Proposta em CHART_SERIE_COR.contratado (--info) × série Real em CHART_SERIE_COR.real (navy), toggle MOD/MOI via Segmented. Usar ChartTooltip (formatter fmtPct) + ChartLegend do ChartKit — convenção canônica já pronta, hoje inadotada em todo o diretório desequilibrio/. Quando Real ≠ Proposta num grupo, a barra Real ganha destaque --warning (semanticamente ruim), espelhando o tint da tabela.

**3. Dado subaproveitado: série mensal MOD da C.4 (52 meses) é carregada e reduzida a um único Σ** · `dado-subaproveitado` · impacto 🔴 alto · esforço medio

- Problema: encargos.ts:104-110 já busca 'C.4 — Histograma mensal MOD' e encargos.ts:146-148 reduz os 52 meses de 'MOD Contr.(R$)' a modContrSum — a distribuição temporal da folha (exatamente o que um Pleito de reoneração precisa: a Lei 14.973/24 incide de forma escalonada até 2028, então o desequilíbrio real é folha_do_mês × alíquota_do_ano, não folha_total × Δ único) é descartada. O simulador atual (encargos.tsx:397-423) só entrega um número agregado.
- Proposta: Sem nenhum fetch novo: expor a série mensal no read-model (Encargos.folhaModMensal) e adicionar um gráfico de barras 'Folha MOD mensal (base do desequilíbrio)' ao lado da simulação, com ChartTooltip mostrando, quando Δ > 0, o desequilíbrio simulado daquele mês (folha_mes ÷ (1+alíquota) × Δ). Eixo X em mesCurtoIso. Isso transforma a simulação de 'um número' em 'uma exposição no tempo' — defensável como anexo de quantificação do Claim (janela de incidência explícita).

**4. Narrativa chumbada: 'Hoje Real = Proposta → desequilíbrio zero' impressa incondicionalmente nos hints** · `literal-chumbado` · impacto 🔴 alto · esforço baixo

- Problema: encargos.tsx:386-387 e :391-392 — o hint do card 'Folha-base e desequilíbrio (vigente)' termina com o texto fixo 'Hoje Real = Proposta → desequilíbrio zero' nas DUAS ramificações (temSplit e fallback). No dia em que a reoneração incidir (desequilibrioRs > 0), o card mostrará um desequilíbrio em R$ grande logo acima de um hint afirmando que ele é zero — numa tela que vira anexo de Pleito, é contradição interna que mina a defensabilidade. A tela já computa temDeseq/deseqPendente (encargos.tsx:80-81), mas o hint ignora.
- Proposta: Derivar a frase final do estado: temDeseq → 'Δ alíquota vigente de X p.p. sobre a folha-base → desequilíbrio acima' (usando v.deltaAliquotaMod); deseqPendente → 'total ainda não normalizado'; senão o texto atual de Real = Proposta. Mesmo tratamento na frase fixa do subtítulo do header (encargos.tsx:68-70), que afirma o cenário aderente como se fosse permanente.

**5. Tabela de 27 rubricas sem o toolkit de coleção: falta 'Só divergentes', busca e ordenação** · `tabela` · impacto 🟡 médio · esforço medio

- Problema: ComposicaoTabela (encargos.tsx:203-262) renderiza ~30 linhas (27 rubricas + grupos) sem busca, filtro ou ordenação — a regra do projeto exige toolkit em coleção 5+. O job nº 1 do jurídico nesta tabela é achar as rubricas divergentes (Real ≠ Proposta); hoje elas só se anunciam por tint --warning-bg diluído no meio de 30 linhas, e o dado 'divergente' já existe por rubrica (encargos.ts:128).
- Proposta: Adotar o toolkit canônico (useColecao + ColToolbar de src/lib/rma/colecao.tsx) preservando os cabeçalhos de grupo: busca por cod/descrição + FilterChip 'Só divergentes (N)' (contador derivado) + ordenação 'Ordem da composição (padrão) / Maior alíquota MOD / A–Z'. Grupos permanecem visíveis enquanto tiverem filhas no resultado; empty filtrado distinto com 'Limpar busca'. Sem paginação (tabela única e contígua é melhor pra conferência de composição — cap não se aplica pois a íntegra é o artefato), mas o filtro de divergência vira o atalho de leitura.

**6. Fila de 5 KPIs diluída por 2 cards qualitativos + explicação da reoneração repetida 3× na página** · `hierarquia` · impacto 🟡 médio · esforço medio

- Problema: Dos 5 FarolCards (encargos.tsx:91-141), ADERÊNCIA e REGIME têm valor textual ('Aderente', regime) — parâmetros de contexto, não indicadores — e diluem os 3 numéricos que decidem (Desequilíbrio, % PV, Folha-base). O farol aparece 2× (Badge no header :73 + card ADERÊNCIA). E a explicação 'desequilíbrio só aparece quando a alíquota real muda / reoneração Lei 14.973/24' aparece 3×: sub do header (:68-70), notebox (:157-160) e leitura IA (:186-187) — poluição textual que enterra o que é novo em cada bloco.
- Proposta: Consolidar sem perder nada: (a) RmaParamBar sob o header com Regime · Base de MOD (Histograma/CPU) · Δ alíquota vigente · Status — padrão já usado nas abas C refinadas; (b) o card DESEQUILÍBRIO vira herói e recebe farol={v.farol} (FarolCard já renderiza o status no canto — a informação de aderência permanece, agora colada ao número que ela qualifica); (c) KPI row fica com os 3 numéricos fortes; (d) sub do header enxuto ('Alíquota Proposta × Real (MOD e MOI), encargo a encargo'), deixando a didática completa da reoneração no notebox, que é o lugar dela.

**7. Toggle Histograma/CPU hand-rolled duplica o Segmented do DS (que já tem keynav ARIA)** · `adocao-fundacao` · impacto ⚪ baixo · esforço baixo

- Problema: encargos.tsx:328-347 + encargos.css:224-261 reimplementam um segmented (.enc-tgwrap/.enc-tg) com role=tablist manual, sem a navegação por teclado ←/→/Home/End que o Segmented do DS já entrega (Segmented.tsx:20-39). ~40 linhas de CSS duplicado e comportamento a11y inferior ao primitivo existente.
- Proposta: Substituir por <Segmented value={baseCpu ? 'cpu' : 'hist'} onChange={...} items={[{value:'hist',label:'MOD: Histograma'},{value:'cpu',label:'MOD: CPU'}]} aria-label='Base de cálculo da MOD' /> e apagar .enc-tgwrap/.enc-tg do CSS. Mesmo visual (o DS é a origem do estilo), teclado de graça, e o mesmo componente serve o toggle MOD/MOI do gráfico de composição proposto.

**8. Coluna Status comunica só por cor com glifo de texto '●' sem texto acessível; input da simulação aceita lixo em silêncio** · `microcopy` · impacto 🟡 médio · esforço baixo

- Problema: encargos.tsx:283 usa o caractere '●' como dot de status — a regra do projeto pede dot como círculo CSS de 8px, nunca glifo — e a célula não tem title/aria: divergente vs aderente é indistinguível pra leitor de tela e pra daltônico (verde × âmbar, sem redundância textual). Na simulação, encargos.tsx:306 faz Number(delta...) || 0: digitar 'abc' silenciosamente simula 0 sem nenhum feedback, e não há atalhos para os degraus típicos de reoneração.
- Proposta: (a) Trocar o glifo por <span> circular 8px via CSS (background var(--success)/var(--warning)) com title e aria-label 'Aderente'/'Real ≠ Proposta'; (b) no input, mostrar hint de valor inválido quando o parse falha (borda --danger + microcopy 'Use número em p.p., ex.: 1,5') em vez de simular 0; (c) chips de preset genéricos +0,5 · +1 · +2 p.p. (FilterChip ou botões ghost) que preenchem o campo — sem chumbar valores da BR-101, são degraus de cenário.

**9. Título fora do padrão dos irmãos do M3 ('Encargos Sociais · D.3' vs 'D.4 — Perda de Produtividade')** · `consistencia` · impacto ⚪ baixo · esforço baixo

- Problema: encargos.tsx:66 usa 'Encargos Sociais · D.3' enquanto valor-agregado.tsx:68 usa 'D.4 — Perda de Produtividade' e pontuais.tsx:87 usa 'D.6 — Análises Pontuais (eventos)' (código na frente, travessão). O meta title (:18) ainda usa uma terceira numeração, '3.3 Encargos Sociais'. Três formatos pra mesma família de telas quebra o senso de sistema no módulo que mais precisa parecer auditável.
- Proposta: Padronizar h2 para 'D.3 — Encargos Sociais' e alinhar o meta title ('D.3 Encargos Sociais — RDM IA' ou manter '3.3' se essa for a convenção dos meta titles do M3 — conferir os irmãos e unificar nos dois eixos).

**10. Tabela de composição sem tratamento responsivo: 6 colunas em grid espremem abaixo de 880px** · `responsivo` · impacto ⚪ baixo · esforço baixo

- Problema: encargos.css:94-100 define grid-template-columns: 2.5fr 1fr 1fr 1fr 1fr 0.7fr sem nenhum breakpoint nem overflow — o CSS só tem media queries pros KPIs (:45-59) e pro deqgrid (:204-208). Em ≤880px as 4 colunas de percentual + status colapsam em larguras ilegíveis e a célula de descrição (ellipsis) vira '…' permanente.
- Proposta: Envolver .enc-tabela num wrapper com overflow-x: auto e dar min-width: ~640px à grade (padrão de tabela larga do projeto) — scroll horizontal honesto preserva as 6 colunas em vez de escondê-las. Alternativa mais fina: em ≤880px, Segmented MOD/MOI acima da tabela mostrando um par Proposta × Real por vez (nenhuma informação some, só alterna).

### D.4 Valor Agregado / Perda de Produtividade — src/routes/\_app/contracts/$contractId/desequilibrio/valor-agregado.tsx (+ .css)

**JTBD**: Jurídico + gerente de contrato preparando um Pleito/Claim de perda de produtividade: ver os três métodos de quantificação lado a lado (Total Cost ativo que alimenta a D.0, Valor Agregado AACE 25R-03, Milha Aferida), entender o intervalo defensável entre eles e a diferença mobilização × improdutividade no BM corrente, e auditar a conta até o nível função/equipamento e item da PQ — para escolher a estratégia de quantificação e sustentar o número (que reconcilia com a âncora D.0) em negociação ou arbitragem, onde um valor indefensável custa milhões.

<details><summary><b>Inventário (o que a tela exibe hoje — nada disto sai)</b></summary>

- Header: título 'D.4 — Perda de Produtividade' + subtítulo com os 3 métodos (Total Cost, Valor Agregado AACE 25R-03, Milha Aferida), doutrina do 'mais favorável ou intervalo', método ativo que alimenta a D.0 e nome da obra + Badge de farol global (d4.farolTotal ?? perda.totalCost.farol)
- Resumo dos três métodos — 4 MetodoCards: Total Cost (tag ATIVO, R$ + % do PV + mini-barra), Valor Agregado (R$ + % do PV + mini-barra), Milha Aferida (Aguardando, barra hachurada), Avanço de serviços (% executado + barra)
- Comparativo — tabela 4 colunas (Método / Como mede / Resultado / Situação) com 3 linhas: Total Cost (Badge 'Ativo (D.0)'), Valor Agregado (Badge 'Observação'), Milha Aferida ('Aguardando')
- Detalhe · card Total Cost: toggle 'Sem ajuste · ATIVO' × 'Com ajuste' (valores nos dois botões), mini-tabela MOD/EQP/TOTAL (Real alocado · Previsto no período|Contrat.×avanço · Total Cost), nota metodológica por modo, botão 'ver por função/por categoria'
- Detalhe · card Valor Agregado: mini-tabela MOD/EQP/TOTAL (Real alocado · Agregado CPU · Perda), botão 'ver itens da PQ'
- Detalhe expandido Total Cost — função a função (grupos MÃO DE OBRA DIRETA ~21 funções + EQUIPAMENTOS ~33 itens, subtotais por categoria, linha TOTAL) com caveat do modo; fallback por categoria + caveat quando o gate de conservação não fecha
- Detalhe expandido Valor Agregado — itens da PQ com produção medida (serviço, unid., qtd medida, MOD necessário, EQP necessário, linha TOTAL) + caveat 'necessário × gasto'
- Bloco Milha Aferida: status 'Aguardando baseline produtivo', Milha de referência Fat/MOD, Fat/EQP, Custo adicional líquido, caveat explicando o critério (melhor mês, mob. mín.)
- Caveat 'Leitura honesta do BM': avanço baixo, sem-ajuste × com-ajuste/VA, mobilização vs improdutividade, fator de recuperação da D.0
- Seção 'Leitura da D.4 · Adm Contratual IA' — 2 parágrafos derivados do dado (valores + cautela do BM)
- Estados: Skeleton (4 KPIs + 2 blocos), erro (EmptyState), pendência de normalização (EmptyState com hint)

</details>

**1. Tela sem nenhum gráfico — a série mensal do VA já é carregada (com acumulados derivados 'p/ o gráfico') e não é plotada** · `grafico` · impacto 🔴 alto · esforço baixo

- Problema: valor-agregado.tsx não renderiza gráfico algum: é uma pilha de cards + 4 tabelas. Mas o read-model valorAgregado.ts (linhas 41-58, 123-150) deriva vaAcumRs/realAcumRs por mês explicitamente 'p/ o gráfico', e a C.4 Recursos JÁ plota essa mesma série com ChartKit (rma/recursos.tsx:580-679 — Real navy × VA info, perda no tooltip via série invisível). Na tela dona do dado (D.4), a evolução temporal que sustenta o argumento 'é mobilização, os métodos convergem' fica invisível.
- Proposta: Nova seção 'Evolução — Real alocado × Valor Agregado (acumulado)' entre o Comparativo e o Detalhe, copiando o padrão pronto de recursos.tsx: ComposedChart Recharts + ChartTooltip/ChartLegend/CHART_SERIE_COR (Real=navy, VA medido=var(--info), 'Perda (Real − VA)' injetada no tooltip com stroke 0). Nada é removido — o gráfico dá o contexto temporal que o caveat do BM só descreve em texto.

**2. Reconciliação com a D.0 (âncora) carregada e nunca exibida** · `dado-subaproveitado` · impacto 🔴 alto · esforço baixo

- Problema: useValorAgregado.ts:77-78 carrega desequilibrioVA (parcela D.4 no painel D.0) e totalDesequilibrio, e a tela nunca os mostra. O subtítulo afirma 'o método ativo alimenta a D.0', mas o Jurídico não vê o número da âncora — e ele é OUTRO (o 'Total Cost do período' da D.0 ≠ o sem-ajuste 791.458 desta tela, confusão documentada só em comentário de código, perdaProdutividade.ts:5-7). Num claim, dois números 'de Total Cost' sem ponte visível é exatamente o tipo de divergência que a outra parte explora.
- Proposta: Linha de reconciliação derivada (nunca chumbada) no card Total Cost ou sob o Comparativo: 'Parcela D.4 no painel D.0: {formatBRL(desequilibrioVA)} · esta tela detalha o método (sem ajuste {formatBRL(tcSemRs)})', com Link pra /desequilibrio (D.0). Segue o princípio 'números das telas filhas devem reconciliar com a D.0' — hoje a ponte só existe em comentário.

**3. Literais da BR-101 chumbados em texto visível: 'BM3', '~R$ 6 mi', 'R$ 6.095.937', '3 meses de mobilização (mob. mín. 70%)'** · `literal-chumbado` · impacto 🔴 alto · esforço medio

- Problema: Textos de UI com dado fixo da BR-101: 'Leitura honesta do BM3' (linha 136) e 'No BM3' (153); sub do card Avanço 'executado até o BM3' (251); caveat '...chegam a ~R$ 6 mi' (139); caveat do detalhe com valor cravado 'O headline do com-ajuste (R$ 6.095.937)...' (662); MilhaBloco 'Com só 3 meses de mobilização (mob. mín. 70%)' (766-767). Em outra obra esses textos mentem — e num documento de Pleito um número chumbado divergente do dado é indefensável.
- Proposta: Derivar tudo do dado já carregado: nº do BM = último periodoLabel da d4.serieMensal (ou corte via useRmaCorte); '~R$ 6 mi' → formatBRL(tcComRs) e formatBRL(vaPerdaRs); 'R$ 6.095.937' → formatBRL do tcComRs calculado na própria tela (linhas 94-97); meses de mobilização = serieMensal.length; 'mob. mín. 70%' e status da Milha lidos de milha.status/params (exibindo '—' quando não normalizado). Zero informação removida — só passa a ser verdadeira em qualquer obra.

**4. Milha Aferida: pendente mascarado como R$ 0,00 e campos normalizados (status, impedimentos) não exibidos** · `estados` · impacto 🔴 alto · esforço baixo

- Problema: MilhaBloco linha 762: fmt(milha?.custoAdicionalRs ?? 0) imprime 'R$ 0,00' enquanto o método está 'Aguardando' — viola pendente ≠ zero ≠ conforme (zero falso numa tela de claim). Além disso o read-model carrega milha.status, impedimentoModRs, impedimentoEqpRs e impedimentoTotalRs (perdaProdutividade.ts:158-170) e a tela não mostra nenhum deles — o status exibido é o literal '⏳ Aguardando baseline produtivo'.
- Proposta: custoAdicionalRs null → '—' com sub 'aguardando baseline' (remover o ?? 0); status do bloco vindo de milha.status quando populado (fallback pro texto atual); acrescentar os 3 valores de Σ Impedimento (MOD/EQP/Total) na va-milha-row — dado já buscado, só falta renderizar. Ganha-se informação, não se perde.

**5. Erro renderizado como EmptyState sem retry — fundação ErroCard não adotada** · `adocao-fundacao` · impacto 🟡 médio · esforço baixo

- Problema: valor-agregado.tsx:41-46: isError cai num EmptyState framed genérico ('Tente recarregar a página'), visualmente idêntico ao estado de pendência logo abaixo — viola ERRO ≠ PENDÊNCIA. Todas as 10 abas RMA refinadas já usam ErroCard (Badge danger + botão de retry).
- Proposta: Destruturar { error, refetch } do useQuery e trocar por <ErroCard mensagem={error.message} onRetry={() => refetch()} /> — mesma adoção feita em faturamento/recursos/prazo etc. Os read-models já 'falham alto' (throw), então o error.message é informativo.

**6. Detalhe função a função (~54 linhas: 21 MOD + 33 EQP) sem busca, ordenação nem paginação** · `tabela` · impacto 🟡 médio · esforço medio

- Problema: DetalheTotalCost/FuncaoGrupo (linhas 633-691) despeja a frota inteira numa tabela corrida — na BR-101 são ~21 funções MOD + ~33 equipamentos. Sem busca por nome, sem ordenar por maior Total Cost (a pergunta nº1 do Jurídico: 'quais recursos concentram a perda?'), sem paginação. A tabela de itens da PQ (DetalheValorAgregado, 694-740) tem o mesmo gap. Regra do projeto: coleção 5+ usa o toolkit canônico.
- Proposta: Adotar useColecao + ColToolbar/ColPag/ColVazio (src/lib/hooks/useColecao.ts · src/lib/rma/colecao.tsx) nas duas tabelas expandidas: busca por função/equipamento/serviço, ordenação default 'maior Total Cost' (+ A-Z, maior Real), paginação 10-12 linhas com subtotais MOD/EQP e a linha TOTAL fixos fora da paginação (conservação sempre visível), empty filtrado com 'Limpar busca'. Nenhuma linha some — ficam navegáveis.

**7. danger usado como 'método ativo' — conflito com a semântica de farol e com o padrão canônico de card herói** · `consistencia` · impacto 🟡 médio · esforço baixo

- Problema: O card Total Cost é tom danger só por ser o ativo (tag ATIVO em danger-bg, barra danger), a linha do Comparativo tem fundo var(--danger-bg) (.va-cmp-ativo, css:216-218) e <Badge tone="danger">Ativo (D.0)</Badge> (tsx:295). No DS danger = Crítico; 'ativo' é seleção, não veredito — o farol real da perda já está no header. E o Badge da linha VA usa 'Observação' (tsx:307), vocabulário reservado ao farol, para descrever situação de método. O padrão canônico de card herói/ativo (exemplar /desequilibrio/indiretos) é brand via color-mix, nunca tom semântico.
- Proposta: Card e linha ativos migram pro padrão herói canônico: fundo/borda color-mix(in srgb, var(--brand) X%, var(--surface)) + chip tingido brand + tag ATIVO em brand; a linha do Comparativo idem, com Badge neutro/brand 'Ativo · alimenta a D.0'. Trocar o Badge 'Observação' por microcopy de método ('Referência comparativa', tone info). danger/warning ficam reservados ao farol da perda — que continua no header via farolToBadge.

**8. Colunas auditáveis da PQ ocultas + 2 fetches carregados e nunca usados (recursos, prod) + leituraIA normalizada não exibida** · `dado-subaproveitado` · impacto 🟡 médio · esforço medio

- Problema: A tabela de itens da PQ mostra só serviço/unid/qtd/VA, mas o read-model carrega codigoCpu, pctMod/pctEqp e modRsUn/eqpRsUn (valorAgregado.ts:26-39) — sem o R$/un da CPU a conta qtd × coeficiente = VA não é reproduzível na tela, e reproducibilidade é o que torna o VA defensável sob AACE 25R-03. O hook ainda busca getRecursos e getProdutividadeEconomica (useValorAgregado.ts:52-58) que a tela nunca consome (o doc do hook promete 'cobertura explícita' que não existe), e perda.leituraIA (a Leitura IA normalizada do workbook) nunca aparece.
- Proposta: Acrescentar colunas 'CPU' (código) e 'MOD R$/un · EQP R$/un' na tabela da PQ (ou expander por linha mostrando a conta completa qtd × R$/un = VA). Exibir perda.leituraIA como citação/quote dentro da seção Leitura da D.4 (exceção de quote permitida), mantendo os 2 parágrafos derivados. recursos/prod: ou exibir a cobertura de meses medidos prometida (contexto pro caveat de mobilização) ou cortar as 2 queries do hook — hoje é latência paga sem pixel.

**9. Resumo × Comparativo repetem os mesmos números e o detalhe expandido renderiza desancorado do card que o abriu** · `hierarquia` · impacto 🟡 médio · esforço medio

- Problema: Os mesmos dois valores (Total Cost sem ajuste e perda do VA) aparecem nos cards do Resumo E na coluna Resultado do Comparativo logo abaixo — duas seções de peso visual igual disputando a mesma headline. E o detalhe expandido (DetalheTotalCost/DetalheValorAgregado) renderiza full-width DEPOIS dos dois cards (tsx:546-549): clicar 'ver por função' no card esquerdo abre um tabelão abaixo do card direito; com os dois abertos, empilham dois tabelões sem vínculo visual com o gatilho.
- Proposta: Sem remover nada: (a) rebaixar o peso do Comparativo pra faixa compacta 'Como mede · Situação' (o Resultado permanece, em fs menor — a headline já mora nos cards, que ganham a mini-barra de intervalo entre os métodos que o subtítulo promete: 'apresentar o intervalo'); (b) ancorar o expandido ao card de origem — accordion ocupando a linha full-width do próprio va-detgrid sob o card clicado, título ecoando o modo do toggle (sem/com ajuste) e scroll suave até a tabela.

**10. Glifos como ícone (⏳, ▸/▾) e título de seção instrucional** · `microcopy` · impacto ⚪ baixo · esforço baixo

- Problema: '⏳' usado como ícone de status em 3 pontos (tsx:242, 317, 750) e setas de texto '▸ ver por função'/'▾ fechar' nos expansores (447, 517) — regra do projeto: lucide-react, nunca emoji/glifo como ícone de UI. O título 'Detalhe — clique para abrir' (435) é instrução, não título (o affordance já está no botão do card).
- Proposta: Trocar ⏳ por <Hourglass size={13}/> (lucide) ao lado de 'Aguardando'; ▸/▾ por ChevronRight/ChevronDown 12px no botão .va-detcard-exp; renomear a seção para 'Detalhe por método' e deixar o botão dizer 'Ver por função (54)'/'Fechar' — contador dá escala antes do clique.

### D.5 Insumos (Reajuste/Reequilíbrio) — src/routes/\_app/contracts/$contractId/desequilibrio/insumos.tsx (+ insumos.css; compartilha InsumosFdShared, useInsumosFd e o motor puro insumosFd.ts com a C.6)

**JTBD**: Jurídico + gerente de contrato quantificam e defendem, para o Pleito/Claim, dois valores independentes: (M1) o reajuste geral pelo IPCA sobre o saldo a executar — decidindo QUAL data-base (CPUs, proposta ou assinatura) é a mais defensável, com memória de cálculo rastreável, diferença de milhões entre candidatas; e (M2) o repasse de reequilíbrio dos insumos de faturamento direto — escolhendo, insumo a insumo, a fonte de índice sustentável em arbitragem, sabendo que o repasse real medido vira lançamento na D.0 (fora do teto pleiteável) e o potencial dimensiona o que vem com a medição futura. Erro ou número indefensável = milhões perdidos ou pleito derrubado.

<details><summary><b>Inventário (o que a tela exibe hoje — nada disto sai)</b></summary>

- Título 'Reajuste e reequilíbrio dos insumos' + sub com Contrato (derivado C.1/obra) · data OS · data Verificação reequilíbrio · pill 'valores c/ BDI'
- Bloco explicativo ifd-srcinfo: os dois mecanismos (M1 cláusula 6.2 IPCA 12 meses · M2 cláusula 8.8 insumos FD, IPCA como linha divisória)
- Mecbar 1 (círculo numerado + título 'Reajuste geral — IPCA · escolha a data-base')
- Hint do M1 com a fórmula R = [(I − I₀) × P] / I₀, o saldo a executar (P) e o mês de referência do IPCA (derivado de serieIpca.at(-1))
- 3 cards de cenário M1 clicáveis (nome, descrição, I₀ → I, variação %, reajuste R$) — recalculam via m1Calc
- Memória de cálculo do cenário ativo (d5-memo): fórmula substituída com números + variação
- Mecbar 2 ('Reequilíbrio dos insumos — índices multifonte (= C.6)')
- Hint M2 (fontes SINAPI/SBC/EMOP/SCO/DNIT/ANP, excedente sobre o IPCA em destaque, dot = sugestão da IA) + 5 presets (Tudo mercado · Tudo DNIT · Recomendado · Melhor · Pior) + presethint explicando melhor/pior
- 4 KPI cards live (Contrato FD c/ BDI + nº insumos · Acima do IPCA com denominador · Repasse M2 real (medido) com sub derivado dos medidos · Potencial M2) com flash ao recalcular
- Tabela multifonte M2 — 15 colunas (rank, insumo, Qtd PQ, R$ unit, valor contrato, classe ABC, seletor de base por insumo, valor OS, valor atual, Δ%, excedente, qtd medida, valor medido, repasse real, potencial), toggle Curva ABC / Ordem da PQ com subtotais por categoria, busca canônica ColToolbar, rodapé TOTAL com '✓ bate com a PQ' + % medido
- Nota derivada da tabela (definições de excedente/repasse/potencial + total medido + insumo dominante do potencial, tudo derivado do dado)
- Card IA 'Leitura do reequilíbrio' (badge IA · Adm Contratual + texto + affordance editar)
- Estados: Skeleton (3 blocos), EmptyState de erro com retry, EmptyState 'v53 não normalizado'

</details>

**1. Sem snapshot no topo — os números-resposta do JTBD ficam enterrados** · `hierarquia` · impacto 🔴 alto · esforço medio

- Problema: insumos.tsx l.167-235: a página abre com título → sub → bloco de prosa (l.179-185) → M1. O valor do M1 (reajuste do cenário ativo, ~R$ 25,2M) só existe DENTRO dos cards clicáveis (l.86) e o repasse/potencial do M2 só aparece nos KPIs do meio da página (l.205-214). A C.6 já resolveu isso no refino: 'snapshot no topo: os números que respondem o JTBD antes de qualquer texto' (rma/insumos.tsx l.777-787).
- Proposta: Faixa snapshot no topo com 3 KPI cards no padrão canônico de /desequilibrio/indiretos (chip quadrado lucide em surface-2 + rótulo → valor tabular-nums → sub): 'M1 · Reajuste (cenário ativo)' · 'M2 · Repasse real (→ D.0)' · 'M2 · Potencial (se tudo medido)', cada um ancorando à sua seção. Nada sai do lugar — os blocos atuais permanecem; ganham só um resumo executivo acima, espelhando o template snapshot+sub-seções do refino RMA.

**2. M1 é 100% numérico e a série IPCA inteira carrega sem virar gráfico** · `grafico` · impacto 🔴 alto · esforço medio

- Problema: insumosFd.ts l.160-172 carrega a serieIpca completa (dezenas de meses) e os 3 cenariosM1 (mes + i0), mas a D.5 usa a série só como rótulo de texto: serieIpca.at(-1) em insumos.tsx l.68. A decisão mais cara da tela — qual data-base do M1, com diferença de milhões entre candidatas — é apresentada apenas como 3 cards de números; dado carregado e subaproveitado.
- Proposta: LineChart (Recharts, já em uso na C.6) da trajetória do IPCA com linha navy (var(--c6-navy)), ReferenceDot nos I₀ dos 3 cenários (cenariosM1 já traz mes+i0) e no I atual (reeq.ipcaAtual), usando ChartTooltip + ChartLegend do DS (fundações do refino); clicar num card de cenário destaca o dot correspondente. Mostra visualmente POR QUE as três candidatas divergem (inflação acumulada desde cada mês) — mesmo padrão do GraficoIndices que a C.6 já tem (rma/insumos.tsx l.264+). Não substitui os cards, complementa entre os cards e a memória.

**3. Falta o link de reconciliação com a D.0 (âncora) — a C.6 tem o espelho, a D.5 não** · `navegacao` · impacto 🔴 alto · esforço baixo

- Problema: O próprio header do arquivo declara que 'o repasse real do M2 alimenta a D.0 como repasse direto à medição (fora do teto pleiteável)' (insumos.tsx l.4-6) e a D.0 exibe a linha 'Excedente de Insumos (D.5) — fora do teto pleiteável' (desequilibrio/index.tsx l.207-215). Mas a D.5 não tem nenhuma menção/link à D.0. A C.6 tem o c6-linkbox 'o repasse real vira lançamento na D.5 → Abrir D.5' (rma/insumos.tsx l.907-932); o elo seguinte da cadeia está quebrado.
- Proposta: Replicar o linkbox no fim da D.5 (mesmas classes .c6-linkbox já provadas): 'O repasse M2 real vira lançamento na D.0 — fora do teto pleiteável' + ValorLive do repasse (sel.totais.repasseReal) + Link 'Abrir D.0' para /contracts/$contractId/desequilibrio. Torna a reconciliação com a âncora visível e navegável (regra: números das telas filhas reconciliam com a D.0).

**4. Chat IA com narrativa chumbada da BR-101 ('CBUQ via CAP... SINAPI a 0%')** · `literal-chumbado` · impacto 🔴 alto · esforço baixo

- Problema: insumos.tsx l.246-252: o card IA afirma 'o CBUQ via CAP, em especial, convive com o SINAPI a 0% do outro lado' — nomes de insumo e fontes específicos da BR-101 chumbados em texto. Em qualquer outra obra a frase mente. Ironia: a mesma tela JÁ deriva dominantePotencial (l.143-154) exatamente 'não chumba — era CBUQ fixo' e usa na nota da tabela, mas o chat ficou para trás.
- Proposta: Derivar a frase do dado carregado: usar o dominantePotencial já computado + o spread de fontes desse insumo (max/min de insumo.opcoes por delta, tudo em memória) — ex.: '{insumo} via {fonte de maior Δ%} convive com {fonte de menor Δ%} a {Δ%} do outro lado'; fallback quando nenhum insumo gera potencial, no padrão que a C.6 já faz (rma/insumos.tsx l.951-959). Nenhuma informação removida — a mesma leitura, só que verdadeira em qualquer obra/BM.

**5. Memória de cálculo do M1 sem datas dos índices e sem decompor P — frágil para o Pleito** · `microcopy` · impacto 🔴 alto · esforço baixo

- Problema: insumos.tsx l.91-99 + insumos.css l.126-135: a memória é uma frase única corrida a 11,5px. I e I₀ aparecem só como números soltos (7.146,73 / 6.892,07) sem o MÊS de cada um, e P entra como valor fechado — o hint acima diz 'contrato cheio − medido acumulado', mas reeq.contratoCheioBdi e reeq.medidoAcumulado (carregados pelo read-model, insumosFd.ts l.184-185) nunca aparecem na tela. Numa memória que sustenta Claim, cada termo precisa de rótulo, data e origem.
- Proposta: Estruturar a memória em termos rotulados mantendo a linha final da fórmula: 'I = IPCA {mesLongoIso(serieIpca.at(-1))} = 7.146,73 · I₀ = IPCA {mesLongoIso(cenAtivo.mes)} ({cenário}) = 6.892,07 · P = contrato cheio {fmtBRL2(contratoCheioBdi)} − medido {fmtBRL2(medidoAcumulado)} = {fmtBRL2(saldoAExecutar)}' → R = resultado. mesLongoIso e os campos já existem; subir a fonte para var(--fs-12). Nada removido — a mesma conta, agora auditável linha a linha.

**6. Parâmetros do reequilíbrio dispersos em prosa — adotar RmaParamBar (como a C.6) e expor os campos mortos do reeq** · `adocao-fundacao` · impacto 🟡 médio · esforço baixo

- Problema: As datas ficam no sub em texto corrido (insumos.tsx l.171-177), o IPCA período só dentro do hint dos presets (l.198) e o saldo a executar dentro do hint do M1 (l.64) — o leitor caça parâmetros em 3 lugares. A C.6 consolidou isso na RmaParamBar (rma/insumos.tsx l.755-775). Além disso, o read-model carrega e a tela NUNCA exibe: dataReajusteAniversario (cláusula 6.2 — quando o M1 pode ser aplicado), reajusteAcumulado, dataAssinatura e dataProposta (insumosFd.ts l.180-187).
- Proposta: Adotar <RmaParamBar> abaixo do sub com: Marco (OS {mesLongoIso(dataOs)}) · Verificação reequilíbrio · IPCA período (linha divisória 8.8, com title explicativo) · Saldo a executar. Incluir, quando não-nulos, 'Aniversário do reajuste' (dataReajusteAniversario) e 'Reajuste já concedido' (reajusteAcumulado) — dado juridicamente relevante que hoje morre no read-model. As menções em prosa podem permanecer; a barra vira o ponto de escaneio.

**7. Bloco institucional de prosa antes de qualquer número — colapsar como a C.6 fez (sem remover texto)** · `poluicao` · impacto 🟡 médio · esforço baixo

- Problema: insumos.tsx l.179-185: o parágrafo ifd-srcinfo explicando M1/M2/cláusulas ocupa ~5 linhas fixas entre o header e o conteúdo, empurrando os números para baixo em toda visita — inclusive para o usuário recorrente que já sabe a mecânica. A C.6 refinou o bloco equivalente para <details> de 1 linha que expande ('nada do texto foi removido', rma/insumos.tsx l.803-817).
- Proposta: Mesmo tratamento: <details className="ifd-srcinfo c6-srcinfo"> com summary 'Dois mecanismos independentes — M1 Reajuste (6.2) · M2 Reequilíbrio (8.8) · como funcionam' + chevron, e o parágrafo completo dentro. Zero informação removida; primeira dobra ganha os cards de cenário e KPIs.

**8. Estados atrás do padrão: erro vira EmptyState (não ErroCard) e Skeleton é genérico** · `estados` · impacto 🟡 médio · esforço baixo

- Problema: (a) insumos.tsx l.128-139: q.isError renderiza EmptyState com botão — o refino codificou ERRO ≠ PENDÊNCIA via ErroCard (Badge danger + retry), que a C.6 já adota (rma/insumos.tsx l.690-698). Visualmente, na D.5 uma falha de leitura parece 'obra sem dado'. (b) insumos.tsx l.119-127: Skeleton = 3 retângulos 120/220/480 que não têm a forma da tela (título → mecbar → 3 cards M1 → memo → presets → 4 KPIs → tabela); a C.6 tem skeleton espelhando a forma real (l.659-688).
- Proposta: Trocar o branch de erro por <ErroCard titulo="Não foi possível carregar o reajuste/reequilíbrio" mensagem={...} onRetry={refetch}> (já no barrel do DS) e espelhar o skeleton da C.6 adaptado: linha de título + barra + row de 3 cards + bloco memo + row de 4 KPIs + bloco alto da tabela.

**9. Cenário ativo do M1 sem o padrão herói canônico e sem distinguir simulação × cenário oficial do Pleito** · `consistencia` · impacto 🟡 médio · esforço baixo

- Problema: insumos.css l.97-101: .d5-m1card.on marca o ativo com borda var(--text-2) + fundo info 6% — o padrão canônico de card herói/ativo é color-mix em BRAND (exemplar /desequilibrio/indiretos, regra do CLAUDE.md). Pior para defensabilidade: o estado é useState local iniciado em reeq.cenarioM1Ativo (insumos.tsx l.51); ao clicar noutro card para simular, NADA continua marcando qual data-base é a posição oficial do Pleito no banco. Os botões também não têm aria-pressed.
- Proposta: Ativo via color-mix(in srgb, var(--brand) X%, var(--surface)) + chip tingido (padrão herói); aria-pressed={c.id===ativo} nos botões; pill fixa 'cenário do pleito' (Badge tone info compacto) no card cujo id === reeq.cenarioM1Ativo, independente da simulação; e quando simulado ≠ oficial, uma linha na memória: 'simulação — o cenário adotado no Pleito é {nome}'. Nenhuma informação removida; a simulação continua livre.

**10. CSS próprio fora do tokens-only: #fff e font-sizes em px chumbados** · `consistencia` · impacto ⚪ baixo · esforço baixo

- Problema: insumos.css: color: #fff no .d5-mecbar .num (l.54) e font-sizes px onde existem tokens — 22px (l.14, .c6-titulo), 15px (l.63, .tt), 16px (l.118, .mc-r), 10px (l.108, .mc-d), 11.5px (l.131, .d5-memo). Regra de ouro do projeto: nunca hardcodar cor/tipografia fora de detalhe geométrico.
- Proposta: Trocar pelos tokens da escala --fs-\* (e criar o degrau se faltar — 'se um valor não tem token, o token está faltando'); para o branco sobre navy do círculo numerado, usar o mesmo token que o Button variant ink do DS já usa para texto sobre --ink (alinhar, não inventar). Mudança puramente de higiene, zero impacto visual no light e corrige potenciais desvios no dark.

### D.6 Análises Pontuais — src/routes/\_app/contracts/$contractId/desequilibrio/pontuais.tsx (+ pontuais.css

**JTBD**: Como Jurídico/Gerente de Contrato preparando o Pleito, preciso do dossiê evento-a-evento das paralisações e ociosidades (período, equipe afetada, memória de cálculo rastreável e prova RDO/ATA) para decidir na D.10 entre o macro da D.4 e a soma por eventos — com a honestidade de que nada foi validado ainda (R$ 0 na D.0, R$ 763k pendente) e com cada número defensável em negociação/arbitragem, onde erro de rastreabilidade custa milhões.

<details><summary><b>Inventário (o que a tela exibe hoje — nada disto sai)</b></summary>

- Header: título "D.6 — Análises Pontuais (eventos)", subtítulo com nome da obra + instrução de clique, Badge de farol (● Conforme), linha de fontes (auxiliar_D.6 Chuva · auxiliar_D.6 Impedimentos · C.9 — Chuvas)
- Resumo — 4 FarolCards: Perda validada acum. (R$ 0, "alimenta a D.0") · Pendente não somado (R$ 763k, "4 eventos em análise") · Eventos pendentes (4) · Farol (Conforme, "nada somado ainda")
- Lista de eventos documentados — 4 cards expansíveis, cada um com: chip de categoria colorido (Chuva/Frente/Retrabalho/Outros), período · duração, descrição truncada, valor pendente em R$, chip "⏳ Pendente", toggle "ver ficha/fechar ficha"
- Ficha CHUVA (expandida): seção Período e dias · tabela diária de equipe afetada (Dia, Efetivo RDO, HH ociosas, Equip. prod., HEQ ociosas + linha TOTAL dias >5mm) · tabela mensal memória de cálculo líquida da prevista (Mês, Real >5mm, Previsto, Excedente, Fração, Pleiteável MOD, Pleiteável EQP + total) · memo narrativo derivado (mês com excedente, MOD+EQP=total) · Anotação RDO com tag
- Ficha IMPEDIMENTO (expandida): Período e dias · equipe afetada por subtração (6 boxes: MOD total/dia, − frentes ativas, = MOD afetado; idem EQP, com destaque danger no afetado) · memória de cálculo (afetado × dias × jornada = HH/HEQ × custo-hora do params = custo MOD/EQP → perda do evento) · Anotação RDO/ATA
- Ficha PRAZO/retrabalho (expandida): Período · equipe (MOD/EQP ocioso ≈ 0) · memória explicando impacto de prazo/prorrogação (BDI estendido), não hora parada · Anotação RDO/ATA
- Aviso de dupla contagem com a D.4 (caixa danger): macro × eventos não se somam; dedup na D.10; por isso eventos ficam pendentes (R$ 0 somado)
- Leitura IA (card com badge IA): 2 parágrafos narrando os 4 eventos, chuva líquida da prevista, mai/26, R$ 279.805 / R$ 738 mil, leira/fundação/retrabalho, total R$ 763.277 pendente
- Estados: Skeleton (4 KPIs + 4 cards de evento) · EmptyState de erro · EmptyState de pendência ("não normalizado", hint "Aguardando o módulo M3")
- Dados carregados pelo hook e NÃO exibidos hoje (subaproveitados): chuvaDia.chuvaMm/acima5mm/periodosAfetados/custoOciosoRs/custoEqpRs · evento.status (ok|needs_review) · evento.titulo (só como fallback) · chuvaMensal.totalMesRs (só como classe de zebra)

</details>

**1. Leitura IA 100% chumbada com a BR-101 — narrativa deve ser DERIVADA do dado** · `literal-chumbado` · impacto 🔴 alto · esforço medio

- Problema: IaLeitura() (pontuais.tsx l.470-490) é texto fixo: "Quatro eventos", "só mai/26 teve excedente", "R$ 279.805", "R$ 738 mil brutos", "leira", "fundação", "retrabalho", "Total documentado R$ 763.277". Nenhum valor vem de props — em outra obra (Sorriso, a635c9ee) a tela narraria a BR-101. Numa tela que vira dossiê de Pleito, um número narrado que não bate com a tabela ao lado destrói a defensabilidade. Contraste: o memo da FichaChuva (l.344-356) já deriva mesExc/totMod/totEqp do dado — o padrão certo existe na própria tela.
- Proposta: Passar `v` para IaLeitura e derivar tudo: nº de eventos = eventos.length; quebra por tipo via tipoFicha() já existente (nomes dos impedimentos = e.titulo/e.categoria); mês com excedente = chuvaMensal.find(m => (m.excedente ?? 0) > 0) com pleiteável do mês (pleiteavelModRs+pleiteavelEqpRs); bruto de ociosidade = Σ chuvaDia.custoOciosoRs+custoEqpRs (já carregados); total pendente = params.pendenteTotalRs. Renderizar cada frase condicionalmente (sem excedente → frase some). Mesma pegada do LeituraIA do D.0 (index.tsx l.413) que recebe texto do banco.

**2. Farol hardcoded em success — se o farol mudar para Risco a tela mente** · `consistencia` · impacto 🔴 alto · esforço baixo

- Problema: Header (l.94): `{farol && <Badge tone="success">● {farol}</Badge>}` — o tom é fixo success independente do valor de params.farol. Idem no KPI "Farol" (l.145-151): `accent="success"` fixo e `info="nada somado ainda"` chumbado. Se amanhã o produtor gravar farol="Risco" (evento validado estourando), a tela exibe verde. Viola a Regra do Farol (4 níveis via farolToBadge/farolLabel, nunca duplicar mapa) e o aprendizado "farol só do campo que o produtor popula" — o campo É populado, mas o tom não o segue.
- Proposta: Mapear params.farol → FarolLevel (normalizar string) e usar `farolToBadge`/`farolLabel` de @/lib/mocks/contracts no Badge do header; no KPI, usar a prop `farol` do FarolCard (l.54, já existe e vence o accent) em vez de accent fixo. O sub "nada somado ainda" vira derivado: validada === 0 ? "nada somado ainda" : "há valor validado na D.0". O glifo "●" sai (ver achado de emojis).

**3. Zero gráficos numa tela que já carrega duas séries prontas (mensal e diária)** · `grafico` · impacto 🔴 alto · esforço medio

- Problema: O dono pediu "gráficos mais completos" e a D.6 não tem NENHUM. O hook já entrega: chuvaMensal (real5mm × prev5mm × excedente por mês — a comparação central do pleito de chuva) e chuvaDia (chuvaMm + hhOciosas/heqOciosas por dia — a evidência do critério >5mm). Hoje isso vive só em tabelas dentro da ficha; a régua visual "quanto o real excedeu o previsto" exige ler linha a linha.
- Proposta: Adotar ChartKit (fundação já existente): (1) na ficha Chuva, barras agrupadas mensais Real >5mm × Previsto — Real = CHART_SERIE_COR.real (navy), Previsto = CHART_SERIE_COR.contratado (info), mês com excedente destacado (danger só aí, que é o "ruim" semântico), com <ChartTooltip formatter={{...}}/> e <ChartLegend/>; (2) mini-barras diárias de chuvaMm com ReferenceLine em 5 mm (CHART_SERIE_COR.meta, warning) e HH ociosas no tooltip — visualiza a prova do critério. Gráficos COMPLEMENTAM as tabelas (nada sai); ~64-96px de altura cada, acima das respectivas tabelas.

**4. Dado carregado e não exibido: mm de chuva do dia (a EVIDÊNCIA), custos diários, status needs_review, título do evento** · `dado-subaproveitado` · impacto 🔴 alto · esforço medio

- Problema: O read-model (pontuaisD6.ts) carrega e a tela ignora: (a) chuvaDia.chuvaMm (l.55) e acima5mm (l.56) — a tabela diária (pontuais.tsx l.281-309) mostra HH ociosas mas NÃO os mm que provam o >5mm, que é exatamente o que o Contratante vai contestar; (b) chuvaDia.periodosAfetados, custoOciosoRs, custoEqpRs (l.57-63) — o custo por dia existe e não aparece; (c) evento.status ('ok'|'needs_review', l.37) — um evento marcado needs_review pelo motor entra no dossiê sem nenhum aviso visual; (d) evento.titulo só aparece como fallback quando período falta (l.211: `subtitulo || e.titulo`) — o NOME do evento, identidade primária num claim, fica invisível; (e) chuvaMensal.totalMesRs usado só como classe de zebra (l.327), nunca exibido.
- Proposta: Sem remover nada: adicionar colunas "Chuva (mm)" e "Custo dia" à tabela diária (7 colunas, cabe no max-width 920px); Badge tone=warning "Revisar" no header do card quando status==='needs_review'; exibir e.titulo como linha principal do card (período·duração desce para o subtítulo — hoje o card abre com "10/03–07/06 · 27 dias" sem dizer O QUÊ); coluna "Total mês" na tabela mensal (já vem no dado).

**5. Microcopy jurídica ambígua: "9 reais vs 4 previstos" lê-se como R$; fração 0,6 vs 56% para o mesmo número** · `microcopy` · impacto 🟡 médio · esforço baixo

- Problema: No memo da chuva (l.349-350): `{fmtInt(mesExc.real5mm)} reais vs {fmtInt(mesExc.prev5mm)} previstos` — "reais" aqui são DIAS reais, mas numa tela cheia de R$ lê-se como moeda; ambiguidade fatal num documento que vira anexo de Pleito. Na mesma frase a fração sai como fmtNum1 ("0,6") enquanto a tabela logo acima mostra fmtPctInt ("56%") — dois formatos para o mesmo fracaoExcedente. Cabeçalhos "Real >5mm"/"Previsto" (l.317-318) não dizem a unidade (dias). E o EmptyState (l.71) diz "Aguardando o módulo M3" — esta tela É M3; as irmãs dizem "Aguardando normalização da Camada A" (indiretos.tsx l.78).
- Proposta: Trocar por "X dias reais vs Y previstos"; unificar a fração no formato percentual da tabela (fmtPctInt) nos dois lugares; cabeçalhos "Real >5 mm (dias)" e "Previsto (dias)"; hint do empty alinhado às irmãs ("Aguardando normalização da Camada A").

**6. Emojis como ícone de UI (📅👷🧮📋⏳⚠️) e barra brand no memo — dois vetos do DS na mesma tela** · `poluicao` · impacto 🟡 médio · esforço baixo

- Problema: Títulos das seções de ficha usam emoji (l.273, 280, 312, 359, 373, 379, 390, 404, 415, 421, 428, 436), o chip de status usa "⏳ Pendente" (l.216), o aviso usa "⚠️" (l.456), o toggle usa glifos "▾/▸" (l.218) e o Badge do header "●" (l.94) — a regra é lucide, nunca emoji/glifo. E .pnt-memo tem `border-left: 3px solid var(--brand)` (pontuais.css l.300) — barra colorida de destaque em caixa, vetada (a exceção é só citação/quote; memória de cálculo não é citação — a Anotacao do RDO, essa sim, é quote legítima).
- Proposta: Substituir 1:1 por lucide 13-14px: Calendar (período), HardHat/Users (equipe), Calculator (memória), ClipboardList (anotação), Clock no chip Pendente, TriangleAlert no aviso, ChevronRight/ChevronDown no toggle; dot de farol vira o padrão de 8px do DS. No .pnt-memo, remover o border-left e tingir o fundo via `color-mix(in srgb, var(--brand) 4-6%, var(--surface))` (padrão canônico do exemplar indiretos). Zero informação removida — só troca de vocabulário visual.

**7. Erro renderizado como EmptyState sem retry — erro ≠ pendência (fundação ErroCard existe e não é usada)** · `adocao-fundacao` · impacto 🟡 médio · esforço baixo

- Problema: isError cai num EmptyState neutro "Tente recarregar a página" (pontuais.tsx l.60-65) — visualmente idêntico à pendência honesta "ainda não normalizado" logo abaixo (l.66-72). É exatamente o anti-padrão que o ErroCard foi criado para matar (ErroCard.tsx l.3-7: "erro NUNCA renderiza como pendência"): o jurídico não sabe se o dossiê não existe ou se o fetch quebrou.
- Proposta: Trocar por `<ErroCard mensagem={(error as Error)?.message} onRetry={() => refetch()} />` — o hook usePontuaisD6 já expõe refetch via useQuery; basta desestruturar. Badge danger + botão "Tentar novamente" de graça.

**8. Memória de cálculo sem guarda de reconciliação — o "=" pode mentir em silêncio** · `consistencia` · impacto 🔴 alto · esforço baixo

- Problema: No memo da chuva (l.354-355), a frase "MOD {totMod} + EQP {totEqp} = {e.custoRs}" imprime a SOMA calculada das tabelas à esquerda do "=" e o VALOR ARMAZENADO do evento à direita — se o banco divergir da soma (re-extração, arredondamento), o memo afirma uma igualdade falsa num documento de claim. Idem no Resumo (l.118): pendente usa params.pendenteTotalRs com fallback Σ eventos, mas nunca confere um contra o outro na tela. O exemplar D.1 já tem esse padrão (indiretos.tsx l.96-98: recOk com tolerância 0,01 + ind-warn visível).
- Proposta: Replicar o recOk: `const ok = Math.abs((totMod+totEqp) - (e.custoRs ?? 0)) < 0.01` — se falhar, aviso discreto no memo ("soma das parcelas difere do valor do evento em R$ X"); mesmo guard entre Σ eventos.custoRs e params.pendenteTotalRs no Resumo, com nota de reconciliação. É a materialização do princípio "D.0 é âncora / conservação conferida pelo gate" NA tela, onde o jurídico vê.

**9. Tabelas de ficha crescem sem cap: meses zerados sempre renderizados, eventos sem toolkit a partir de 5** · `tabela` · impacto 🟡 médio · esforço medio

- Problema: A tabela mensal (l.326-335) renderiza TODOS os meses, inclusive os sem valor (só esmaecidos via .pnt-ft-z) — numa obra de 46 meses (vigência real da BR-101) são 40+ linhas cinzas para achar 1 mês com excedente. A lista de eventos (l.171-179) não tem busca/ordenação/paginação — hoje são 4, mas o RDO diário (fase 2) multiplica isso; a regra do projeto exige o toolkit canônico em coleções 5+. E .pnt-ft (7 colunas) não tem wrapper com overflow-x — em 720px a tabela estoura (o @media l.429-443 só trata kpis/header).
- Proposta: Sem remover: default "meses com movimento" + linha-expansor "ver todos os N meses (M zerados)" que abre o resto — o total continua conferindo. Nos eventos, adotar useColecao + ColToolbar/ColPag quando eventos.length >= 5 (busca por título/categoria/fonte, ordenação valor/período); com 4 mantém como está. Envolver .pnt-ft em div com overflow-x:auto.

**10. Resumo plano com KPI redundante — sem herói e com o mesmo "4 eventos" dito duas vezes** · `hierarquia` · impacto 🟡 médio · esforço baixo

- Problema: Dos 4 FarolCards (l.124-151), o 2º já diz "4 eventos em análise" no sub e o 3º repete "Eventos pendentes: 4" — 25% da faixa de KPIs é eco. E os 4 cards têm o mesmo peso visual, quando o número de trabalho da tela é o Pendente R$ 763k (a perda validada R$ 0 é o contexto de honestidade). O padrão canônico (indiretos) marca o card-herói via color-mix brand.
- Proposta: Manter os 4 cards (nada sai): "Pendente (não somado)" vira o herói com fundo/borda color-mix brand do padrão canônico; o sub do card "Eventos pendentes" troca a redundância por informação nova derivada de tipoFicha(): "1 chuva · 2 impedimentos · 1 prazo" (quebra por categoria, que hoje só se descobre scrolando os cards). O sub "alimenta a D.0" do card validada ganha precisão jurídica: "somado à D.0 só após validação".

### 3.10 Gerador de Claim Consolidado (M3.10, ápice do M3) — src/routes/\_app/contracts/$contractId/desequilibrio/gerador-claim.tsx + gerador-claim.css. Estado real: híbrido honesto — Etapa 3 (Quantificação) implementada com dado real do D.0 via useDesequilibrio/getDeseqContexto; Etapas 1, 2 e 4 são pendências explícitas (sem dado fabricado), aguardando agentes/APIs/pipeline .docx.

**JTBD**: Como jurídico ou gerente de contrato preparando o Pleito/Claim, quero ver o valor consolidado e defensável do desequilíbrio (por método, reconciliado ao centavo com o Painel D.0 e auditável na tela de origem de cada parcela) e a prontidão real das 4 etapas do claim (dossiê, fundamentação, quantificação, documento), para decidir quanto pleitear agora e o que ainda bloqueia a emissão do .docx final — sabendo que qualquer número não-auditável derruba o pleito em negociação ou arbitragem.

<details><summary><b>Inventário (o que a tela exibe hoje — nada disto sai)</b></summary>

- Header custom (h2 '3.10 Gerador de Claim Consolidado' + sub com nome da obra vindo do hook)
- Stepper clicável de 4 etapas (Dossiê Probatório · Fundamentação · Quantificação · Documento) com hints de prontidão
- Etapa 1 · Dossiê Probatório (pendente honesta): texto explicativo + 3 itens com tag 'pendente' (indexação, classificação por evento, Matriz de Nexo Causal M2.5.3.9)
- Etapa 2 · Fundamentação (pendente honesta): texto + 3 itens (cláusulas, jurisprudência Jusbrasil, normas AACE/IBAPE + precedentes)
- Etapa 3 · Quantificação (REAL, D.0): hero escuro --ink com 'VALOR CONSOLIDADO DO PLEITO' + total formatBRL + '% do contratado' + Badge de farol (classificarPorRegra desequilibrio_acumulado)
- Etapa 3 · tabela Método/Categoria · Origem (chip D.x) · Valor (R$) · % do total, linhas comValor ordenadas desc + linha TOTAL CONSOLIDADO (formatBRLCents + 100%)
- Etapa 3 · nota de rodapé: categorias sem valor ('R$ 0 / pendente') + explicação de por que cenários alto/baixo não existem (sem ±% fabricado)
- Etapa 4 · Documento (pendente honesta): texto do pipeline .docx + valor consolidado a documentar em negrito + botão 'Gerar Claim (.docx) — em breve' desabilitado
- Navegação Voltar/Próxima + contador 'Etapa X de 4'
- Estados: Skeleton (bloco stepper 64px + bloco etapa 360px), EmptyState de erro (sem retry), EmptyState de obra sem D.0 ('Aguardando o módulo M3')
- Dado carregado e NÃO exibido: valorContratado (denominador do farol), valorContratadoFonte ('obra' | 'faturamento'), deseq.nComValor, deseq.status, pctDoTotal pré-computado no read-model

</details>

**1. Estado de erro mascarado como pendência — adotar ErroCard com retry** · `adocao-fundacao` · impacto 🔴 alto · esforço baixo

- Problema: gerador-claim.tsx L42–47: `isError` renderiza `<EmptyState framed title="Não foi possível carregar...">` — sem Badge danger, sem botão de retry, visualmente idêntico à pendência honesta do `!data` (L48–54). A fundação ErroCard (src/components/ds/ErroCard/ErroCard.tsx, exportada no barrel L25) existe exatamente pra isso e NENHUMA das duas é usada aqui; o hook useDesequilibrio expõe `refetch` do useQuery mas a tela nem desestrutura.
- Proposta: Trocar o branch de erro por `<ErroCard mensagem={error?.message} onRetry={() => refetch()} />` (desestruturar `error` e `refetch` do hook na L33). Mantém o EmptyState atual só no branch `!data` (pendência real do M3). Zero mudança de layout — só o estado de erro ganha a semântica correta (Badge danger + Tentar novamente).

**2. Nota de categorias sem valor viola 'pendente ≠ zero' e esconde informação em prosa** · `consistencia` · impacto 🔴 alto · esforço medio

- Problema: L184 `semValor = categorias.filter(c => !((c.valorRs ?? 0) > 0))` mistura `valorRs === null` (não apurado/pendente) com `valorRs === 0` (apurado sem desequilíbrio), e a nota L229–235 declara tudo junto como "sem desequilíbrio medido (R$ 0 / pendente)" num parágrafo corrido de 11px. É o aprendizado codificado 'pendente ≠ zero ≠ conforme' quebrado — e diverge do D.0 (index.tsx L181–200), que lista as mesmas categorias num `<details>` expansível com "— não apurado" por linha.
- Proposta: Espelhar o padrão do D.0: abaixo da linha TOTAL, um `<details>` "N categorias sem desequilíbrio apurado" com uma linha por categoria (nome + chip D.x + "— não apurado" quando null vs "R$ 0 apurado" quando zero). A frase sobre cenários alto/baixo (que é outro assunto) vira nota separada, mantida integralmente. Nada é removido — a informação sai da prosa e vira estrutura auditável, consistente com a tela-mãe.

**3. Precisão mista na coluna Valor: parcelas sem centavos não fecham com o total com centavos** · `tabela` · impacto 🔴 alto · esforço baixo

- Problema: QuantRow L249 usa `formatBRL(valor)` (maximumFractionDigits: 0) nas parcelas, mas a linha TOTAL L224 usa `formatBRLCents(total)` (2 casas). Um jurídico somando as parcelas arredondadas da tabela não reproduz o total exibido (off-by-centavos visível) — numa quantificação de pleito isso mina a defensabilidade do documento que a Etapa 4 promete gerar a partir deste número.
- Proposta: Usar `formatBRLCents` também nas parcelas (L249). A coluna já é `tabular-nums` e right-aligned; a grid `2.4fr 0.8fr 1.3fr 1fr` (css L177) comporta os centavos. Σ parcelas passa a reconciliar visualmente com o TOTAL e com o teto do D.0 ao centavo.

**4. Denominador do % carregado e nunca exibido (valorContratado + fonte)** · `dado-subaproveitado` · impacto 🟡 médio · esforço baixo

- Problema: useDesequilibrio carrega `valorContratado` e `valorContratadoFonte` — cujo doc-comment em deseqContexto.ts L19–20 diz literalmente 'para rotular com honestidade' — mas o hero (L198–207) mostra só "X% do contratado" sem dizer sobre QUAL valor nem de onde ele veio (obra vs PV da curva de faturamento). O D.0 (index.tsx L95–97) já exibe `· R$ 611,4 mi` via formatBRLCompact; aqui o dado morre no hook. De quebra, "do contratado" diverge do vocabulário do D.0 ("do Valor Contratual").
- Proposta: No `gc-quant-sub` do hero: `{formatPct(pctContrato)} do Valor Contratual · {formatBRLCompact(v.valorContratado)}` + sufixo discreto quando `valorContratadoFonte === "faturamento"` (ex.: "(PV da curva)") para rotular o fallback. Uma linha de código, alinha vocabulário e dá ao jurídico o denominador auditável do farol.

**5. Coluna Origem é chip morto — parcela não navega para a tela-fonte** · `navegacao` · impacto 🔴 alto · esforço baixo

- Problema: QuantRow L246–248 renderiza o chip `gc-quant-tela` ("D.1", "D.2", "D.4") como texto estático, enquanto o D.0 (index.tsx L20–27 TELA_DEST + L251–259) já resolve cada D.x para sua rota e renderiza "Ver 3.1 →". Quem prepara o claim precisa auditar cada parcela na tela de origem (Indiretos, BDI, Perda de Produtividade) — hoje o caminho é voltar à Sidebar de memória.
- Proposta: Extrair o mapa TELA_DEST do index.tsx para um módulo compartilhado do M3 (ex.: src/lib/rma ou um deseqNav.ts) e fazer o chip virar `<Link to={/contracts/$id/desequilibrio/{route}}>` com hover/focus-ring; adicionar também um link "Ver Painel D.0 →" no EtapaHead da Quantificação (sub L191 já cita o D.0 sem linkar). Nenhuma informação muda — ela vira navegável e auditável.

**6. Quantificação sem nenhum gráfico — barra de composição 100% empilhada** · `grafico` · impacto 🟡 médio · esforço medio

- Problema: A Etapa 3 é hero + tabela; zero visualização da composição do pleito, enquanto o D.0 tem barras por categoria com tons de magnitude (index.tsx BAR_TONE L29–33: D.4 info, D.2 warning, D.1 ink). O dono pediu 'gráficos mais completos' e esta é a única tela do fluxo sem leitura visual de proporção — o jurídico não vê de relance que o BDI é ~metade do pleito.
- Proposta: Entre o hero e a tabela, uma barra horizontal 100% empilhada em CSS puro (tokens-only, sem lib): um segmento por categoria `comValor` com largura = pctDoTotal, reutilizando os mesmos tons de magnitude do D.0 (compartilhar BAR_TONE junto com TELA_DEST), + legenda inline (dot colorido + categoria + %) logo abaixo, com `title` nativo por segmento como tooltip. Consistente com a barra do D.0, proporcional ao estado da tela, respeita 'Contratado=info/navy' pois é magnitude e não série temporal.

**7. Stepper não comunica prontidão — tudo que não é corrente vira 'upcoming'** · `hierarquia` · impacto 🟡 médio · esforço baixo

- Problema: GCConteudo L87–92 mapeia toda etapa não-corrente para status "upcoming", embora o Stepper do DS suporte "done" (Stepper.tsx StepStatus) com check verde e conector preenchido. Resultado: navegando para a Etapa 4, a Quantificação — a única etapa PRONTA, com dado real — aparece idêntica às pendentes. Além disso os `hintPronto` de 1/2/4 (L25–28: "documentos", "jurídico", ".docx") são dead data: a L90 só usa hintPronto quando `e.n === 3`.
- Proposta: Derivar status por prontidão real: Quantificação → "done" quando não é a etapa corrente (dado do D.0 consolidado), 1/2/4 → "upcoming" com hint "pendente" honesto. Limpar os campos hintPronto/hintPend mortos da constante ETAPAS (fica um `hint` por etapa). O stepper passa a responder de relance 'o que já está pronto pro claim' — que é o JTBD da tela.

**8. Botões e ícones bespoke fora do padrão do refino (DS Button + lucide)** · `consistencia` · impacto ⚪ baixo · esforço baixo

- Problema: gc-gerar-btn (L274–276 + css L246–260) e gc-nav-btn (L288–304) são botões artesanais que reimplementam o que `<Button>` do DS já dá (variants, disabled, focus ring); o ícone de etapa pendente é o glifo `I.shield` (L155, L266) — semanticamente estranho para 'pendente' — e a regra do projeto define lucide como default no refino visual. As duas etapas pendentes usam o MESMO ícone, perdendo escaneabilidade.
- Proposta: Trocar gc-gerar-btn por `<Button variant="primary" disabled>` mantendo o texto "Gerar Claim (.docx) — em breve"; gc-nav por `<Button variant="outline">`/`<Button variant="ink">`. Ícones lucide por etapa no gc-pend-icon/EtapaHead: FolderSearch (Dossiê), Scale (Fundamentação), Calculator (Quantificação), FileText (Documento). Layout idêntico, menos CSS próprio pra manter, dark mode e focus de graça.

**9. Tabela de quantificação sem semântica de tabela (roles ARIA)** · `tabela` · impacto ⚪ baixo · esforço baixo

- Problema: gc-quant-tab (L211–227) é div-grid sem `role="table"/"row"/"columnheader"/"cell"`, enquanto o D.0 na mesma família marca a dq-qtable com roles (index.tsx L308–319). Leitores de tela leem a quantificação do pleito como texto solto — e é justamente a tabela que fundamenta o valor do claim.
- Proposta: Adicionar os mesmos roles do padrão do D.0 no gc-quant-head/row/total-row. Cinco atributos, nenhum pixel muda. (Fora isso a tabela está bem: ordenação desc por valor já é o default sensato, 3–7 linhas não justificam useColecao/paginação — não inventar toolkit aqui.)
