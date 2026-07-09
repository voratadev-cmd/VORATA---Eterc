"""c2 · Índice contratual de reajuste — resolve o §4.4 (era IPCA no mock; o real é INCC). Lê a
'Legenda dos Índices' do PSP: índice = família dominante entre as séries ATIVAS (descontinuadas,
variação null, NÃO contam). Periodicidade pela distância das datas. Sintético + doc_type real.
Rodar: cd agent && venv/bin/python -m agents.normalizacao.test_reajuste
"""

from __future__ import annotations

from .configs import eh_doctype_insumos, eh_doctype_reajuste
from .resolvers import extrair_indice_reajuste

DT_PSP = "Solicitação de Reajustamento Contratual + Anexo PSP (Planilha de Serviços e Preços Reajustada)"

PAYLOAD = {
    "secoes": [
        {"titulo": "PSP - Planilha de Serviços e Preços Reajustada", "linhas": [{"ITEM": "01"}]},
        {
            "titulo": "Legenda dos Índices de Reajustamento (FGVDADOS / FGV-IBRE)",
            "colunas": ["Código", "Descrição", "Série", "Índice inicial 08/24",
                        "Índice relativo à data do reajuste 08/25", "Variação"],
            "linhas": [
                {"Código": "I 01", "Descrição": "INCC-Brasil-DI-Projetos", "Variação": 0.05},
                {"Código": "I 02", "Descrição": "INCC-Brasil-DI- Mão de Obra", "Variação": 0.10},
                {"Código": "I 03", "Descrição": "INCC-Brasil-DI-Todos os itens", "Variação": 0.07},
                {"Código": "I 04", "Descrição": "IPA 160OG-DI- Máquinas — DESCONTINUADA", "Variação": None},
            ],
        },
    ]
}


def run() -> None:
    # roteamento: o PSP cai no handler de reajuste, não em insumos
    assert eh_doctype_reajuste(DT_PSP) is True
    assert eh_doctype_reajuste("Boletim de Medição") is False
    assert eh_doctype_insumos(DT_PSP) is False

    r = extrair_indice_reajuste(PAYLOAD)
    assert r["status"] == "ok", r
    assert r["indice"] == "INCC", r  # família dominante ATIVA (IPA descontinuada, var null, fora)
    assert r["familias"] == {"INCC": 3}, r["familias"]
    assert r["periodicidade"] == "anual", r  # 08/24 → 08/25 = 12 meses
    assert len(r["series"]) == 4  # registra todas (inclusive a descontinuada) p/ auditoria

    # sem a seção → needs_review honesto (não inventa índice)
    assert extrair_indice_reajuste({"secoes": []})["status"] == "needs_review"

    print("✅ reajuste: INCC (IPA descontinuada fora) · anual (08/24→08/25) · falha-loud sem seção.")


if __name__ == "__main__":
    run()
