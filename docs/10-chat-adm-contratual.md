> **Status:** blueprint de arquitetura (aprovação do dono pendente) · 2026-06-15
> **Decisão:** chat Adm Contratual IA via tool-calling sobre os read-models normalizados.
> Escopo v1: quantitativo + documental (cláusulas). Worker local com ANTHROPIC key.
> Companion de [08-camadas-transversais.md](08-camadas-transversais.md) §9.4. Gerado por análise multi-agente do código real.

All anchor files exist. The evidence is internally consistent and well-sourced. Writing the blueprint now.

# BLUEPRINT EXECUTÁVEL — Chat Adm Contratual IA (tool-calling)

**Para aprovação do dono antes de codar.** Arquitetura decidida: **agente com ferramentas** sobre os read-models normalizados (NÃO despejar fatos no prompt). Escopo v1: quantitativo + documental. Worker local com `ANTHROPIC` key.

> **Regra-mãe (inviolável):** a IA NUNCA lê/calcula/inventa número. Cada ferramenta lê o dado já conservado pelos gates da Camada A/B (ao centavo) e devolve. A IA só **orquestra** (escolhe tools) e **explica**. Erro num valor = milhões.

---

## 1) TOOLBOX — todas as ferramentas

**Convenção:** `R` = tool de **RESUMO/headline** (1 call, número-âncora). `D` = tool de **DETALHE** (drill por mês/frente/disciplina/item). `DOC` = documental.
Todas leem o **estado VIGENTE** das tabelas `obra_*` (persist por vigência; re-upload substitui, delete remove → tool live sempre vê o atual). Todas devolvem **PENDENTE como NULL, nunca 0**, e carregam proveniência (`bm_corte`, `arquivo_id`/tabela/seção).

### Domínio: Faturamento (`src/lib/supabase/*.ts` → portar a leitura p/ Python)

| Tipo  | Tool                             | O que responde                                                                                                                                         | Fonte (read-model · file:line)                                        | Proveniência                                                                                 |
| ----- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **R** | `get_faturamento_resumo`         | "Como está o faturamento? Quanto já foi faturado? Saldo? Farol?" — contratado, realizado, avanço financeiro %, aderência vs previsto, desvio pp, farol | `medicoes.ts:47` + `faturamentoCurva.ts:47,55` + `contexto.py:65-105` | BM de corte + tabela canônica; contratado cita item-raiz '1'                                 |
| **D** | `get_faturamento_curva_mensal`   | "Curva S mês a mês; forecast do trimestre; gap real vs plano"                                                                                          | `faturamentoCurva.ts:55`                                              | `obra_faturamento_curvas/meses` + mês de corte; `tipo_projecao` distingue realizado×forecast |
| **D** | `get_faturamento_por_frente`     | "Qual frente concentra mais valor / está mais avançada" (C.3)                                                                                          | `faturamentoFrentes.ts:34`                                            | `obra_faturamento_frentes` + caderno C.3                                                     |
| **D** | `get_faturamento_frente_trecho`  | "Dentro da frente X, qual trecho atrasou" (drill 2D)                                                                                                   | `faturamentoFrenteTrecho.ts:49`                                       | `obra_faturamento_frente_trecho` + seção SaaS A171:I242                                      |
| **D** | `get_faturamento_por_disciplina` | "Qual disciplina pesa mais / distribuição no tempo" (matriz disc×mês)                                                                                  | `faturamentoDisciplinaMes.ts:69`                                      | `obra_faturamento_disciplina_mes` + seção SaaS A114:L157                                     |

> **Precedência crítica (não duplicar):** `realizadoAcumDe` (`faturamentoCurva.ts:47-52`) — medições (cadeia de BMs · fluxo Sorriso) **vencem** sobre Real-direto-da-curva (workbook-motor). `get_faturamento_resumo` deve devolver `fonte_realizado` p/ rastreabilidade (sem isso 4 hooks já divergiram).
> **Cross-check natural entre tools:** 4 tools devolvem o mesmo **PV** por caminhos diferentes (resumo→`contratado_total`, curva→`custo_total`, frentes→`soma_contratado_total`, disciplina→`total_previsto`). A IA pode confrontar sem recalcular.
> **Honestidade estrutural:** 3 das 5 têm `real_pendente=true` como estado normal (BR-101: 20,5M medido mas não alocado por frente; frente×trecho e disciplina×mês têm real como input do RDO). Reais vêm NULL.

### Domínio: Prazo / Cronograma

