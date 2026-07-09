# Schema Supabase para Documentos Estáticos

> Modelagem das tabelas que vão receber a informação extraída dos 45 documentos da pasta `Estaticos/`. Estrutura **multi-empresa · multi-obra**, pensada para extração via agente IA.

**Princípios:**
- Toda tabela tem `id uuid` (default `gen_random_uuid()`), `created_at`, `updated_at`
- Multi-tenant via `org_id` (organização-cliente da plataforma — ex.: ETERC) na maioria das tabelas
- Multi-obra via `obra_id` onde aplicável
- Documento físico fica no Supabase Storage; metadados + extração ficam em `documents` + tabelas-alvo
- Toda extração feita por agente IA registra origem em `document_extractions` (rastreabilidade)
- Códigos do mundo real (CNPJ, CNO, código do contrato) viram **natural keys** em campos `code/document_number` com UNIQUE
- Valores monetários em `numeric(18,2)`; %s em `numeric(8,4)`

---

## 1. Análise por arquivo — o que extrair

Os 45 arquivos da pasta `Estaticos/` cabem em **8 grupos lógicos**. Para cada arquivo: o que ele contém e em quais tabelas a informação cai.

### 1.1 Identificação da Obra e Empresas (3 arquivos)

| Arquivo | Conteúdo | Tabelas-alvo |
|---|---|---|
| `CNPJ - ETERC.pdf` | CNPJ 03.987.285/0001-94 · razão social · CNAEs · porte · endereço · capital social | `companies` |
| `CNO Aeroporto Sorriso - MT.pdf` | CNO 90.025.81636/71 · zona (rural) · data início obra · CNAEs · situação | `obras`, `obra_codes` |
| `SEDEOSI202500028A-ordem de serviço.pdf` | OS nº SEDE-OSI-2025/00028 · representante legal contratada · contratante (Infraero) · objeto · prazo 780 dias (540 execução + 60+60+120) · início 22/09/2025 · término 15/03/2027 | `contracts`, `contract_milestones`, `companies` (Infraero) |

### 1.2 Contrato e Licitação (3 arquivos)

| Arquivo | Conteúdo | Tabelas-alvo |
|---|---|---|
| `Edital_Lic_SBSO_2024 (1).pdf` | Edital Licitação Eletrônica 188/ADLI-1/SBSO/2024 · objeto · regime · prazos · garantias | `tenders` |
| `Anexo_VI_Contrato_SBSO.pdf` | Minuta de contrato com cláusulas · regime contratação integrada · vinculação Lei 13.303/2016 · normas aplicáveis | `contracts`, `contract_clauses` |
| `Solicitação de reajuste-2425.pdf` | Pedido de reajuste já enviado · usado como TEMPLATE de claim | `document_templates` |

### 1.3 BDI (4 arquivos)

| Arquivo | Conteúdo | Tabelas-alvo |
|---|---|---|
| `Anexo_XIV_BDI_OBRAS.pdf` | BDI Obras: Grupo A (Adm Central 4%, Risco 1,11%) · Grupo B (Seguro 0,5%, Garantia 0,21%, Lucro 7,38%, Desp Fin 1,2%) · Grupo C (ISS 2,5%, PIS 0,65%, COFINS 3%, CPRB 4,5%) | `contract_bdis`, `bdi_items` |
| `Anexo_XIV_BDI_EQUIP_ESP.pdf` | BDI Equipamentos Especiais (variante com %s diferentes) | idem |
| `Anexo_XIV_BDI_SERV_TEC.pdf` | BDI Serviços Técnicos (variante) | idem |
| `11.1 d) BDI.pdf` | BDI da proposta da ETERC (valores efetivos: Adm 3,45%, Risco 0,85%, Lucro 5,11%, etc.) | idem (com `is_proposal = true`) |

### 1.4 Cronograma e Curva S Contratada (7 arquivos)

| Arquivo | Conteúdo | Tabelas-alvo |
|---|---|---|
| `TPS Sorriso- SBSO-R0.mpp` | Cronograma baseline em MS Project (R0) — tarefas, predecessores, durações | `schedules`, `schedule_tasks`, `wbs_items` |
| `Cronograma Fisico - SBSO.pdf` | Gantt físico | `schedules` (PDF rendering) |
| `Cronograma Fisico-financeiro - SBSO - 2025-10-07.pdf` | Curva S por mês out/25→mar/27 com valor e % por mês por item EDT | `schedule_monthly`, `wbs_items` |
| `Cronograma Físico- SBSO - 2026-03-10.pdf` | Versão impressa atualizada do físico | `schedules` (rev R1) |
| `2025.12.16 - Cronograma de custo - 2025-10-07.xlsx` | Cronograma de preços com Item, Composição, Unidade, Qtde, Pr Unitário, Pr Total, Custo Atual | `cost_schedules`, `wbs_items` |
| `Cronograma de quantidades .pdf` | Quantidades por item | `wbs_quantities` |
| `cronograma  financeiro de custo.pdf` | Cronograma financeiro impresso | `cost_schedules` (PDF dump) |
| `Sorriso - Planilha comparativa.xlsx` | 7 abas: Planilha de Venda (PSP) · Indices (índices reajuste) · Planilha comparativa (Custo Real × Índice Reajuste × valor inicial 08/24) · Total atividades · Cronograma de venda | `wbs_items`, `wbs_costs`, `contract_indices` |
| `Planilha de Venda.pdf` | Versão impressa da PSP | (cobertura dupla) |

### 1.5 Insumos / Curva ABC (5 arquivos)

| Arquivo | Conteúdo | Tabelas-alvo |
|---|---|---|
| `Curva ABC de Insumos.pdf` | Lista classificada ABC dos insumos com % e acumulado % | `obra_insumos` |
| `Cronograma de insumos curva abc R1.xlsx` | 357 itens com Cód Grupo Custo · Grupo Custo · Código Insumo · Descrição · Unidade · Quantidade · Valor Unit · Valor Total · % · % Acum | `insumos`, `obra_insumos`, `cost_groups` |
| `Histograma de insumo Curva ABC.pdf` | Visual da Curva ABC | (PDF render) |
| `histograma de insumos por quantidades.xlsx` | 4329 linhas: Código Tarefa · Código Insumo · Descrição · Quantidade · Unidade · Composição · % standard · Total | `wbs_insumo_quantities` |
| `histograma de insumos por valor.xlsx` | Mesma estrutura, em valores | `wbs_insumo_values` |

