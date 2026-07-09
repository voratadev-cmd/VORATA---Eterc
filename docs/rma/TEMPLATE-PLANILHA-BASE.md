# TEMPLATE · Planilha-Base da Obra — mapeamento completo (Fase 1)

> **Objetivo**: especificar a planilha-base padrão que o dono da obra preenche para alimentar o
> motor de extração/normalização — dividida em **PARTE 1 · IMUTÁVEIS** (baseline contratual,
> preenche 1× no onboarding) e **PARTE 2 · MUTÁVEIS** (ciclo mensal, preenche a cada BM).
> Este doc é o MAPA (o quê/onde/granularidade). A geração do `.xlsx` é a Fase 2.
>
> Fontes deste mapeamento (03/jul/2026): rotas do workbook-motor
> (`agent/agents/normalizacao/workbook_motor.py` + resolvers/gates/persist), schema normalizado
> (65 tabelas `obra_*` nas migrations) e o Contrato do Template
> ([FLUXO-UPLOAD-E-TEMPLATE.md](FLUXO-UPLOAD-E-TEMPLATE.md) §5).

---

## 0. Princípios (herdados, inegociáveis)

1. **IA nunca digita número** — código determinístico lê a célula; gate de conservação confere Σ
   contra o total declarado antes de gravar. Por isso **toda aba tem linha TOTAL de controle**.
2. **Derivado NÃO se preenche** — acumulados, %, desvios, aderências, faróis, desequilíbrios
   (D.0–D.11), perdas, curvas derivadas: o motor recomputa TUDO. A planilha só pede **fato**.
3. **Real ≠ Previsto, pendente ≠ zero** — em pré-execução o bloco Real fica **vazio** (nunca 0).
   O motor grava NULL e a tela mostra "pendente" honesto.
4. **Contrato do Template** (FLUXO §5): 1 tabela lógica por aba; sem linha-subtítulo no meio
   (agrupar = coluna "Grupo"); cabeçalho estável; total de controle por bloco; salvar com
   valores (não só fórmulas); código de seção no título.
5. **Compatibilidade com o motor atual**: cada tabela mantém no título o **código de seção**
   (C.1, C.3, C.4… D.x) e as **colunas-âncora** que as ~35 rotas já casam — o template novo é
   drop-in, sem rota nova. A organização IMUTÁVEL/MUTÁVEL é dos **blocos de abas** (prefixo
   `I-`/`M-` + cor de aba), não dos títulos das tabelas.
6. **Abas meta embutidas**: `Guia da IA` + `MAPA` (grafo "lê de / alimenta") — o gate de
   cobertura (`guia_contrato.py`) usa o Guia como lista autoritativa de abas atômicas.

---

## PARTE 1 · IMUTÁVEIS — baseline contratual (preenche 1×)

> Mudam apenas por **aditivo/TAC** (aí é revisão de baseline, com nova versão do arquivo —
> nunca edição silenciosa).