| Tipo  | Tool                          | O que responde                                                                                                                | Fonte (file:line)                              | Nota dura                                                                                                                                                |
| ----- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R** | `get_prazo_resumo`            | "A obra está atrasada? Quanto? Quanto do prazo decorreu?" — datas, decorrido/restante, físico previsto×real, atraso pp, farol | `cronograma.ts:45` + `calcPrazo.ts` (Camada B) | farol físico SÓ físico×físico E só se previsto físico×financeiro coerentes (gap ≤15pp, `LIMITE_COERENCIA_PREVISTO_PP`); senão `farol_fisico=NULL`+motivo |
| **D** | `get_curva_prevista_fisica`   | "Curva S física mês a mês; em que mês atinge 50%"                                                                             | `cronograma.ts:45`                             | expõe `soma_pct≈1,0` e `status='ok'` (gate Σ%==100%)                                                                                                     |
| **D** | `get_curva_fisica_por_frente` | "Quais frentes puxam/atrasam a curva; quando Estrutura conclui" (matriz C.5)                                                  | `cronogramaFrenteMes.ts:35`                    | cada frente normaliza ao próprio escopo (`fim_pct≈1,0`) — **proibido somar % entre frentes**                                                             |
| **D** | `get_marcos_contratuais`      | "Quais marcos / datas-limite; algum em Risco/Crítico"                                                                         | `prazoMarcos.ts:20`                            | `obra_prazo_marcos`; `pct_concluido` é input por BM, farol só com leitura                                                                                |
| **D** | `get_marcos_cronograma_fonte` | "Término planejado pelo MS Project; marcos do cronograma-fonte"                                                               | `cronograma.ts:153`                            | `termino_planejado` = MAIOR `data_termino` da EDT, não o header                                                                                          |

> **Decisão de implementação aberta (importante):** `get_prazo_resumo` NÃO é leitura de tabela única — depende da Camada B (`calcPrazo.ts`) que hoje roda **no front**. Duas opções honestas: (a) reimplementar `calcPrazo` em Python (risco de divergir centavo/regra — caro de manter); **(b) materializar o snapshot de prazo no corte** numa tabela `obra_*` durante o persist, e a tool só LÊ. **A regra-mãe favorece (b)** — ver Fase 2/Riscos. As outras 4 tools de prazo são leitura direta e já obedecem.
> **Gap de proveniência:** não há proveniência granular por linha (qual arquivo/seção originou cada mês/marco) — só por BM-corte e nome-de-fonte (FF/MS Project/C.5). Citar arquivo+página por marco exige enriquecer `obra_cronograma_meses`/`obra_prazo_marcos` no persist (gap a registrar, não fabricar).

### Domínio: Recursos / Produtividade

| Tipo  | Tool                                 | O que responde                                                              | Fonte (file:line)                                             | Nota dura                                                                                                                                   |
| ----- | ------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **R** | `get_recursos_resumo`                | "Quantos homens·mês contratados? Pico de mobilização? Já mobilizamos real?" | `recursos.ts:116`                                             | total por categoria SEMPRE do **histograma** (Σ `obra_recursos_meses`), não da lista por função (parcial → `catalogoParcial`+`ressalvas[]`) |
| **D** | `get_recursos_por_categoria`         | "Quais funções compõem MOI; equipamentos e custo"                           | `recursos.ts:116` (filtrar `.itens`)                          | reportar `catalogoQtde` junto de `contratadoQtde`; nunca a soma da lista como total quando parcial                                          |
| **D** | `get_recursos_mobilizacao_mensal`    | "Efetivo mês a mês; mês de pico; até onde medimos real"                     | `recursos.ts:215-224`                                         | real cortado no último mês medido; `realQtde=null` (PENDENTE≠0, `recursos.ts:81`)                                                           |
| **R** | `get_produtividade_fisica`           | "kg de aço por homem-hora; aço consolidado; índice de perda"                | `produtividade.ts:28`                                         | `kg/Hh` **recomputada** Σaço/Σperson-h (NÃO a média aritmética errada do dashboard XLSX); `perdaAnomalia=true` se perda >100%               |
| **R** | `get_produtividade_economica_resumo` | "HH previsto×real; aderência HH; R$/HH"                                     | `produtividadeEconomica.ts:44` (+ `produtividade.tsx:96-100`) | **distinção que vale milhões:** card ADERÊNCIA HH = HH real÷previsto-dos-meses-medidos ≠ coluna `aderencia` (R$/HH real÷contratado)         |
| **D** | `get_produtividade_economica_mensal` | "R$/HH mês a mês; meses em que HH rendeu mais que contratado"               | `produtividadeEconomica.ts:72-81`                             | coluna `aderencia` = índice **econômico**, rotular como tal                                                                                 |

> **Distinção a virar nota no system prompt:** existem TRÊS "produtividades" — (1) FÍSICA kg/Hh, (2) ECONÔMICA R$/HH, (3) o índice `aderencia` (R$/HH real÷contratado) que NÃO é o card "ADERÊNCIA HH". Uma tool jamais devolve um valor com o rótulo do outro.
> Produtividade FÍSICA **não tem detalhe mensal** exposto hoje (`obra_produtividade_meses` existe mas `getProdutividade` só conta `nMeses`) — série física por mês = 7ª tool futura.

### Domínio: Econômico / Desequilíbrio (M3 · painel D.0)