### 1.6 Histogramas (4 arquivos)

| Arquivo | Conteúdo | Tabelas-alvo |
|---|---|---|
| `HISTOGRAMA_MDO_AEROPORTO_SORRISO_MT_REV00.pdf` | Histograma MO real DGB por mês × função (15→36→48→50→42→18 funcionários abr-set/26 + acumulado) | `histogram_monthly` |
| `Histograma de mão de obra.pdf` | Histograma MO contratada do PA | `histogram_monthly` |
| `Histograma de mão de obra - QSMS.xlsx` | Histograma MOI por função × mês (almoxarife, apontador, comprador, etc.) | `histogram_monthly` |
| `Histograma de Materiais.pdf` | Materiais consumidos por mês | `material_consumption_monthly` |
| `Histograma de Subcontratados.pdf` | Subs ativos por mês | `subcontractor_monthly` |
| `M.O - Planejamento - Aeroporto de Sorriso.xlsx` | 51 funções × quantidade meses (Ajudante Armador 28m, Almoxarife 11m, ...) | `mo_planning` |

### 1.7 Estrutura Organizacional (5 arquivos)

| Arquivo | Conteúdo | Tabelas-alvo |
|---|---|---|
| `Organograma-SBSO .pdf` | Organograma visual do contrato | (PDF render) |
| `ETERC - Organograma-sorriso-r1.xlsx` | 6 abas: Organograma (hierarquia) · Matriz de Responsabilidade (atividades × papel) · DI (Despesa Indireta — pessoal com código, quantidade, valor mensal, regime PJ/CLT) · Planilha2 (composição de cargos) · Alocação MO (insumos IH×× horas) · GERAL quantidades | `org_structure`, `positions`, `stakeholders`, `mo_planning` |
| `Matriz de responsabilidade.pdf` | RACI ou similar dos cargos × atividade | `responsibility_matrix` |
| `Matriz de Responsabilidade e Permissão.xlsx` | 4 abas: RESPONSABILIDADES (área × setor) · RESPONSABILIDADES GLOBAIS (P/C/M/F por setor) · PERMISSÕES (L/G — leitura/gestão) · CRONOGRAMA DE ENTREGA | `responsibility_matrix`, `permissions_matrix` |
| `Vendor List COnsolidada com HTB.xlsx` | 7 abas por categoria (Fundações · Civil · Armação · Pintura · Instalações · Drywall/Forro/Steel Frame · Steel Deck) com Fornecedor · Contato · Telefone · E-mail · Obs | `vendors`, `vendor_categories` |
| `relação de projetistas.xlsx` | Empresas projetistas × disciplina | `designers`, `design_disciplines`, `obra_designs` |

### 1.8 Documentos Técnicos e Templates (8 arquivos)

| Arquivo | Conteúdo | Tabelas-alvo |
|---|---|---|
| `PA - Plano de Ataque ... Rev 02 (1).pdf` (+ .docx + 2 OLD) | Plano estratégico completo: §2 Dados básicos · §2.3 Serviços · §2.5 Materiais Curva ABC · §2.6 Equipamentos · §2.7 Alocação MO · §2.8 Recursos · §3 Análise Cliente + SWOT · §4 Premissas · §5 Avaliação Riscos · §8/9/10 Planos | `attack_plans`, `swot_items`, `contract_risks`, `strategic_premises`, `plan_sections` |
| `PI.01-201.75-0001-01_MEMORIAL DESCRITIVO.pdf` | Memorial descritivo da arquitetura | `technical_documents` |
| `SBSO Estudos Estacas.xlsx` | Estudo de pré-dimensionamento de fundações | `technical_documents` |
| `2025.09.26  SBSO Apresentação - PONTOS DE ATENÇÃO.pptx` | Ponto de atenção: subdimensionamento TPS | `technical_documents`, `attention_points` |
| `SBSO-ETC-INF-0002-2026 ... - signed.pdf` | Resposta a Ofício INFRAERO — usado como TEMPLATE de carta | `document_templates` |
| `SBSO-GRL-ATA-0001-00.xlsx` | Template de Ata de Reunião (Empreendimento · Data · Horário · Assunto · Participantes/E-mails) | `document_templates`, `meeting_minutes` (instâncias) |

---

## 2. Modelo de entidades — visão de alto nível

```
                   ┌─────────────────┐
                   │ organizations   │ (tenant da plataforma — ETERC)
                   └────────┬────────┘
                            │ 1:N
                  ┌─────────┴─────────┐
                  │                   │
            ┌─────▼─────┐       ┌────▼─────┐
            │ companies │       │  people  │
            └─────┬─────┘       └────┬─────┘
                  │ N:M               │
                  └────┬──────────────┘
                       │
                  ┌────▼────────┐
                  │   obras     │──────────┐
                  └────┬────────┘          │
                       │                   │
            ┌──────────┼──────────┐        │
            │          │          │        │
       ┌────▼────┐  ┌──▼─────┐  ┌─▼─────┐  │
       │contracts│  │vendors │  │designs│  │
       └────┬────┘  └────────┘  └───────┘  │
            │                              │
   ┌────────┼────────┐                     │
   │        │        │                     │
   ▼        ▼        ▼                     ▼
 BDIs   Schedules   AttackPlans      OrgStructure
   │        │        │                     │
   ▼        ▼        ▼                     ▼
 Items  WBS+Curva  Risks/SWOT       Positions+
        +Insumos                    Stakeholders
                                    +RACI
                                    +Histograms
```

---

## 3. Schema SQL — `CREATE TABLE` por entidade

### 3.1 Núcleo (multi-tenant)

