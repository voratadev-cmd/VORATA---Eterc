PLATAFORMA DE ADMINISTRAÇÃO

CONTRATUAL IA

Documento de Visão da Plataforma

Especificação funcional e arquitetural para desenvolvimento

Versão 1.0 · Maio de 2026

Sumário

Apresentação · página 3

1. Visão Geral da Plataforma · página 4

2. Arquitetura · página 6

3. Tela Inicial — Dashboard · página 9

4. Módulo 1 — Pré-Contrato · página 12

5. Módulo 2 — Gestão Contratual · página 16

6. Módulo 3 — Painel de Desequilíbrio · página 26

7. Módulo 4 — Check-list da Obra · página 31

8. Módulo 5 — Finalização do Contrato · página 35

9. Camadas Transversais · página 37

10. Estado Atual do Desenvolvimento (v1) · página 41

11. Próximos Passos · página 43

Apresentação

Este documento descreve a visão completa da Plataforma de Administração Contratual IA, organizando os módulos, funcionalidades, agentes inteligentes e camadas transversais que compõem o sistema.

A administração contratual de obras é uma área que exige tempo, expertise técnica, conhecimento jurídico e disciplina documental.

Hoje, esse trabalho é feito predominantemente por consultorias especializadas que produzem relatórios mensais manuais a partir do levantamento de dados em documentos da obra.

A Plataforma de Administração Contratual IA automatiza esse processo, integrando documentos e dados da obra a uma camada de agentes especializados que produzem as mesmas análises (e outras mais profundas) de forma contínua, com qualidade superior e velocidade incomparável.

Para quem é a plataforma

Diretores e donos de construtoras que precisam de visão executiva consolidada de todos os contratos sob administração.

Gerentes de contrato que operam o dia a dia da obra e precisam de suporte técnico-contratual contínuo.

Departamentos jurídicos que conduzem pleitos, claims, arbitragens e ações judiciais decorrentes de contratos de empreitada.

1. Visão Geral da Plataforma

1.1 O problema

Contratos de empreitada — em especial os de grande porte — geram volumes massivos de documentos: contratos, planilhas de quantidades, projetos executivos, cronogramas, RDOs, atas, boletins de medição, cartas, e-mails. Esses documentos contêm a informação que define se o contrato está sendo cumprido conforme acordado ou se está derivando para uma situação de desequilíbrio econômico-financeiro.

Hoje, transformar essa massa documental em diagnóstico contratual é trabalho artesanal. Consultores especializados leem documentos, transcrevem dados para planilhas, montam gráficos e apresentações, escrevem análises textuais e sugerem condutas. Em obras grandes, isso consome dezenas de horas por mês e a profundidade do diagnóstico fica limitada pelo tempo disponível.

A consequência prática é que muitos desvios passam despercebidos até virarem prejuízo. Quando a construtora se dá conta de que perdeu produtividade, de que custos indiretos extrapolaram, de que insumos subiram acima do índice contratual, de que pagamentos atrasaram sistematicamente — frequentemente é tarde demais para registrar tempestivamente os eventos e fundamentar um pleito sólido.

1.2 A solução

A Plataforma de Administração Contratual IA inverte essa lógica. O cliente sobe os documentos da obra (ou conecta seus sistemas via API), e a plataforma faz o trabalho continuamente, 24 horas por dia, com a expertise condensada de um consultor sênior.

Cada documento da obra passa por agentes especializados — um para projetos, um para medições, um para planejamento, um para qualidade e segurança, e assim por diante.

Cada agente extrai dados, classifica eventos, identifica desvios e gera sugestões de conduta dentro de sua especialidade.

Acima deles, um agente consolidador — o Adm Contratual IA — produz os entregáveis estratégicos: relatórios mensais, análises de singularidades, claims completos, cartas, pareceres.

O resultado é triplo. Primeiro, o cliente passa a ter visão em tempo real do estado de cada contrato.

Segundo, a profundidade analítica é incomparavelmente maior — onde uma consultoria entrega 15 páginas de RMA, a plataforma entrega análises detalhadas por frente de serviço, por método de quantificação, por evento documentado.

Terceiro, o custo unitário despenca: o que custa hoje uma consultoria mensal pode ser entregue por uma fração do valor praticado, escalando para múltiplos contratos simultâneos.

1.3 O que a plataforma entrega

Diagnóstico contratual contínuo e em tempo real, com indicadores claros e farol de criticidade.

Relatório Mensal de Acompanhamento (RMA) gerado automaticamente a cada mês.

Análises de singularidades (varredura setorial completa) emitidas periodicamente.

Painel de Desequilíbrio Econômico-Financeiro com quantificação por múltiplos métodos (Valor Agregado, Total Cost, Measured Mile) e cenários (indiretos, BDI, encargos, insumos, atraso de pagamento, chuvas, ociosidade).

Geração automática de documentos: cartas, claims, pedidos de preço novo, take-offs, planos de ação, análises de cláusula contratual, matriz de nexo causal.

Diagnóstico pré-contrato (análise de minuta, riscos, premissas, elaboração do Plano de Ação).

Análise pós-contrato (lições aprendidas, negociação de pleitos, suporte judicial/arbitral).

Chat especializado com agente sênior treinado em administração contratual, disponível em todas as telas.

1.4 Diferenciais frente ao mercado atual

A plataforma se diferencia em quatro dimensões essenciais:

Automação ponta a ponta. As consultorias atuais entregam documentos produzidos manualmente. A plataforma produz os mesmos entregáveis automaticamente, com qualidade equivalente ou superior, em uma fração do tempo e do custo.

Quantificação contínua de desequilíbrio. Hoje, cálculos detalhados de desequilíbrio (indiretos, BDI, encargos, perda de produtividade por múltiplos métodos, variação de insumos) são feitos sob demanda e pontualmente. A plataforma os calcula mensalmente, em todos os cenários, sem custo adicional.