| #        | Aba proposta                                  | Granularidade                                                     | Colunas de entrada (o que o humano digita)                                                                                                                                                                                                                                                                                                               | Alimenta (tabela → tela)                                                                                                                                                                     | Gate                                                                   |
| -------- | --------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **I-01** | **Identificação do Contrato**                 | chave-valor (1 col campo, 1 col valor)                            | nome interno · objeto · contratante · contratada · modalidade · cidade/UF · **valor contratual PV c/ BDI** · custo direto · custo indireto · receita · data assinatura · OS original · OS real · início · término contratual · prazo (meses) · índice de reajuste (INCC/IPCA…) · periodicidade · data-base da proposta · gestor da obra · adm contratual | `obras` + `obra_orcamentos` → cadastro, C.1, header de tudo                                                                                                                                  | PV = CD + markup (âncora C.1)                                          |
| **I-02** | **PQ — Planilha de Quantidades (C.0)**        | por item-folha da EAP                                             | nº item · código · descrição · unidade · **qtd contratada** · custo unit · custo total · preço venda unit (c/ BDI) · **disciplina** · **frente/trecho** · grupo                                                                                                                                                                                          | `obra_orcamento_itens` → C.0, Curva ABC, VA, rollups por disciplina/frente                                                                                                                   | Σ custo == custo total do contrato; valor == qtd × preço linha a linha |
| **I-03** | **Composição do BDI (C.1)**                   | por rubrica                                                       | rubrica · % sobre receita · % sobre custo direto · valor R$ · é subtotal? · **flag "rubrica de tempo"** (p/ D.2)                                                                                                                                                                                                                                         | `obra_bdi_rubricas` + `obra_bdi_rubrica_tempo` → C.1, D.2                                                                                                                                    | CD implícito constante; CD+markup ≈ PV                                 |
| **I-04** | **Encargos Sociais (D.3)**                    | por alíquota (grupos A/B/C/D)                                     | grupo · alíquota · % · base de incidência                                                                                                                                                                                                                                                                                                                | hoje `obra_secoes` (JSONB) → D.3 ⚠️ ver Decisão 4                                                                                                                                            | Σ grupos == total declarado                                            |
| **I-05** | **CPUs — Composições (C.7/D.4)**              | por CPU (~558)                                                    | código CPU · serviço · unidade · tipo · custo direto unit · MOD R$/un · EQP R$/un · %MOD · %EQP · %MAT                                                                                                                                                                                                                                                   | `obra_cpu_coeficientes` → C.7 física, D.4 VA                                                                                                                                                 | MOD+EQP ≤ CD                                                           |
| **I-06** | **Cronograma fís-fin contratado (C.3/C.5)**   | 2 blocos: (a) por mês · (b) disciplina × mês                      | (a) mês · % físico previsto · R$ previsto no mês — (b) matriz disciplina × mês (R$ e % físico acum)                                                                                                                                                                                                                                                      | `obra_cronograma_meses` + `obra_faturamento_meses.contratado` + `obra_faturamento_disciplina_mes` + `obra_cronograma_frente_mes` + `obra_avanco_fisico_disciplina_mes` → C.3, C.5, C.8, C.14 | Σ % == 100; Σ R$ == PV; Σ matriz[mês] == curva[mês]                    |
| **I-07** | **Cronograma de tarefas / Gantt (C.13)**      | por tarefa                                                        | nº · nome · **coluna Grupo** (trecho) · duração (dias) · data início · data término · é marco?                                                                                                                                                                                                                                                           | `obra_cronograma_tarefas` → C.13, C.5                                                                                                                                                        | datas coerentes (término ≥ início)                                     |
| **I-08** | **Marcos contratuais (C.5)**                  | por marco (~24)                                                   | categoria · trecho · marco · data-limite                                                                                                                                                                                                                                                                                                                 | `obra_prazo_marcos` → C.5                                                                                                                                                                    | —                                                                      |
| **I-09** | **Recursos contratados (C.4/D.1)**            | 2 blocos: (a) catálogo por recurso · (b) histograma recurso × mês | (a) categoria MOD/MOI/EQP · função/equipamento · qtd contratada · custo unit mensal · jornada — (b) qtd prevista por mês                                                                                                                                                                                                                                 | `obra_recursos` + `obra_recursos_meses` (contratado) + `obra_indiretos_itens` (Adm Local = 29 grupos MOI: qtd contr, custo contr) → C.4, D.1, D.3                                            | Σ itens == totais por categoria; per-recurso × histograma cross-check  |
| **I-10** | **Insumos FD — baseline (C.6/D.5)**           | 2 blocos: (a) por insumo (30) · (b) insumo × fonte de índice      | (a) nome · unidade · classe ABC · categoria · ordem PQ · qtd PQ · preço unit c/ BDI — (b) fonte (SINAPI/DNIT/ANP/SBC/EMOP/SCO) · rótulo · código · tipo (índice/preço) · **valor na data da OS** · recomendada ★                                                                                                                                         | `obra_insumos_fd` + `obra_insumos_fd_fontes.valor_os` → C.6, D.5                                                                                                                             | Σ valor contrato == FD da PQ ("✓ bate com a PQ")                       |
| **I-11** | **Parâmetros de reajuste/reequilíbrio (D.5)** | chave-valor + série                                               | datas (OS · proposta · assinatura · aniversário · verificação) · número-índice do índice contratual nas datas-base (cenários M1)                                                                                                                                                                                                                         | `obra_insumos_reeq` + `obra_ipca_serie` (cenários) → D.5 M1                                                                                                                                  | saldo = contrato cheio − medido (derivado)                             |
| **I-12** | **Mapa da obra (C.14)**                       | por segmento + por elemento pontual                               | (a) segmento: código · nome · tipo · km início · km fim · valor contratado · mês liberação prevista — (b) elemento: tipo (OAE/dispositivo/talude) · nome · km · estaca · valor                                                                                                                                                                           | `obra_mapa_segmentos` + `obra_mapa_elementos` → C.14, C.8                                                                                                                                    | geometria contígua sem buraco/sobreposição; Σ == PV físico             |
| **I-13** | **Baseline de chuvas (C.9/D.6)**              | por mês                                                           | chuva prevista mm (média histórica) · dias >5mm previstos                                                                                                                                                                                                                                                                                                | `obra_chuvas_meses` (prev) + `obra_pontuais_chuva_mensal.prev_5mm` → C.9, D.6                                                                                                                | acum ≈ Σ mensal                                                        |
| **I-14** | **Parâmetros da obra (config)**               | chave-valor                                                       | meta R$/HH · jornadas MOD/MOI (h/mês) · benchmarks de produtividade · jornada dia (h) · custo-hora MOD · custo-hora EQP · réguas de farol custom (se houver)                                                                                                                                                                                             | `obra_produtividade_params` (baseline) + `obra_pontuais_params` + `obras.farol_regras` → C.7, D.6, faróis                                                                                    | —                                                                      |
| **I-15** | **Guia da IA + MAPA** (abas meta)             | lista de abas                                                     | aba · classificação (atômica/derivada/meta) · "lê de" · "alimenta"                                                                                                                                                                                                                                                                                       | `guia_contrato.py` → gate de cobertura                                                                                                                                                       | cobertura X/N atômicas                                                 |

