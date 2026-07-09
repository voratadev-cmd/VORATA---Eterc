"""Golden test do SPLITTER · rota C.5 Prazo — curva física % previsto × real (workbook-motor).

Synthetic: curva acumulada em percentual → fração + per-month recomputado; Σ previsto == 100% (gate
ok); linha-rótulo pulada. Real (SKIP se ausente): C.5 da BR-101 v11 (46 meses) — final previsto
≈ 100% e gate_cronograma fecha; real parcial (obra no BM 4).

Rodar: cd agent && venv/bin/python -m agents.normalizacao.test_workbook_prazo
"""

from __future__ import annotations

import json
import pathlib

from .gate import gate_cronograma
from .resolvers import extrair_cronograma_curva_fisica

FIX = pathlib.Path(__file__).parent / "fixtures" / "workbook_br101v11_c5_prazo.json"


def _curva(linhas):  # noqa: ANN001
    return {"tipo": "tabela", "titulo": "C.5 Prazo — Curva física % previsto acum. × real",
            "colunas": ["Mês", "Período", "% Físico Previsto Acum.", "% Físico Real Acum. (input)"],
            "linhas": linhas}


def _synthetic() -> None:
    linhas = [
        {"Mês": "1", "Período": "mar-26", "% Físico Previsto Acum.": "25", "% Físico Real Acum. (input)": "20"},
        {"Observação": "max rank →"},  # linha-rótulo → pulada
        {"Mês": "2", "Período": "abr-26", "% Físico Previsto Acum.": "60", "% Físico Real Acum. (input)": "50"},
        {"Mês": "3", "Período": "mai-26", "% Físico Previsto Acum.": "100", "% Físico Real Acum. (input)": None},
    ]
    res = extrair_cronograma_curva_fisica([_curva(linhas)])
    assert res["n_meses"] == 3, res["n_meses"]
    # percentual→fração + per-month recomputado: previsto_pct = 0.25, 0.35, 0.40
    pms = [m["previsto_pct"] for m in res["meses"]]
    assert pms == [0.25, 0.35, 0.40], pms
    assert res["meses"][-1]["previsto_pct_acumulado"] == 1.0, res["meses"][-1]
    assert res["meses"][2]["real_pct_acumulado"] is None, "real vazio deve ficar None (não 0)"
    assert gate_cronograma(res["meses"])["status"] == "ok", "Σ previsto == 100% deveria fechar"
    print("PASS synthetic · percentual→fração · per-month recomputado · Σ=100% · real None · rótulo pulado")


def _real() -> None:
    if not FIX.exists():
        print(f"SKIP {FIX.name} (gitignored · dado real). Regenere via dump.")
        return
    secoes = json.loads(FIX.read_text())
    res = extrair_cronograma_curva_fisica(secoes)
    g = gate_cronograma(res["meses"])
    assert res["n_meses"] == 46, res["n_meses"]
    assert abs(res["final_previsto"] - 1.0) < 0.01, res["final_previsto"]
    assert g["status"] == "ok", g["findings"]
    com_real = sum(1 for m in res["meses"] if m["real_pct_acumulado"] is not None)
    # nesta obra o '% Físico Real Acum. (input)' NÃO foi preenchido (só o faturamento R$ real foi)
    # → físico real fica None (honesto · farol físico PENDENTE), nunca 0 silencioso.
    assert com_real == 0, f"físico real input vazio nesta obra; veio {com_real} preenchido(s)"
    # CRÍTICO (bug pego em prod): sem inicio/término o cronograma fica sem datas → prazoContratualDias
    # null → a aba Prazo E a Visão Geral ficam VAZIAS. O resolver DEVE derivar as datas dos meses.
    assert res["inicio_iso"] == "2026-03-01", res["inicio_iso"]
    assert res["termino_iso"] == "2029-12-31", res["termino_iso"]
    print(f"PASS real · 46 meses · previsto 100% · real PENDENTE · datas mar/26→dez/29 (Prazo/VG renderizam)")


def run() -> None:
    _synthetic()
    _real()


if __name__ == "__main__":
    run()