Cobertura pré e pós-contrato. As consultorias tradicionais entram quando a obra começa. A plataforma cobre todo o ciclo, do diagnóstico da minuta antes da assinatura até o suporte em arbitragem após o encerramento.

Integração contínua com fontes da obra. Hoje, a consultoria depende do envio manual de documentos pelo cliente. A plataforma é desenhada para se conectar diretamente ao e-mail da obra, aos sistemas de gestão de RDO, aos repositórios de projetos — operando em tempo real.

2. Arquitetura

A plataforma é organizada em cinco módulos verticais (que seguem o ciclo de vida do contrato: pré-contrato → execução → desequilíbrio → check-list setorial → finalização) e camadas transversais que atravessam todos eles (agentes de IA, base de conhecimento, sistema de farol, chat).

Figura 1 — Arquitetura macro da plataforma. Os 5 módulos são apresentados em sequência (sob o Dashboard), e as camadas transversais aparecem na base, atravessando todos os módulos.

2.1 Os cinco módulos

Módulo 1 — Pré-Contrato. Análises antes da assinatura: revisão da minuta do contrato, análise dos documentos disponibilizados para elaboração da proposta, análise de riscos, exame da proposta com foco em premissas, diagnóstico do contrato e geração do Plano de Ação (transpasse para o gestor que vai tocar a obra). Aqui também são geradas as bases iniciais do RMA — os dados contratados que servirão de referência para todas as análises futuras de execução.

Módulo 2 — Gestão Contratual. É o coração da plataforma. Aqui mora o RMA mensal, a timeline do contrato, o mapa retigráfico (liberado x impedido), a análise de qualidade documental, as condutas sugeridas e a biblioteca de todos os documentos produzidos. É onde o usuário passa a maior parte do tempo durante a execução do contrato.

Módulo 3 — Painel de Desequilíbrio. Quantificação econômico-financeira do desequilíbrio em todos os cenários: indiretos, BDI, encargos sociais, valor agregado, total cost, measured mile, preço de insumos, análises pontuais (chuvas, ociosidade) e econômico-financeiras (atraso de pagamento, capital de giro). Culmina no Gerador de Claim, que consolida tudo em um pleito completo.

Módulo 4 — Check-list da Obra. Varredura setorial completa da obra. Cada engenharia da obra (Mobilização/Canteiro, Orçamento, Qualidade e Segurança, Planejamento, Medição, Engenharia, Produção) é diagnosticada quanto ao seu funcionamento, com sugestão de conduta específica. A análise transversal de Cenário Tendente prevê o futuro da obra com base em todos os dados.

Módulo 5 — Finalização do Contrato. Encerramento do contrato: relatório de lições aprendidas, suporte à negociação de pleitos pendentes, e análise jurídica para eventual disputa judicial ou arbitral.

2.2 As camadas transversais

Quatro camadas atravessam todos os módulos verticais:

Camada de Agentes de IA. Composta por oito agentes setoriais especializados (Mobilização, Orçamento, Qualidade/Segurança, Planejamento, Medição, Engenharia, Produção, Cenário Tendente), pelo Agente de Orçamento dedicado a Pré-Contrato e Check-list, e pelo Adm Contratual IA — agente sênior que orquestra os demais e produz os entregáveis estratégicos.

Camada de Base de Conhecimento e Integrações. Normas técnicas (AACE, IBAPE), jurisprudência, documentos da obra do cliente (contratos, projetos, RDOs, atas, e-mails), referências de preço e produtividade (Orsafáscio, SINAPI, dissídios sindicais). Hoje o input é manual via upload; futuramente, integrações via API permitirão operação contínua.

Sistema de Farol. Indicadores em quatro níveis — Conforme (verde), Observação (azul), Risco (amarelo), Crítico (vermelho) — aplicados a todas as análises da plataforma. Critérios configuráveis por contrato, com valores de referência baseados na prática de mercado (AACE, normas IBAPE).

Chat com Adm Contratual IA. Disponível em todas as telas. O usuário faz perguntas livres, pede análises customizadas, solicita geração de documentos. O agente sênior responde consultando contratos, RDOs, projetos, normas e jurisprudência, com a expertise de quem viu milhares de obras.

2.3 Fluxo entre módulos

Os módulos não são sequenciais estritos — eles se alimentam mutuamente. O Pré-Contrato gera as bases do RMA (Gestão Contratual). A Gestão Contratual produz os dados que o Painel de Desequilíbrio quantifica. O Check-list da Obra valida setor por setor e alimenta o Cenário Tendente, que por sua vez retroalimenta o RMA. A Finalização consolida tudo que foi feito ao longo do contrato e gera as lições aprendidas que melhoram a análise dos próximos contratos.

A integração entre os módulos é garantida pelas camadas transversais — em especial pelos agentes, que operam continuamente e mantêm os dados consistentes entre todas as telas.

3. Tela Inicial — Dashboard

A tela inicial da plataforma é uma visão executiva consolidada de todos os contratos sob administração do cliente. É a porta de entrada para diretores e donos que precisam de uma fotografia rápida do portfólio antes de mergulhar em um contrato específico.

Figura 2 — Dashboard com indicadores consolidados, mapa de obras, alertas da IA e tabela resumo dos contratos.

3.1 Componentes da tela

3.1.1 Indicadores de topo (KPIs)

Cinco cards em destaque, atualizados em tempo real:

Contratos ativos: número total de contratos sob administração, com variação mensal.

Valor administrado: soma dos valores contratuais de todos os contratos ativos.

Desequilíbrio acumulado: soma dos desequilíbrios apurados nos painéis de cada contrato (Módulo 3), com variação mensal.

Alertas críticos: número de eventos em status crítico que demandam ação imediata.

Qualidade documental média: indicador agregado da qualidade dos documentos da obra (RDOs, atas, cronogramas, relatórios) — medida pela completude, contemporaneidade e padronização.

3.1.2 Mapa das Obras

Visualização geográfica dos contratos sob administração. Cada pino representa uma obra ou um conjunto de obras na mesma região, com cor do farol indicando o status consolidado. Permite ao diretor identificar rapidamente onde estão os pontos críticos no portfólio.