```sql
-- 1. ORGANIZAÇÕES (tenants da plataforma — ETERC é uma org)
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. EMPRESAS (contratada, contratante, projetistas, subs — qualquer PJ)
CREATE TABLE companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  cnpj text UNIQUE,                          -- "03.987.285/0001-94"
  legal_name text NOT NULL,                  -- "ETERC ENGENHARIA LTDA"
  trade_name text,                           -- "ETERC"
  opening_date date,
  size_category text,                        -- "DEMAIS", "ME", "EPP"
  primary_cnae_code text,
  primary_cnae_description text,
  secondary_cnaes jsonb,                     -- [{ code: "42.11-1-02", desc: "..." }]
  legal_nature text,
  share_capital numeric(18,2),
  address jsonb,                             -- { logradouro, número, cep, cidade, uf }
  contacts jsonb,                            -- { phone, email, website }
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. PESSOAS (gestores, gerentes, engenheiros, equipe)
CREATE TABLE people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  phone text,
  cpf text,
  professional_title text,                   -- "Eng. Civil", "Adv."
  professional_registry text,                -- "CREA-DF 1234567"
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. OBRAS
CREATE TABLE obras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  contractor_id uuid REFERENCES companies(id),    -- contratada
  client_id uuid REFERENCES companies(id),        -- contratante (Infraero)
  name text NOT NULL,                             -- "Aeroporto de Sorriso - SBSO"
  short_code text,                                -- "SBSO"
  icao_code text,                                 -- código aeroporto, se aplicável
  cno text,                                       -- "90.025.81636/71"
  cib text,                                       -- Cadastro Imobiliário
  zone_type text,                                 -- "Rural", "Urbana"
  city text,
  state text,
  start_date_official date,                       -- do CNO
  status text DEFAULT 'active',                   -- 'planning'|'active'|'closed'|'cancelled'
  primary_cnae_code text,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. STAKEHOLDERS — pessoa × obra × papel (Gestor da obra, Adm contratual, etc.)
CREATE TABLE stakeholders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid REFERENCES obras(id) ON DELETE CASCADE,
  person_id uuid REFERENCES people(id),
  company_id uuid REFERENCES companies(id),       -- de qual empresa essa pessoa atua
  role text NOT NULL,                             -- "Gestor da Obra", "Adm Contratual", "Eng. Planejamento"
  is_primary boolean DEFAULT false,               -- "responsável principal pela função"
  start_date date,
  end_date date,                                  -- null = ainda atuando
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_stakeholders_obra ON stakeholders(obra_id);
```

### 3.2 Contrato e Licitação

```sql
-- 6. LICITAÇÕES (Tender / processo licitatório)
CREATE TABLE tenders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES companies(id),
  tender_number text NOT NULL,                    -- "188/ADLI-1/SBSO/2024"
  modality text,                                  -- "Licitação Eletrônica", "Concorrência", "RDC"
  legal_framework text,                           -- "Lei 13.303/2016"
  object_description text,
  estimated_value numeric(18,2),
  publication_date date,
  proposal_opening_date date,
  status text,                                    -- 'open'|'closed'|'awarded'|'cancelled'
  created_at timestamptz DEFAULT now()
);

-- 7. CONTRATOS
CREATE TABLE contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid REFERENCES obras(id) ON DELETE CASCADE,
  tender_id uuid REFERENCES tenders(id),
  contract_number text NOT NULL,                  -- "0124-EG/2025/0210"
  internal_code text,                             -- "SEDE-CTR-2025/00162"
  contractor_id uuid REFERENCES companies(id),
  client_id uuid REFERENCES companies(id),
  object_description text NOT NULL,
  execution_regime text,                          -- "Contratação Integrada", "Preço Global"
  contract_value_p0 numeric(18,2) NOT NULL,       -- R$ 39.766.000 (P0)
  contract_value_current numeric(18,2),           -- com reajuste + aditivos
  signature_date date,                            -- 04/09/2025 ou 08/09/2025
  start_date date,                                -- 22/09/2025 (data OS)
  execution_days int,                             -- 540
  contract_duration_days int,                     -- 780 (inclui aceite + pgto)
  end_date_planned date,                          -- 15/03/2027
  end_date_with_extension date,
  base_date date,                                 -- 08/2024 (data-base reajuste)
  readjustment_periodicity_months int,            -- 12
  resource_source text,                           -- "Própria", "União (MIDR)"
  resource_program text,
  budget_code text,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 8. PARTES DO CONTRATO (representantes legais, fiscais, gestores)
CREATE TABLE contract_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES contracts(id) ON DELETE CASCADE,
  party_type text NOT NULL,                       -- 'representante_contratante'|'representante_contratada'|'fiscal'|'gestor'
  person_id uuid REFERENCES people(id),
  company_id uuid REFERENCES companies(id),
  signature_position text,                        -- "Representante Legal"
  created_at timestamptz DEFAULT now()
);

-- 9. CLÁUSULAS DO CONTRATO (texto + tipo)
CREATE TABLE contract_clauses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES contracts(id) ON DELETE CASCADE,
  clause_number text,                             -- "1.1", "5.3"
  clause_title text,                              -- "DO OBJETO"
  category text,                                  -- 'objeto'|'preço'|'prazo'|'reajuste'|'penalidade'|'rescisão'
  full_text text,
  order_index int,
  created_at timestamptz DEFAULT now()
);

-- 10. ÍNDICES DE REAJUSTE
CREATE TABLE contract_indices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES contracts(id) ON DELETE CASCADE,
  index_code text NOT NULL,                       -- "I1", "I2", "I3"
  series_code text,                               -- "1464984"
  source text,                                    -- "IBGE", "FGV", "CAIXA"
  description text,                               -- "INCC-Brasil-DI-Projetos"
  weight_percent numeric(8,4),                    -- peso na fórmula paramétrica
  created_at timestamptz DEFAULT now()
);

-- 11. MARCOS CONTRATUAIS (Data OS, Mob, Conc. Estrut., Entrega, etc.)
CREATE TABLE contract_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES contracts(id) ON DELETE CASCADE,
  milestone_code text,                            -- "M0", "M1", "M3"
  title text NOT NULL,                            -- "Ordem de Serviço", "Conclusão da estrutura"
  category text,                                  -- 'inicio'|'mobilizacao'|'fase'|'entrega'|'aceite'|'pagamento'
  planned_date date,
  actual_date date,
  duration_days int,
  description text,
  order_index int,
  created_at timestamptz DEFAULT now()
);
```

