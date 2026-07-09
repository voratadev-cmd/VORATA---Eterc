# Plataforma de Administração Contratual IA

> Doc oficial: [PRODUCT.md](PRODUCT.md) (versão 1.0 · Maio/2026). Este arquivo é o **overview navegável** — síntese curta + índice cruzado para os docs por módulo.

## O que é

Plataforma SaaS para **administração contratual de obras de empreitada** que substitui o trabalho artesanal de consultorias por uma camada de **agentes de IA especializados** operando 24/7. Diagnóstico contratual contínuo, quantificação automatizada de desequilíbrio econômico-financeiro, geração automática de **RMA**, claims, cartas, pareceres.

## Personas

| Persona                           | Foco                                      | Tela de entrada                            |
| --------------------------------- | ----------------------------------------- | ------------------------------------------ |
| **Diretor / Dono** de construtora | Portfólio executivo                       | Dashboard consolidado                      |
| **Gerente de Contrato**           | Operação diária de um ou poucos contratos | RMA mensal do contrato                     |
| **Jurídico**                      | Pleitos, claims, arbitragens              | Painel de Desequilíbrio + Gerador de Claim |

> **Hoje só modelamos visão Diretor.** Permissões por persona ficam pra quando auth chegar.

## Arquitetura macro

**5 módulos verticais** (ciclo de vida do contrato: pré-contrato → execução → desequilíbrio → check-list setorial → finalização) + **4 camadas transversais** (agentes, base de conhecimento, farol, chat).

```
                       Dashboard
                           │
        ┌──────────┬───────┼───────┬──────────┐
       M1         M2      M3      M4         M5
   Pré-Contrato  Gestão  Deseq.  Check-list  Finalização
                  ❤️                SASBY
                CORAÇÃO
        ─────────── Camadas Transversais ───────────
        Agentes IA · Base Conhecimento · Farol · Chat
```

Os módulos **não são sequenciais estritos** — se alimentam mutuamente. M1 gera bases do RMA. M2 produz dados que M3 quantifica. M4 alimenta Cenário Tendente que retroalimenta M2. M5 consolida tudo e gera Lições Aprendidas que melhoram M1 de futuros contratos.

## Índice por módulo / camada

| Doc                                                      | Conteúdo                                                                                                                |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [02-dashboard.md](02-dashboard.md)                       | Tela inicial · KPIs · Mapa · Alertas · Resumo dos Contratos                                                             |
| [03-m1-pre-contrato.md](03-m1-pre-contrato.md)           | Revisão Documental · Bases · Diagnóstico · Transpasse                                                                   |
| [04-m2-gestao-contratual.md](04-m2-gestao-contratual.md) | ❤️ Síntese · **RMA (11 abas)** · Timeline · Mapa Retigráfico · Melhorias · Biblioteca                                   |
| [05-m3-desequilibrio.md](05-m3-desequilibrio.md)         | Indiretos · BDI · Encargos · Valor Agregado · Total Cost · Measured Mile · Insumos · Pontuais · **Gerador de Claim** ⭐ |
| [06-m4-checklist.md](06-m4-checklist.md)                 | Cenário Tendente + 7 engenharias (Mobilização, Orçamento, Qualidade, Planejamento, Medição, Engenharia, Produção)       |
| [07-m5-finalizacao.md](07-m5-finalizacao.md)             | Lições Aprendidas · Negociação de Pleitos · Judicial/Arbitral                                                           |
| [08-camadas-transversais.md](08-camadas-transversais.md) | 8 agentes setoriais + Adm Contratual IA · Base Conhecimento (AACE/IBAPE/Jusbrasil/Orsafáscio/SINAPI) · Farol · Chat     |

## Sistema de Farol (regra de toda análise)

| Nível          | Cor      | Token DS    | Ação                         |
| -------------- | -------- | ----------- | ---------------------------- |
| **Conforme**   | Verde    | `--success` | Nenhuma                      |
| **Observação** | Azul     | `--info`    | Monitorar                    |
| **Risco**      | Amarelo  | `--warning` | Preventiva, registro formal  |
| **Crítico**    | Vermelho | `--danger`  | Pleito, claim, ação imediata |

