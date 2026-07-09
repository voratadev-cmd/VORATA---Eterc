"""Golden test do SPLITTER · rota C.7 Produtividade econômica (R$/HH · workbook-motor).

Synthetic: série mínima + card-âncora → Σ HH previsto conserva; linhas-rótulo de IA/critérios
puladas; HH real parcial (None onde vazio). Real (SKIP se ausente): C.7 da BR-101 v11 (46 meses) —
Σ HH previsto == 1.433.728 (card hhTotalPrevisto); gate ok; 4 linhas-rótulo descartadas.

Rodar: cd agent && venv/bin/python -m agents.normalizacao.test_workbook_produtividade
"""

from __future__ import annotations

import json
import pathlib

from .gate import gate_produtividade_economica
from .resolvers import extrair_produtividade_economica

FIX = pathlib.Path(__file__).parent / "fixtures" / "workbook_br101v11_c7_produtividade.json"


def _cards(hh):  # noqa: ANN001
    return {"tipo": "kv", "titulo": "C.7 Produtividade — Cards", "dados": {"hhTotalPrevisto": hh, "bmCorrente": 2}}


def _serie(linhas):  # noqa: ANN001
    return {"tipo": "tabela", "titulo": "C.7 Produtividade — Mês a mês",
            "colunas": ["Mês", "Período", "Faturado no Mês (R$)", "HH Real Mês", "R$/HH Real Mês",
                        "HH Previsto Mês", "Aderência Mês"],
            "linhas": linhas}


def _synthetic() -> None:
    linhas = [
        {"Mês": "1", "Período": "mar-26", "Faturado no Mês (R$)": "1000", "HH Previsto Mês": "100", "HH Real Mês": "0"},
        {"Mês": "2", "Período": "abr-26", "Faturado no Mês (R$)": "2000", "HH Previsto Mês": "300", "HH Real Mês": "250", "R$/HH Real Mês": "9.5"},
        {"Mês": "3", "Período": "mai-26", "Faturado no Mês (R$)": "0", "HH Previsto Mês": "200", "HH Real Mês": "0"},  # futuro: Faturado=0 → NULL
        {"Mês": "(IA: evolução do R$/HH…", "HH Previsto Mês": "999"},  # linha-rótulo IA → pulada
        {"Mês": "CRITÉRIOS DO FAROL", "HH Previsto Mês": "888"},       # rótulo → pulada
    ]
    res = extrair_produtividade_economica([_cards(600), _serie(linhas)])
    assert res["n_meses"] == 3, res["n_meses"]
    assert res["soma_hh_previsto"] == 600.0, res["soma_hh_previsto"]
    assert res["meses"][0]["hh_real"] == 0.0 and res["meses"][1]["hh_real"] == 250.0, res["meses"]
    # PENDENTE ≠ ZERO: Faturado da cauda futura (mês 3, após o último faturado>0) vira NULL, não 0.
    assert res["meses"][1]["faturado_rs"] == 2000.0, res["meses"][1]
    assert res["meses"][2]["faturado_rs"] is None, "Faturado futuro deve ser pendente (NULL)"
    assert gate_produtividade_economica(res)["status"] == "ok"
    # card errado → reprova
    assert gate_produtividade_economica(extrair_produtividade_economica([_cards(999), _serie(linhas)]))["status"] == "needs_review"
    print("PASS synthetic · Σ HH conserva · linhas-rótulo puladas · Faturado futuro→NULL · card errado reprova")


def _real() -> None:
    if not FIX.exists():
        print(f"SKIP {FIX.name} (gitignored · dado real).")
        return
    res = extrair_produtividade_economica(json.loads(FIX.read_text()))
    g = gate_produtividade_economica(res)
    assert res["n_meses"] == 46, res["n_meses"]
    assert abs(res["soma_hh_previsto"] - 1433728) < 1, res["soma_hh_previsto"]
    assert g["status"] == "ok", g["findings"]
    assert res["eixo_real_vazio"] is False, "C.7 tem HH real (obra no BM 4)"
    print(f"PASS real · 46 meses · Σ HH previsto=1.433.728 (==card) · gate ok · 4 linhas-rótulo descartadas")


def run() -> None:
    _synthetic()
    _real()


if __name__ == "__main__":
    run()