3.1.3 Alertas da IA

Lista de eventos detectados pelos agentes que demandam decisão. Cada alerta traz: nível de criticidade (cor do farol), nome do contrato, descrição curta do evento, agente responsável pela detecção e tempo desde a detecção. Clicar no alerta leva diretamente para a tela onde o evento foi identificado.

3.1.4 Qualidade Documental

Componente exibido como indicador no topo e detalhado em tela dedicada. Mede a qualidade dos documentos sendo produzidos pela obra. Em específico:

Atas de reunião — presença, completude, registro contemporâneo de eventos.

RDOs — preenchimento diário, registro de impactos, classificação de eventos.

Cronogramas — atualização, identificação de caminho crítico, registro de desvios.

Relatórios mensais e semanais — periodicidade, padronização, profundidade.

Quando a qualidade documental cai, o cliente é alertado: documentação ruim hoje significa pleito fraco amanhã.

3.1.5 Resumo dos Contratos

Tabela com a lista de todos os contratos ativos, mostrando: nome do contrato e localização, cliente final, valor contratual, prazo decorrido/restante, percentual de faturamento e desvio, valor de desequilíbrio acumulado, e farol consolidado. Cada linha é clicável e leva ao módulo correspondente do contrato.

3.2 Comportamento e personalização

O Dashboard se adapta ao perfil do usuário logado. Diretores e donos veem o portfólio inteiro. Gerentes de contrato veem apenas os contratos sob sua responsabilidade. Jurídicos veem destaque para contratos em situação de pleito ou disputa. Todas as visualizações respeitam permissões de acesso definidas no cadastro de usuário.

4. Módulo 1 — Pré-Contrato

O Módulo 1 cobre as análises que antecedem a assinatura do contrato. É o momento de identificar riscos, mapear premissas, validar produtividades orçadas e construir o Plano de Ação que será entregue ao gestor responsável pela execução da obra.

A maior parte das construtoras hoje não realiza diagnóstico contratual sistemático antes de assinar — o que significa que entram em obras com riscos não mapeados e premissas frágeis. A consequência é que, quando os problemas aparecem na execução, falta base documental para fundamentar pleitos.

4.1 Revisão Documental

Primeira análise da plataforma. Os documentos da concorrência (edital, contrato, projetos básicos, planilha de quantidades, procedimentos, anexos) são submetidos a um agente de IA especializado, que produz análises em múltiplas dimensões.

Análises produzidas

Compatibilidade entre projeto recebido e planilha de quantidades — identificação de divergências, omissões e itens sem especificação clara.

Riscos contratuais — cláusulas desfavoráveis, distribuição de riscos, gatilhos de penalidades, condições suspensivas, hipóteses de exceção.

Obrigações contratuais mapeadas — listagem completa do que a Contratada deve fazer, prazos, formas de comprovação, documentos exigidos.

Análise técnica dos projetos recebidos — adequação às normas, exequibilidade, omissões.

Análise dos procedimentos — clareza, exequibilidade, riscos de não conformidade.

Suporte ao esclarecimento de dúvidas — geração de questionamentos técnicos a serem submetidos à Contratante na fase de concorrência.

Entregáveis

Relatório de revisão documental, com seções para cada análise acima.

Lista de pontos de atenção, classificados por criticidade (farol).

Lista de questionamentos sugeridos para a Contratante.

4.2 Bases do Negócio

Análise da proposta e das premissas que sustentam o orçamento da Contratada. Aqui mora um dos riscos mais subestimados: muitos contratos entram em desequilíbrio não porque algo deu errado, mas porque as premissas da proposta estavam erradas desde o início.

Análises produzidas

Mapeamento e validação de premissas — produtividades, jornadas, composições de equipe, índices de consumo, prazos de fornecedores.

Análise das produtividades orçadas — comparação com referências de mercado (Orsafáscio, SINAPI, contratos similares em locais próximos).

Análise dos preços unitários — comparação com bases referenciais e detecção de itens potencialmente subdimensionados ou superdimensionados.

Análise do BDI — composição, alíquotas de encargos, riscos cobertos, margens.

Identificação de premissas frágeis que precisam ser registradas formalmente para preservar direito futuro de pleito.

Base de dados

Esta análise se beneficia de bancos de dados externos. Sugestão: integração via API com o Orsafáscio (que já possui banco amplo de produtividades e preços). Complementarmente, banco interno com contratos similares anteriores em localidades próximas para comparação geográfica.

4.3 Diagnóstico do Contrato

Documento gerado a partir das análises de Revisão Documental e Bases do Negócio. Com um clique, o usuário obtém um diagnóstico consolidado do contrato antes da assinatura, com:

Resumo executivo dos principais riscos e oportunidades.

Lista de cláusulas que merecem renegociação.

Premissas que precisam ser registradas formalmente.

Estimativa preliminar do potencial de desequilíbrio se os riscos identificados se materializarem.

Recomendação clara: assinar como está, renegociar, ou recusar.

4.4 Transpasse e Documentação Gerada

O Transpasse é o documento de passagem entre o time de orçamento (que ganhou a concorrência) e o time de execução (que vai tocar a obra). Em construtoras maduras, é uma prática consolidada — mas frequentemente feita de forma incompleta ou apressada. A plataforma automatiza essa passagem com qualidade.

Conteúdo do Transpasse

Resumo do contrato e da proposta, com todas as premissas formalizadas.

Identificação dos principais riscos e como mitigá-los.

Plano de Ação para a fase inicial da obra (mobilização e primeiros 90 dias).

Documentos que precisam ser emitidos obrigatoriamente pela Contratada nos primeiros meses (cartas, registros, plano de trabalho).

Modelos pré-formatados desses documentos, prontos para uso.

Geração das bases do RMA

Esta é uma funcionalidade crítica do Módulo 1:

