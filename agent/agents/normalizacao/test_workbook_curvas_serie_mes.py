"""Golden test do SPLITTER · série mensal das curvas (C.8 × C.3 · Tela 6 do RMA).

Synthetic: 3 meses com cross-source C.8==C.3, corte no BM=2 (carry pós-BM → NULL), âncoras dos
cards → gate ok; C.3 deslocado (shift) e acumulado não-monotônico reprovam.

Real (SKIP se ausente): BR-101 v11 — 46 meses · M04 == cards (Contratado 41.045.543 · Capacidade
7.257.514,32 · Executado 20.522.771,5) · carry pós-BM vira NULL · último Contratado Acum ==
611.357.315 · Σ Previsto Serviços == 363.666.790,75 · gate ok.

Rodar: cd agent && venv/bin/python -m agents.normalizacao.test_workbook_curvas_serie_mes
"""

from __future__ import annotations

import json
import pathlib

from .gate import gate_curvas_serie_mes
from .resolvers import (
    extrair_curvas_serie_mes,
    snapshot_bm_corrente,
    snapshot_contratado_total,
    snapshot_curvas_cards,
)

FIX = pathlib.Path(__file__).parent / "fixtures" / "workbook_br101v11_curvas_serie.json"


def _secoes_synthetic() -> list[dict]:
    serie = {"tipo": "tabela",
             "titulo": "C.8 Aderência das Curvas — Curvas acumuladas mês a mês",
             "colunas": ["Mês", "Período", "Contratado Acum.", "Liberado Acum.",
                         "Capacidade Acum.", "Executado Acum."],
             "linhas": [
                 {"Mês": 1, "Período": "jan", "Contratado Acum.": 100.0, "Liberado Acum.": 100.0,
                  "Capacidade Acum.": 10.0, "Executado Acum.": 50.0},
                 {"Mês": 2, "Período": "fev", "Contratado Acum.": 250.0, "Liberado Acum.": 250.0,
                  "Capacidade Acum.": 30.0, "Executado Acum.": 125.0},
                 # pós-BM: carry-forward da planilha (constante) → resolver corta p/ NULL
                 {"Mês": 3, "Período": "mar", "Contratado Acum.": 400.0, "Liberado Acum.": 400.0,
                  "Capacidade Acum.": 30.0, "Executado Acum.": 125.0},
             ]}
    curva3 = {"tipo": "tabela",
              "titulo": "C.3 Faturamento — Curva mensal Previsto × Real por BM (3 meses)",
              "colunas": ["BM", "Mês", "Previsto Todo", "Previsto Serviços", "Previsto Acum.",
                          "Real Acum."],
              "linhas": [
                  {"BM": 1, "Mês": "jan", "Previsto Todo": 100.0, "Previsto Serviços": 60.0,
                   "Previsto Acum.": 100.0, "Real Acum.": 50.0},
                  {"BM": 2, "Mês": "fev", "Previsto Todo": 150.0, "Previsto Serviços": 90.0,
                   "Previsto Acum.": 250.0, "Real Acum.": 125.0},
                  {"BM": 3, "Mês": "mar", "Previsto Todo": 150.0, "Previsto Serviços": 100.0,
                   "Previsto Acum.": 400.0, "Real Acum.": 125.0},
              ]}
    cards3 = {"tipo": "chave_valor", "titulo": "C.3 Faturamento — Cards de resumo",
              "dados": {"bmCorrente": 2, "contratadoTotal": 400.0}}
    cards8 = {"tipo": "chave_valor",
              "titulo": "C.8 Aderência das Curvas — Cards (4 curvas) e painel de sinais",
              "dados": {"totalContratadoAcum": 250.0, "liberadoParaExecucaoAcum": 250.0,
                        "capacidadeProdutivaAcum": 30.0, "executadoAcum": 125.0}}
    return [cards3, cards8, serie, curva3]


