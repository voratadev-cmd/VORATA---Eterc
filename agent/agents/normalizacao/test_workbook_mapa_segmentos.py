"""Golden test do SPLITTER · mapa da obra por km (C.14 Bloco 1 · segmentos de liberação).

Synthetic: 3 segmentos (2 duplicação contíguos + 1 sinistro pontual) com BM=2 → status/Liberado/
Impedido deriváveis, Σ cruzadas com resumo e contratado, mapa mensal recomputável, gate ok;
status divergente da derivação e buraco de km reprovam.

Real (SKIP se ausente): C.14 da BR-101 v11 — 11 segmentos (9 duplicação km 144+600→190+300 +
2 sinistros de talude) · Σ duplicação == Contratado Total 611.357.315 · Σ Liberado 157.855.936 ·
Σ Impedido 14.000.000 (2,2% do contrato) · Bloco 2 (46 meses) recomputável · gate ok.

Rodar: cd agent && venv/bin/python -m agents.normalizacao.test_workbook_mapa_segmentos
"""

from __future__ import annotations

import json
import pathlib

from .gate import gate_mapa_segmentos
from .resolvers import (
    derivar_status_segmento,
    extrair_mapa_liberacao_mensal,
    extrair_mapa_segmentos,
    snapshot_bm_corrente,
    snapshot_contratado_total,
    snapshot_resumo_liberacoes,
)

FIX = pathlib.Path(__file__).parent / "fixtures" / "workbook_br101v11_c14_mapa.json"


def _secoes_synthetic() -> list[dict]:
    bloco1 = {"tipo": "tabela",
              "titulo": "C.14 Mapa da Obra — Bloco 1: Segmentos = itens do cronograma (liberação/impedimento)",
              "colunas": ["Seg.", "Item do cronograma", "km início", "km fim", "Mês lib. prevista",
                          "Mês lib. real", "Imped. início", "Imped. fim", "Valor contrato (R$)",
                          "Status (no BM)", "Liberado (R$)", "Impedido (R$)",
                          "Causa do impedimento (input)"],
              "linhas": [
                  {"Seg.": "S1", "Item do cronograma": "Duplicação 0+000–10+000", "km início": 0.0,
                   "km fim": 10.0, "Mês lib. prevista": 1, "Mês lib. real": 1,
                   "Valor contrato (R$)": 100.0, "Status (no BM)": "Liberado",
                   "Liberado (R$)": 100.0, "Impedido (R$)": 0.0},
                  {"Seg.": "S2", "Item do cronograma": "Duplicação 10+000–20+000", "km início": 10.0,
                   "km fim": 20.0, "Mês lib. prevista": 2, "Mês lib. real": 3,
                   "Valor contrato (R$)": 50.0, "Status (no BM)": "Não iniciado",
                   "Liberado (R$)": 0.0, "Impedido (R$)": 0.0},
                  {"Seg.": "S3", "Item do cronograma": "Sinistro Talude 5+000", "km início": 5.0,
                   "km fim": 5.0, "Mês lib. prevista": 4, "Mês lib. real": 4,
                   "Imped. início": 1, "Imped. fim": 3, "Valor contrato (R$)": 7.0,
                   "Status (no BM)": "Impedido", "Liberado (R$)": 0.0, "Impedido (R$)": 7.0,
                   "Causa do impedimento (input)": "Talude instável"},
              ]}
    bloco2 = {"tipo": "tabela",
              "titulo": "C.14 Mapa da Obra — Bloco 2 (liberação seg×mês) + Bloco 3",
              "colunas": ["Mês \\ Seg", "S1", "S2", "S3"],
              "linhas": [
                  {"Mês \\ Seg": "jan", "S1": 1, "S2": 0, "S3": 2},
                  {"Mês \\ Seg": "fev", "S1": 1, "S2": 0, "S3": 2},
                  # linha não-mês NO MEIO (banner/separador) → não pode desalinhar o mes_num
                  {"Mês \\ Seg": "Seg.", "S1": "S1", "S2": "S2", "S3": "S3"},
                  {"Mês \\ Seg": "mar", "S1": 1, "S2": 1, "S3": 2},
                  {"Mês \\ Seg": "abr", "S1": 1, "S2": 1, "S3": 1},
                  {"Mês \\ Seg": "Legenda:", "S1": "a liberar", "S2": "liberado", "S3": "impedido"},
              ]}
    cards = {"tipo": "chave_valor", "titulo": "C.3 Faturamento — Cards de resumo",
             "dados": {"bmCorrente": 2, "contratadoTotal": 150.0}}
    resumo = {"tipo": "chave_valor",
              "titulo": "C.9 Chuvas — Resumo liberações × impedimentos (fontes C.14/C.8)",
              "dados": {"liberadoTotalRS": 100.0, "impedidoTotalRS": 7.0,
                        "frentesNaoIniciadasQtd": 1, "pctImpedidoVsContrato": 7.0 / 157.0}}
    return [cards, resumo, bloco1, bloco2]