### 3.3 BDI

```sql
-- 12. BDIs DO CONTRATO (pode ter mais de um: Obras, Equip Esp, Serv Tec, Proposta)
CREATE TABLE contract_bdis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES contracts(id) ON DELETE CASCADE,
  bdi_type text NOT NULL,                         -- 'obras'|'equipamentos_especiais'|'servicos_tecnicos'|'proposta'
  is_proposal boolean DEFAULT false,              -- true = BDI ofertado pela contratada (não o normativo)
  total_percent numeric(8,4),                     -- BDI total final
  total_percent_with_desoneration numeric(8,4),
  formula text,                                   -- "(1+A)x(1+B)/(1-C) - 1"
  source_document text,
  created_at timestamptz DEFAULT now()
);

-- 13. ITENS DA COMPOSIÇÃO DO BDI
CREATE TABLE bdi_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bdi_id uuid REFERENCES contract_bdis(id) ON DELETE CASCADE,
  group_letter text NOT NULL,                     -- 'A', 'B', 'C'
  item_number int,                                -- 1, 2, 3...
  item_name text NOT NULL,                        -- "Administração Central", "Risco", "Lucro Bruto"
  percent_value numeric(8,4) NOT NULL,
  notes text,
  order_index int
);
```

### 3.4 EDT / WBS

```sql
-- 14. EDT (Estrutura Analítica do Projeto) — hierárquico
CREATE TABLE wbs_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid REFERENCES obras(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES contracts(id),
  parent_id uuid REFERENCES wbs_items(id),
  edt_code text NOT NULL,                         -- "1.1.1.1.2"
  external_code text,                             -- código original da fonte (Composição, etc)
  name text NOT NULL,                             -- "Administração Local"
  description text,
  unit text,                                      -- "conj.", "m²", "kg", "Hh"
  quantity numeric(18,4),
  unit_cost numeric(18,4),
  total_cost numeric(18,2),
  level int NOT NULL,                             -- 1, 2, 3, 4...
  order_index int,
  is_summary boolean DEFAULT false,               -- linha agregadora
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_wbs_parent ON wbs_items(parent_id);
CREATE INDEX idx_wbs_obra ON wbs_items(obra_id);
CREATE UNIQUE INDEX idx_wbs_obra_code ON wbs_items(obra_id, edt_code);

-- 15. FRENTES DE SERVIÇO (TPS, KF/ETE, CRS, Guarita, Terraplenagem, Fundações)
CREATE TABLE service_fronts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid REFERENCES obras(id) ON DELETE CASCADE,
  name text NOT NULL,                             -- "TPS", "Terraplenagem", "Fundações"
  short_code text,
  description text,
  parent_front_id uuid REFERENCES service_fronts(id),
  order_index int,
  created_at timestamptz DEFAULT now()
);

-- 16. WBS ↔ FRENTE (vinculação)
CREATE TABLE wbs_fronts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wbs_id uuid REFERENCES wbs_items(id) ON DELETE CASCADE,
  front_id uuid REFERENCES service_fronts(id) ON DELETE CASCADE,
  UNIQUE(wbs_id, front_id)
);
```

### 3.5 Cronograma e Curva S

```sql
-- 17. CRONOGRAMAS (versões: R0 baseline, R1, R2...)
CREATE TABLE schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid REFERENCES obras(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES contracts(id),
  revision text NOT NULL,                         -- "R0", "R1"
  revision_date date NOT NULL,
  is_baseline boolean DEFAULT false,              -- R0 = baseline contratual
  is_current boolean DEFAULT false,               -- apenas 1 por obra
  total_value numeric(18,2),
  duration_days int,
  start_date date,
  end_date date,
  source_file text,                               -- ".mpp", "pdf"
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 18. TAREFAS DO CRONOGRAMA
CREATE TABLE schedule_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid REFERENCES schedules(id) ON DELETE CASCADE,
  wbs_id uuid REFERENCES wbs_items(id),
  task_code text,                                 -- ID exclusivo no MS Project
  task_name text NOT NULL,
  duration_days int,
  start_date date,
  end_date date,
  predecessors text,                              -- "ID4,ID5FS+2d"
  resource_assignments text,
  is_milestone boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 19. DISTRIBUIÇÃO MENSAL DO CRONOGRAMA (Curva S Contratada)
CREATE TABLE schedule_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid REFERENCES schedules(id) ON DELETE CASCADE,
  wbs_id uuid REFERENCES wbs_items(id),
  reference_month date NOT NULL,                  -- "2026-05-01"
  planned_value numeric(18,2),                    -- R$ no mês
  planned_percent numeric(8,4),                   -- % do total do item no mês
  cumulative_value numeric(18,2),
  cumulative_percent numeric(8,4)
);
CREATE INDEX idx_smonth_sched ON schedule_monthly(schedule_id);
CREATE INDEX idx_smonth_month ON schedule_monthly(reference_month);
```

### 3.6 Insumos / Curva ABC

```sql
-- 20. GRUPOS DE CUSTO (Subempreiteiros, ISS Retido, PIS, etc.)
CREATE TABLE cost_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  code text UNIQUE,                               -- "CC000002"
  name text NOT NULL,                             -- "SUBEMPREITEIROS"
  category text                                   -- 'subempreitero'|'material'|'mao_obra'|'imposto'|'equipamento'
);

-- 21. INSUMOS (catálogo global por organização — reutilizável entre obras)
CREATE TABLE insumos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  code text NOT NULL,                             -- "IS2005", "IH0085"
  description text NOT NULL,                      -- "HVAC", "OPERADOR DE MAQUINAS"
  unit text NOT NULL,                             -- "UN", "H", "m³", "kg"
  cost_group_id uuid REFERENCES cost_groups(id),
  category text,                                  -- 'subempreiteiro'|'material'|'mao_obra'|'equipamento'
  UNIQUE(org_id, code)
);

-- 22. INSUMOS DA OBRA (Curva ABC contratual)
CREATE TABLE obra_insumos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid REFERENCES obras(id) ON DELETE CASCADE,
  insumo_id uuid REFERENCES insumos(id),
  abc_rank int,                                   -- 1, 2, 3...
  abc_class text,                                 -- 'A'|'B'|'C'
  quantity numeric(18,4),
  unit_cost numeric(18,4),
  total_value numeric(18,2),
  percent_of_total numeric(8,4),
  cumulative_percent numeric(8,4),
  created_at timestamptz DEFAULT now(),
  UNIQUE(obra_id, insumo_id)
);

-- 23. INSUMO × ITEM EDT (quanto cada item consome)
CREATE TABLE wbs_insumo_consumption (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wbs_id uuid REFERENCES wbs_items(id) ON DELETE CASCADE,
  insumo_id uuid REFERENCES insumos(id),
  composition_code text,
  composition_description text,
  standard_quantity numeric(18,6),               -- quantidade padrão por unidade
  total_quantity numeric(18,4),
  total_value numeric(18,2)
);

-- 24. DISTRIBUIÇÃO MENSAL DE INSUMO
CREATE TABLE obra_insumo_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid REFERENCES obras(id),
  insumo_id uuid REFERENCES insumos(id),
  reference_month date NOT NULL,
  planned_quantity numeric(18,4),
  planned_value numeric(18,2)
);
```

