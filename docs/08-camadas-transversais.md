# Camadas Transversais

> Fonte: [PRODUCT.md §9](PRODUCT.md). Quatro camadas que atravessam todos os módulos verticais e dão à plataforma sua inteligência e consistência.

## 9.1 Camada de Agentes de IA

A plataforma é estruturada em torno de **agentes especializados**.

### 9.1.1 Agentes Setoriais (8 agentes)

Operam principalmente no **Módulo 4 (Check-list)**, mas alimentam todos os outros módulos:

| Agente                                     | Setor                                                   | Atua principalmente em             |
| ------------------------------------------ | ------------------------------------------------------- | ---------------------------------- |
| **Mobilização, Canteiro e Desmobilização** | Estado da mobilização inicial, canteiro, desmobilização | M4.2                               |
| **Orçamento e Bases do Negócio**           | Premissas, produtividades, preços, BDI                  | M1.2 + M4.3                        |
| **Qualidade e Segurança**                  | RNCs, conformidade, ESG                                 | M4.4                               |
| **Planejamento**                           | Cronograma, Windows Analysis, prazo justificável        | M4.5 → alimenta M2.5.3.5 e M3      |
| **Medição**                                | BMs, glosas, preços novos                               | M4.6 → alimenta M2.5.3.2 e M3      |
| **Engenharia (Projetos)**                  | Lista mestra, take-off, extra-escopo                    | M4.7 → alimenta M2.5.3.10 e M2.5.5 |
| **Processo de Produção**                   | MOD/MOI/EQP, produtividade, RDOs                        | M4.8 → alimenta M2.5.3.3, M2.5.3.4 |
| **Cenário Tendente** ⭐                    | Síntese transversal — projeta futuro do contrato        | M4.1 (alimentado pelos outros 7)   |

Cada agente tem **conhecimento técnico aprofundado** da sua área, **vocabulário próprio** do setor, **normas aplicáveis** e padrões de análise. Operam **24/7**, processando documentos conforme chegam e atualizando indicadores em tempo real.

### 9.1.2 Adm Contratual IA (agente sênior)

Agente **transversal** — o "consultor sênior" da plataforma. **Orquestra** os agentes setoriais, sintetiza análises, produz **entregáveis estratégicos**:

- **RMA mensal** (M2.5.3)
- **Singularidades** (varreduras setoriais completas)
- **Claims consolidados** (M3.10)
- **Diagnósticos pré-contrato** (M1.3)
- **Cartas, pareceres, análises de cláusula** (M2.5.3.10)
- **Atende ao chat** com o usuário (9.4)

> Treinado com expertise equivalente a **+200 mil horas** de prática em administração contratual. Combina conhecimento técnico (engenharia, normas AACE/IBAPE) e jurídico (direito contratual, jurisprudência arbitral e judicial brasileira).

## 9.2 Camada de Base de Conhecimento e Integrações

Alimenta todos os agentes. Quanto mais rica essa base, mais precisas e fundamentadas as análises.

### 9.2.1 Conteúdo da Base

| Categoria                        | Fontes                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Normas técnicas**              | AACE Recommended Practices (especialmente **25R-03** sobre Earned Value), normas **IBAPE/SP**, normas **ABNT** aplicáveis |
| **Jurisprudência**               | Integração com **Jusbrasil** (decisões judiciais e arbitrais)                                                             |
| **Documentos do cliente**        | Contratos, projetos, planilhas, RDOs, atas, cartas, e-mails, fotos                                                        |
| **Preços e produtividade**       | Integração API com **Orsafáscio** (sugerida), bases **SINAPI**, **dissídios sindicais**                                   |
| **Banco de contratos similares** | Pra benchmarking e comparação geográfica                                                                                  |

### 9.2.2 Ingestão de dados

**Hoje (MVP)**: upload manual de documentos e planilhas tratadas.

**Roadmap (Etapa 7)**: integrações via API com:

