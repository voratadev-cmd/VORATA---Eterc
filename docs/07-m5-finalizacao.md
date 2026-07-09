# Módulo 5 — Finalização do Contrato

> Fonte: [PRODUCT.md §8](PRODUCT.md). Fechamento do contrato e fase pós-execução.

## Propósito

Mesmo após a desmobilização da obra, frequentemente há trabalho:

- **Pleitos pendentes** que ainda estão sendo negociados
- **Distrato** e quitação final
- **Disputas** (arbitragem, judicial)

A plataforma acompanha o cliente até a quitação final. **É a fase em que o investimento se paga de forma mais clara** — o cliente chega ao litígio com material consolidado, fundamentação sólida e quantificação validada (todos produzidos ao longo do M2/M3).

## Onde fica na arquitetura

- **Posição**: pós-execução
- **Inputs**:
  - Tudo o que foi produzido ao longo do contrato (toda a Biblioteca do M2)
  - Claims gerados (M3.10)
  - Análises do M4 (lições por engenharia)
- **Outputs**:
  - **Relatório de Lições Aprendidas** → alimenta a Base de Conhecimento → melhora análises de **M1 (Pré-Contrato) de contratos futuros**
  - Petições iniciais, pareceres, quesitos técnicos (8.3)
- **Agentes**: Adm Contratual IA principal; agentes setoriais consultados pra lições específicas

## Telas e rotas

| Rota                                  | Sub-módulo                    | Estado  |
| ------------------------------------- | ----------------------------- | ------- |
| `/contracts/$id/finalizacao/licoes`   | 5.1 Lições Aprendidas         | ⚪ Stub |
| `/contracts/$id/finalizacao/pleitos`  | 5.2 Negociação de Pleitos     | ⚪ Stub |
| `/contracts/$id/finalizacao/judicial` | 5.3 Análise Judicial/Arbitral | ⚪ Stub |

## 8.1 Relatório de Lições Aprendidas

Documento gerado ao **final do contrato** consolidando tudo:

- O que funcionou bem
- O que não funcionou e por quê
- Riscos que se materializaram **e não estavam mapeados** no pré-contrato
- Premissas que se mostraram corretas ou erradas
- **Recomendações para contratos futuros similares**

> Esse relatório **alimenta a base de conhecimento** da plataforma, melhorando análises de M1 de novos contratos. Ciclo virtuoso.

## 8.2 Negociação de Pleitos

Suporte ao processo de negociação de pleitos pendentes ao final do contrato:

- IA acompanha as tratativas
- Sugere argumentos
- Ajuda a calibrar **valores de proposta** (alto/médio/baixo do M3.10)
- Monitora **prazos de prescrição**

## 8.3 Análise Judicial / Arbitral

Quando o pleito **não é resolvido amigavelmente** e migra pra arbitragem ou judiciário:

- **Geração de petições iniciais**
- Mapeamento da **estratégia jurídica**
- **Indexação de toda a prova documental**
- **Acompanhamento processual**
- Sugestão de **peritos e quesitos técnicos**
- Suporte na elaboração de **pareceres**

> Integração com **Jusbrasil** permite consulta a precedentes específicos. Combinado com a base probatória já indexada durante a execução → entrega no nível "consultor sênior + escritório de advocacia".

## Mocks atuais

- Nenhum.

## Componentes DS usados / a criar

- **Existe**: `Card`, `DataTable` (lista de pleitos, lista de processos), `Badge`, `Tabs`
- **A criar**:
  - **LessonCard** com seções "Funcionou / Não funcionou / Recomendação"
  - **NegotiationTimeline** (estado de cada pleito + prazos de prescrição com alerta)
  - **CaseTracker** pro 5.3 (acompanhamento processual)

## Próximos passos

> Doc é claro: **M5 só depois de M1+M3 prontos** (depende de outputs deles). Prioridade baixa no roadmap.

1. **5.1 Lições Aprendidas** — pode entrar mais cedo porque é só leitura (gerar a partir de mocks de claims fechados)
2. **5.2 Negociação de Pleitos** — quando 3.10 tiver pleitos prontos
3. **5.3 Judicial/Arbitral** — last, depende de Jusbrasil