### 3.7 Histogramas (MO/Equipamentos/Subs)

```sql
-- 25. POSIÇÕES / CARGOS (Catálogo organizacional)
CREATE TABLE positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  code text,                                      -- "CA0001"
  title text NOT NULL,                            -- "Diretor", "Almoxarife", "Pedreiro"
  category text,                                  -- 'administrativo'|'producao'|'qsms'|'diretoria'
  resource_type text,                             -- 'MOD'|'MOI'|'EQP'
  default_monthly_cost numeric(18,2),
  default_regime text,                            -- 'PJ'|'CLT'|'Terceirizado'
  UNIQUE(org_id, code)
);

-- 26. ESTRUTURA ORGANIZACIONAL DA OBRA
CREATE TABLE org_structure (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid REFERENCES obras(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES org_structure(id),
  position_id uuid REFERENCES positions(id),
  internal_code text,                             -- "3.1.1"
  area text,                                      -- "Administração", "Produção", "SGI"
  planned_quantity numeric(8,2),                  -- 1, 0.2 (parcial), etc.
  monthly_cost numeric(18,2),
  regime text,                                    -- 'PJ'|'CLT'
  level int,
  order_index int
);

-- 27. HISTOGRAMA (definição) — uma obra pode ter vários: MO Contratada, MO Real, MOI, MOD, EQP, Subs
CREATE TABLE histograms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid REFERENCES obras(id) ON DELETE CASCADE,
  histogram_type text NOT NULL,                   -- 'mod_contratada'|'mod_real'|'moi'|'eqp'|'subcontratados'|'materiais'
  source text,                                    -- 'PA'|'DGB'|'QSMS'|'Real'
  revision text,                                  -- "R0", "R1"
  start_month date,
  end_month date,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 28. HISTOGRAMA MENSAL (linha por mês × função/recurso)
CREATE TABLE histogram_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  histogram_id uuid REFERENCES histograms(id) ON DELETE CASCADE,
  position_id uuid REFERENCES positions(id),
  resource_label text,                            -- preenchido se sem position_id (ex.: "Caçamba (terceirizada)")
  reference_month date NOT NULL,
  quantity numeric(8,2) NOT NULL,                 -- 1, 2, 5 funcionários ou unidades
  cumulative_quantity numeric(8,2),
  unit text,                                      -- "pessoas", "unidades", "Hh"
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_hist_month_hist ON histogram_monthly(histogram_id);

-- 29. PLANEJAMENTO DE MO (M.O - Planejamento.xlsx — função × meses totais)
CREATE TABLE mo_planning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid REFERENCES obras(id) ON DELETE CASCADE,
  position_id uuid REFERENCES positions(id),
  function_label text,                            -- caso position_id seja null
  total_months numeric(6,2)                       -- "28 meses"
);
```

### 3.8 Matriz de Responsabilidade e Permissões

```sql
-- 30. ATIVIDADES / ÁREAS-FOCO (catálogo: "01. PRÉ-CONTRATO/01. LICITAÇÃO", etc.)
CREATE TABLE activity_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  code text,                                      -- "01.01"
  name text NOT NULL,                             -- "PRÉ-CONTRATO / LICITAÇÃO"
  parent_id uuid REFERENCES activity_areas(id),
  level int,
  order_index int
);

-- 31. MATRIZ DE RESPONSABILIDADE (RACI-like)
CREATE TABLE responsibility_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid REFERENCES obras(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES activity_areas(id),
  department_obra text,                           -- 'Engenharia'|'DP'|'Administrativo'|'Suprimentos'|'SGI'
  department_matriz text,                         -- 'Engenharia'|'Contabilidade'
  responsibility_type text,                       -- 'P'(Principal)|'C'(Compartilhado)|'M'(Monitora)|'F'(Faz)|'X'(Marcador)
  notes text
);

-- 32. MATRIZ DE PERMISSÕES
CREATE TABLE permissions_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid REFERENCES obras(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES activity_areas(id),
  department text,
  permission_level text,                          -- 'L'(Leitura)|'G'(Gestão)|'E'(Edição)
  notes text
);
```

### 3.9 Vendor List / Projetistas

```sql
-- 33. CATEGORIAS DE FORNECEDOR
CREATE TABLE vendor_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,                             -- "Fundações", "Civil", "Armação"
  parent_id uuid REFERENCES vendor_categories(id),
  order_index int
);

-- 34. FORNECEDORES (Vendor List — catálogo)
CREATE TABLE vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id),       -- se já existir cadastro completo
  name text NOT NULL,                             -- "Barbosa e DallaRosa"
  contact_person text,
  phone text,
  email text,
  notes text,                                     -- "Estaca Raiz", "Varzea Grande / MT"
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 35. FORNECEDOR × CATEGORIA (N:M)
CREATE TABLE vendor_category_assignments (
  vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE,
  category_id uuid REFERENCES vendor_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (vendor_id, category_id)
);

-- 36. VENDOR LIST DA OBRA (qual fornecedor está habilitado nesta obra)
CREATE TABLE obra_vendor_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid REFERENCES obras(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES vendors(id),
  category_id uuid REFERENCES vendor_categories(id),
  status text DEFAULT 'qualified',                -- 'qualified'|'contracted'|'disqualified'
  added_at timestamptz DEFAULT now()
);

-- 37. DISCIPLINAS DE PROJETO
CREATE TABLE design_disciplines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id),
  name text NOT NULL                              -- "Arquitetura", "Estrutura", "Elétrica", "HVAC"
);

-- 38. PROJETISTAS (empresas) × OBRA × DISCIPLINA
CREATE TABLE obra_designers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid REFERENCES obras(id) ON DELETE CASCADE,
  designer_company_id uuid REFERENCES companies(id),
  discipline_id uuid REFERENCES design_disciplines(id),
  responsible_person_id uuid REFERENCES people(id),
  status text                                     -- 'active'|'completed'|'cancelled'
);
```

