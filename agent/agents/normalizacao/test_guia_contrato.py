"""Teste do GUIA → CONTRATO (Passo 4 · o classificador autoritativo).

Synthetic: trava a NUANCE da classificação (Base★ 'Não deriva' → atômica · Tela 'deriva' → derivada
· Índice → meta) + o parse de âncora (ignora ref de célula B4, pega 611,4M). Real (SKIP se ausente):
o Guia da BR-101 v11 → partição 51 atômica / 7 derivada / 21 meta + classificações-chave.

Rodar: cd agent && venv/bin/python -m agents.normalizacao.test_guia_contrato
"""

from __future__ import annotations

import json
import pathlib

from .guia_contrato import parse_guia_contrato

FIX = pathlib.Path(__file__).parent / "fixtures" / "workbook_br101v11_guia.json"

_COLS = ["Aba", "Módulo", "Tipo", "Finalidade", "Inputs (amarelo)", "Saídas-chave",
         "Lê de (fontes)", "Alimenta", "Instrução para a IA"]


def _guia(linhas):  # noqa: ANN001
    return [{"tipo": "tabela", "titulo": "INSTRUÇÕES — Guia da IA", "colunas": _COLS, "linhas": linhas}]


def _row(aba, tipo, inputs, sai="", le="", ali="", ins=""):  # noqa: ANN001
    return {"Aba": aba, "Módulo": "M2", "Tipo": tipo, "Finalidade": "x", "Inputs (amarelo)": inputs,
            "Saídas-chave": sai, "Lê de (fontes)": le, "Alimenta": ali, "Instrução para a IA": ins}


def _synthetic() -> None:
    ct = parse_guia_contrato(_guia([
        _row("C.1 BDI Detalhe", "Base ★", "Não (deriva)", sai="B4=PV 611,4M · B5=BDI 29,75%",
             ins="FONTE-MÃE do workbook"),                                   # atômica (fonte!)
        _row("C.2 Indicadores", "Tela", "Sim — 1 céls", ins="Deriva das demais. Não editar."),  # derivada
        _row("MAPA", "Índice", "Sim — 3 céls"),                             # meta
        _row("C.3 Faturamento", "Tela", "Sim — 573 céls", le="C.3 Cronograma", ins="INPUT: lançar medição"),  # atômica
    ]))
    by = {a["aba"]: a for a in ct["abas"]}
    assert by["C.1 BDI Detalhe"]["classe"] == "atomica", "Base★ 'Não deriva' é FONTE → atômica"
    assert by["C.2 Indicadores"]["classe"] == "derivada", "'deriva/não editar' → derivada"
    assert by["MAPA"]["classe"] == "meta", "Índice → meta"
    assert by["C.3 Faturamento"]["classe"] == "atomica"
    # âncora: ignora B4/B5 (ref célula), pega 611,4M e 29,75%
    anc = by["C.1 BDI Detalhe"]["ancoras"]
    vals = {round(a["valor"], 4) for a in anc}
    assert 611400000.0 in vals, f"611,4M deveria virar 611.400.000; veio {vals}"
    assert 0.2975 in vals, f"29,75% deveria virar 0,2975; veio {vals}"
    assert 4.0 not in vals and 5.0 not in vals, "refs de célula B4/B5 não podem virar âncora"
    # grafo
    assert by["C.3 Faturamento"]["le_de"] == ["C.3 Cronograma"]
    print("PASS synthetic · nuance Base★/Tela/Índice · âncora ignora ref-célula · grafo Lê-de")


def _real() -> None:
    if not FIX.exists():
        print(f"SKIP {FIX.name} (gitignored).")
        return
    ct = parse_guia_contrato(json.loads(FIX.read_text()))
    assert ct["status"] == "ok", ct["status"]
    r = ct["resumo"]
    # partição autoritativa do classificador nuançado (texto-completo da fixture · não o env truncado)
    assert r["atomica"] == 49, r
    assert r["derivada"] == 9, r
    assert r["meta"] == 21, r
    by = {a["aba"]: a for a in ct["abas"]}
    assert by["C.1 BDI Detalhe"]["classe"] == "atomica"
    assert by["C.2 Indicadores e Farol"]["classe"] == "derivada"
    assert any(round(a["valor"]) == 105100000 for a in by["auxiliar_C.4 MOD Detalhe"]["ancoras"]), "MOD 105,1M"
    print(f"PASS real · partição 49 atômica / 9 derivada / 21 meta · âncoras + classificações OK")


def run() -> None:
    _synthetic()
    _real()


if __name__ == "__main__":
    run()