| Tipo            | Tool                          | O que responde                                                                          | Fonte (file:line)     | Nota dura                                                                                                |
| --------------- | ----------------------------- | --------------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------- |
| **R**           | `get_desequilibrio_resumo`    | "Desequilíbrio total apurado; composição D.1..D.8 com %" — **âncora de cross-check**    | `desequilibrio.ts:30` | `obra_desequilibrio` é a ÂNCORA D.0; cada D.x reconcilia ao centavo                                      |
| **D** (recorte) | `get_desequilibrio_categoria` | "Quanto vem de Indiretos (D.1)? % sobre contratado?" — 2 denominadores (total D.0 e PV) | `deseqContexto.ts:29` | `valorContratadoFonte` ('obra'/'faturamento'); `existeCategoria` distingue 'a abrir' de 'inexistente'    |
| **D**           | `get_indiretos_detalhe`       | "Composição dos indiretos (mensal×redução×extensão); 4 métodos; defensabilidade"        | `indiretos.ts:36`     | método `ativo=true` é a referência; `status='needs_review'` = número não confiável                       |
| **D**           | `get_bdi_buildup`             | "Composição do BDI contratual; markup total sem subtotais"                              | `bdi.ts:35`           | **markup ≠ desequilíbrio do BDI (D.2)** — p/ deseq do BDI usar `get_desequilibrio_categoria(tela='D.2')` |
| **R**           | `get_orcamento_resumo`        | "Preço-venda, BDI, custo direto/indireto; gate Σ-itens fechou?"                         | `orcamento.ts:33`     | REGRA DURA: gatear em `status` antes de exibir; `needs_review` = não confiável                           |

> **Mapa D.x:** D.1=Indiretos · D.2=BDI · D.3=Encargos · D.4=Valor Agregado · D.5=Insumos · D.6=Eventos Pontuais · D.8=Pleitos Pontuais.
> **Dívidas a comunicar se perguntado:** D.2 (deseq do BDI) **não tem memória detalhada reconciliável** — vive só no D.0 (`bdi.ts:1-5`). D.3 Encargos / D.4 Valor Agregado são cobertos pelo headline via `get_desequilibrio_categoria` (detalhe próprio vive em outros read-models não mapeados aqui).

### Domínio: Curvas / Mapa (C.8 · C.14)

| Tipo  | Tool                        | O que responde                                                         | Fonte (file:line)           | Nota dura                                                                                         |
| ----- | --------------------------- | ---------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------- |
| **R** | `get_curvas_resumo`         | "Onde está o gargalo: liberação, capacidade ou alocação? Maior gap?"   | `curvasC8.ts:27`            | pcts no banco são fração 0..1; UI multiplica ×100 (`curvasC8.ts:42`) — declarar convenção na tool |
| **D** | `get_curvas_por_frente`     | "Qual frente concentra o gargalo / responsabilidade preliminar"        | `curvasC8.ts:66`            | `responsabilidade` = classificação **preliminar**, citar como tal                                 |
| **D** | `get_curvas_serie_mensal`   | "Executado acumulado mês a mês; onde o real parou"                     | `curvasSerieMes.ts:35`      | `capacidade/executado` NULL p/ mês > `bm_corrente` (carry cortado)                                |
| **R** | `get_mapa_liberacao_resumo` | "Quanto liberado×impedido em R$; faixa de km; segmentos não iniciados" | `mapaSegmentos.ts:52,92-96` | Σ duplicação == Contratado Total (gate explícito)                                                 |
| **D** | `get_mapa_segmentos`        | "Qual trecho/km está parado e por quê"                                 | `mapaSegmentos.ts:52`       | `causaImpedimento` = declarado pela obra; `impedMesFim=null` = janela aberta, não 0               |

> **Cross-checks confirmados:** `executado_acum` (C.8) == faturamento real medido; Σ duplicação (mapa) == Contratado Total (C.3); C.8 == C.3 mês a mês.

### Domínio: Insumos (take-off + Curva ABC + excedente 8.8 · D.5)

| Tipo  | Tool                             | O que responde                                                                    | Fonte (file:line)                                    | Nota dura                                                                                                       |
| ----- | -------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **R** | `get_insumos_resumo`             | "Quantos insumos; valor orçado; quem concentra 80%; take-off confiável?"          | `insumos.ts:73`                                      | `valor` é REFERÊNCIA (conf 0,600, ~7% divergência), **não preço pago**; `qtde/valor==0 literal → NULL` (lacuna) |
| **D** | `get_insumos_curva_abc`          | "Top-N por valor; item mais caro; quanto na classe A"                             | `insumos.ts:73` (campo `curvaAbcValor`)              | rotular orçado/referência; só entram itens com valor>0                                                          |
| **D** | `get_insumo_distribuicao_mensal` | "Em que mês consome mais X; pico de demanda física"                               | lê `obra_insumo_meses` direto (sem read-model `.ts`) | **auto-gate:** recomputar Σ meses == `qtde_total` antes de devolver; citar unidade                              |
| **R** | `get_insumo_excedente_resumo`    | "Quanto faturar de excedente ao IPCA (8.8)? Maior estouro?"                       | `insumoExcedente.ts:55`                              | reframe: até o IPCA = risco da Contratada (6.2.2); só o excedente (Δ%−teto)⁺ é faturável (8.8)                  |
| **D** | `get_insumo_excedente_detalhe`   | "Quais insumos estouraram o teto; índice que prova; algum a favor do contratante" | `insumoExcedente.ts:55`                              | Δ R$ é sobre qtde ORÇADA; efetivo usa qtde da NF (input futuro); `indice_pendente=true → derivados NULL`        |

