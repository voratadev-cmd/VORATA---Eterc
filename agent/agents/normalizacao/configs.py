"""Configs de mapeamento por tipo de doc. NÃO-TRAVADO ainda: os alias_set serão estendidos
quando o 2º projeto for extraído (decisão do usuário). Hoje cobrem a variação INTRA-Sorriso
já observada (BM-02 'EDT/Custo/Valor total' × BM-03 'Item/Custo Unitário/Valor (R$) no Período').
"""

from __future__ import annotations

from .config import NormConfig, load_config

# ── BM / Medição · fatia-1 (item atômico + totais) ──────────────────────
_MEDICAO_V1: dict = {
    "config_version": "config@1.0.0",
    "doc_types": ["Boletim de Medição", "Medição", "Planilha de Medição"],
    "entidades": [
        {
            "entidade": "obra_medicao_itens",
            "seletor_secao": {"papel": "tabela_medicao"},
            "resolvers": ["rollup_hierarquico"],
            "campos": [
                # dimensões
                {"canonico": "numero_item", "role": "dimensao",
                 "coluna": {"alias_set": ["Item", "EDT", "EAP", "Código", "Cod"], "perfil": "codigo_dotted"}},
                {"canonico": "descricao", "role": "dimensao",
                 "coluna": {"alias_set": ["Nome da Tarefa", "Descrição", "Descricao", "Serviço"], "perfil": "texto"}},
                {"canonico": "unidade", "role": "dimensao",
                 "coluna": {"alias_set": ["UND", "Unidade", "Un"], "perfil": "unidade"}},
                # contratado (previsto)
                {"canonico": "quantidade_contratada", "role": "medida",
                 "eixo": {"periodo": "contratado", "grandeza": "quantidade"},
                 "coluna": {"alias_set": ["Quantidade Total", "Quantidade"], "perfil": "quantidade"}},
                {"canonico": "preco_unitario", "role": "medida",
                 "eixo": {"periodo": "contratado", "grandeza": "preco_unitario"},
                 "coluna": {"alias_set": ["Custo Unitário", "Preço Unitário", "Preco Unitario"], "perfil": "preco"}},
                {"canonico": "valor_contratado", "role": "medida",
                 "eixo": {"periodo": "contratado", "grandeza": "valor"},
                 "coluna": {"alias_set": ["Custo Total", "Valor total", "Valor Total"], "perfil": "monetario"}},
                # realizado · período
                {"canonico": "quantidade_periodo", "role": "medida",
                 "eixo": {"periodo": "periodo", "grandeza": "quantidade"},
                 "coluna": {"alias_set": ["Quantidade no Período", "Qtde no Período"], "perfil": "quantidade"}},
                {"canonico": "valor_medido_periodo", "role": "medida",
                 "eixo": {"periodo": "periodo", "grandeza": "valor"},
                 "coluna": {"alias_set": ["Valor (R$) no Período", "Valor no Período", "Valor Medido"], "perfil": "monetario"}},
                # realizado · acumulado
                {"canonico": "quantidade_acumulada", "role": "medida",
                 "eixo": {"periodo": "acumulado", "grandeza": "quantidade"},
                 "coluna": {"alias_set": ["Quantidade acumulada no Período", "Qtde Acumulada"], "perfil": "quantidade"}},
                {"canonico": "valor_medido_acumulado", "role": "medida",
                 "eixo": {"periodo": "acumulado", "grandeza": "valor"},
                 "coluna": {"alias_set": ["Valor (R$) acumulado no Período", "Valor Acumulado"], "perfil": "monetario"}},
            ],
        },
        {
            "entidade": "obra_medicao_totais",
            "seletor_secao": {"papel": "identificacao"},
            "campos": [
                {"canonico": "total_periodo_valor", "role": "medida",
                 "eixo": {"periodo": "periodo", "grandeza": "valor"},
                 "coluna": {"alias_set": ["totalMesValor", "totalPeriodoValor", "totalPeriodo"], "perfil": "monetario"}},
                {"canonico": "total_acumulado_valor", "role": "medida",
                 "eixo": {"periodo": "acumulado", "grandeza": "valor"},
                 "coluna": {"alias_set": ["totalAcumuladoValor", "totalAcumulado"], "perfil": "monetario"}},
            ],
        },
    ],
}


def medicao_v1() -> NormConfig:
    return load_config(_MEDICAO_V1)


# ── Cronograma Físico-Financeiro · curva PREVISTA FÍSICA (unpivot temporal) ──
# A distribuição mensal vem como chave_valor {mês: %}, não tabela → o engine usa o resolver
# `unpivot_temporal` (campos vazios; a transposição não cabe em CampoMap de coluna). Mira o
# doc dedicado "Cronograma Físico-Financeiro" (o BM casa medicao_v1 primeiro, por ordem do
# registro). O gate (Σ% == 100%) protege contra estrutura divergente → needs_review.
_CRONOGRAMA_V1: dict = {
    "config_version": "config@1.0.0",
    "doc_types": ["Cronograma Físico-Financeiro", "Cronograma Fisico-Financeiro", "Cronograma Físico Financeiro"],
    "entidades": [
        {
            "entidade": "obra_cronograma_previsto",
            "seletor_secao": {"papel": "cronograma"},
            "resolvers": ["unpivot_temporal"],
        }
    ],
}


def cronograma_v1() -> NormConfig:
    return load_config(_CRONOGRAMA_V1)


