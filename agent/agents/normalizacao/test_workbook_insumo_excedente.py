"""Golden test do SPLITTER · excedente ao IPCA por insumo relevante (D.5 · cláusula 8.8).

Synthetic: 3 insumos (1 acima do teto, 1 que caiu, 1 pendente de índice) → derivações exatas
((Δ−teto)⁺ · Δ R$ · farol pela régua), cross com a ABC, pendente sem R$, gate ok; Δ R$ trocado,
farol falso e qtd divergente da ABC reprovam.

Real (SKIP se ausente): D.5 da BR-101 (revisão jun/2026, pós-correção IPCA) — 8 relevantes ·
snapshot jan/26 (teto +1,57%) · Σ Δ R$ == 114.654,68 == cards/consolidação · 4 acima do teto ·
aço CA-50 caiu (sem repasse) · CBUQ/Concreto/Cimento pendentes (NULL, nunca 0) · gate ok.

Rodar: cd agent && venv/bin/python -m agents.normalizacao.test_workbook_insumo_excedente
"""

from __future__ import annotations

import json
import pathlib

from .gate import gate_insumo_excedente
from .resolvers import (
    derivar_farol_excedente,
    extrair_insumo_excedente,
    snapshot_abc_insumos,
    snapshot_excedente_params,
)

FIX = pathlib.Path(__file__).parent / "fixtures" / "workbook_br101v13_d5_excedente.json"


def _secoes_synthetic() -> list[dict]:
    abc = {"tipo": "tabela",
           "titulo": "C.6 Insumos — Curva ABC de materiais (orçado)",
           "colunas": ["Insumo", "Und", "Qtde contratada", "Preço orçado (R$)", "Custo total (R$)",
                       "Classe"],
           "linhas": [
               {"Insumo": "DIESEL COMUM", "Und": "l", "Qtde contratada": 1000.0,
                "Preço orçado (R$)": 10.0, "Custo total (R$)": 10000.0, "Classe": "A"},
               {"Insumo": "AÇO CA-50", "Und": "kg", "Qtde contratada": 500.0,
                "Preço orçado (R$)": 8.0, "Custo total (R$)": 4000.0, "Classe": "B"},
           ]}
    bloco = {"tipo": "tabela",
             "titulo": "D.5 Insumos — Bloco 5: excedente por insumo relevante (cl. 8.8 · snapshot jan/26)",
             "colunas": ["Insumo (8.8)", "ABC", "Qtd orçada", "Preço orçado (R$)",
                         "Preço ref. real (R$)", "Δ% real (jan/26)", "Teto IPCA", "Excedente %",
                         "Δ R$ conforme contrato", "Farol"],
             "linhas": [
                 # acima do teto: Δ 5% · teto 2% → excedente 3% → Δ R$ = 1000×10×0,03 = 300
                 {"Insumo (8.8)": "Diesel comum", "ABC": "A", "Qtd orçada": 1000.0,
                  "Preço orçado (R$)": 10.0, "Preço ref. real (R$)": 10.5,
                  "Δ% real (jan/26)": 0.05, "Teto IPCA": 0.02, "Excedente %": 0.03,
                  "Δ R$ conforme contrato": 300.0, "Farol": "● Risco"},
                 # caiu: sem repasse (6.2.2)
                 {"Insumo (8.8)": "Aço CA-50", "ABC": "B", "Qtd orçada": 500.0,
                  "Preço orçado (R$)": 8.0, "Preço ref. real (R$)": 7.6,
                  "Δ% real (jan/26)": -0.05, "Teto IPCA": 0.02, "Excedente %": 0.0,
                  "Δ R$ conforme contrato": 0.0, "Farol": "● Conforme · caiu"},
                 # pendente de índice: 0 da planilha é default de fórmula → NULL
                 {"Insumo (8.8)": "Cimento CP-II", "ABC": "A", "Preço ref. real (R$)": "—",
                  "Δ R$ conforme contrato": 0, "Farol": "—"},
             ]}
    params = {"tipo": "chave_valor",
              "titulo": "D.5 Insumos — Parâmetros/base e consolidação (cl. 6.2/8.8)",
              "dados": {"excedenteRepassavel88": 300.0, "somaDeltaBrutoMetodoAtivo": 300.0,
                        "desequilibrioLiquidoInsumos": 300.0, "reajusteContratualJaPagoAcum": 0,
                        "insumosAcimaDoTeto": 1, "pctSobrePV": 300.0 / 1000000.0,
                        "dataBaseOrcamento": "2025-07-01"}}
    return [abc, params, bloco]


