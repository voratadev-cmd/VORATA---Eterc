"""Golden test do SPLITTER · rota C.6 Insumos · Curva ABC (workbook-motor).

Parte 1 (synthetic · SEMPRE roda): exercita extrair_insumos_curva_abc + gate_insumos_abc —
conservação fecha, divergência reprova, violação de linha reprova, eixo real vazio vira warn
(não erro), código determinístico.

Parte 2 (fixture REAL · SKIP se ausente, gitignored): a Curva ABC da BR-101 (32 insumos) —
assere por VALOR: Σ custo == TOTAL materiais declarado (78.636.026,31), âncora CBUQ
26.675.126,93 classe A preço 180, eixo de preço REAL vazio (real/variação NULL → farol pendente).

Rodar: cd agent && venv/bin/python -m agents.normalizacao.test_workbook_insumos
"""

from __future__ import annotations

import json
import pathlib

from .gate import gate_insumos_abc
from .resolvers import extrair_insumos_curva_abc

FIX = pathlib.Path(__file__).parent / "fixtures" / "workbook_c6_insumos_abc.json"

COLS = ["Insumo", "Und", "Qtde contratada", "Preço orçado (R$)", "Custo total (R$)",
        "% total", "% acum", "Classe", "Preço reajustado", "Preço real pago",
        "Variação real %", "Impacto R$ (gap)", "Farol"]


def _linha(nome, und, qtde, preco, valor, pct, classe, real=None):  # noqa: ANN001
    return {"Insumo": nome, "Und": und, "Qtde contratada": qtde, "Preço orçado (R$)": preco,
            "Custo total (R$)": valor, "% total": pct, "Classe": classe,
            "Preço reajustado": preco, "Preço real pago": real, "Variação real %": 0,
            "Impacto R$ (gap)": 0, "Farol": "● Conforme"}


def _secao(linhas):  # noqa: ANN001
    return {"tipo": "tabela", "titulo": "C.6 Insumos — Curva ABC de materiais", "colunas": COLS,
            "linhas": linhas}


def _synthetic() -> None:
    base = [
        _linha("CBUQ - MASSA COMERCIAL", "m3", 100.0, 180.0, 18000.0, 0.6, "A"),
        _linha("ÓLEO DIESEL", "l", 2000.0, 5.0, 10000.0, 0.3333333, "A"),
        _linha("AREIA LAVADA", "m3", 10.0, 200.0, 2000.0, 0.0666667, "B"),
    ]
    res = extrair_insumos_curva_abc(_secao(base), total_declarado=30000.0)
    assert res["n_insumos"] == 3, res["n_insumos"]
    assert res["status"] == "ok", res
    assert res["eixo_real_vazio"] is True, "real vazio deveria ser detectado"
    assert any(f["campo"] == "preco_real_pago_unit" for f in res["findings"]), "faltou warn de eixo real"
    # código determinístico a partir do nome
    cods = {i["codigo"] for i in res["insumos"]}
    assert "cbuq-massa-comercial" in cods, cods
    # eixo real persistido como NULL (não zero)
    assert all(i["preco_real_pago_unit"] is None for i in res["insumos"]), "real virou número!"
    # GATE: total bate → ok
    assert gate_insumos_abc(res)["status"] == "ok", "conservação deveria fechar"

    # total ERRADO → needs_review (conservação)
    g_err = gate_insumos_abc(extrair_insumos_curva_abc(_secao(base), total_declarado=99999.0))
    assert g_err["status"] == "needs_review", "divergência de total deveria reprovar"

    # violação de linha (valor ≠ qtde×preço) → needs_review
    ruim = base + [_linha("BRITA", "m3", 10.0, 100.0, 9999.0, 0.0, "C")]  # 10×100=1000 ≠ 9999
    r2 = extrair_insumos_curva_abc(_secao(ruim), total_declarado=30000.0 + 9999.0)
    assert r2["n_violacoes_linha"] == 1, r2["n_violacoes_linha"]
    assert gate_insumos_abc(r2)["status"] == "needs_review", "violação de linha deveria reprovar"

    # Σ% ≠ 100% → needs_review
    pct_ruim = [_linha("X", "un", 1.0, 1.0, 1.0, 0.2, "C")]  # Σ%=0,2
    assert gate_insumos_abc(extrair_insumos_curva_abc(_secao(pct_ruim), total_declarado=1.0))["status"] == "needs_review"

    print("PASS synthetic · conservação fecha · total errado/violação/Σ%≠100 reprovam · "
          "eixo real NULL+warn · código determinístico")


def _real() -> None:
    if not FIX.exists():
        print(f"SKIP fixture · {FIX.name} ausente (gitignored · dado real). Regenere via dump.")
        return
    fx = json.loads(FIX.read_text())
    res = extrair_insumos_curva_abc(fx["secao"], total_declarado=fx.get("total_declarado"))
    g = gate_insumos_abc(res)
    assert res["n_insumos"] == 32, f"esperado 32 insumos, veio {res['n_insumos']}"
    assert res["n_violacoes_linha"] == 0, f"violações de linha: {res['n_violacoes_linha']}"
    assert g["status"] == "ok", f"gate {g['status']} · findings {g['findings']}"
    # âncora CBUQ (maior item, classe A)
    cbuq = next((i for i in res["insumos"] if "CBUQ" in i["descricao"].upper()), None)
    assert cbuq and abs(cbuq["valor_orcado"] - 26675126.93) < 0.01, cbuq
    assert cbuq["classe_abc"] == "A" and cbuq["preco_orcado_unit"] == 180, cbuq
    assert res["eixo_real_vazio"] is True, "BR-101 BM-1: eixo de preço real deveria estar vazio"
    classes: dict = {}
    for i in res["insumos"]:
        classes[i["classe_abc"]] = classes.get(i["classe_abc"], 0) + 1
    print(f"PASS real · 32 insumos · Σ custo={res['soma_valor']:,.2f} == TOTAL "
          f"{fx['total_declarado']:,.2f} · classes {classes} · CBUQ 26.675.126,93 classe A · "
          f"eixo real vazio (farol de desvio pendente)")


def run() -> None:
    _synthetic()
    _real()


if __name__ == "__main__":
    run()