def _synthetic() -> None:
    secoes = _secoes_synthetic()
    res = extrair_mapa_segmentos(secoes)
    assert res["n_segmentos"] == 3, res["n_segmentos"]
    assert res["segmentos"][2]["tipo"] == "sinistro"
    assert res["soma_valor_rs"] == 157.0
    mapa = extrair_mapa_liberacao_mensal(secoes)
    assert len(mapa) == 4, mapa  # banner no meio e legenda no fim NÃO viram mês
    g = gate_mapa_segmentos(res, bm=snapshot_bm_corrente(secoes),
                            resumo=snapshot_resumo_liberacoes(secoes),
                            contratado_total=snapshot_contratado_total(secoes),
                            mapa_mensal=mapa)
    assert g["status"] == "ok", g["findings"]

    # janela ABERTA (fim vazio) = impeditivo até reparo: impedido até a véspera da liberação real
    aberto = {"imped_mes_inicio": 1, "imped_mes_fim": None, "mes_lib_real": 4}
    assert derivar_status_segmento(aberto, 2) == "Impedido"
    assert derivar_status_segmento(aberto, 3) == "Impedido"
    assert derivar_status_segmento(aberto, 4) == "Liberado"
    assert derivar_status_segmento({"imped_mes_inicio": 2, "imped_mes_fim": None,
                                    "mes_lib_real": None}, 9) == "Impedido"

    # status divergente da derivação reprova (S2 'Liberado' mas mês lib. real 3 > BM 2)
    secoes_bad = _secoes_synthetic()
    secoes_bad[2]["linhas"][1]["Status (no BM)"] = "Liberado"
    secoes_bad[2]["linhas"][1]["Liberado (R$)"] = 50.0
    res_bad = extrair_mapa_segmentos(secoes_bad)
    g_bad = gate_mapa_segmentos(res_bad, bm=2, resumo=snapshot_resumo_liberacoes(secoes_bad),
                                contratado_total=150.0)
    assert g_bad["status"] == "needs_review", g_bad["findings"]
    assert any(f["campo"] == "status" for f in g_bad["findings"])

    # buraco de km entre trechos de duplicação reprova
    secoes_gap = _secoes_synthetic()
    secoes_gap[2]["linhas"][1]["km início"] = 12.0
    g_gap = gate_mapa_segmentos(extrair_mapa_segmentos(secoes_gap), bm=2, contratado_total=150.0)
    assert any(f["campo"] == "km" and f["severity"] == "error" for f in g_gap["findings"]), \
        g_gap["findings"]

    # Σ Impedido ≠ resumo C.9 reprova (conservação)
    secoes_soma = _secoes_synthetic()
    secoes_soma[1]["dados"]["impedidoTotalRS"] = 9.0
    res_soma = extrair_mapa_segmentos(secoes_soma)
    g_soma = gate_mapa_segmentos(res_soma, bm=2, resumo=snapshot_resumo_liberacoes(secoes_soma),
                                 contratado_total=150.0)
    assert any(f["campo"] == "impedido" and f["severity"] == "error"
               for f in g_soma["findings"]), g_soma["findings"]
    print("PASS synthetic · 3 segmentos (2 duplicação + sinistro) · derivação status/K/L no BM · "
          "Σ cruzadas · mapa mensal · status falso, buraco de km e Σ divergente reprovam")


def _real() -> None:
    if not FIX.exists():
        print(f"SKIP {FIX.name} (gitignored · dado real).")
        return
    secoes = json.loads(FIX.read_text())
    res = extrair_mapa_segmentos(secoes)
    bm = snapshot_bm_corrente(secoes)
    mapa = extrair_mapa_liberacao_mensal(secoes)
    g = gate_mapa_segmentos(res, bm=bm, resumo=snapshot_resumo_liberacoes(secoes),
                            contratado_total=snapshot_contratado_total(secoes),
                            mapa_mensal=mapa)
    assert res["n_segmentos"] == 11, res["n_segmentos"]
    assert bm == 4, bm
    dupls = [s for s in res["segmentos"] if s["tipo"] == "duplicacao"]
    sins = [s for s in res["segmentos"] if s["tipo"] == "sinistro"]
    assert len(dupls) == 9 and len(sins) == 2
    assert abs(sum(s["valor_contrato_rs"] for s in dupls) - 611357315.0) < 0.005
    assert abs(res["soma_liberado_rs"] - 157855936.0) < 0.005
    assert abs(res["soma_impedido_rs"] - 14000000.0) < 0.005
    assert dupls[0]["km_inicio"] == 144.6 and dupls[-1]["km_fim"] == 190.3
    assert all(s["causa_impedimento"] for s in sins), "sinistro sem causa"
    assert len(mapa) == 46, len(mapa)
    assert derivar_status_segmento(dupls[0], 4) == "Liberado"
    assert derivar_status_segmento(sins[0], 4) == "Impedido"
    assert derivar_status_segmento(sins[0], 7) == "Liberado"  # libera após a janela (mês 7)
    assert g["status"] == "ok", g["findings"]
    print("PASS real · 11 segmentos (9 duplicação km 144+600→190+300 + 2 sinistros) · "
          "Σ duplicação == Contratado 611.357.315 · Liberado 157.855.936 · Impedido 14.000.000 · "
          "Bloco 2 (46 meses) recomputável · gate ok")


def run() -> None:
    _synthetic()
    _real()


if __name__ == "__main__":
    run()
