"""Golden test do SPLITTER · matriz disciplina×mês (C.3 Faturamento, explosão 2D da curva).

Synthetic (SEMPRE roda): matriz mínima 2 disc × 3 meses + curva-âncora → Σ fecha; cross-check por
mês fecha; real fica None (pendente); matriz que não fecha com o PV reprova.

Real (SKIP se ausente · fixture gitignored): C.3 da BR-101 v11 — 12 disciplinas × 46 meses ·
Σ previsto ≈ 611.357.320 (≈ PV/curva) · acum até mês 4 == 41.045.544 (Contratado Acum) · real
pendente em TODAS as células · gate ok.

Rodar: cd agent && venv/bin/python -m agents.normalizacao.test_workbook_disciplina_mes
"""

from __future__ import annotations

import json
import pathlib

from .gate import gate_faturamento_disciplina_mes
from .resolvers import extrair_faturamento_curva, extrair_faturamento_disciplina_mes

FIX = pathlib.Path(__file__).parent / "fixtures" / "workbook_br101v11_c3_faturamento.json"


def _synthetic() -> None:
    cards = {"tipo": "kv", "titulo": "C.3 Faturamento — Cards de resumo",
             "dados": {"contratadoTotal": 600.0, "realAcumAteBM": 0.0, "bmCorrente": 0}}
    curva = {"tipo": "tabela", "titulo": "C.3 Faturamento — Curva mensal Previsto × Real por BM",
             "colunas": ["BM", "Mês", "Previsto Todo", "Real (R$)"],
             "linhas": [
                 {"BM": "1", "Mês": "mar-26", "Previsto Todo": 100.0, "Real (R$)": 0.0},
                 {"BM": "2", "Mês": "abr-26", "Previsto Todo": 200.0, "Real (R$)": 0.0},
                 {"BM": "3", "Mês": "mai-26", "Previsto Todo": 300.0, "Real (R$)": 0.0},
             ]}
    # matriz 2 disc × 3 meses (colunas ORDINAIS "1".."3"); Σ=600, por-mês 100/200/300 (== curva)
    matriz = {"tipo": "tabela",
              "titulo": "C.3 Faturamento — Previsto por frente, mês a mês (R$) — 3 meses",
              "colunas": ["Frente ╲ Mês", "1", "2", "3"],
              "linhas": [
                  {"Frente ╲ Mês": "Terraplenagem", "1": 60.0, "2": 120.0, "3": 180.0},
                  {"Frente ╲ Mês": "Drenagem", "1": 40.0, "2": 80.0, "3": 120.0},
                  {"Observação": "label →"},  # linha-rótulo → deve ser pulada
              ]}
    secoes = [cards, curva, matriz]
    cv = extrair_faturamento_curva(secoes)
    res = extrair_faturamento_disciplina_mes(secoes, meses_curva=cv["meses"])
    assert res["n_disciplinas"] == 2, res["n_disciplinas"]
    assert res["n_linhas"] == 6, res["n_linhas"]  # 2 disc × 3 meses (rótulo pulado)
    assert res["soma_previsto"] == 600.0, res["soma_previsto"]
    assert all(l["real_rs"] is None and l["deficit_rs"] is None for l in res["linhas"])
    pv = cv["soma_contratado"]
    curva_mes = {(m["ano"], m["mes"]): m["contratado_rs"] for m in cv["meses"]}
    assert gate_faturamento_disciplina_mes(res, pv=pv, curva_por_mes=curva_mes)["status"] == "ok"
    # matriz que NÃO fecha com o PV → reprova
    bad = {**res, "soma_previsto": 999.0}
    assert gate_faturamento_disciplina_mes(bad, pv=pv, curva_por_mes=curva_mes)["status"] == "needs_review"
    print("PASS synthetic · 2 disc × 3 meses · Σ=600 (==curva) · cross-check por mês ok · "
          "real pendente · matriz errada reprova")


def _real() -> None:
    if not FIX.exists():
        print(f"SKIP {FIX.name} (gitignored · dado real).")
        return
    secoes = json.loads(FIX.read_text())
    cv = extrair_faturamento_curva(secoes)
    res = extrair_faturamento_disciplina_mes(secoes, meses_curva=cv["meses"])
    pv = cv["soma_contratado"]  # 611.357.315
    curva_mes = {(m["ano"], m["mes"]): m["contratado_rs"] for m in cv["meses"]}
    g = gate_faturamento_disciplina_mes(res, pv=pv, curva_por_mes=curva_mes)
    assert res["n_disciplinas"] == 12, res["n_disciplinas"]
    assert res["n_linhas"] == 12 * 46, res["n_linhas"]
    assert abs(res["soma_previsto"] - 611357320) < 20, res["soma_previsto"]
    assert all(l["real_rs"] is None for l in res["linhas"]), "real deve ser pendente (None)"
    soma4 = round(sum(l["previsto_rs"] or 0 for l in res["linhas"] if l["mes_num"] <= 4), 0)
    assert abs(soma4 - 41045544) < 20, soma4
    assert g["status"] == "ok", g["findings"]
    print(f"PASS real · 12 disc × 46 meses · Σ={res['soma_previsto']:,.0f} (≈PV) · "
          f"acum4={soma4:,.0f} (==Contratado Acum) · real pendente · gate ok")


def run() -> None:
    _synthetic()
    _real()


if __name__ == "__main__":
    run()