A IA lê o contrato, a planilha de quantidades, o cronograma físico-financeiro e o histograma de recursos. A partir desses dados, ela popula automaticamente todas as bases contratadas que serão usadas no RMA do Módulo 2: curvas de faturamento previsto, histogramas de MOD/MOI/EQP, marcos contratuais, valores de referência para indicadores.

Ou seja: quando a obra começa, o RMA já está parametrizado e pronto para receber os dados realizados. Isso elimina semanas de trabalho manual de cadastro inicial.

4.5 Agentes envolvidos

Agente de Orçamento: especialista nas Bases do Negócio. Analisa produtividades, preços, BDI, premissas. Consulta as bases referenciais (Orsafáscio, SINAPI, dissídios) e contratos similares anteriores.

Adm Contratual IA: atua na Revisão Documental e no Diagnóstico do Contrato. Lê o contrato como um advogado-engenheiro experiente, identificando riscos jurídicos e técnicos. Gera o Transpasse e os modelos de documentos.

5. Módulo 2 — Gestão Contratual

É o coração da plataforma — o módulo onde o usuário passa a maior parte do tempo durante a execução do contrato. Aqui mora o RMA mensal e todas as análises que sustentam a administração contratual contínua.

Figura 3 — Tela principal do RMA dentro do Módulo 2, mostrando indicadores gerais, farol por bloco de análise e curva de faturamento.

5.1 Estrutura do Módulo

O Módulo 2 organiza-se em duas grandes áreas: a Visão Geral das Obras (que reúne todas as análises e abas do RMA) e a Biblioteca de Documentos (que arquiva tudo que foi produzido durante o contrato).

5.2 Síntese do Contrato

Tela de entrada do contrato. Mostra o cabeçalho com os dados essenciais (cliente, valor, prazo, datas-chave), os documentos contratuais indexados, a equipe responsável e os contatos. Esta mesma síntese é compartilhada com o Módulo 4 (Check-list da Obra).

5.3 RMA — Relatório Mensal de Acompanhamento

É o entregável mais importante do módulo. Gerado a cada mês a partir dos dados consolidados, contém todas as análises macro do contrato. Organizado em abas paralelas, cada uma com sua função.

5.3.1 Indicadores e Farol

Aba de entrada do RMA, com visão executiva imediata. Apresenta:

Card de situação geral, com diagnóstico textual gerado pelo agente sênior.

Status por bloco de análise (Faturamento, Recursos, Produtividade, Prazo, Desequilíbrio), cada um com seu próprio farol.

Acesso direto a cada aba detalhada.

5.3.2 Faturamento

Análise da execução financeira do contrato. Contém:

Curva de faturamento contratado vs. realizado (Curva S), com gap sombreado e projeção até o fim do contrato.

Cards numéricos: Contratado Total, Contratado Acumulado até a data de corte, Real Acumulado, Saldo a Faturar.

Indicador de desvio em percentual, com cor do farol.

Indicador de aderência do mês corrente (faturado no mês ÷ previsto para o mês).

Projeção de término no ritmo atual de faturamento — quando essa data ultrapassa o prazo contratual, dispara alerta automático com sugestão de claim de prorrogação.

Seletor de visão: "Todo o faturamento" (incluindo mobilização, canteiro, manutenção) ou "Apenas serviços" (exclui itens não produtivos). Quando o usuário muda o seletor, todos os gráficos e indicadores recalculam.

Tabela de Faturamento Previsto mês a mês, baseada na Curva S contratual.

Análise textual automática do desvio, gerada pelo Adm Contratual IA e editável pelo usuário.

Análise por frente de serviço (subseção), com gráfico comparativo Contratado x Real por categoria contratual e justificativa textual de cada desvio.

Critérios do farol de Faturamento (configuráveis)

Conforme: desvio até -1%

Observação: desvio entre -1% e -5%

Risco: desvio entre -5% e -15%

Crítico: desvio acima de -15%

5.3.3 Recursos (MOD, MOI, Equipamentos)

Análise da alocação de mão de obra direta, indireta e equipamentos. Para cada categoria:

Total do contrato (vindo do histograma contratual gerado no Pré-Contrato).

Real alocado até a data de corte.

Percentual alocado vs. previsto.

Comparativo mensal (barras Contratado x Real).

Evolução BM a BM (linha).

Alocação em reais (custo).

Análise textual com interpretação cruzada: quando recursos estão alocados acima do percentual de faturamento, há indício de perda de produtividade que deve ser apurada no Módulo 3.

5.3.4 Produtividade

Análise da relação faturamento/recurso, em três níveis:

Comparativo Hora-Homem (HH real, HH contratado, benchmark nacional, benchmark global) — herdado da v1 atual.

Evolução mensal do HH ao longo do contrato.

Indicadores preliminares de perda de produtividade (cálculo detalhado mora no Módulo 3).

5.3.5 Prazo e Cronograma

Análise da execução temporal:

Prazo decorrido x prazo restante (gauge donut).

Curva de avanço físico contratado x real.

Marcos contratuais — situação de cada marco (cumprido, em atraso, em risco).

Análise de caminho crítico (Windows Analysis), identificando eventos que impactaram o término projetado.

Tendência de término baseada em ritmo real.

5.3.6 Insumos

Visualização da variação de preços de insumos relevantes ao contrato. Apresenta gráficos comparativos do índice contratual vs. índices reais (INCC, SINAPI, índices setoriais). O cálculo do desequilíbrio decorrente dessas variações mora no Módulo 3

5.3.7 Curvas: Liberação x Capacidade Produtiva x Alocado

Análise diferencial — três curvas sobrepostas:

Curva de Liberação: o que está liberado para execução, com base nos projetos recebidos e nas frentes desimpedidas pela Contratante.

Curva de Capacidade Produtiva: o que a equipe alocada é capaz de produzir, considerando produtividade real.

Curva de Alocado: o que está sendo efetivamente executado.

Quando há divergência entre essas três curvas, identifica-se o tipo de problema: se a curva de liberação está abaixo das outras duas, o gargalo está na Contratante (projetos atrasados, áreas impedidas). Se a curva de capacidade está abaixo, há problema interno de produtividade.