# ── Medição acumulada (XLSX-ERP) · curvas financeiras (Camada A, handler dedicado) ──
# Doc "tudo-em-um": traz as 2 curvas R$ (Contratado baseline + Projeção). É roteado a um
# HANDLER próprio (normalizar_acumulada) — NÃO à medicao_v1 — pra NÃO re-gravar os BMs (que já
# estão limpos dos PDFs). A extração das curvas é via unpivot_tabela_temporal; a seleção de
# seção é por conteúdo no handler. O gate (Σ cada curva == custo total) protege.
_ACUMULADA_V1: dict = {
    "config_version": "config@1.0.0",
    "doc_types": ["Medição acumulada", "Orçamento analítico", "exportado de ERP"],
    "entidades": [
        {
            "entidade": "obra_faturamento_meses",
            "seletor_secao": {"papel": "cronograma"},
            "resolvers": ["unpivot_tabela_temporal"],
        }
    ],
}


def acumulada_v1() -> NormConfig:
    return load_config(_ACUMULADA_V1)


# Registro · escolha de config por doc_type (substring case-insensitive). Cresce por tipo de
# doc. ORDEM IMPORTA: acumulada_v1 PRIMEIRO (seu doc_type contém "Medição" e "Cronograma", mas
# é um doc distinto que vai pro handler de curvas); depois medicao_v1 antes de cronograma_v1
# (o doc_type do BM contém "Cronograma Físico-Financeiro anexos" e deve cair no BM).
_REGISTRO: list[NormConfig] = [acumulada_v1(), medicao_v1(), cronograma_v1()]


def config_para_doc_type(doc_type: str | None) -> NormConfig | None:
    """A config cujo `doc_types` casa o doc_type da extração (substring). None se nenhuma."""
    dt = (doc_type or "").lower()
    for cfg in _REGISTRO:
        if any(p.lower() in dt for p in cfg.doc_types):
            return cfg
    return None


# ── Handlers DEDICADOS (resolvers auto-descritivos · NÃO usam CampoMap) ──────────────────
# Insumos e Produtividade têm resolvers próprios (normalizar_insumos / extrair_produtividade) e
# não passam pela matriz CampoMap. São roteados por doc_type DIRETO no job (antes do _REGISTRO).
# Mantidos AQUI pra configs.py seguir como a ÚNICA fonte do que o pipeline reconhece.
#
# ⚠️ ESPECÍFICO de propósito: casar só "por Quantidades" — o gêmeo "por Valor" tem a MESMA
# estrutura mas as colunas são R$, não quantidade; roteá-lo ao handler de take-off gravaria R$
# como qtde (erro de milhões). "por Valor" fica sem handler (pulado) até ter normalização própria.
_DOCTYPE_INSUMOS = ("Histograma de Insumos por Quantidades",)
_DOCTYPE_PRODUTIVIDADE = ("controle de produtividade", "controle de armação", "armação/concreto")
_DOCTYPE_REAJUSTE = ("solicitação de reajustamento", "reajustamento contratual")
# Catálogo (classe ABC + grupo de custo) — fonte de ENRIQUECIMENTO cross-doc do take-off físico.
# Não é normalizado sozinho; o handler de Insumos o busca via buscar_extracao_por_doctype.
DOCTYPE_CATALOGO_INSUMOS = ("Curva ABC", "Cadastro de Insumos")
# Histograma por Valor — fonte de ENRIQUECIMENTO cross-doc do VALOR orçado (R$) por insumo.
DOCTYPE_INSUMOS_VALOR = ("Histograma de Insumos por Valor",)


def _casa(doc_type: str | None, substrings: tuple[str, ...]) -> bool:
    dt = (doc_type or "").lower()
    return any(s.lower() in dt for s in substrings)


def eh_doctype_insumos(doc_type: str | None) -> bool:
    """Histograma de Insumos por Quantidades (take-off físico). NÃO casa 'por Valor'."""
    return _casa(doc_type, _DOCTYPE_INSUMOS)


def eh_doctype_produtividade(doc_type: str | None) -> bool:
    """Controle de Armação e Concreto (produtividade física kg/Hh)."""
    return _casa(doc_type, _DOCTYPE_PRODUTIVIDADE)


def eh_doctype_reajuste(doc_type: str | None) -> bool:
    """Solicitação de Reajustamento (PSP) — índice contratual de reajuste (atualiza o cadastro)."""
    return _casa(doc_type, _DOCTYPE_REAJUSTE)


# Workbook-MOTOR consolidado: 1 arquivo XLSX que espelha as tabs do produto (módulos A/H/M1-M5),
# com TODAS as seções num envelope só. Roteado p/ o SPLITTER (fan-out 1→N seções). Distinto dos
# docs SEPARADOS do Sorriso (1 doc = 1 entidade). Matcher amplo (qualquer uma das marcas casa).
_DOCTYPE_WORKBOOK_MOTOR = (
    "workbook-fonte", "motor de cálculo", "motor de calculo",
    "plataforma de administração contratual", "plataforma de administracao contratual",
)


def eh_doctype_workbook_motor(doc_type: str | None) -> bool:
    """Workbook-motor consolidado (todas as seções num arquivo) → handler splitter dedicado."""
    return _casa(doc_type, _DOCTYPE_WORKBOOK_MOTOR)


# Versão da config do splitter (proveniência gravada em cada linha persistida pelo workbook-motor).
CONFIG_VERSION_WORKBOOK = "workbook_motor@1.0.0"