def _synthetic() -> None:
    secoes = _secoes_synthetic()
    bm = snapshot_bm_corrente(secoes)
    res = extrair_curvas_serie_mes(secoes, bm=bm)
    assert res["n_meses"] == 3
    m2 = next(x for x in res["meses"] if x["mes_num"] == 2)
    m3 = next(x for x in res["meses"] if x["mes_num"] == 3)
    assert m2["previsto_servicos_rs"] == 90.0
    # carry pós-BM vira NULL (capacidade/executado não existem no futuro · PENDENTE≠0)
    assert m3["capacidade_acum_rs"] is None and m3["executado_acum_rs"] is None
    assert m3["contratado_acum_rs"] == 400.0  # contratado é plano → série inteira fica
    g = gate_curvas_serie_mes(res, cards=snapshot_curvas_cards(secoes), bm=bm,
                              contratado_total=snapshot_contratado_total(secoes))
    assert g["status"] == "ok", g["findings"]

    # C.3 deslocado (shift de mês) reprova o cross-source
    secoes_shift = _secoes_synthetic()
    for r in secoes_shift[3]["linhas"]:
        r["Previsto Acum."] = r["Previsto Acum."] + 7.0
    res_s = extrair_curvas_serie_mes(secoes_shift, bm=2)
    g_s = gate_curvas_serie_mes(res_s, cards=snapshot_curvas_cards(secoes_shift), bm=2,
                                contratado_total=400.0)
    assert any(f["campo"] == "contratado" and f["severity"] == "error"
               for f in g_s["findings"]), g_s["findings"]

    # acumulado não-monotônico reprova
    secoes_mono = _secoes_synthetic()
    secoes_mono[2]["linhas"][2]["Contratado Acum."] = 200.0
    res_m = extrair_curvas_serie_mes(secoes_mono, bm=2)
    g_m = gate_curvas_serie_mes(res_m, cards=None, bm=2, contratado_total=None)
    assert any(f["campo"] == "contratado_acum_rs" for f in g_m["findings"]), g_m["findings"]
    print("PASS synthetic · 3 meses · cross C.8==C.3 · carry pós-BM → NULL · corte == cards · "
          "shift e não-monotônico reprovam")


def _real() -> None:
    if not FIX.exists():
        print(f"SKIP {FIX.name} (gitignored · dado real).")
        return
    secoes = json.loads(FIX.read_text())
    bm = snapshot_bm_corrente(secoes)
    res = extrair_curvas_serie_mes(secoes, bm=bm)
    g = gate_curvas_serie_mes(res, cards=snapshot_curvas_cards(secoes), bm=bm,
                              contratado_total=snapshot_contratado_total(secoes))
    assert bm == 4 and res["n_meses"] == 46, (bm, res["n_meses"])
    m4 = next(x for x in res["meses"] if x["mes_num"] == 4)
    m5 = next(x for x in res["meses"] if x["mes_num"] == 5)
    assert abs(m4["contratado_acum_rs"] - 41045543.0) < 0.005
    assert abs(m4["capacidade_acum_rs"] - 7257514.316391813) < 0.005
    assert abs(m4["executado_acum_rs"] - 20522771.5) < 0.005
    assert m5["capacidade_acum_rs"] is None and m5["executado_acum_rs"] is None
    ult = res["meses"][-1]
    assert abs(ult["contratado_acum_rs"] - 611357315.0) < 0.005
    soma_serv = sum(x["previsto_servicos_rs"] or 0.0 for x in res["meses"])
    assert abs(soma_serv - 363666790.75) < 0.005, soma_serv
    assert g["status"] == "ok", g["findings"]
    print("PASS real · 46 meses · M04 == cards (41,0 mi · 7,26 mi · 20,5 mi) · carry pós-BM NULL · "
          "fim 611.357.315 · Σ serviços 363.666.790,75 · gate ok")


def run() -> None:
    _synthetic()
    _real()


if __name__ == "__main__":
    run()
