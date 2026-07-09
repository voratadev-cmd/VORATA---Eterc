"""Golden test do SPLITTER · matriz FÍSICA disciplina×mês (C.5 Prazo · seletor por frente).

Synthetic: matriz 2 disc × 3 meses + snapshot-âncora → corte casa o snapshot, monotônico, gate ok;
matriz não-monotônica reprova.

Real (SKIP se ausente): C.5 da BR-101 v11 — 12 disciplinas × 46 meses · % físico previsto acum
(fração) · corte M04 == snapshot (Terraplenagem 0,0504 · Mobilização 0,795 · Recuperação 0,222) ·
monotônico · % real pendente · gate ok.

Rodar: cd agent && venv/bin/python -m agents.normalizacao.test_workbook_cronograma_frente_mes
"""

from __future__ import annotations

import json
import pathlib

from .gate import gate_cronograma_frente_mes
from .resolvers import extrair_cronograma_frente_mes, snapshot_fisico_por_disciplina

FIX = pathlib.Path(__file__).parent / "fixtures" / "workbook_br101v11_c5_prazo.json"


def _synthetic() -> None:
    matriz = {"tipo": "tabela",
              "titulo": "C.5 Prazo — Matriz % físico previsto acum. por disciplina × mês",
              "colunas": ["Disciplina", "M01", "M02", "M03"],
              "linhas": [
                  {"Disciplina": "Terraplenagem", "M01": 10.0, "M02": 30.0, "M03": 60.0},
                  {"Disciplina": "Drenagem", "M01": 0.0, "M02": 20.0, "M03": 50.0},
                  {"Observação": "rótulo →"},  # linha-rótulo → pulada
              ]}
    snap = {"tipo": "tabela",
            "titulo": "C.5 Prazo — Atraso físico por disciplina (% previsto até BM)",
            "colunas": ["Grupo / Disciplina", "% Previsto (até BM)", "% Real (até BM · input)"],
            "linhas": [
                {"Grupo / Disciplina": "Terraplenagem", "% Previsto (até BM)": 0.30},  # == M02 (corte)
                {"Grupo / Disciplina": "Drenagem", "% Previsto (até BM)": 0.20},
            ]}
    secoes = [snap, matriz]
    res = extrair_cronograma_frente_mes(secoes)
    sn = snapshot_fisico_por_disciplina(secoes)
    assert res["n_disciplinas"] == 2, res["n_disciplinas"]
    assert res["linhas"][0]["previsto_pct"] == 0.10  # 10% → 0,10 fração
    assert all(ln["real_pct"] is None for ln in res["linhas"])
    g = gate_cronograma_frente_mes(res, sn)
    assert g["status"] == "ok", g["findings"]
    # não-monotônico reprova
    bad = {"linhas": [
        {"ordem": 0, "disciplina": "X", "mes_num": 1, "previsto_pct": 0.5, "real_pct": None},
        {"ordem": 1, "disciplina": "X", "mes_num": 2, "previsto_pct": 0.3, "real_pct": None},
    ], "n_disciplinas": 1, "findings": []}
    assert gate_cronograma_frente_mes(bad, None)["status"] == "needs_review"
    print("PASS synthetic · 2 disc × 3 meses · % → fração · corte casa snapshot · monotônico · "
          "não-monotônico reprova")


def _real() -> None:
    if not FIX.exists():
        print(f"SKIP {FIX.name} (gitignored · dado real).")
        return
    secoes = json.loads(FIX.read_text())
    res = extrair_cronograma_frente_mes(secoes)
    sn = snapshot_fisico_por_disciplina(secoes)
    g = gate_cronograma_frente_mes(res, sn)
    assert res["n_disciplinas"] == 12, res["n_disciplinas"]
    assert len({ln["mes_num"] for ln in res["linhas"]}) == 46
    assert all(ln["real_pct"] is None for ln in res["linhas"]), "real deve ser pendente (None)"

    def m04(disc: str):
        return next((ln["previsto_pct"] for ln in res["linhas"]
                     if ln["disciplina"].startswith(disc) and ln["mes_num"] == 4), None)

    assert abs(m04("Terraplenagem") - 0.0504) < 1e-6, m04("Terraplenagem")
    assert abs(m04("Mobiliz") - 0.795) < 1e-6, m04("Mobiliz")
    assert abs(m04("Recupera") - 0.222) < 1e-6, m04("Recupera")
    assert g["status"] == "ok", g["findings"]
    print("PASS real · 12 disc × 46 meses · M04 ✓ (Terra 5,04% · Mobiliz 79,5% · Recup 22,2%) · "
          "monotônico · corte casa snapshot · gate ok")


def run() -> None:
    _synthetic()
    _real()


if __name__ == "__main__":
    run()
