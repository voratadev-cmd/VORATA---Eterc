# Fluxo do documento (upload → tela) + Contrato do Template (workbook-motor)

> Como um documento da obra entra no sistema, onde cada parte fica salva, e como montar o XLSX
> pra ele ser extraído 100%. Referência operacional. Companion de [AUDITORIA-PIPELINE.md](./AUDITORIA-PIPELINE.md)
> (lógica do motor) e [DADOS-PENDENTES.md](./DADOS-PENDENTES.md) (cobertura por aba).

## 1. O ciclo de vida — 5 etapas

```
[1] UPLOAD ───► [2] MAPEAMENTO ──► [3] EXTRAÇÃO ──► [4] NORMALIZAÇÃO ──► [5] TELAS
 arquivo cru       IA entende        IA extrai os      código distribui      front lê
 → Storage         o doc inteiro     VALORES (JSON)    pras tabelas obra_*   as tabelas obra_*
 obra_arquivos     obra_arquivo_     obra_arquivo_     obra_insumos,         read-model →
 (status raw)      contextos         extracoes         obra_recursos, …      bridge → aba
```

| #   | Etapa                       | Quem faz                                                 | Onde grava                                                                         | O que produz                                                                                                              |
| --- | --------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Upload**                  | front                                                    | **Supabase Storage** (bucket `rma-docs`) + linha em `obra_arquivos` (`status=raw`) | o **arquivo cru** salvo                                                                                                   |
| 2   | **Mapeamento**              | IA (Claude)                                              | `obra_arquivo_contextos` (`status=mapped`)                                         | "texto-mapa": o que é, onde está cada dado, anomalias. **Não extrai número.** Gate humano em `/contracts/$id/mapeamento`. |
| 3   | **Extração**                | IA + ingestão **determinística**                         | `obra_arquivo_extracoes.payload` (JSON)                                            | o **envelope**: TODAS as seções com os **VALORES** (não fórmulas). BR-101 = 114 seções / 1,26 MB. `status=extracted`.     |
| 4   | **Normalização** (splitter) | **código determinístico** (`agent/agents/normalizacao/`) | tabelas canônicas `obra_*`                                                         | fatias **limpas + conferidas** (gate de conservação). `status=normalized`.                                                |
| 5   | **Telas**                   | front (read-model → bridge → aba)                        | — (só leitura)                                                                     | a aba renderiza o dado de `obra_*`                                                                                        |

## 2. Onde o dado vive (3 cópias, de propósito)

| Lugar                                             | Conteúdo                                   | Para quê                              |
| ------------------------------------------------- | ------------------------------------------ | ------------------------------------- |
| **Storage** (`rma-docs`)                          | o `.xlsx` **cru**                          | auditoria · re-extrair se o doc mudar |
| **`obra_arquivo_extracoes`**                      | o **envelope JSON** completo (tudo do doc) | a "verdade extraída" — nada se perde  |
| **`obra_*`** (`obra_insumos`, `obra_recursos`, …) | as **fatias normalizadas** (conferidas)    | alimentar as telas                    |

**Consequência prática:** uma vez subido e extraído, **TODA a informação já está no banco** (no envelope). Telas que ainda não existem **não perdem nada** — quando forem construídas, só **lêem o que já está salvo**. Você **não re-sobe** o doc por causa de tela nova. Re-sobe só se o **documento mudar** (gera nova `extracao_version`).

## 3. A fronteira inegociável (honestidade)

- **Entender / rotear** ("isto é a Curva ABC → vai pra Insumos") → **IA** (genérico, sem setup por-doc).
- **Ler o NÚMERO** (R$ 26.675.126,93) → **código determinístico** (lê a célula) + **gate de conservação** (confere Σ contra um total declarado).

O modelo **nunca digita um número** — porque um modelo que chuta/lê errado um valor financeiro = **erro de milhões**. Por isso cada _tipo de seção_ tem um **resolver** (leitor seguro) construído **uma vez** e reusado pra sempre.

## 4. "Toda vez que mudar o formato preciso reconstruir?"

