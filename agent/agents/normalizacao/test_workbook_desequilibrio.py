"""Golden test · D.0 Painel Desequilíbrio (M3 · headline da composição).

Synthetic: Σ categorias == total + linha-rótulo pulada. Real (SKIP se ausente): BR-101 v11 —
8 categorias, Σ = 33.118.333,34 (D.1 Indiretos 31,99M + D.2 BDI 1,13M), gate fecha.

Rodar: cd agent && venv/bin/python -m agents.normalizacao.test_workbook_desequilibrio
"""

from __future__ import annotations

import json
import pathlib

from .gate import gate_desequilibrio
from .resolvers import extrair_desequilibrio_painel

FIX = pathlib.Path(__file__).parent / "fixtures" / "workbook_br101v11_d0_desequilibrio.json"
_COLS = ["Categoria (natureza)", "Tela", "Valor (R$)", "% do total"]


def _sec(linhas):  # noqa: ANN001
    return [{"tipo": "tabela", "titulo": "D.0 Painel Desequilíbrio — Composição por categoria",
             "colunas": _COLS, "linhas": linhas}]


def _synthetic() -> None:
    res = extrair_desequilibrio_painel(_sec([
        {"Categoria (natureza)": "Custos Indiretos", "Tela": "D.1", "Valor (R$)": "30", "% do total": "0.75"},
        {"Categoria (natureza)": "max rank →"},  # linha-rótulo → pulada
        {"Categoria (natureza)": "BDI", "Tela": "D.2", "Valor (R$)": "10", "% do total": "0.25"},
    ]))
    assert res["n_categorias"] == 2, res["n_categorias"]
    assert res["soma_rs"] == 40.0, res["soma_rs"]
    assert gate_desequilibrio(res, total_declarado=40.0)["status"] == "ok"
    assert gate_desequilibrio(res, total_declarado=99.0)["status"] == "needs_review", "total errado reprova"
    print("PASS synthetic · Σ categorias == total · linha-rótulo pulada · total errado reprova")


def _real() -> None:
    if not FIX.exists():
        print(f"SKIP {FIX.name} (gitignored).")
        return
    res = extrair_desequilibrio_painel(json.loads(FIX.read_text()))
    g = gate_desequilibrio(res, total_declarado=33_118_333.34)
    assert res["n_categorias"] == 8, res["n_categorias"]
    assert abs(res["soma_rs"] - 33_118_333.34) < 0.5, res["soma_rs"]
    assert g["status"] == "ok", g["findings"]
    print(f"PASS real · 8 categorias · Σ desequilíbrio 33.118.333,34 · gate ok")


def run() -> None:
    _synthetic()
    _real()


if __name__ == "__main__":
    run()