### 3.10 Plano de Ataque (PA)

```sql
-- 39. PLANO DE ATAQUE
CREATE TABLE attack_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES contracts(id) ON DELETE CASCADE,
  revision text NOT NULL,                         -- "Rev 02"
  revision_date date,
  status text DEFAULT 'active',                   -- 'draft'|'active'|'archived'
  full_document_id uuid,                          -- FK pra documents
  created_at timestamptz DEFAULT now()
);

-- 40. SEÇÕES DO PA (texto livre por seção)
CREATE TABLE plan_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attack_plan_id uuid REFERENCES attack_plans(id) ON DELETE CASCADE,
  section_number text,                            -- "1", "2.1", "5.1"
  section_title text NOT NULL,
  section_text text,
  order_index int
);

-- 41. SWOT
CREATE TABLE swot_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attack_plan_id uuid REFERENCES attack_plans(id) ON DELETE CASCADE,
  category text NOT NULL,                         -- 'forca'|'fraqueza'|'oportunidade'|'ameaca'
  description text NOT NULL,
  impact_level text,                              -- 'baixo'|'medio'|'alto'
  order_index int
);

-- 42. RISCOS CONTRATUAIS (e mitigadoras)
CREATE TABLE contract_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attack_plan_id uuid REFERENCES attack_plans(id) ON DELETE CASCADE,
  category text NOT NULL,                         -- 'contratual'|'economico'|'tecnico'|'ambiental'|'politico'|'rh'
  risk_title text NOT NULL,
  risk_description text,
  consequence text,
  mitigation text,
  probability text,                               -- 'baixa'|'media'|'alta'
  impact text,                                    -- 'baixo'|'medio'|'alto'
  status text DEFAULT 'open',                     -- 'open'|'mitigated'|'materialized'|'closed'
  order_index int
);

-- 43. PREMISSAS ESTRATÉGICAS
CREATE TABLE strategic_premises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attack_plan_id uuid REFERENCES attack_plans(id) ON DELETE CASCADE,
  description text NOT NULL,
  order_index int
);
```

### 3.11 Documentos Técnicos e Pontos de Atenção

```sql
-- 44. DOCUMENTOS TÉCNICOS (memoriais, estudos)
CREATE TABLE technical_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid REFERENCES obras(id) ON DELETE CASCADE,
  doc_type text NOT NULL,                         -- 'memorial_descritivo'|'estudo_fundacoes'|'estudo_topografico'
  discipline_id uuid REFERENCES design_disciplines(id),
  internal_code text,                             -- "PI.01-201.75-0001-01"
  revision text,
  title text NOT NULL,
  document_id uuid                                -- FK pra documents
);

-- 45. PONTOS DE ATENÇÃO
CREATE TABLE attention_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid REFERENCES obras(id) ON DELETE CASCADE,
  detected_date date,
  title text NOT NULL,                            -- "Subdimensionamento do TPS"
  description text,
  responsible_party text,                         -- 'contratante'|'contratada'|'compartilhado'
  severity text,                                  -- 'baixa'|'media'|'alta'|'critica'
  status text,                                    -- 'aberto'|'em_analise'|'resolvido'
  source_document_id uuid
);
```

### 3.12 Storage de Documentos + Templates + Extração IA

```sql
-- 46. TIPOS DE DOCUMENTO (taxonomia)
CREATE TABLE document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,                      -- 'CNO', 'CNPJ', 'CONTRATO', 'OS', 'BDI', 'CRONOGRAMA_FF', 'PA', 'CURVA_ABC'
  name text NOT NULL,
  category text,                                  -- 'identificacao'|'contratual'|'cronograma'|'orcamento'|'recursos'|'tecnico'|'template'
  is_static boolean DEFAULT true,                 -- estático vs. recorrente
  recurrence text,                                -- 'unique'|'monthly'|'weekly'|'daily'|'eventual'
  expected_extraction jsonb                       -- esquema do que o agente IA deve extrair
);

-- 47. DOCUMENTOS UPLOADED (Storage Supabase)
CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  obra_id uuid REFERENCES obras(id),
  contract_id uuid REFERENCES contracts(id),
  document_type_id uuid REFERENCES document_types(id),
  storage_path text NOT NULL,                     -- caminho no bucket
  original_filename text NOT NULL,
  mime_type text,
  file_size bigint,
  hash_sha256 text,                               -- dedupe
  reference_date date,                            -- data do conteúdo (ex.: BM-03 = 31/05/2026)
  upload_user_id uuid,                            -- FK auth.users
  upload_source text,                             -- 'manual'|'email'|'whatsapp'|'api'
  is_template boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_docs_obra ON documents(obra_id);
CREATE INDEX idx_docs_type ON documents(document_type_id);

-- 48. REVISÕES (linkagem entre versões do mesmo doc)
CREATE TABLE document_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_document_id uuid REFERENCES documents(id),  -- a 1ª versão
  document_id uuid REFERENCES documents(id),
  revision_label text,                              -- "R0", "R1", "R02"
  revision_date date,
  notes text
);

-- 49. EXTRAÇÕES DE IA (log do que cada agente extraiu de cada doc)
CREATE TABLE document_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
  agent_name text NOT NULL,                       -- "extract-contract", "extract-bdi", "extract-schedule"
  agent_version text,
  extraction_status text NOT NULL,                -- 'pending'|'running'|'success'|'partial'|'failed'|'needs_review'
  extracted_data jsonb,                           -- payload bruto da extração
  validation_errors jsonb,
  confidence_score numeric(5,2),                  -- 0-100
  target_tables text[],                           -- tabelas onde os dados foram gravados
  target_record_ids uuid[],
  started_at timestamptz,
  completed_at timestamptz,
  reviewed_by uuid,                               -- FK auth.users
  reviewed_at timestamptz,
  notes text
);

-- 50. TEMPLATES DE DOCUMENTOS (cartas, atas, memoriais — usados para gerar saídas)
CREATE TABLE document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  template_type text NOT NULL,                    -- 'carta_reajuste'|'carta_impugnacao'|'memorial'|'ata_reuniao'|'oficio'
  name text NOT NULL,
  description text,
  source_document_id uuid REFERENCES documents(id),  -- doc-modelo de onde nasceu
  template_body text,                             -- corpo com placeholders {{cliente}}, {{valor}}, etc.
  variables_schema jsonb,                         -- definição dos placeholders
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 51. INSTÂNCIAS GERADAS (atas reais, cartas geradas)
CREATE TABLE meeting_minutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid REFERENCES obras(id) ON DELETE CASCADE,
  template_id uuid REFERENCES document_templates(id),
  ata_number text,                                -- "ATA-0001-00"
  meeting_date date NOT NULL,
  meeting_time time,
  subject text,                                   -- "Projetos"
  participants jsonb,                             -- [{ name, email }, ...]
  discussion_text text,
  decisions text,
  next_steps text,
  document_id uuid REFERENCES documents(id),
  created_at timestamptz DEFAULT now()
);
```