| O que muda                         | Precisa de trabalho?                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Mesmo template, outra obra**     | **Não** — os resolvers já feitos auto-preenchem.                                                  |
| **Nome de coluna/seção diferente** | **Quase não** — matching tolerante (`_achar_coluna`/alias); no máximo +1 sinônimo (config).       |
| **Estrutura nova de verdade**      | **Sim, uma vez** — um resolver novo (a IA propõe o mapeamento via `propor.py`; um gate verifica). |

→ **O modelo que escala = TRAVAR um template** e deixar os **dados** variarem dentro dele.

## 5. Contrato do Template (como montar o XLSX pra extrair 100%)

Regras pra cada workbook-motor sair extraível sem atrito (derivadas dos alertas reais do BR-101):

1. **1 tabela lógica por aba/intervalo.** Nada de **2 tabelas empilhadas** na mesma sheet com cabeçalho repetido no meio (vira `needs_review`).
2. **Sem linhas-subtítulo dentro da tabela** ("MÃO DE OBRA DIRETA — 1º TURNO" ocupando só a 1ª coluna). Se precisar agrupar, use uma **coluna** "Grupo", não uma linha-rótulo.
3. **Cabeçalho de coluna estável** (mesmo nome entre versões). Nomes claros: `Qtde contratada`, `Preço orçado (R$)`, `Custo total (R$)`, `Classe`…
4. **Total de controle por bloco** (ex.: `TOTAL custo materiais`). **É o que permite CONFERIR** (gate) — sem ele, o número entra mas não há prova de que está certo. Template **auto-verificável**.
5. **Salvar com os VALORES** (não só fórmulas). Fórmula sem valor em cache vem vazia → o motor sinaliza e pede re-salvar.
6. **"Real" separado de "Previsto"** (como já está). Em obra pré-execução o Real fica vazio (honesto), o farol de execução fica pendente.
7. **Seções com código** (C.1, C.3, C.4, D.x…) no título — ajuda o roteamento.

> Guias **dentro do workbook** (abas "Guia da IA" / "MAPA") **ajudam a etapa de EXTRAÇÃO e o propositor de config** — a IA lê e entende melhor. Mantê-las é bom.

## 6. "Vale criar um doc de TEXTO com instruções pra a NORMALIZAÇÃO?"

**Resposta honesta:** a normalização (etapa 4) é **código determinístico** — ela **não lê prosa** em runtime. Então um `.txt` de instruções **não alimenta o normalizador diretamente**. Mas é útil em **duas formas**:

1. **Como o "contrato" do template** (este documento, §5) — serve de **spec** pra mim/IA construir o resolver de cada seção, e pro **gate** saber qual total conferir. ✅
2. **Embutido no workbook** (as abas "Guia da IA") — aí sim entra na **extração/propositor** (que são IA). ✅

**Não precisa** de um `.txt` separado pra normalização. O que ajuda de verdade: (a) **totais de controle** em cada bloco do XLSX (pro gate), e (b) **estrutura estável** (§5). Isso vale mais que qualquer instrução em prosa, porque vira **verificação automática**, não confiança.

## 7. Estado dos resolvers (a "biblioteca de leitores")

| Seção                        | Tabela                                     | Resolver                                           | Estado                                                                             |
| ---------------------------- | ------------------------------------------ | -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| C.6 Insumos · Curva ABC      | `obra_insumos`                             | `extrair_insumos_curva_abc`                        | ✅ feito + validado live + **aba real**                                            |
| C.4 Recursos (MOD/MOI/EQP)   | `obra_recursos` + `obra_recursos_meses`    | `extrair_recursos` + `extrair_recursos_histograma` | ✅ feito + validado live (BR-101) + **aba real** (catálogo + curva de mobilização) |
| C.3 Faturamento / Cronograma | `obra_faturamento_*` / `obra_cronograma_*` | —                                                  | ⏳ (acende com BM medido ou modo previsto-only)                                    |
| C.1 BDI / Orçamento          | `obra_orcamentos`                          | —                                                  | ⏳                                                                                 |
| C.9 Chuvas · C.14 Mapa · D.x | tabelas novas                              | —                                                  | ⏳                                                                                 |

> Cada linha pronta = mais uma aba que **auto-preenche** em qualquer upload futuro do template. Detalhe da arquitetura do motor em [AUDITORIA-PIPELINE.md](./AUDITORIA-PIPELINE.md); spec por-seção no workflow de spec do splitter.
