# Módulo 4 — Check-list da Obra (SASBY-EASAC)

> Fonte: [PRODUCT.md §7](PRODUCT.md). Varredura **setorial completa** da obra. Cada engenharia diagnosticada por agente próprio.

## Propósito

Implementa a metodologia **SASBY-EASAC**: cada engenharia da obra é tratada como **entidade autônoma** com seu próprio agente especialista que escaneia, diagnostica e sugere conduta. É a vitrine da plataforma — o "consultor sênior em toda obra" olhando todos os setores **simultaneamente, todos os dias**.

## Onde fica na arquitetura

- **Posição**: paralelo ao M2, durante a execução
- **Inputs**:
  - Documentos da obra (RDOs, atas, projetos, cronogramas, planilhas, BMs, RNCs)
  - Output do M2 (Síntese é compartilhada)
  - Bases do Negócio do M1 (quando contrato entra após assinatura, 4.3 re-executa parte do M1.2)
- **Outputs**:
  - **Cenário Tendente** alimenta o RMA (M2)
  - Análise de cada engenharia alimenta abas correspondentes do RMA:
    - 4.5 Planejamento → 5.3.5 Prazo e Cronograma
    - 4.6 Medição → 5.3.2 Faturamento + M3 (glosas indevidas)
    - 4.7 Engenharia → 5.3.10 Take-off + 5.5 Mapa Retigráfico
    - 4.8 Produção → 5.3.3 Recursos + 5.3.4 Produtividade
- **Agentes responsáveis**: 8 agentes setoriais — um por engenharia (Mobilização, Orçamento, Qualidade/Segurança, Planejamento, Medição, Engenharia, Produção, Cenário Tendente)

## Telas e rotas

| Rota                                        | Engenharia                              | Estado  |
| ------------------------------------------- | --------------------------------------- | ------- |
| `/contracts/$id/checklist/cenario-tendente` | 4.1 Cenário Tendente                    | ⚪ Stub |
| `/contracts/$id/checklist/mobilizacao`      | 4.2 Mobilização/Canteiro/Desmobilização | ⚪ Stub |
| `/contracts/$id/checklist/orcamento`        | 4.3 Orçamento e Bases do Negócio        | ⚪ Stub |
| `/contracts/$id/checklist/qualidade`        | 4.4 Qualidade e Segurança               | ⚪ Stub |
| `/contracts/$id/checklist/planejamento`     | 4.5 Planejamento                        | ⚪ Stub |
| `/contracts/$id/checklist/medicao`          | 4.6 Medição                             | ⚪ Stub |
| `/contracts/$id/checklist/engenharia`       | 4.7 Engenharia (Projetos)               | ⚪ Stub |
| `/contracts/$id/checklist/producao`         | 4.8 Processo de Produção                | ⚪ Stub |

> Falta uma tela raiz `/contracts/$id/checklist` com **Diagnóstico Geral** (§7.1) — resumo de quantos setores funcionando/atenção/crítico + Cenário Tendente em destaque + 8 cards de engenharia em grid.

## 7.1 Diagnóstico Geral

Topo da tela raiz com:

- **Resumo da situação**: quantos setores adequados · em atenção · em situação crítica
- **Cenário Tendente** em destaque — projeta o futuro do contrato

## 7.2 As Oito Engenharias (cards)

Cada engenharia é um card com **5 elementos**: nome do setor · ícone do farol · diagnóstico textual · conduta sugerida específica · link pra visão detalhada.

### 4.1 Cenário Tendente e Relações ⭐ (transversal)

Análise de **para onde o contrato está caminhando**. Considera todos os indicadores e eventos para projetar o futuro: extensão de prazo provável · escalada de conflitos · deterioração de relações com a Contratante · risco de litígio. **"Meteorologia" do contrato**.

### 4.2 Engenharia da Mobilização, Canteiro e Desmobilização

Estado da mobilização inicial, operação do canteiro durante execução, plano de desmobilização. Identifica pendências de equipamentos, atrasos em recebimento, problemas de infraestrutura.

### 4.3 Engenharia do Orçamento e Bases do Negócio

Quando o cliente contrata a plataforma **após a assinatura**, as análises de Bases (originalmente no M1) também são executadas aqui. Acompanha evolução do orçamento, formalização de TACs, ajustes de quantidades, controle do saldo contratual.

### 4.4 Engenharia da Qualidade e Segurança

Monitora:

- Sistema de qualidade → tratamento de **RNCs** (não-conformidades), conformidade documental, ações corretivas
- **Segurança do trabalho**
- **Meio ambiente**
- Práticas trabalhistas e comunitárias (componente **ESG**)

### 4.5 Engenharia do Planejamento

- Cronograma vs. realizado
- Desvios no caminho crítico
- **Windows Analysis** (cronograma impactado)
- Extensão de prazo justificável
- Alimenta o **M3** com a base temporal pra quantificação do desequilíbrio

### 4.6 Engenharia da Medição

- Analisa **boletins de medição** (BMs)
- Identifica **glosas indevidas**
- Compara medido × contratado por item
- Detecta divergências
- Analisa preços novos
- Sugere impugnações
- Conecta diretamente ao M2 (5.3.2 Faturamento) e ao M3 (quantificação de glosas indevidas)

### 4.7 Engenharia da Engenharia (Projetos)

- **Lista mestra de projetos** (recebimento, revisões, situação)
- **Take-off automatizado** a partir de projetos novos
- Compara com planilha de quantidades contratual
- Identifica serviços **extra-escopo** → pedidos de preço novo
- Alerta sobre revisões de projeto e seus impactos

### 4.8 Engenharia do Processo de Produção

- Controle de produção real: MOD/MOI/EQP, produtividade, frentes de serviço, RDO
- **Fonte primária dos dados** que alimentam o RMA mensal e o Painel de Desequilíbrio

## 7.3 Síntese do Contrato (rodapé)

A mesma do M2.1.1 — valor contratado, prazo, data de corte, docs processados. Garante contexto. **Inclui acesso direto ao Chat com Adm Contratual IA**.

## Mocks atuais

- Nenhum específico do M4

> **Falta mockear**: 8 engenharias com diagnóstico textual + conduta + farol pra cada uma + Cenário Tendente (extensão prevista, escalada).

## Componentes DS usados / a criar

- **Existe**: `Card`, `Badge`, `Grid`+`Col`, `Tabs` (talvez para ver detalhe de engenharia)
- **A criar/avaliar**:
  - **EngenhariaCard** custom (5 elementos do §7.2) — pode ser inline na tela raiz
  - **CenárioTendenteHero** — destaque visual de "meteorologia" (ícone + texto + previsão de prazo)
  - **TimelineOfEvents** pra páginas de detalhe (RDOs cronológicos, RNCs etc.)

## Próximos passos (depende de Agentes Setoriais)

> O doc é claro (Etapa 4 → Etapa 5): **M4 depende dos Agentes Setoriais**. Sem backend de agentes, M4 fica em mock estático.

Mesmo assim, pra MVP visual:

1. Tela **raiz** com Diagnóstico Geral + 8 cards (mockado)
2. **4.1 Cenário Tendente** primeiro (transversal, define o tom)
3. **4.5 Planejamento** + **4.6 Medição** + **4.7 Engenharia** + **4.8 Produção** (alimentam o RMA → maior ROI)
4. **4.2 Mobilização** + **4.3 Orçamento** + **4.4 Qualidade** (segunda onda)