> **Unidades NUNCA somam entre si** (KG/M3/H/%) — qualquer tool que devolve qtde cita a unidade.

### Domínio: Transversais (chuvas C.9 · condutas C.11 · panorama C.10 · sínteses IA)

| Tipo          | Tool                      | O que responde                                                                        | Fonte (file:line)                         | Nota dura                                                                            |
| ------------- | ------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------ |
| **R**         | `get_chuvas_resumo`       | "Quanto a chuva impediu; frentes não iniciadas; sinistro principal; tem real medido?" | `chuvas.ts:31,72`                         | `eixo_real_vazio=true` = chuva real pendente, não 0                                  |
| **D**         | `get_chuvas_serie_mensal` | "Mês de maior chuva; prev×real acumulada; dias parados"                               | `chuvas.ts:73-77`                         | `chuva_real/dias_parados` NULL nos meses não medidos                                 |
| **coleção**   | `get_condutas`            | "Quais ações a IA sugere e com base em qual cláusula; prioridade alta em aberto"      | `condutas.ts:27,36`                       | `clausula` é **referência** ("12.3"), não teor; `[]` = não normalizado               |
| **R**         | `get_panorama`            | "Farol consolidado; quais dimensões em risco; % áreas liberadas"                      | `panorama.ts:62`                          | consolidado SÓ confiável com cobertura completa; `n_avaliados<6` → dizer o que falta |
| **R (texto)** | `get_diagnostico_ia`      | "Panorama em palavras; pontos de atenção; recomendação"                               | `sinteses.ts` (lente `diagnostico_geral`) | **TEXTO interpretativo, não número**; `needs_review` = citou número não-ancorado     |
| **D (texto)** | `get_sintese_lente`       | "O que a IA escreveu na análise de faturamento/recursos"                              | `sinteses.ts:43-44`                       | número NUNCA sai daqui — vem das tools quantitativas                                 |

> **Separação número×texto (estrutural):** chuvas/condutas/panorama = tools de DADO (conservado pelos gates). `get_diagnostico_ia`/`get_sintese_lente` = TEXTO já ancorado na geração (`fatos_hash` registra qual versão dos fatos gerou — `sinteses_ia.sql:11`). Texto JAMAIS é fonte de número.

### Domínio: Documental (cláusulas)

| Tipo    | Tool                                      | Estado                       | Fonte                                               | Nota                                                                                                              |
| ------- | ----------------------------------------- | ---------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **DOC** | `buscar_secoes(obra_id, termo?, codigo?)` | ✅ **DISPONÍVEL HOJE**       | `obra_secoes` (já populada, `obra_secoes.sql:9-31`) | devolve células VERBATIM do JSONB (não soma); filtro `tem_dado=True`; lista vazia → instrução de dizer "pendente" |
| **DOC** | `buscar_clausula(obra_id, termo)`         | ❌ **PRECISA INGESTÃO NOVA** | `obra_clausulas` (tabela a criar)                   | devolve TEXTO LITERAL entre `«»` + número + página; nunca paráfrase                                               |

> **Bloqueio único e honesto:** o teor literal de cláusulas **nunca foi ingerido**. Ver §3.

### overview_obra (a 1ª tool, sempre)

| Tipo  | Tool                     | Função                                                                                      | Fonte                                                                                                  |
| ----- | ------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **R** | `overview_obra(obra_id)` | mapa barato: nome, índice de reajuste, BM-corte, e **quais dimensões têm dado vs pendente** | `obras` + flags de cobertura (`obra_secoes`); é o conteúdo do `«DATA_CONTEXT»` (`contexto.py:166,211`) |

**Total: ~35 tools** (12 R · 17 D · 4 texto · 2 DOC, com overview contado em R). Padrão de implementação único: funções Python sobre Supabase (service_role no worker local), expostas via `create_sdk_mcp_server` espelhando `agent/agents/extracao/doc_tools.py:380-601` (`@tool(nome, desc, schema)` → `_txt(...)`/`_err(...)`). **NÃO reimplementar a matemática** — portar a leitura/agregação dos `.ts` (Σ ignora null, preserva null por mês) ou o número diverge da tela.

---

## 2) ESTRATÉGIA DE CONTEXTO EM 2 NÍVEIS + ORQUESTRAÇÃO

### Nível 1 — Overview barato (sempre, grátis)