- **E-mails da obra** (importação automática de correspondência)
- **Sistemas de RDO digital** usados pelas construtoras
- **Repositórios de projetos** (GreenDocs e similares)
- **Sistemas contábeis** e de gestão de obra

## 9.3 Sistema de Farol

Aplicado a **todos os indicadores** onde for relevante. 4 níveis com cores padronizadas e ações correspondentes:

| Nível          | Cor      | Token DS                     | Significado          | Ação esperada                                                 |
| -------------- | -------- | ---------------------------- | -------------------- | ------------------------------------------------------------- |
| **Conforme**   | Verde    | `--success` / `--success-bg` | Sem desvio relevante | Nenhuma                                                       |
| **Observação** | Azul     | `--info` / `--info-bg`       | Desvio leve          | Monitorar. Registros adequados em RDO/ata                     |
| **Risco**      | Amarelo  | `--warning` / `--warning-bg` | Desvio relevante     | Ação preventiva/registro. Cartas, atas formais, plano de ação |
| **Crítico**    | Vermelho | `--danger` / `--danger-bg`   | Desvio grave         | Ação imediata. Início de pleito, claim, comunicação formal    |

**Critérios numéricos são configuráveis por contrato** — alguns contratos toleram mais desvio que outros. Configuração futura em Settings.

> **Tudo no Design System já está alinhado.** O `<Badge tone="success|info|warning|danger">` casa 1:1. Não inventar tons novos.

### Regra dura para implementação

- **Todo indicador numérico com tendência ganha farol.**
- Nunca usar cor solta (`#xxx`, `red`, etc.). Sempre `var(--token)` ou utility Tailwind correspondente.
- Quando um cálculo é só informativo (não tem desvio relativo), não forçar farol — usar `--text-2` neutro.

## 9.4 Chat com Adm Contratual IA

**Disponível em todas as telas, sempre acessível.** O usuário pode perguntar livremente.

### Exemplos de perguntas (do doc)

- "Por que o setor de Medição está em atenção?"
- "Quais cláusulas do contrato suportam um pleito de prorrogação por chuvas?"
- "Gera uma carta cobrando os projetos atrasados."
- "Qual o melhor método de quantificação de produtividade para este caso?"
- "Tem jurisprudência sobre glosa indevida de medição em contratos da Petrobras?"

### Comportamento

- Consulta contratos, RDOs, projetos, normas e jurisprudência pra responder
- **Conversas ficam arquivadas na Biblioteca de Documentos** do contrato

### Decisões pendentes pra UI

- **Drawer lateral** (estilo CMD-K + chat) vs. **botão flutuante** com popover
- Posicionamento: bottom-right (padrão de chat) vs. lateral colável
- Sempre o **mesmo widget global** ou contextualizado por tela (tela RMA → contexto RMA pré-carregado)

## Estado atual

| Camada                             | Implementação                                                            |
| ---------------------------------- | ------------------------------------------------------------------------ |
| Agentes Setoriais                  | ⚪ Nenhum implementado (backend)                                         |
| Adm Contratual IA                  | ⚪ Aparece como persona mockada na Revisão Documental                    |
| Base de Conhecimento + Integrações | ⚪ Nenhuma                                                               |
| Sistema de Farol                   | ✅ 4 tons nativos no DS (`--success/info/warning/danger` + `-bg`)        |
| Chat                               | ⚪ Mockup parcial dentro de M1.1 Revisão (painel lateral no card escuro) |

## Próximos passos

1. **Chat global** — drawer/popover acessível de qualquer tela (UI primeiro, com respostas mockadas)
2. **Settings de farol** — tela `/settings` permitindo configurar critérios numéricos por contrato
3. **Backend** quando entrar:
   - Orquestração multi-agente (provavelmente arquitetura tipo CrewAI / LangGraph)
   - RAG sobre documentos do cliente
   - Streaming de respostas no chat
   - Integrações API (Jusbrasil → Etapa 7, Orsafáscio → Etapa 7)
