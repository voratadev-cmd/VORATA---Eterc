"""Golden test do SPLITTER · rota C.3 Faturamento (workbook-motor).

Synthetic (SEMPRE roda): curva mínima Previsto×Real + cards-âncora → conservação fecha; divergência
reprova; linha-rótulo é pulada; acumulado é RECOMPUTADO (não da fonte).

Real (SKIP se ausente · fixture gitignored): C.3 da BR-101 v11 (46 meses) — Σ contratado ==
611.357.315 (== card contratadoTotal) · Σ real == 20.522.771,5 (== card realAcumAteBM); gate ok.

Rodar: cd agent && venv/bin/python -m agents.normalizacao.test_workbook_faturamento
"""

from __future__ import annotations

import json
import pathlib

from .gate import gate_faturamento_workbook
from .resolvers import extrair_faturamento_curva

FIX = pathlib.Path(__file__).parent / "fixtures" / "workbook_br101v11_c3_faturamento.json"


def _cards(contr, real):  # noqa: ANN001
    return {"tipo": "kv", "titulo": "C.3 Faturamento — Cards de resumo",
            "dados": {"contratadoTotal": contr, "realAcumAteBM": real, "bmCorrente": 2}}


def _curva(linhas):  # noqa: ANN001
    return {"tipo": "tabela", "titulo": "C.3 Faturamento — Curva mensal Previsto × Real por BM",
            "colunas": ["BM", "Mês", "Previsto Todo", "Previsto Acum.", "Real (R$)", "Real Acum."],
            "linhas": linhas}


def _synthetic() -> None:
    linhas = [
        {"BM": "1", "Mês": "mar-26", "Previsto Todo": 100.0, "Previsto Acum.": 999, "Real (R$)": 40.0},
        {"BM": "2", "Mês": "abr-26", "Previsto Todo": 150.0, "Previsto Acum.": 999, "Real (R$)": 60.0},
        {"Observação": "max rank →"},  # linha-rótulo (helper) → deve ser pulada
        {"BM": "3", "Mês": "mai-26", "Previsto Todo": 250.0, "Previsto Acum.": 999, "Real (R$)": 0.0},
    ]
    res = extrair_faturamento_curva([_cards(500.0, 100.0), _curva(linhas)])
    assert res["n_meses"] == 3, res["n_meses"]
    assert res["soma_contratado"] == 500.0 and res["soma_real"] == 100.0, res
    # acumulado RECOMPUTADO (ignora 'Previsto Acum.'=999 da fonte): 100,250,500
    assert [m["contratado_rs_acumulado"] for m in res["meses"]] == [100.0, 250.0, 500.0], res["meses"]
    assert gate_faturamento_workbook(res)["status"] == "ok", "conservação deveria fechar"

    # cards errados → reprova
    bad = extrair_faturamento_curva([_cards(999.0, 100.0), _curva(linhas)])
    assert gate_faturamento_workbook(bad)["status"] == "needs_review", "Σ contratado ≠ card deveria reprovar"
    print("PASS synthetic · conservação fecha · acumulado recomputado · linha-rótulo pulada · "
          "card errado reprova")


def _real() -> None:
    if not FIX.exists():
        print(f"SKIP {FIX.name} (gitignored · dado real). Regenere via dump.")
        return
    secoes = json.loads(FIX.read_text())
    res = extrair_faturamento_curva(secoes)
    g = gate_faturamento_workbook(res)
    assert res["n_meses"] == 46, res["n_meses"]
    assert abs(res["soma_contratado"] - 611357315) < 1, res["soma_contratado"]
    assert abs(res["soma_real"] - 20522771.5) < 1, res["soma_real"]
    assert g["status"] == "ok", (g["findings"])
    # acumulado monotônico e fecha no total
    acums = [m["contratado_rs_acumulado"] for m in res["meses"]]
    assert acums == sorted(acums) and abs(acums[-1] - 611357315) < 1, acums[-3:]
    print(f"PASS real · 46 meses · Σ contratado=611.357.315 (==card) · Σ real=20.522.771,5 (==card) · gate ok")


def run() -> None:
    _synthetic()
    _real()


if __name__ == "__main__":
    run()
