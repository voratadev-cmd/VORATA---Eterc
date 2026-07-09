"""Roteamento por doc_type · pré-requisito da OBRA #2. Garante que Histograma de Insumos e
Controle de Armação caem nos handlers dedicados (hoje rodavam por script one-off), e — crítico —
que o gêmeo 'por Valor' NÃO cai no handler de quantidade (gravaria R$ como qtde, erro de milhões).
Sintético (sem fixture). Rodar: cd agent && venv/bin/python -m agents.normalizacao.test_routing
"""

from __future__ import annotations

from .configs import (
    config_para_doc_type,
    eh_doctype_insumos,
    eh_doctype_produtividade,
)

# doc_types REAIS (verbatim das extrações no banco · auditoria 04/jun)
DT_INSUMOS_QTD = "Histograma de Insumos por Quantidades (cronograma físico de quantitativos)"
DT_INSUMOS_VALOR = "Histograma de Insumos por Valor (planejamento físico-financeiro)"
DT_PRODUTIVIDADE = "Planilha de controle de produtividade (armação/concreto — fundações)"
DT_CATALOGO = "Cronograma de Insumos com Curva ABC (planejamento de obra)"
DT_BM = "Boletim de Medição (BM) / Planilha de Medição"
DT_ACUMULADA = "Medição acumulada / Orçamento analítico + Cronograma físico-financeiro (XLSX-ERP)"


def run() -> None:
    # Insumos: quantidade → SIM; valor → NÃO (gravaria R$ como qtde); catálogo → NÃO (é fonte de
    # enriquecimento, não take-off).
    assert eh_doctype_insumos(DT_INSUMOS_QTD) is True
    assert eh_doctype_insumos(DT_INSUMOS_VALOR) is False, "CRÍTICO: 'por Valor' não pode rotear como qtde"
    assert eh_doctype_insumos(DT_CATALOGO) is False
    assert eh_doctype_insumos(None) is False

    # Produtividade: armação/concreto → SIM; nada mais
    assert eh_doctype_produtividade(DT_PRODUTIVIDADE) is True
    assert eh_doctype_produtividade(DT_BM) is False
    assert eh_doctype_produtividade(DT_INSUMOS_QTD) is False

    # Os handlers dedicados NÃO devem ser confundidos com o _REGISTRO (CampoMap):
    # produtividade e insumos-qtd não casam nenhuma config genérica (iriam pro handler dedicado).
    assert config_para_doc_type(DT_PRODUTIVIDADE) is None
    assert config_para_doc_type(DT_INSUMOS_QTD) is None
    # e o _REGISTRO segue roteando o que é dele (regressão):
    assert config_para_doc_type(DT_BM) is not None
    assert config_para_doc_type(DT_ACUMULADA) is not None

    print("✅ routing: insumos-qtd/produtividade → handler dedicado · 'por Valor' barrado · _REGISTRO intacto.")


if __name__ == "__main__":
    run()
