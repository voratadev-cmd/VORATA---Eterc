"""c1 · Curva ABC por VALOR — valor orçado (R$) por insumo do Histograma por Valor (Σ 'Total' das
folhas, por código; um insumo aparece sob várias tarefas). É REFERÊNCIA orçada (conf 0,600). Prova
agregação + ranking desc + exclusão de garbage/EAP + join honesto (null sem match). Sintético.
Rodar: cd agent && venv/bin/python -m agents.normalizacao.test_insumos_valor
"""

from __future__ import annotations

from .engine import enriquecer_insumos_com_valor
from .resolvers import extrair_insumos_valor

SECAO = {
    "linhas": [
        {"Código da Tarefa": "001", "Total": 1000.0},  # EAP pai (sem Código do Insumo) → ignora
        {"Código do Insumo": "IS1", "Descrição": "HVAC", "Total": 500.0},
        {"Código do Insumo": "IS1", "Descrição": "HVAC", "Total": 300.0},  # mesmo insumo, outra tarefa
        {"Código do Insumo": "IM2", "Descrição": "AÇO", "Total": 200.0},
        {"Código do Insumo": "9999", "Descrição": "x", "Total": 999.0},  # garbage
    ]
}


def run() -> None:
    r = extrair_insumos_valor(SECAO)
    assert r["status"] == "ok", r
    assert r["n"] == 2, r["n"]
    assert r["total_valor"] == 1000.0, r["total_valor"]  # 800 (IS1) + 200 (IM2); 9999/EAP fora
    assert r["itens"][0]["codigo"] == "IS1" and r["itens"][0]["valor_orcado"] == 800.0, r["itens"]
    assert r["itens"][1]["codigo"] == "IM2", r["itens"]  # ordenado por valor desc

    # enriquecimento por código (cross-doc), join honesto
    payload = {"secoes": [{"titulo": "Histograma de Insumos por Valor", **SECAO}]}
    insumos = [{"codigo": "IS1", "qtde_total": 5}, {"codigo": "IMX", "qtde_total": 2}]
    enr = enriquecer_insumos_com_valor(insumos, payload)
    by = {i["codigo"]: i for i in enr["insumos"]}
    assert by["IS1"]["valor_orcado"] == 800.0, by["IS1"]
    assert by["IMX"]["valor_orcado"] is None, by["IMX"]  # sem match → NULL honesto, não 0
    assert by["IS1"]["qtde_total"] == 5  # preserva o take-off (não muta)
    assert enr["n_enriquecidos"] == 1 and enr["total_valor"] == 1000.0

    print("✅ insumos_valor: Σ por código · ranking desc · garbage/EAP fora · join honesto (null sem match).")


if __name__ == "__main__":
    run()