`overview_obra` (= `build_data_context`/`«DATA_CONTEXT»`, `contexto.py:166`) entra no system prompt como **mapa**, não como fonte completa de números. Traz: nome da obra, `indice_reajuste`+`periodicidade_reajuste` (`contexto.py:179-181`), último BM-corte, e o **inventário de cobertura** (quais dimensões têm dado vs pendente, `contexto.py:211`). Custo fixo, baixo. **Reposiciona** o que hoje é "única fonte" (persona STUB despeja tudo) para "mapa que escolhe a ferramenta certa".

### Nível 2 — Tools on-demand (caro, só o necessário)

Os números detalhados vêm das tools R/D. O agente chama **uma tool por dimensão**, só as que a pergunta exige.

### Protocolo de orquestração (no system prompt, §5)

1. **Sempre começar pelo overview.** Se a pergunta é respondível só com ele (ex.: "qual o índice de reajuste?"), responder citando proveniência e **PARAR**.
2. **Qualquer número específico → tool de RESUMO da dimensão.** Headline numa call.
3. **Drill ("qual trecho da frente X atrasou") → tool de DETALHE** com param (`frente?`/`disciplina?`/`ano?`/`mes?`/`categoria?`) — filtra sem trazer a matriz inteira (BR-101 = 12 disc × 46 meses).
4. **Cláusulas/texto → tool DOCUMENTAL** (`buscar_secoes` hoje; `buscar_clausula` pós-ingestão).
5. **Não chamar tool de dimensão que o overview já marcou pendente** "só pra conferir" — dizer pendente.
6. **Não chamar tools redundantes.** Se nenhuma cobre, dizer o que TEM e o que está fora do escopo normalizado.

`max_turns` sobe de 6 (`agent.py:47`, suficiente só p/ texto) para **~12** (tool-calling em cadeia precisa de turnos).

---

## 3) CAMADA DOCUMENTAL (cláusulas)

### Dá pra fazer JÁ

- **`buscar_secoes` sobre `obra_secoes`** (já populada, `obra_secoes.sql:9-31`; vigência por delete-before-insert `persist.py:711`). Responde perguntas estruturais ancoradas em planilha ("tabela de faturamento por trecho/indiretos/curva"). Devolve `colunas`+`dados` literais do JSONB — número já conservado pelos gates.
- **Metadado de reajuste:** "qual o índice de reajuste?" → `obras.indice_reajuste`+`periodicidade_reajuste`, já exposto em `contexto.py:179-181`.

### Precisa de INGESTÃO NOVA (honesto: o teor de cláusula não está em banco)

`obra_secoes` **não contém texto de contrato**: a fonte é o XLSX-motor (abas C.x/D.x/B.x), e `capturar_secoes` (`resolvers.py:2320-2348`) **descarta** seções só-`conteudo` (`tem_dado = bool(linhas) or bool(kv)`, `resolvers.py:2338-2340`). O envelope **suporta** `tipo='texto'`/`conteudo` (`envelope.py:62,91-94`), mas hoje texto narrativo não sobrevive. `obra_condutas.clausula` (`condutas.sql:14`) é **referência** ("Cláusula 12.3"), não teor. `obra_arquivos` não guarda `full_text`. Não há doc-type "Contrato" em `doc_schemas.py:22-78` (8 doc-types, nenhum jurídico).

**Viabilização mínima de `buscar_clausula` (3 peças):**

1. **Doc-type "Contrato"** no envelope/`doc_schemas.py`: quando o arquivo é contrato/edital (DOCX/PDF), extrair com `tipo='texto'`/`conteudo` = transcrição literal por cláusula (`ler_docx`/`ler_pdf_paginas` já leem — `doc_tools.py:557,425`).
2. **Tabela `obra_clausulas`** (nova migration): `contrato_id, arquivo_id, extracao_version, numero ("12.3"), titulo, texto (verbatim), pagina`, vigência por delete-before-insert (igual `upsert_secoes`).
3. **Persister próprio** `upsert_clausulas` — não passar pelo filtro `tem_dado` (que descarta texto, `resolvers.py:2339`).

A tool devolve **verbatim entre `«»`** (nunca paráfrase) + número + página + `arquivo_id`. Lista vazia → negar, não inventar.

**Fase 2 opcional — busca semântica:** "quais cláusulas suportam pleito por chuvas?" pode não bater por termo literal ("condições climáticas adversas"). pgvector sobre `obra_clausulas.texto` (embedding por cláusula na ingestão) → match semântico, **continua devolvendo texto verbatim**. Sem pgvector, `ilike`/`text_search` PT-BR cobre o v1.

---

## 4) ANTI-FABRICAÇÃO + PROVENIÊNCIA + ROBUSTEZ A MUDANÇA

### Anti-fabricação (por construção)