---

## PARTE 2 · MUTÁVEIS — ciclo mensal (preenche a cada BM)

> Regra de ouro do ciclo: **medição entra item a item (M-02); o motor deriva o resto**.
> Nunca digitar de novo o que é rollup de outra aba.

| #        | Aba proposta                               | Granularidade                                     | Colunas de entrada                                                                                                                                                                          | Alimenta (tabela → tela)                                                                                                                                                                 | Gate                                                     |
| -------- | ------------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **M-00** | **Capa do ciclo**                          | chave-valor                                       | BM nº · competência (mês/ano) · data de corte                                                                                                                                               | `obra_medicoes` header + `bm_corrente` de todos os domínios                                                                                                                              | corte único e consistente                                |
| **M-01** | **Medição do período — BM (C.3)**          | por item da PQ medido                             | nº item (FK da I-02) · **qtd medida no período** · glosa (se houver)                                                                                                                        | `obra_medicao_itens` → faturamento real, avanço físico, `obra_valor_agregado_servico.qtd_medida` (D.4), `obra_insumos_fd.qtd_medida` (C.6/D.5)                                           | Σ período == total declarado do BM; qtd acum recomputada |
| **M-02** | **Faturamento real do mês (C.3)**          | por mês (+ por disciplina/frente se medido assim) | R$ faturado no mês · R$ real por disciplina · R$ real por frente                                                                                                                            | `obra_faturamento_meses.real_rs` + `obra_faturamento_serie_mes.real_rs` → C.3 Curva S ⚠️ ver Decisão 1                                                                                   | Σ real == card real acum do BM                           |
| **M-03** | **Recursos reais do mês (C.4/D.1/C.7)**    | por recurso × mês                                 | qtd real · custo real no mês · **HH real** (MOD/MOI)                                                                                                                                        | `obra_recursos_meses` (real) + `obra_recursos` (real acum) + `obra_produtividade_economica.hh_real` + `obra_indiretos_itens` (Adm Local real: qtd real, custo real) → C.4, C.7, D.1, D.3 | cross per-recurso × histograma                           |
| **M-04** | **Avanço físico real (C.5/C.13)**          | por disciplina × mês + por tarefa + por marco     | % físico real acum por disciplina · por tarefa: data início real · data término real · % concluído · por marco: % concluído                                                                 | `obra_cronograma_frente_mes.real_pct` + `obra_cronograma_tarefas` (eixo real) + `obra_prazo_marcos.pct_concluido` → C.5, C.13                                                            | monotônico; físico oficial == BM                         |
| **M-05** | **Chuvas do mês (C.9/D.6)**                | por mês (+ por dia se RDO)                        | chuva real mm · dias >5mm reais · dias parados · [diário: data · mm · efetivo em campo]                                                                                                     | `obra_chuvas_meses` (real) + `obra_pontuais_chuva_dia` → C.9, D.6 ⚠️ ver Decisão 3                                                                                                       | excedente = real − baseline                              |
| **M-06** | **Eventos & impedimentos (C.13/D.6/C.14)** | por evento (cadastro incremental, nunca apaga)    | título · categoria (chuva/impedimento/paralisação/pleito) · data início · data fim · frente/trecho/km · dias · MOD afetado · EQP afetado · crítico? · cláusulas · fonte (RDO/ata/CE/ofício) | `obra_eventos_prazo` + `obra_pontuais_evento` → C.13, D.6, Windows Analysis                                                                                                              | MOD+EQP == perda por evento (recomputada)                |
| **M-07** | **Liberação de frentes (C.14/C.8)**        | por segmento                                      | mês liberação real · impedimento início · impedimento fim · causa                                                                                                                           | `obra_mapa_segmentos` (eixo real) → C.14, C.8 liberado                                                                                                                                   | derivabilidade status/lib/imp ao centavo                 |
| **M-08** | **Índices do mês (C.6/D.5)**               | por fonte de índice + índice contratual           | número-índice contratual do mês (IPCA/INCC) · **valor atual de cada fonte** (DNIT/SINAPI/ANP/SBC/EMOP/SCO) na data de verificação                                                           | `obra_ipca_serie` + `obra_insumos_fd_fontes.valor_atual` → C.6, D.5 (Δ% e excedente derivados)                                                                                           | Δ% == atual/OS − 1                                       |
| **M-09** | **Custos pagos (opcional — gap #5)**       | por insumo/NF                                     | insumo · NF · data · preço real pago unit                                                                                                                                                   | `obra_insumos.preco_real_pago_unit` → C.6 preço real, C.7 custo real                                                                                                                     | —                                                        |

---

## O que NUNCA entra na planilha (o motor deriva)

Acumulados e running sums · déficit/desvio/Δ · aderência/% · faróis e status · curvas C.8
derivadas (capacidade/gaps) · **todo o Painel de Desequilíbrio D.0–D.11** (indiretos, BDI deseq,
encargos deseq, VA/perda, insumos excedente, pontuais R$, cascata) · produtividade R$/HH ·
projeções e forecast · contadores/cards · sínteses de IA · condutas · KPIs. Motivo documentado:
os 3 erros reais do BR-101 em colunas derivadas da fonte (`Prev. acum` dobrado, Déficit por
frente, contadores da Biblioteca) — ver [AUDITORIA-EXTRACAO-139-SECOES.md](AUDITORIA-EXTRACAO-139-SECOES.md).

## Zona cinzenta (imutável-com-revisão)

- **OS real** — imutável depois de emitida, mas só existe após o onboarding (campo em I-01,
  pode chegar vazio e ser preenchido 1×).
- **Aditivos/TAC** — mudam PV, prazo, PQ: tratados como **nova versão do baseline** (re-upload
  da PARTE 1 com changelog), nunca edição do ciclo mensal.
- **Cenários M1 de data-base** (I-11) — fixos por contrato, mas o número-índice ATUAL do mês é
  mutável (M-08).

## Decisões (batidas pelo dono em 03/jul/2026)

1. **Real do faturamento: só via BM item a item** — a aba de faturamento real digitado foi
   ELIMINADA; o motor deriva os rollups (mês/disciplina/frente) do BM × PQ.
2. **Histograma real por recurso × mês** (formato longo) — alimenta D.1 por grupo e D.3.
3. **Chuva diária (RDO)**: aba presente na v1, marcada opcional.
4. **Encargos D.3**: ganha tabela própria + rota no motor quando a planilha entrar em produção
   (aba I-04 já nasce estruturada pra isso).
5. **Nomenclatura `I-nn`/`M-nn`** aprovada; código de seção C.x/D.x mantido no título interno.

## Layout final do `BASE-PADRAO-v1.xlsx` (Fase 2 · gerado)

**Gerador reproduzível**: `scripts/planilha-base/gerar_base_padrao.py` →
`docs/rma/templates/BASE-PADRAO-v1.xlsx`. **35 abas** = 3 meta (cinza) + **19 imutáveis** (azul) +
13 mutáveis (verde). Regra "1 tabela lógica por aba" respeitada — por isso o mapa I-01..I-15
do §PARTE 1 virou 19 abas (blocos separados) e M-00..M-09 virou 13.

### Revisão adversarial (03/jul/2026) — 8 fixes aplicados e re-verificados

O requisito "base alimentada durante o andamento da obra" expôs 6 problemas reais na 1ª geração,
todos corrigidos e re-auditados (script de verificação reabre o arquivo e confere):

1. **M-02 sem coluna de BM (CRÍTICO)** — o mês 2 sobrescreveria o mês 1. Agora: `BM nº` na
   primeira coluna, 2.000 linhas, ciclos ACUMULAM (regra 9 do LEIA-ME: nunca apagar ciclo).
2. **Faltava o previsto por Frente×Mês (GAP)** — sem baseline, C.8 curvas por frente e o
   recorte por frente da C.3 ficariam órfãos. Nova aba **I-19** (matriz wide, Σ == PV).
3. **M-12 sobrescreveria o histórico de índices** — virou série append por competência
   (Competência × Insumo × Fonte × Valor), preservando a evolução p/ os gráficos da C.6.
4. **M-01 era chave-valor** (perderia o histórico de cortes) — virou tabela 1-linha-por-BM com
   **"Valor total medido no período — declarado"**, a âncora do gate de conservação da M-02.
5. **TOTAIS ingênuos em I-03 BDI / I-04 Encargos** — `SUM()` dupla-contaria subtotais e
   incidências entre grupos. Trocados por **TOTAL DECLARADO** manual (o motor confere Σ das
   linhas não-subtotal contra ele).
6. **Nomes de aba sem acento ≠ Guia da IA** (11 divergências) — o gate de cobertura via Guia
   falharia. Normalizados; verificação agora exige guia ≡ nomes reais.
7. M-05/M-06 ganharam **competência do registro** (proveniência do snapshot); I-11 ganhou
   **custo-hora produtivo/improdutivo (EQP)** p/ D.6/C.4 detalhe.
8. LEIA-ME: regras 9–11 (ciclos acumulam · % no formato do Excel · inserir linhas dentro do
   intervalo do TOTAL).

**Limitação deliberada da v1 (documentada, não é gap)**: equip-horas e dias de serviço POR
SERVIÇO (C.7 física detalhe) exigem apontamento de RDO por serviço — fase 2, consistente com
a decisão da C.9 diária. A C.7 física fica pendente-honesta até lá.

### Revisão de generalização "todas as obras" (03/jul/2026) — 5 fixes

A 3ª passada, com a lente "serve para QUALQUER obra?", pegou o template calibrado demais na
BR-101 (rodovia linear). Corrigido e re-auditado verde (com suite de regressão da revisão 2):

1. **Vocabulário travado em rodovia** — disciplinas/tipos de segmento eram dropdown fixo.
   Agora a aba LISTAS é declaradamente **da obra** (edita/estende para edificação, saneamento,
   aeroporto…; rodovia é o exemplo pré-carregado) e os ranges dos dropdowns têm **+24 linhas de
   folga** para listas estendidas.
2. **Guia da IA ganhou coluna "Aplicável?"** (Sim/Não) — obra marca Não nas abas que não valem
   pro seu tipo (ex.: mapa por km em obra não-linear; chuva diária sem RDO) e o gate de
   cobertura ignora, sem pendência falsa. ⚠️ requer o `guia_contrato.py` ler a coluna quando o
   template entrar em produção (junto das variantes de resolver já previstas).
3. **Capacidades subdimensionadas** — o Gantt tinha 150 linhas e a PRÓPRIA BR-101 tem 424
   tarefas. Novos limites: PQ 1.500 · CPUs 1.000 · Gantt 600 · Medição 6.000 · Recursos reais
   3.000 · físico real 1.200 · diário 2.000 (≈60 meses) · fontes 300 · índices 2.000 ·
   custos pagos 1.000. (Regra 11 do LEIA-ME cobre além disso.)
4. **Obra não-linear**: I-15 instruída — 1 linha por frente física com km em branco.
5. **Obra >60 meses**: LEIA-ME instrui inserir colunas ANTES da última coluna de mês (o
   TOTAL linha expande sozinho).

| Bloco     | Abas                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| META      | `LEIA-ME` · `Guia da IA` (lista autoritativa p/ gate de cobertura) · `LISTAS` (fontes dos dropdowns)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| IMUTÁVEIS | I-01 Identificação · I-02 PQ (cols Disciplina/Frente/Grupo/**Insumo FD?** — insumos FD derivam daqui, sem aba própria) · I-03 BDI (col Rubrica de tempo?, TOTAL DECLARADO) · I-04 Encargos (TOTAL DECLARADO) · I-05 CPUs · I-06 Curva Prevista mensal · I-07 Previsto R$ Disc x Mês (wide 1..60) · I-08 Previsto %Físico Disc x Mês (wide) · **I-19 Previsto R$ Frente x Mês** (wide · baseline C.8/C.3 por frente) · I-09 Gantt Tarefas · I-10 Marcos · I-11 Recursos Contratados (col Grupo Adm Local → D.1 deriva; custo-hora produtivo/improdutivo EQP) · I-12 Histograma Contratado (wide qtd; R$ deriva de qtd×custo unit) · I-13 Fontes de Índice (valor na OS) · I-14 Reequilíbrio Params · I-15 Mapa Segmentos · I-16 Mapa Elementos · I-17 Chuvas Baseline · I-18 Parâmetros da Obra |
| MUTÁVEIS  | M-01 Capa do Ciclo (**tabela 1-linha-por-BM** + total declarado do período) · M-02 Medição BM (**BM nº** × item × qtd período · acumula) · M-03 Recursos Reais (longo: mês×recurso, qtd/HH/R$) · M-04 Avanço Físico Real (longo: mês×disciplina % acum) · M-05 Gantt Real (datas reais + % por tarefa + competência) · M-06 Marcos Real (+ competência) · M-07 Chuvas do Mês · M-08 Chuva Diária RDO (opcional) · M-09 Eventos & Impedimentos (incremental) · M-10 Liberação de Frentes · M-11 Série Índice Contratual (append · seed histórico + cenários M1) · M-12 Índices dos Insumos (**append por competência** — série p/ gráficos) · M-13 Custos Pagos (opcional)                                                                                                                      |

**Nota de compatibilidade (honesta)**: os títulos internos carregam os códigos C.x/D.x e as
colunas-âncora, mas alguns resolvers atuais esperam o shape exato do workbook BR-101 (ex.: a
curva C.3 exige coluna Real, que neste template deriva do BM). Na entrada em produção da
planilha-base, prever uma **passada leve de variantes de resolver** (mesmos gates) + a tabela
própria do D.3 (decisão 4). O template também introduz granularidade NOVA (recursos reais por
recurso×mês — decisão 2) que hoje o banco agrega por categoria: motor agrega até a migration
dedicada existir.
