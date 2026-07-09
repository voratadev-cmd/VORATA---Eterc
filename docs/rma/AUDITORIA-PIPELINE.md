# Auditoria do Pipeline de Normalização + Cálculo do RMA

> **Gerada em 04/jun/2026** por duas auditorias multi-agente (84 agentes, verificação adversarial sobre o código e o dado real). Documento de referência da engenharia do motor que roda em **toda obra**. Companion do [DADOS-PENDENTES.md](./DADOS-PENDENTES.md) (este foca em LÓGICA/arquitetura; o outro em DADO/cobertura).

## Veredito

**No caminho certo — com ressalvas.** O pilar do projeto (HONESTIDADE) está implementado como invariante de código, não promessa. Determinismo real (zero LLM no número). Mas há **2 bloqueadores** e o motor **ainda não roda sozinho numa obra nova** (~70% pronto p/ multi-obra).

---

## Como funciona — 3 camadas

Regra transversal: **o modelo de IA nunca calcula um número** — só lê o documento. Todo número vem de código determinístico.

### Camada A — Normalização (Python · `agent/agents/normalizacao/`)

- **Resolvers nomeados** (`resolvers.py`) — funções puras de cálculo. Nada de lógica inline; ou é resolver, ou é config tipada (`config.py`, validada com Pydantic).
- **Gates de conservação** (`gate.py`) — confere que as partes somam o todo (Σ células == Total; Σ% == 100%; pai ≈ Σ filhos) ANTES de gravar. Não fecha → `needs_review` (falha-alto, nunca grava "mais ou menos").
- **Honestidade na origem** — branco ≠ zero; `#REF!` para o processo; lixo (cód 9999/"Teste") excluído; anomalias sinalizadas, não escondidas.

### Camada B — Cálculo (TypeScript puro · `src/lib/rma/`)

- **Réguas de farol** (`farol.ts`) — 9 réguas fixas (Conforme/Observação/Risco/Crítico).
- **Regra-mãe** (`calcIndicadores.ts:117-118`) — Situação Geral só fica verde com cobertura 100% (`COBERTURA_MINIMA_CONSOLIDADO=6`); senão `null` ("Parcial X/6"). Nunca verde com área cega (testado como invariante).
- **Valor real sem régua = farol pendente** — número aparece mas NÃO infla a cobertura.

### Bridge — montagem pra tela (`src/lib/rma/bridge*.ts` + hooks `use*View`)

Nenhum bridge inventa dado; o que falta vira texto "pendente".

### Tela de Normalização (`/contracts/$id/normalizacao`)

Painel de PROVA: cada card é um dataset já normalizado + cobertura das abas. É tela de auditoria, não do cliente.

---

## Estado real das 12 abas (04/jun)

| Estado               | Abas                                                              |
| -------------------- | ----------------------------------------------------------------- |
| **Real** (1)         | Prazo (62%)                                                       |
| **Parcial real** (3) | Faturamento (62%), Visão Geral (52%), Indicadores (28%)           |
| **Mock** (6)         | Recursos, Produtividade, Insumos, Curvas, Condutas, Plano de Ação |
| **Stub vazio** (2)   | Responsabilidade, Panorama                                        |

4 abas tocam dado real; 8 ainda não. "Mock" = tela plausível com dado fictício.

---

## 🔴 Bloqueadores

### B1 · Gate de orçamento falha SILENCIOSAMENTE — ✅ CORRIGIDO (commit b9ccf51)

Era: `engine.py` só setava `out["orcamento"]["status"]`, nunca `out["status"]`; o arquivo era concluído "normalized" com reason=None e o front exibia BDI de orçamento quebrado como válido. **Fix:** `engine._resumo_sub_review` carrega as sub-entidades (orçamento/tarefas) em revisão pro reason/log do arquivo (curva boa não é derrubada, mas o aviso aparece); `OrcamentoCard` gateia em `data.status` (Badge "Em revisão" + banner quando needs_review); read-model com contrato de honestidade explícito. Golden sem regressão; test_sub_review cobre.