- **Número nasce do SQL da tool** (campo conservado pelos gates Camada A/B, ao centavo), não do modelo. O modelo só escolhe a tool e narra.
- **PENDENTE ≠ 0:** toda tool devolve `null`→"pendente" (igual `contexto.py:55`: campos ausentes ficam de fora, nunca 0). Eixo real só existe até o BM-corte; depois é pendente.
- **FALHA ALTO vs NULL:** erro de leitura (RLS/timeout) **lança exceção**; `null` significa exclusivamente "não normalizado". Preservar a distinção no Python (re-raise no erro, `{disponivel:false}` no null) — `desequilibrio.ts:38`, `indiretos.ts:52`, `bdi.ts:41`, `orcamento.ts:41`.
- **Rede de segurança existente:** `validar_ancoragem` (`validador.py:74`) roda sobre a resposta final contra a UNIÃO de (fatos do overview + retornos das tools); todo R$/% que não casa é sinalizado (mesmo gate das sínteses, `sintese.py:96`). **Um número só vira resposta/insight se veio de uma tool** — raspar do texto do modelo é proibido por construção.
- **`status='needs_review'` propaga:** qualquer tool cujo gate não fechou avisa "em revisão, não citar ao centavo" antes do número.

### Proveniência (citável sempre)

Toda tool inclui no retorno um bloco `_proveniencia { bm_corte, arquivo_id, extracao_version, tabela/seção }`. Recomendação: as tools Python fazem um `SELECT` um pouco mais largo que o read-model `.ts` (que hoje não expõe `arquivo_id`/`extracao_version` no shape). O system prompt **obriga** a citar (ex.: "(BM-04 · `obra_medicao_totais`)").

### Robustez a mudança — VIGÊNCIA + `fatos_hash`

- **Vigência:** todas as `obra_*` têm UNIQUE por (contrato, arquivo, extracao_version) e os read-models leem a latest (`created_at desc limit 1`, `faturamentoCurva.ts:59`). Tool live SEMPRE vê o VIGENTE — re-upload de um BM novo muda o corte **sem código novo**; delete remove. Nenhuma tool filtra versão manualmente.
- **`fatos_hash` por resposta:** cada resposta-IA grava em `metadata.fatos_hash` o hash da UNIÃO dos retornos de tools que a fundamentaram (espelhando `sinteses_ia.sql:11`). Isso torna a resposta **auditável e reproduzível**: se a obra for re-extraída, o hash muda e expõe que a resposta antiga falava de um estado anterior. Trilha de auditoria = `{fatos_hash, modelo, tools_chamadas, bm_corte}`.

---

## 5) WIRING DO FRONT (UI não muda) + PERSONA

### 3 contratos congelados

1. **Banco** (`20260601000002_adm_chat.sql`): `adm_messages(id, conversation_id, role∈{user,ai}, content, streaming, metadata jsonb, created_at)` + `adm_conversations(id, visitor_id, obra_id, title, last_message_at)`. Realtime ligado (`:60-61`); **anon SÓ lê** (`:53,:56`), escrita só service_role.
2. **HTTP** (`schemas.py:11-33`): `POST /api/agents/adm/ask` body `{visitor_id, message, conversation_id?, obra_id?}` → `{conversation_id, message_id, status}`. Auth = `Authorization: Bearer <VPS_SECRET>` (`auth.py:21`).
3. **UI** (`chat.ts:15-34`): `ChatMessage{id,role,content,ts,thinking?,insights?}` + `ChatThread`. **Não muda** — o adaptador mora no hook.

### Diff de wiring (componentes de render intactos)

| Camada | Arquivo                                          | Mudança                                                                                                                                               |
| ------ | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Front  | `src/env.d.ts:7`                                 | descomentar `ImportMetaEnv` + `VITE_API_URL`, `VITE_ADM_BEARER`                                                                                       |
| Front  | `src/lib/agent/admChat.ts` (novo)                | `admAsk()` POST (falha alto em `!r.ok`)                                                                                                               |
| Front  | `src/lib/supabase/admChat.ts` (novo)             | `getAdmConversations(visitorId,obraId)`, `getAdmMessages(convId)` (padrão `prazoMarcos.ts:20-36`)                                                     |
| Front  | `src/lib/hooks/useAdmChat.ts` (novo)             | **substitui `useGeracaoMock`** (`chat.tsx:37-122`); POST + Realtime + adaptadores `rowToChatMessage`/`convToThread`                                   |
| Front  | `src/routes/_app/contracts/$contractId/chat.tsx` | troca `useGeracaoMock`+`seedThreads`+`gerarResposta` pelo hook; **render intacto**                                                                    |
| Front  | `src/lib/mocks/chat.ts`                          | mantém tipos/`uid`/`tituloDaPergunta`/`coletarInsights`/`SUGESTOES`; remove `gerarResposta`/`seedThreads`/`RESPOSTAS` quando o real estabilizar       |
| Back   | `agent/.../agent.py:47`                          | passar `mcp_servers={"admtools": build_adm_tools_server(obra_id)}` + `allowed_tools=["mcp__admtools__*"]` (hoje `[]`) — padrão `extractor.py:134-142` |
| Back   | `agent/.../tools.py` (novo)                      | as ~35 tools via `create_sdk_mcp_server` (padrão `doc_tools.py:587`)                                                                                  |
| Back   | `agent/.../service.py`                           | acumular `thinking` (eventos `agent.py:63-64`, hoje descartados); coletar tool-results → `metadata.insights`+`thinking_trace`+`fatos_hash`            |
| Back   | `agent/.../persona.py:13`                        | STUB → persona real (abaixo)                                                                                                                          |