---

## 4. Mapeamento: arquivo → tabelas

| Arquivo | Tabelas-alvo (ordem de gravação) |
|---|---|
| `CNPJ - ETERC.pdf` | `companies` |
| `CNO Aeroporto Sorriso - MT.pdf` | `obras` |
| `SEDEOSI...ordem de serviço.pdf` | `companies` (Infraero) · `contracts` · `contract_milestones` (OS) |
| `Edital_Lic_SBSO_2024 (1).pdf` | `tenders` · `companies` (Infraero) |
| `Anexo_VI_Contrato_SBSO.pdf` | `contracts` · `contract_clauses` |
| `Anexo_XIV_BDI_OBRAS.pdf` (+ EQUIP_ESP + SERV_TEC) | `contract_bdis` (3 rows) · `bdi_items` (~10 por BDI) |
| `11.1 d) BDI.pdf` | `contract_bdis` (is_proposal=true) · `bdi_items` |
| `TPS Sorriso- SBSO-R0.mpp` | `schedules` · `schedule_tasks` · `wbs_items` |
| `Cronograma Fisico-financeiro - SBSO - 2025-10-07.pdf` | `schedule_monthly` |
| `Cronograma Fisico - SBSO.pdf` + `Físico- SBSO - 2026-03-10.pdf` | `schedules` (PDF render) |
| `2025.12.16 - Cronograma de custo - 2025-10-07.xlsx` | `wbs_items` · `wbs_quantities` · `wbs_costs` |
| `Cronograma de quantidades .pdf` | `wbs_quantities` |
| `cronograma  financeiro de custo.pdf` | (já coberto pelo xlsx) |
| `Sorriso - Planilha comparativa.xlsx` | `wbs_items` · `contract_indices` · `wbs_costs` |
| `Planilha de Venda.pdf` | (cobertura dupla com a xlsx) |
| `Curva ABC de Insumos.pdf` | `obra_insumos` |
| `Cronograma de insumos curva abc R1.xlsx` | `cost_groups` · `insumos` · `obra_insumos` |
| `histograma de insumos por quantidades.xlsx` | `wbs_insumo_consumption` (qtd) |
| `histograma de insumos por valor.xlsx` | `wbs_insumo_consumption` (valor) |
| `Histograma de insumo Curva ABC.pdf` | (PDF render) |
| `HISTOGRAMA_MDO_AEROPORTO_SORRISO_MT_REV00.pdf` | `histograms` (source=DGB) · `histogram_monthly` |
| `Histograma de mão de obra.pdf` | `histograms` (source=PA) · `histogram_monthly` |
| `Histograma de mão de obra - QSMS.xlsx` | `histograms` (source=QSMS, type=MOI) · `histogram_monthly` |
| `Histograma de Materiais.pdf` | `material_consumption_monthly` (tabela espelho a criar) |
| `Histograma de Subcontratados.pdf` | `histograms` (type=subcontratados) · `histogram_monthly` |
| `M.O - Planejamento - Aeroporto de Sorriso.xlsx` | `positions` · `mo_planning` |
| `Organograma-SBSO .pdf` + `ETERC - Organograma-sorriso-r1.xlsx` | `positions` · `org_structure` · `responsibility_matrix` (aba Matriz) · `wbs_insumo_consumption` (aba Alocação MO) |
| `Matriz de responsabilidade.pdf` | `responsibility_matrix` |
| `Matriz de Responsabilidade e Permissão.xlsx` | `activity_areas` · `responsibility_matrix` · `permissions_matrix` |
| `Vendor List COnsolidada com HTB.xlsx` | `vendor_categories` (7) · `vendors` (~50) · `vendor_category_assignments` · `obra_vendor_list` |
| `relação de projetistas.xlsx` | `design_disciplines` · `companies` (projetistas) · `obra_designers` |
| `PA - Plano de Ataque ... .pdf/.docx` | `attack_plans` · `plan_sections` · `swot_items` · `contract_risks` · `strategic_premises` |
| `PI.01-201.75-0001-01_MEMORIAL DESCRITIVO.pdf` | `technical_documents` |
| `SBSO Estudos Estacas.xlsx` | `technical_documents` |
| `2025.09.26 ... PONTOS DE ATENÇÃO.pptx` | `attention_points` · `technical_documents` |
| `Solicitação de reajuste-2425.pdf` | `document_templates` (carta_reajuste) |
| `SBSO-ETC-INF-0002-2026 ... .pdf` | `document_templates` (oficio_resposta) |
| `SBSO-GRL-ATA-0001-00.xlsx` | `document_templates` (ata_reuniao) |