### B2 · Auto-routing de Insumos/Produtividade — ✅ CORRIGIDO + VERIFICADO AO VIVO (1487d5a)

Era: `job.py` não roteava insumos/produtividade; populados por scripts ONE-OFF com Sorriso hardcoded → obra #2 caía em "sem config → pulado". **Fix:** `configs.eh_doctype_insumos/produtividade` (matchers por doc_type, fonte única); `job._processar_insumos` (take-off + enriquecimento ABC cross-doc via `buscar_extracao_por_doctype`) e `job._processar_produtividade`; `persist.upsert_produtividade` (faltava). ⚠️ ESPECÍFICO: "por Quantidades" roteia, "por Valor" NÃO (gravaria R$ como qtde) — test_routing trava isso. **Verificado ao vivo** (`process_one` direto no banco): insumos 344 · 1428 meses · 344/344 classe ABC enriquecida NO FLUXO · produtividade 2,3182 kg/Hh com anomalia sinalizada.

---

## 🟠 Riscos ALTOS

**Correção:** ✅ `pct()` agora guarda NaN/Infinity (calcFaturamento + calcPrazo) · ✅ insumos.ts não coerce `null→0` (conta `nSemQtde`) + expõe `status` · ✅ medicoes.ts varre TODOS os BMs pela raiz + `contratadoTotalMotivo` honesto. Pendente: engine.py:218-219 (físico fora de [0,1] só warn, não flipa status).

**Multi-obra:** ✅ raízes orçamento '001'/'003' + edt_raiz parametrizados via config (#4) · ✅ golden multi-obra (denominador zero, curva vazia, meses desordenados, NaN — `calcMultiObra.test.ts`). Pendente: nomes de coluna/meses/regex/descoberta de seção por substring (estender alias_set na obra #2).

---

## 🔴 Qualidade de dado (defesa multi-obra)

O acervo tinha **2 docs de OUTRAS obras** ingeridos: `Anexo PSQ e CFF` = Aeroporto de Sorocaba/SP; `Pluviométrico Maio` = Consórcio Novo Túnel/2022. A honestidade evitou a contaminação (confiança baixa → não auto-normalizados), mas **falta um gate de pertinência** ("este doc é DESTA obra?" — nome/código/valor-global vs contrato) antes de normalizar.

---

## 🟢 Sólido (verificado)

Honestidade sem verde falso · determinismo (zero IA no número) · gates de conservação · guardas de divisão-por-zero (suspeita de bug REFUTADA — está correto) · anomalias sinalizadas · referência financeira honesta do Prazo + guard de coerência >15pp · read-models null-guarded · UPSERT idempotente · golden travando centavos · infra de aliasing pronta (falta estender).

---

## Plano (ordem de ataque)

1. ✅ **B1** — propagar status do gate de orçamento (furo de honestidade ativo). **FEITO** (b9ccf51).
2. ✅ **B2** — auto-routing insumos/produtividade no `job.py`. **FEITO + VERIFICADO AO VIVO** (1487d5a).
3. ✅ **Gate de pertinência de obra** (barrar doc de outra obra). **FEITO** — `gate_pertinencia` (token distintivo da obra × resumo); verificado ao vivo: Anexo de Sorocaba **BARRADO**, docs reais passam. Bloqueia só docs roteados.
4. ✅ **Parametrizar hardcodes** (raízes '001'/'003', edt_raiz) via config. **FEITO** (c5a7747). Colunas já eram alias_set.
5. ✅ **Golden multi-obra + bordas** (NaN guard, null-vs-0, contratadoTotal robusto, golden sintético). **FEITO.**

Pendentes menores: físico fora de [0,1] flipar status; alias_set de colunas/seções a estender quando a obra #2 chegar.

Só depois apontar a obra #2 ao pipeline + normalizar os dados novos achados (Curva ABC por valor, índice INCC, curva física limpa).