**Fluxo:** `enviar` insere user-msg otimista → `admAsk()` → adota `conversation_id` retornado → Realtime em `adm_messages` (modelo `useObraRealtime.ts`: `.channel().on("postgres_changes", {filter:"conversation_id=eq..."})`) → `applyRow` faz upsert por `id` (cada UPDATE de `content` durante stream é a fonte, **sem `setInterval`**). Bootstrap de histórico via `getAdmMessages` antes de assinar (anon tem SELECT).

**Mapeamentos puros (a UI não percebe):**

- `adm_messages → ChatMessage`: `role 'ai'→'agent'` (DB usa `ai`, UI usa `agent`); `created_at→ts` (epoch); `metadata.status` → fase (`thinking`/`streaming`/`done`); `metadata.thinking_trace→thinking.trace`; `metadata.insights[]→insights`.
- **`insights[]` saem dos RETORNOS DAS TOOLS, não do texto** (`{label, valor, tom, proveniencia:{bm,fonte,obra_id}}`). `tom` mapeia 1:1 o farol já calculado (`conforme/observacao/risco/critico → success/info/warning/danger`, espelhando `InsightTom` em `chat.ts:10`). A UI mostra só `label`+`valor`+`dot` (`chat.tsx:464-467`); proveniência viaja no metadata p/ tooltip futuro **sem mudar o tipo `Insight`**.
- `adm_conversations → ChatThread`: `obra_id→contractId`; `title` null → `tituloDaPergunta` (`chat.ts:284`); `coletarInsights` (`chat.ts:274`) **continua igual**.

**Segredo (decisão aberta):** `VITE_ADM_BEARER` em `.env.local` é **dev-only**. No go-live, mover `/ask` para trás de uma Edge/Vercel function que injeta o `VPS_SECRET` server-side — o Bearer não deve ir no bundle do front.

### PERSONA (esboço do system prompt)

`persona.py:13` hoje injeta TODOS os fatos via `«DATA_CONTEXT»` (`service.py:96`). Inverte para "orquestre tools; o overview é só mapa barato".

```
# PAPEL
Você é o "Adm Contratual IA", administrador contratual SÊNIOR de obras de empreitada (PT-BR).
Um diretor conversa sobre UMA obra. Você INTERPRETA e EXPLICA; NUNCA lê, calcula ou
inventa número — os números vêm SEMPRE do retorno de uma ferramenta determinística.

# REGRAS DURAS (honestidade = tudo · erro num valor = milhões)
1. NUNCA escreva R$, %, data, prazo, quantidade ou cláusula sem tê-lo obtido de uma TOOL
   nesta conversa. Proibido "estimo/cerca de/aproximadamente".
2. SEMPRE cite a PROVENIÊNCIA: qual BM (corte), qual tabela/read-model, ou qual doc/cláusula.
3. PENDENTE é PENDENTE. null/"a medir" → "pendente" + o que falta. NUNCA preencha com 0.
   Eixo "real" só existe até o BM medido; após o corte é pendente, não zero.
4. NÃO confunda avanço FINANCEIRO (% do contrato faturado) com ADERÊNCIA (real vs previsto).
   NÃO confunda as 3 produtividades (física kg/Hh · econômica R$/HH · índice aderência).
5. Vocabulário canônico sem tradução: RMA, BM, BDI, MOD/MOI/EQP, RDO, TAC, Curva S, Valor
   Agregado, Measured Mile, Windows Analysis, Nexo Causal, Pleito, Claim, Glosa, Contratante/Contratada.
6. Farol = 4 níveis FIXOS (Conforme·Observação·Risco·Crítico); use o que a tool retornar.
7. PT-BR executivo. Não prometa ações de outros módulos (gerar carta/claim) — ofereça encaminhar.

# PROTOCOLO (barato → caro · só o necessário)
- Passo 1: comece pelo OVERVIEW abaixo. Respondível só com ele → responda (com proveniência) e PARE.
- Passo 2: qualquer número → tool de RESUMO da dimensão.
- Passo 3: drill ("qual trecho atrasou") → tool de DETALHE com param.
- Passo 4: cláusula/texto → tool DOCUMENTAL.
- Não chame tool de dimensão que o overview marcou pendente. Não chame tools redundantes.
- Nenhuma tool cobre → diga o que TEM e o que está fora do escopo normalizado.

# FORMATO
Conclusão primeiro (diretor é executivo). Depois números, cada um com proveniência.
Markdown leve. Número-chave já virou "Dado-chave" via retorno da tool — não repita como lista artificial.

# OVERVIEW BARATO (mapa · NÃO é a fonte completa de números)
«DATA_CONTEXT»
```

---

## 6) PLANO EM FASES + RISCOS