Critérios numéricos são **configuráveis por contrato**. Detalhes em [08-camadas-transversais.md §9.3](08-camadas-transversais.md#93-sistema-de-farol).

## Estado da implementação

### ✅ Pronto

- Design System completo (30+ primitivos + tokens + showcase em `/design-system`)
- App shell: AppShell + Sidebar (com ContractPicker no topo) + Topbar (busca + "+ Novo" + sino + tema + avatar)
- Tema claro/escuro persistente
- **Dashboard** (`/`) — 5 KPIs · Mapa do Brasil · Alertas IA · Resumo dos Contratos
- **Lista de Obras** (`/contracts`) — KPIs · FilterChips · grid denso
- **M1.1 Revisão Documental** (`/contracts/$id/pre/revisao`)
- Mocks: 12 contratos · 7 alertas · revisão documental completa do "Aeroporto Uberlândia"

### 🟡 Stubs aguardando construção (32 rotas)

Todo o resto do M1, M2 inteiro, M3 inteiro, M4 inteiro, M5 inteiro, Settings.

### ⚪ Não iniciado

- Backend (agentes, RAG, integrações Jusbrasil/Orsafáscio)
- Chat global em todas as telas
- Geração de `.docx` (claims, RMA, transpasses)
- Permissões por persona (auth)

## Roadmap canônico

Ordem oficial de construção (espelha o doc §11 com adaptação ao que já foi feito):

| #   | Bloco                                                             | Estado            |
| --- | ----------------------------------------------------------------- | ----------------- |
| 0   | Design System + App Shell                                         | ✅                |
| 1   | **Dashboard**                                                     | ✅                |
| 2   | **Lista de Obras**                                                | ✅                |
| 3   | **M1.1 Revisão Documental** (prova de conceito de tela de módulo) | ✅                |
| 4   | **M2.1.1 Síntese do Contrato** (entry point)                      | → próximo natural |
| 5   | **M2.1.2 RMA Mensal** (maior bloco, "coração")                    |                   |
| 6   | **M3 Painel de Desequilíbrio** + Gerador de Claim                 |                   |
| 7   | **Agentes Setoriais** (backend)                                   |                   |
| 8   | **M4 Check-list** (depende de #7)                                 |                   |
| 9   | **M1.2-1.4** + **M5**                                             |                   |
| 10  | **APIs** (Jusbrasil, Orsafáscio, RDO digital, e-mail)             |                   |

> Mudança de ordem requer decisão explícita — não re-priorizar tela a tela.

## Vocabulário canônico

A plataforma é **PT-BR único, desktop-first, sem i18n**. Termos do domínio aparecem **literalmente** em UI e código — nada de traduções, abreviações novas ou sinônimos.

Glossário completo: [PRODUCT.md §Glossário](PRODUCT.md). Lista resumida das siglas e expressões que aparecem em tela:

**Siglas:** RMA · BM · BDI · MOD · MOI · EQP · RDO · RNC · TAC · ESG  
**Métodos e conceitos:** Curva S · Valor Agregado (AACE 25R-03) · Total Cost · Measured Mile (Milha Aferida) · Windows Analysis · Take-off · Nexo Causal · Pleito · Claim · Singularidades · Glosa · Frente de Serviço · Caminho Crítico  
**Stakeholders:** Contratante · Contratada · Adm Contratual IA  
**Provedores e normas:** AACE · IBAPE · ABNT · SINAPI · Orsafáscio · Jusbrasil

## Observações arquiteturais

1. **Multi-tenancy inerente** — construtora → contratos → usuários com permissões diferenciadas
2. **Documentos como cidadãos de 1ª classe** — indexação, busca, versionamento; tudo gerado vai pra Biblioteca
3. **IA é o produto, não feature** — quando o backend chegar: orquestração multi-agente + RAG + streaming
4. **Cálculos pesados, mas isolados** — Valor Agregado, Total Cost, Measured Mile, fórmulas paramétricas → podem rodar client-side
5. **Visualizações ricas** — Curva S, gauges, donuts, histogramas (**Recharts** já em deps); mapa usa **d3-geo** (Brasil simplificado)
6. **Farol casa 1:1 com tons da DS** — não inventar tons novos
7. **Geração de `.docx`** — futura skill/lib para Word (cartas, claims, RMAs, transpasses)
8. **Chat com IA em todas as telas** — slot global no app shell quando o backend de IA estiver ativo
9. **CmdK** — passa de "opcional" para "essencial" quando os módulos começarem a ter ações
10. **PT-BR único** — sem i18n; mobile pode vir depois