5.3.8 Análise de Responsabilidade

Classificação dos eventos negativos do período por responsabilidade: Contratante, Contratada, terceiro, força maior. Apresenta:

Matriz de eventos x responsabilidade.

Quantificação dos impactos por responsável.

Fundamentação documental para cada classificação.

Esta análise é base para construção de pleitos. Sem ela, não há como provar nexo causal.

5.3.9 Panorama do Contrato

Visão consolidada do mês (estilo do panorama da v1 atual), em três aspectos:

Aspectos de ordem técnica.

Aspectos de ordem econômica.

Aspectos de ordem física.

Complementada pela Matriz de Impactos (eventos do mês classificados por categoria) e pela Matriz de Nexo Causal (fato → documento que comprova → embasamento contratual → hipótese de desequilíbrio → quantificação).

5.3.10 Condutas Sugeridas e Geração de Documentos

Conjunto aberto de entregáveis que a IA sugere com base no estado atual do contrato:

Take-off automatizado a partir de novos projetos recebidos.

Pedidos de preço novo para serviços extra-escopo.

Cartas (de cobrança, notificação, registro de eventos, impugnação de glosas, etc.).

Comentários e sugestões de anotação em RDOs e atas.

Análises de cláusula contratual aplicáveis ao caso concreto.

Plano de Ação atualizado.

A lista é aberta — a IA sugere o que faz sentido conforme a situação do contrato. Eventualmente surgem entregáveis novos (resposta a notificação, resposta a TCU, etc.) que a plataforma deve suportar sem precisar de reprogramação.

5.3.11 Plano de Ação

Documento estruturado que lista, para cada ponto de atenção identificado nas análises: o que fazer (ação), por quê (justificativa), quem (responsável), quando (prazo), onde (canal/sistema), esforço estimado, status (concluído, em andamento, pendente).

5.4 Timeline do Contrato

Aba paralela ao RMA, com visão cronológica:

Linha do tempo do contrato com todos os eventos relevantes.

Marcos contratuais e seu status.

Cronograma físico previsto vs. real.

Caminho crítico destacado.

5.5 Mapa / Retigráfico do Contrato

Overview geográfico/topográfico da obra mostrando o que está liberado para executar e o que está impedido (por falta de projeto, área não desimpedida, pendência de licença, etc.). Atualizado continuamente pelos agentes de Engenharia e Planejamento. Funciona como um "radar" visual do estado da obra.

5.6 Melhorias Documentais

Aba dedicada à qualidade da documentação produzida pela obra. Lista, para cada tipo de documento (atas, RDOs, cronogramas, relatórios), sugestões de melhoria. Exemplos: RDOs que não registram impactos contemporaneamente; atas sem responsáveis e prazos definidos; cronogramas desatualizados. A ideia é que a base documental do contrato seja sempre forte o suficiente para sustentar pleitos futuros.

5.7 Biblioteca de Documentos

Arquivo de tudo que foi produzido durante o contrato: cartas enviadas, claims, take-offs, atas, RDOs, cronogramas impactados, pareceres, análises de cláusula. Organizado por data, tipo, setor, evento associado. Pesquisável. Lista aberta — qualquer entregável gerado pela plataforma vai automaticamente para a Biblioteca.

6. Módulo 3 — Painel de Desequilíbrio

O Módulo 3 é onde a plataforma cumpre uma de suas promessas mais importantes: quantificar continuamente o desequilíbrio econômico-financeiro do contrato em todos os cenários possíveis, com fundamentação técnica e jurídica.

Hoje, esse trabalho é feito sob demanda e pontualmente — quando o cliente decide entrar com um pleito ou um claim. Frequentemente já é tarde, e a quantificação fica limitada pelos dados que foram registrados ao longo do contrato (que, na maioria das vezes, não foram registrados adequadamente).

A plataforma inverte essa lógica: quantifica desde o primeiro mês, em todos os cenários, sempre. Quando o cliente decidir entrar com um pleito, todo o material está pronto.

Figura 4 — Painel de Desequilíbrio mostrando desequilíbrio acumulado, composição por categoria, cenários calculados e gerador de claim.

6.1 Resumo do Desequilíbrio

Topo da tela, com destaque para:

Desequilíbrio acumulado total (em reais).

Variação do mês.

Percentual do desequilíbrio sobre o valor contratual.

Prorrogação estimada (em dias) — obtida da análise Windows do Módulo 2.

Força no mérito — avaliação da solidez da base documental e jurídica (escala 1 a 5 estrelas).

Botão de "Próximo passo" — convida o cliente a gerar o claim consolidado.

6.2 Composição por Categoria

Gráfico de barras horizontal mostrando como o desequilíbrio se distribui entre as diferentes naturezas (custos diretos, indiretos, BDI, perda de produtividade, variação de insumos, atraso de pagamento, chuvas e ociosidade). Permite ao cliente entender rapidamente onde está concentrado o problema.

6.3 Cenários e Métodos Calculados

Aqui ficam, em cards individuais, todas as análises detalhadas:

6.3.1 Análise de Indiretos (3.1)

Quantificação da extensão de custos indiretos (administração local, canteiro de obras) em função do prazo decorrido além do contratual. Base: documentos contábeis do canteiro, planilha de custos indiretos contratada, número de dias de extensão.

6.3.2 Análise de BDI (3.2)

Quantificação dos componentes do BDI que precisam ser reequilibrados:

Administração Central — extensão pela prorrogação.

Encargos Sociais (3.3) — variação de alíquotas (ex.: reoneração progressiva pela Lei 14.973/24).

Garantias bancárias e seguros estendidos.

Outros itens do BDI.

Impostos — variação de alíquotas.

Lucro — impacto financeiro proporcional.

6.3.3 Valor Agregado, Total Cost, Measured Mile (3.4, 3.5, 3.6)

Três métodos diferentes de quantificação de perda de produtividade, aplicados em paralelo. O cliente pode ver os três e escolher o mais favorável, ou apresentar a média/intervalo.