def _synthetic() -> None:
    secoes = _secoes_synthetic()
    res = extrair_insumo_excedente(secoes)
    assert res["n_insumos"] == 3 and res["snapshot_label"] == "jan/26", res
    pend = res["insumos"][2]
    assert pend["indice_pendente"] and pend["delta_rs"] is None and pend["teto_ipca_pct"] is None
    assert derivar_farol_excedente(0.05, 0.03) == "Risco"
    assert derivar_farol_excedente(-0.05, 0.0) == "Conforme · caiu"
    assert derivar_farol_excedente(None, None) is None
    g = gate_insumo_excedente(res, abc=snapshot_abc_insumos(secoes),
                              params=snapshot_excedente_params(secoes), contratado_total=1000000.0)
    assert g["status"] == "ok", g["findings"]
    assert abs(g["soma_delta_rs"] - 300.0) < 0.005

    # Δ R$ que não fecha a fórmula reprova
    s2 = _secoes_synthetic()
    s2[2]["linhas"][0]["Δ R$ conforme contrato"] = 999.0
    g2 = gate_insumo_excedente(extrair_insumo_excedente(s2), abc=snapshot_abc_insumos(s2),
                               params=None)
    assert any(f["campo"] == "delta_rs" and f["severity"] == "error" for f in g2["findings"])

    # farol fora da régua reprova
    s3 = _secoes_synthetic()
    s3[2]["linhas"][0]["Farol"] = "● Conforme"
    g3 = gate_insumo_excedente(extrair_insumo_excedente(s3), abc=None, params=None)
    assert any(f["campo"] == "farol" and f["severity"] == "error" for f in g3["findings"])

    # qtd divergente da ABC reprova (cross)
    s4 = _secoes_synthetic()
    s4[2]["linhas"][0]["Qtd orçada"] = 1234.0
    g4 = gate_insumo_excedente(extrair_insumo_excedente(s4), abc=snapshot_abc_insumos(s4),
                               params=None)
    assert any(f["campo"] == "qtd" and f["severity"] == "error" for f in g4["findings"])
    print("PASS synthetic · 3 insumos (acima do teto · caiu · pendente) · (Δ−teto)⁺ × qtd × preço "
          "ao centavo · régua de farol · pendente sem R$ · Δ R$ falso, farol falso e qtd≠ABC reprovam")


def _real() -> None:
    if not FIX.exists():
        print(f"SKIP {FIX.name} (gitignored · dado real).")
        return
    secoes = json.loads(FIX.read_text())
    res = extrair_insumo_excedente(secoes)
    g = gate_insumo_excedente(res, abc=snapshot_abc_insumos(secoes),
                              params=snapshot_excedente_params(secoes),
                              contratado_total=611357314.09)
    assert res["n_insumos"] == 8 and res["snapshot_label"] == "jan/26"
    assert abs(g["soma_delta_rs"] - 114654.67941344) < 0.005, g["soma_delta_rs"]
    por = {i["insumo"]: i for i in res["insumos"]}
    assert abs(por["Óleo diesel"]["delta_rs"] - 88480.9553428001) < 0.005
    assert por["Aço CA-50/60"]["farol"] == "Conforme · caiu" and por["Aço CA-50/60"]["delta_rs"] == 0.0
    pendentes = [i for i in res["insumos"] if i["indice_pendente"]]
    assert len(pendentes) == 3 and all(i["delta_rs"] is None for i in pendentes)
    acima = [i for i in res["insumos"] if (i["excedente_pct"] or 0) > 0]
    assert len(acima) == 4
    assert g["status"] == "ok", g["findings"]
    print("PASS real · 8 relevantes (8.8) · snapshot jan/26 (teto +1,57%) · Σ Δ R$ 114.654,68 == "
          "cards/consolidação · 4 acima do teto · CA-50 caiu (sem repasse) · 3 pendentes NULL · gate ok")


def run() -> None:
    _synthetic()
    _real()


if __name__ == "__main__":
    run()