Toda inserção também grava 1 row em `documents` + 1 row em `document_extractions`.

---

## 5. Plano de extração via Agente IA

### 5.1 Pipeline padrão (upload → extração → validação → gravação)

```
1. UPLOAD          Usuário sobe arquivo via UI (drag-and-drop ou e-mail)
                    ↓
2. STORAGE          Arquivo vai pro bucket Supabase Storage
                   `documents/{org_id}/{obra_id}/{type}/{filename}`
                   1 row em `documents` (status=uploaded)
                    ↓
3. DETECT TYPE      Agente Classificador detecta o tipo do arquivo
                   (CNPJ? CNO? Contrato? BDI? Cronograma? PA? Histograma?)
                   Grava `documents.document_type_id`
                    ↓
4. EXTRACT          Agente Especialista (1 por tipo) extrai estrutura JSON
                   Grava `document_extractions` (status=success/partial/needs_review)
                    ↓
5. VALIDATE         Validações automáticas (CNPJ checksum, datas coerentes, soma BDI=100%, etc.)
                    ↓
6. PERSIST          Grava nas tabelas-alvo (upsert por natural keys quando possível)
                   Marca `document_extractions.target_record_ids`
                    ↓
7. REVIEW (opcional)  Se confidence < 80%, fica em `needs_review` aguardando humano
```

### 5.2 Agentes especializados (1 por tipo de doc)

| Agente | Lê | Extrai pra |
|---|---|---|
| `extract-cnpj` | CNPJ pdf | `companies` (1 row) |
| `extract-cno` | CNO pdf | `obras` (1 row) |
| `extract-os` | OS pdf | `contracts`, `contract_milestones`, `contract_parties` |
| `extract-contract` | Contrato pdf | `contracts`, `contract_clauses`, `contract_indices` |
| `extract-bdi` | BDI pdf (qualquer variante) | `contract_bdis` + `bdi_items` |
| `extract-schedule-mpp` | .mpp | `schedules`, `schedule_tasks`, `wbs_items` |
| `extract-schedule-ff` | Cronograma F-F pdf | `schedule_monthly` |
| `extract-wbs-xlsx` | Cronograma de custo xlsx, Planilha comparativa | `wbs_items`, `wbs_costs`, `wbs_quantities` |
| `extract-curva-abc` | Curva ABC pdf/xlsx | `insumos`, `obra_insumos`, `cost_groups` |
| `extract-histogram` | Histogramas pdf/xlsx | `histograms`, `histogram_monthly`, `positions` |
| `extract-org-structure` | Organograma xlsx | `positions`, `org_structure` |
| `extract-responsibility` | Matriz Responsabilidade xlsx | `activity_areas`, `responsibility_matrix`, `permissions_matrix` |
| `extract-vendor-list` | Vendor List xlsx | `vendor_categories`, `vendors`, `vendor_category_assignments` |
| `extract-attack-plan` | PA docx/pdf | `attack_plans`, `plan_sections`, `swot_items`, `contract_risks`, `strategic_premises` |
| `extract-memorial` | Memorial pdf | `technical_documents` |
| `extract-template` | Templates (CE, Ata, etc.) | `document_templates` (extrai placeholders) |

### 5.3 Estratégia para multi-empresa (formatos diferentes)

Cada agente é treinado/promptado com **schema-alvo JSON** + exemplos. Quando uma obra de **outra empresa** sobe um documento, o agente:

1. Tenta o **schema-alvo** primeiro (campos esperados).
2. Se faltar campo, **infere** pelo contexto (ex.: CNPJ pode estar em qualquer parte do documento).
3. Marca `confidence_score` baixo se a inferência foi necessária — humano valida.
4. **Aprende** padrões da empresa: depois de N documentos validados de uma empresa, o agente reconhece o template recorrente.

A tabela `document_types.expected_extraction` armazena o **schema JSON esperado**, que o agente usa como contrato:

```json
{
  "type": "CNPJ",
  "fields": {
    "cnpj": { "type": "string", "pattern": "^\\d{2}\\.\\d{3}\\.\\d{3}/\\d{4}-\\d{2}$", "required": true },
    "legal_name": { "type": "string", "required": true },
    "trade_name": { "type": "string" },
    "opening_date": { "type": "date" },
    "primary_cnae": { "type": { "code": "string", "description": "string" } },
    "secondary_cnaes": { "type": "array" },
    "address": { "type": "object" }
  }
}
```

### 5.4 Edge Functions Supabase (sugestão)

- `POST /functions/v1/document-upload` — recebe upload e dispara classificação
- `POST /functions/v1/document-classify` — chama LLM com prompt classificador
- `POST /functions/v1/document-extract/{type}` — chama agente especializado
- `POST /functions/v1/document-validate` — roda validadores (CNPJ, soma BDI, etc.)
- `POST /functions/v1/document-persist` — faz upsert nas tabelas-alvo

### 5.5 Row-Level Security (RLS)

Toda tabela com `org_id` deve ter RLS habilitada:

```sql
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON companies
  USING (org_id = current_setting('app.current_org_id')::uuid);
```

Aplicar pattern equivalente em todas as tabelas com `org_id` ou `obra_id` (com join via obras→org).

---

## 6. Próximos passos sugeridos

1. **Validar este schema com o usuário** antes de criar a primeira migration.
2. **Criar migration 001_static_docs_schema.sql** com `CREATE TABLE` ordenado por dependências (organizations → companies → obras → contracts → resto).
3. **Seedar `document_types`** com os 17 tipos identificados acima e seus `expected_extraction` JSONs.
4. **Implementar agentes 1 por 1**, começando pelos mais simples (CNPJ, CNO, OS) e indo pros mais complexos (PA, .mpp).
5. **Para .mpp** (MS Project): considerar `mpxj` (lib Python) ou exportar pra XML antes da extração — `.mpp` binário direto é complicado.
6. **Quando atacar os recorrentes (BMs, RSs, Fluxo de Caixa, AGM)**: criar tabelas adicionais — `bm_measurements`, `bm_items`, `weekly_reports`, `monthly_financial_panel`, `cash_flow_entries`, etc. — referenciando `obras` + `contracts`.