Valor Agregado (AACE 25R-03). Custo previsto multiplicado pela variação do avanço. Comparado com horas reais alocadas. O Excel atual dos devs já tem esse cálculo implementado na aba S15.

Total Cost. Comparação direta entre o histograma contratual e o real alocado, para MOD e Equipamentos. Mostra diferença em horas e em reais.

Measured Mile (Milha Aferida). Análise de produtividade real ao longo dos meses (R$ medido por hora-homem alocada). Identifica períodos de queda de produtividade e os atribui aos eventos contemporâneos documentados.

6.3.4 Análise de Preço de Insumos (3.7)

Cálculo do desequilíbrio decorrente da variação de preços de insumos relevantes (cimento, aço, brita, combustível, mão de obra) acima do índice contratual. Aplicação da fórmula paramétrica do contrato sobre as quantidades efetivamente compradas.

6.3.5 Análises Pontuais (3.8)

Quantificação de eventos pontuais documentados:

Chuvas acima da média histórica — dias improdutivos e ociosidade de recursos.

Ociosidade documentada — recursos parados por culpa da Contratante.

Greves, manifestações sindicais, paralisações externas.

Retrabalho por mudança de projeto.

6.3.6 Análises Econômico-Financeiras (3.9)

Impactos financeiros indiretos:

Atraso de pagamentos — juros, correção monetária, custo de capital de giro.

Capital de giro adicional necessário.

Custos financeiros de garantias estendidas.

6.4 Gerador de Claim Consolidado (3.10)

Item final do Módulo 3. Funcionalidade que reúne todas as análises acima e produz um pleito completo, com fundamentação técnica, jurídica e quantificação detalhada. Em quatro etapas:

Etapa 1 — Dossiê Probatório

A IA varre todos os documentos do contrato (RDOs, atas, cartas, e-mails, fotos, registros) e monta o dossiê probatório. Indexa cada documento, classifica por evento, gera a matriz de nexo causal completa.

Etapa 2 — Fundamentação

Mapeia as cláusulas contratuais aplicáveis, cita a doutrina e jurisprudência pertinentes (consulta ao Jusbrasil), referencia as normas técnicas (AACE, IBAPE), busca precedentes em câmaras arbitrais.

Etapa 3 — Quantificação

Consolida o valor total do pleito a partir de todas as análises do Painel. Gera planilhas de cálculo separadas por método, memórias de cálculo detalhadas, cenários de valor (alto, médio, baixo) para suportar negociação.

Etapa 4 — Geração do Documento

Produz o Word final formatado, com índice, capa, sumário, anexos. Pronto para envio à Contratante. Templates baseados em modelos de pleitos vencedores em casos similares (banco de dados curado).

7. Módulo 4 — Check-list da Obra

O Módulo 4 implementa a metodologia SASBY-EASAC de varredura setorial completa. Cada engenharia da obra é tratada como uma entidade autônoma com seu próprio agente especialista, que escaneia, diagnostica e sugere conduta.

É o módulo onde a plataforma cumpre o papel de "consultor sênior em toda obra" — alguém que tem conhecimento profundo de cada setor e consegue olhar todos eles simultaneamente, todos os dias.

Figura 5 — Check-list da Obra com diagnóstico geral, status farol dos 8 setores e conduta sugerida para cada engenharia.

7.1 Diagnóstico Geral

Topo da tela, com:

Resumo da situação: quantos setores funcionam adequadamente, quantos demandam atenção, quantos estão em situação crítica.

Cenário Tendente: análise transversal que prevê o futuro da obra com base no estado atual de todos os setores.

7.2 As oito Engenharias

Cada engenharia é um card com cinco elementos: nome do setor, ícone do farol, diagnóstico textual de funcionamento, conduta sugerida específica, link para visão detalhada.

7.2.1 Cenário Tendente e Relações (4.1)

Análise transversal de para onde o contrato está caminhando. Considera todos os indicadores e eventos para projetar o futuro: extensão de prazo provável, escalada de conflitos, deterioração de relações com a Contratante, risco de litígio. Como uma "meteorologia" do contrato.

7.2.2 Engenharia da Mobilização, Canteiro e Desmobilização (4.2)

Acompanha o estado da mobilização inicial, da operação do canteiro durante a execução e do plano de desmobilização. Identifica pendências de equipamentos, atrasos em recebimento de peças, problemas de infraestrutura de apoio.

7.2.3 Engenharia do Orçamento e Bases do Negócio (4.3)

Quando o cliente contrata a plataforma após a assinatura do contrato, as análises de Bases do Negócio (originalmente no Módulo 1) também são executadas aqui. Acompanha a evolução do orçamento, formalização de TACs, ajustes de quantidades, controle do saldo contratual.

7.2.4 Engenharia da Qualidade e Segurança (4.4)

Monitora o sistema de qualidade da obra: tratamento de RNCs (não conformidades), análise de conformidade documental, controle de não-conformidades, sugestão de respostas e ações corretivas. Acompanha também segurança do trabalho, meio ambiente, práticas trabalhistas e comunitárias (componente ESG).

7.2.5 Engenharia do Planejamento (4.5)

Monitora cronograma vs. realizado, identifica desvios no caminho crítico, faz a análise Windows (cronograma impactado), calcula a extensão de prazo justificável. Alimenta o Módulo 3 com a base temporal para quantificação do desequilíbrio.

7.2.6 Engenharia da Medição (4.6)

Analisa boletins de medição: identifica glosas indevidas, compara medido x contratado por item, detecta divergências, analisa preços novos, sugere impugnações. Conecta-se diretamente ao Módulo 2 (faturamento) e ao Módulo 3 (quantificação de glosas indevidas).

7.2.7 Engenharia da Engenharia (4.7)

Controla a lista mestra de projetos: recebimento, revisões, situação de cada projeto. Faz take-off automatizado a partir de projetos novos. Compara com a planilha de quantidades contratual. Identifica serviços extra-escopo que viram pedidos de preço novo. Alerta sobre revisões de projeto e seus impactos.

