# M·Normalização — dos JSONs extraídos para o banco

> **Status: ideia em amadurecimento (mai/2026).** Schema do banco ainda NÃO definido.
> Esta etapa entra **depois da Extração** e é o que de fato **popula o sistema** com os
> dados dos documentos. Importância **EXTREMA** (igual à Extração): se a normalização
> errar, o sistema inteiro opera sobre dado errado.

## Onde encaixa na pipeline

```
Cadastro → Mapeamento → Extração → ★ NORMALIZAÇÃO ★ → (sistema populado)
```

- **Extração** já entrega, por documento, um **envelope JSON fiel** (identificação,
  seções tabela/chave-valor/texto, totais declarados, alertas). É a "fotografia exata"
  do documento — números certos, mas **na forma do documento**, não na forma do sistema.
- **Normalização** pega esses JSONs (que são GIGANTES e heterogêneos — cada tipo de doc
  tem uma estrutura) e **grava nas tabelas do banco** numa forma canônica, consultável,
  que alimenta os módulos (Dashboard, RMA, Desequilíbrio, etc.).

## O que a tela de Normalização faz

Tela em `/contracts/$contractId/normalizacao` (depois da Extração no stepper). Função:

1. **Organizar os dados extraídos** — mostrar o que está pronto pra normalizar (docs com
   extração concluída/`needs_review`) e o estado da normalização de cada um.
2. **Disparar o agente normalizador** — que lê os envelopes e grava no banco.
3. **Conferir/revisar** — antes (ou depois) de gravar, o humano valida o mapeamento
   doc→banco (gate, como nas etapas anteriores).

## O agente Normalizador (a definir)

Um **novo agente** (3º da pipeline, depois do Mapeador e do Extrator). Responsabilidade:

- **Entender a LÓGICA de cada documento** — um BM não é uma Medição não é um Cronograma
  não é um RDO. Cada um tem semântica própria (itens medidos × período, avanço físico ×
  financeiro, efetivo/equipamentos, etc.). O normalizador precisa saber o que cada
  número SIGNIFICA, não só onde ele está.
- **Pegar JSONs gigantes e mapear pro schema** — colapsar a estrutura "forma do
  documento" (seções, colunas com nome do doc) na "forma do banco" (tabelas/colunas
  canônicas, FKs, tipos). Ex.: as 187 linhas de itens de um BM viram N rows numa tabela
  `medicao_itens` ligadas à `medicao`/`obra`; os totais viram colunas agregadas; as séries
  mensais do cronograma viram rows numa tabela de avanço por competência.
- **Resolver vocabulário** — campos com nomes diferentes entre docs (a reconciliação por
  valor da extração já tolera isso) precisam ser mapeados pra UM nome canônico no banco.
- **Falhar alto** — como na extração, se não conseguir mapear com segurança, marca pra
  revisão humana; **nunca grava dado errado no banco** (que é a fonte de verdade do
  sistema). Provavelmente reusa a ideia de reconciliação/sanity.

## Decisões em aberto (amadurecer com o usuário)

1. **Schema do banco** — qual o modelo de dados canônico? (tabelas por tipo de doc? um
   modelo unificado de "medição"/"item"/"avanço"? como ligar obra↔contrato↔medição↔item?)
2. **Granularidade** — normaliza tudo de um doc de uma vez, ou por seção?
3. **Idempotência / reprocessamento** — re-normalizar um doc (após re-extração) atualiza
   ou versiona? Como evitar duplicar dados no banco?
4. **Gate humano** — revisão do mapeamento doc→banco antes de gravar?
5. **Conflitos entre docs** — quando 2 docs trazem o mesmo dado (ex.: total contratual no
   BM e na ART, que divergem na fonte), qual vence no banco? (a extração preserva ambos;
   a normalização precisa de uma regra.)
6. **Onde roda o agente** — mesma infra do extrator (`agent/`, claude-agent-sdk, fila com
   lease)? Provável um novo worker/fase.

## Princípios herdados da Extração (aplicam aqui)

- **Determinístico onde der** — o que dá pra mapear por código (tipos, FKs óbvias) não
  passa pelo modelo.
- **Dado 100% correto > organização > divergência cosmética** (filosofia do usuário,
  ver [[extracao-readiness-review]]).
- **Falha-alto** — incerteza vira `needs_review`, nunca dado silenciosamente errado.

## Estado atual do código

- Tela **scaffold** criada (`normalizacao.tsx`/`.css`) — placeholder premium no padrão do
  DS, com o stepper (Cadastro→Mapeamento→Extração→**Normalização**), o fluxo conceitual
  (JSON → agente → banco), a lista de docs prontos pra normalizar, e o estado "aguardando
  schema". Sem lógica real ainda.
- Agente normalizador: **não existe** ainda.
- Schema do banco normalizado: **não definido** ainda.