### Fase 0 — Tools quantitativas de RESUMO + wiring mínimo (entrega o chat real)

1. `agent/.../tools.py`: implementar `overview_obra` + as ~12 tools de **RESUMO** (1 por dimensão), portando a leitura dos read-models `.ts`. Padrão `doc_tools.py:587`.
2. Ligar no `agent.py:47` (`mcp_servers`+`allowed_tools`, `max_turns`→12).
3. `service.py`: acumular `thinking`, coletar tool-results → `metadata.{insights,thinking_trace,fatos_hash}`.
4. `persona.py`: persona real.
5. Front: `env.d.ts`, `admChat.ts`, `admChat.ts` (supabase), `useAdmChat.ts`, plugar no `chat.tsx`.
6. **Passo de validação local:** subir worker com `ANTHROPIC` key, `VITE_ADM_BEARER` em `.env.local`, perguntar headline de cada dimensão numa das 2 obras com dado (`fe288319` BR-101 workbook-motor · `5dd81834` Sorriso multi-doc) e conferir cada número/proveniência contra a tela do RMA. `validar_ancoragem` deve passar limpo.

**Dependência:** nada além do que existe. **Maior valor com menor esforço.** `buscar_secoes` (documental disponível) cabe aqui também.

### Fase 1 — Tools de DETALHE (drill)

As ~17 tools `D` (curva mensal, frente×trecho, disciplina×mês, mobilização mensal, marcos, curva ABC, excedente detalhe, série mensal de curvas/chuvas) + `get_diagnostico_ia`/`get_sintese_lente`. **Depende de Fase 0** (padrão de tool + coleta de insights provados).

### Fase 2 — Snapshot de prazo materializado + Documental novo

1. **Materializar `calcPrazo` no persist** (decisão recomendada (b)): tabela `obra_prazo_snapshot` gravada na normalização → `get_prazo_resumo` só LÊ (a regra-mãe proíbe recalcular na hora da pergunta). **Bloqueia o `get_prazo_resumo` confiável** — até lá, responder prazo só com `get_marcos_*` (leitura direta).
2. **Ingestão de cláusulas:** doc-type "Contrato" (`doc_schemas.py`) + migration `obra_clausulas` + `upsert_clausulas` + tool `buscar_clausula`. **Depende** de decidir o formato de transcrição por cláusula.

### Fase 3 — Robustez & semântica

1. pgvector sobre `obra_clausulas.texto` (busca semântica de cláusula).
2. Enriquecer proveniência granular de prazo (origem por linha em `obra_cronograma_meses`/`obra_prazo_marcos`).
3. Tooltip de proveniência na UI (sem mudar o tipo `Insight` — já viaja no metadata).
4. Edge function p/ injetar `VPS_SECRET` server-side (tirar Bearer do front).

### RISCOS / DECISÕES ABERTAS (precisam do dono)

1. **`calcPrazo` em Python vs materializar (Fase 2.1).** Reimplementar = risco de divergir centavo/regra com o front (caro de manter); materializar = mais trabalho no persist mas obedece a regra-mãe. **Recomendo materializar.** Até decidir, `get_prazo_resumo` fica adiado.
2. **Paridade número-a-número TS↔Python.** Se a leitura/agregação Python divergir do `.ts`, o número do chat ≠ número da tela. Mitigação: portar a lógica exata (Σ ignora null, precedências), e o `fatos_hash`+`validar_ancoragem` como rede.
3. **Bearer no front (dev-only).** Aceitável no MVP local; **inseguro em prod** — Edge function é pré-requisito de go-live.
4. **Ingestão de cláusulas é a única lacuna real do escopo documental.** Sem ela, "o que o contrato DIZ sobre X" só responde no nível de metadado. Decidir se entra no v1 ou fica para v1.1.
5. **D.2 (deseq do BDI) sem memória reconciliável** e **produtividade física sem detalhe mensal** — lacunas conhecidas a comunicar, não fabricar.
6. **anon SÓ lê `adm_messages`** (`:53`) — toda escrita passa pelo worker (service_role). Se o front quiser "fixar/excluir thread" persistido, precisa de endpoint novo; no MVP, fixar pode ser client-only.

**Arquivos-âncora:** front → `src/routes/_app/contracts/$contractId/chat.tsx`, `src/lib/mocks/chat.ts:15-34`, `src/env.d.ts:7`, novos `useAdmChat.ts`/`admChat.ts`×2 (padrão `prazoMarcos.ts:20` + `useObraRealtime.ts`). Back → `agent/agents/adm_contratual/{persona.py:13, service.py:93-124, agent.py:42-50, contexto.py:166, validador.py:74}`, novo `tools.py` (padrão `doc_tools.py:380-601` + `extractor.py:134-142`). Schema → `20260601000002_adm_chat.sql`, `20260607000003_obra_secoes.sql`, futura `obra_clausulas` + `obra_prazo_snapshot`. Read-models quantitativos → `src/lib/supabase/*.ts` (a portar p/ Python).