7.2.8 Engenharia do Processo de Produção (4.8)

Acompanha o controle de produção real: recursos alocados (MOD/MOI/EQP), produtividade, frentes de serviço, RDO. É a fonte primária dos dados que alimentam o RMA mensal e o Painel de Desequilíbrio.

7.3 Síntese do Contrato

Rodapé do Check-list mostra a Síntese do Contrato (a mesma do Módulo 2) — valor contratado, prazo, data de corte, documentos processados — para garantir contexto. Inclui também acesso direto ao Chat com o Adm Contratual IA, permitindo ao usuário fazer perguntas livres sobre o que vê na tela.

8. Módulo 5 — Finalização do Contrato

O Módulo 5 cobre o fechamento do contrato e a fase pós-execução. Mesmo após a desmobilização da obra, frequentemente há trabalho a fazer: pleitos pendentes, distrato, quitação, eventuais disputas. A plataforma acompanha o cliente até a quitação final.

8.1 Relatório de Lições Aprendidas

Documento gerado ao final do contrato, consolidando tudo que foi aprendido. Inclui:

O que funcionou bem na execução.

O que não funcionou e por quê.

Riscos que se materializaram e que não estavam mapeados na fase pré-contrato.

Premissas que se mostraram corretas ou erradas.

Recomendações para contratos futuros similares.

Este relatório alimenta a base de conhecimento da plataforma, melhorando as análises de Pré-Contrato (Módulo 1) de contratos futuros.

8.2 Negociação de Pleitos

Suporte ao processo de negociação de pleitos pendentes ao final do contrato. A IA acompanha as tratativas, sugere argumentos, ajuda a calibrar valores de proposta, monitora prazos de prescrição.

8.3 Análise Judicial / Arbitral

Quando o pleito não é resolvido amigavelmente e migra para arbitragem ou judiciário, a plataforma fornece suporte completo:

Geração de petições iniciais.

Mapeamento da estratégia jurídica.

Indexação de toda a prova documental.

Acompanhamento processual.

Sugestão de peritos e quesitos técnicos.

Suporte na elaboração de pareceres.

A integração com Jusbrasil permite consulta a precedentes e jurisprudência específica. O conhecimento jurídico do Adm Contratual IA, combinado com toda a base probatória já indexada durante a execução, faz desta a fase em que o investimento na plataforma se paga de forma mais clara: o cliente chega ao litígio com material consolidado, fundamentação sólida e quantificação validada.

9. Camadas Transversais

As camadas transversais atravessam todos os módulos verticais e dão à plataforma sua inteligência e consistência. São quatro: agentes de IA, base de conhecimento, sistema de farol e chat.

9.1 Agentes de IA

A plataforma é estruturada em torno de agentes especializados, cada um com sua expertise específica.

9.1.1 Agentes Setoriais (8 agentes)

Operam principalmente no Módulo 4 (Check-list), mas alimentam todos os outros módulos:

Agente de Mobilização, Canteiro e Desmobilização.

Agente de Orçamento e Bases do Negócio (também atua no Módulo 1).

Agente de Qualidade e Segurança.

Agente de Planejamento.

Agente de Medição.

Agente de Engenharia (Projetos).

Agente de Processo de Produção.

Agente de Cenário Tendente (transversal aos demais — sintetiza tendências).

Cada agente é treinado especificamente em sua área, com conhecimento técnico aprofundado, vocabulário próprio do setor, normas aplicáveis e padrões de análise. Operam 24/7, processando documentos conforme chegam e atualizando os indicadores em tempo real.

9.1.2 Adm Contratual IA (agente sênior)

Agente transversal — o "consultor sênior" da plataforma. Orquestra os agentes setoriais, sintetiza suas análises, produz os entregáveis estratégicos:

RMA mensal.

Singularidades.

Claims consolidados.

Diagnósticos pré-contrato.

Cartas, pareceres, análises de cláusula.

Atende ao chat com o usuário.

Treinado com a expertise equivalente a mais de 200 mil horas de experiência prática em administração contratual, combinando conhecimento técnico (engenharia, normas AACE/IBAPE) e jurídico (direito contratual, jurisprudência arbitral e judicial brasileira).

9.2 Base de Conhecimento e Integrações

Alimenta todos os agentes. Quanto mais rica essa base, mais precisas e fundamentadas as análises.

9.2.1 Conteúdo da Base

Normas técnicas — AACE Recommended Practices (em especial 25R-03 sobre Earned Value), normas IBAPE/SP, normas ABNT aplicáveis.

Jurisprudência — integração com Jusbrasil para consulta de decisões judiciais e arbitrais.

Documentos do cliente — contratos, projetos, planilhas, RDOs, atas, cartas, e-mails, fotos.

Referências de preço e produtividade — integração via API com Orsafáscio (sugerida), bases SINAPI, dissídios sindicais.

Banco de contratos similares — para benchmarking e comparação.

9.2.2 Como os dados entram na plataforma

Hoje (MVP), o cliente faz upload manual de documentos e planilhas tratadas. Futuramente, a plataforma é desenhada para se conectar diretamente via API a:

E-mails da obra (importação automática de correspondência).

Sistemas de RDO digital usados pelas construtoras.

Repositórios de projetos (GreenDocs e similares).

Sistemas contábeis e de gestão de obra.

9.3 Sistema de Farol

Aplicado a todos os indicadores onde for relevante. Quatro níveis com cores padronizadas:

Conforme (verde)

Indicador dentro do contratado, sem desvio relevante. Nenhuma ação necessária.

Observação (azul)

Desvio leve. Monitorar. Manter registros adequados em RDO e ata.

Risco (amarelo)

Desvio relevante. Ação preventiva ou de registro recomendada. Cartas, atas formais, plano de ação.

Crítico (vermelho)

Desvio grave. Ação imediata. Início de pleito, claim, paralisação, comunicação formal.

Os critérios numéricos de classificação são configuráveis por contrato — alguns contratos toleram mais desvio que outros.

9.4 Chat com Adm Contratual IA

Disponível em todas as telas, sempre acessível. O usuário pode perguntar livremente:

"Por que o setor de Medição está em atenção?"

"Quais cláusulas do contrato suportam um pleito de prorrogação por chuvas?"

"Gera uma carta cobrando os projetos atrasados."

"Qual o melhor método de quantificação de produtividade para este caso?"

"Tem jurisprudência sobre glosa indevida de medição em contratos da Petrobras?"

O agente sênior consulta contratos, RDOs, projetos, normas e jurisprudência para responder. Conversas ficam arquivadas na Biblioteca de Documentos do contrato.

10. Estado Atual do Desenvolvimento (v1)

Esta seção fotografa o que já existe na v1 atual ("BM Tracker") e o que ainda precisa ser construído. Serve como mapa de gaps para o time de desenvolvimento.

10.1 O que existe hoje

A v1 atual concentra-se exclusivamente no Módulo 2 (Gestão Contratual), e mesmo dentro dele, em um subconjunto do RMA. Especificamente:

Indicadores macro do contrato (prazo decorrido, faturamento acumulado, alocação de recursos consolidada).

Análise de faturamento (gráfico de curva acumulada, cards de Contratado/Real/Saldo).

Análise de MOD, MOI e Equipamentos (comparativos mensais, histogramas, alocação em reais).

Produtividade hora-homem (comparativo real vs. contratado vs. benchmarks).

Panorama atual do contrato em três aspectos (técnico, econômico, físico).

Tela de equipe responsável e contatos.

O Excel modelado pelos devs (versão rev02) já estrutura as bases de dados de quase todo o RMA por slide (S3 a S15) e tem a fórmula de Valor Agregado implementada na aba S15 — base para a análise de perda de produtividade do Módulo 3.

10.2 O que precisa ser ajustado no que existe

No gráfico de faturamento, falta sobrepor a curva contratada à curva realizada (hoje aparece só o real).

Falta o card de Contratado Acumulado até a data de corte (hoje há só o Contratado Total — não há base correta de comparação).

Falta indicador de desvio destacado com cor do farol (hoje só valores absolutos).

Eliminar a tela de "Análise Detalhada do Faturamento" que está vazia nos primeiros BMs e gera confusão.

10.3 O que precisa ser construído (novo)

10.3.1 Dentro do RMA (Módulo 2)

Análise de faturamento por frente de serviço, com justificativas textuais.

Análise de prazo e cronograma (Windows Analysis, cronograma impactado).

Aba de Insumos (visualização).

Aba de Curvas Liberação x Capacidade x Alocado.

Aba de Análise de Responsabilidade.

Mapa/Retigráfico do contrato.

Aba de Melhorias Documentais.

Análise de RDOs (processamento contínuo).

Lista mestra de projetos.

Tratamento de RNC.

Matriz de impactos e Matriz de nexo causal.

Plano de Ação estruturado.

Indicadores tipo farol em todas as análises.

Biblioteca de documentos.

10.3.2 Módulos inteiros ainda não construídos

Módulo 1 (Pré-Contrato) — não há nada no Excel atual.

Módulo 3 (Painel de Desequilíbrio) — apenas a fórmula de Valor Agregado existe; falta Total Cost, Measured Mile, indiretos, BDI, encargos, insumos, atraso de pagamento, chuvas, gerador de claim.

Módulo 4 (Check-list da Obra) — não há nada.

Módulo 5 (Finalização) — não há nada.

10.3.3 Camadas transversais ainda não construídas

Camada de agentes de IA — toda.

Base de conhecimento (Jusbrasil, Orsafáscio, banco de normas, banco de contratos).

Sistema de farol.

Chat com Adm Contratual IA.

Dashboard inicial.

11. Próximos Passos

Este documento apresenta a visão completa da plataforma. Os próximos passos sugeridos para o time de desenvolvimento, em ordem de prioridade, são:

Etapa 1 — Completar o RMA do Módulo 2

Ajustar o que já existe na v1 e adicionar as funcionalidades faltantes da seção 10.3.1. É o mais maduro conceitualmente e o que entrega valor imediato ao cliente. Estimativa: maior bloco de trabalho do MVP.

Etapa 2 — Construir o Dashboard

Tela inicial consolidada. Permite ao cliente ver o portfólio antes de mergulhar em cada contrato. Importante para venda e demonstração.

Etapa 3 — Construir o Painel de Desequilíbrio (Módulo 3)

Implementar Total Cost, Measured Mile, análises de indiretos, BDI, encargos, insumos. Implementar o Gerador de Claim. Já existe base de dados parcial.

Etapa 4 — Construir os Agentes Setoriais

Começar pelos agentes que alimentam diretamente o RMA: Medição, Engenharia, Planejamento, Produção. Os demais (Mobilização, Orçamento, Qualidade, Cenário Tendente) podem vir em segunda onda.

Etapa 5 — Construir o Módulo 4 (Check-list)

Depende dos agentes setoriais. É a vitrine da metodologia SASBY e diferencia visualmente a plataforma das consultorias tradicionais.

Etapa 6 — Construir Pré-Contrato (Módulo 1) e Finalização (Módulo 5)

Cobrem os extremos do ciclo de vida do contrato. Importantes para a proposta de valor completa, mas podem vir depois do core.

Etapa 7 — Implementar integrações via API

E-mail da obra, sistemas de RDO, Jusbrasil, Orsafáscio. Transformam a plataforma de "sistema com upload manual" em "plataforma viva" conectada à obra. Importante para escalabilidade comercial.

Este documento será expandido conforme avançamos na construção. Cada módulo terá, no futuro, seu próprio documento de especificação detalhada — com fluxos de tela, modelagem de dados, regras de negócio específicas e modelos de entregáveis (cartas, claims, RMAs, transpasses, etc.) para servir de referência ao time de desenvolvimento.

Documento elaborado em maio de 2026.

Versão 1.0
