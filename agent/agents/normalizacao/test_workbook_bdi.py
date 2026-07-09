"""Golden test · C.1 BDI Detalhe (FONTE-MÃE econômica · engine edt_rollup).

Synthetic: trava a detecção de subtotal (independente) + a conservação CD-constante. Real (SKIP se
ausente): BR-101 v11 — 18 rubricas, 2 subtotais, markup 140,1M, CD 471,2M, CD+markup ≈ PV, gate ok.

Rodar: cd agent && venv/bin/python -m agents.normalizacao.test_workbook_bdi
"""

from __future__ import annotations

import json
import pathlib

from .gate import gate_bdi
from .resolvers import extrair_bdi_detalhe

FIX = pathlib.Path(__file__).parent / "fixtures" / "workbook_br101v11_c1_bdi.json"
_COLS = ["DESCRIÇÃO", "% s/ RECEITA (fonte)", "% s/ CUSTO DIRETO (base)",
         "VALOR (R$) = % s/CD × CD", "% s/ receita implícito"]


def _sec(linhas):  # noqa: ANN001
    return [{"tipo": "tabela", "titulo": "C.1 BDI Detalhe — Rubricas", "colunas": _COLS, "linhas": linhas}]


def _r(desc, prec, pcd, val):  # noqa: ANN001
    return {"DESCRIÇÃO": desc, "% s/ RECEITA (fonte)": prec, "% s/ CUSTO DIRETO (base)": pcd,
            "VALOR (R$) = % s/CD × CD": val, "% s/ receita implícito": prec}


def _synthetic() -> None:
    # CD = 1000. Impostos(300) = ISS(180)+COFINS(120). Markup = Lucro(100)+Impostos-children(300) = 400.
    res = extrair_bdi_detalhe(_sec([
        _r("Lucro", "0.1", "0.1", "100"),
        _r("Impostos", "0.3", "0.3", "300"),    # subtotal de ISS+COFINS
        _r("ISS", "0.18", "0.18", "180"),
        _r("COFINS", "0.12", "0.12", "120"),
    ]))
    assert res["n_rubricas"] == 4, res["n_rubricas"]
    subs = [r["descricao"] for r in res["rubricas"] if r["eh_subtotal"]]
    assert subs == ["Impostos"], subs
    assert res["soma_folhas_rs"] == 400.0, res["soma_folhas_rs"]   # Lucro+ISS+COFINS (Impostos é subtotal)
    assert res["cd_implicito"] == 1000.0, res["cd_implicito"]
    assert gate_bdi(res, pv_anchor=1400)["status"] == "ok"          # CD(1000)+markup(400)=1400
    # valor mal-lido → CD diverge → gate reprova
    mau = extrair_bdi_detalhe(_sec([_r("Lucro", "0.1", "0.1", "100"), _r("X", "0.2", "0.2", "999")]))
    assert gate_bdi(mau)["status"] == "needs_review", "CD inconsistente deveria reprovar"
    print("PASS synthetic · subtotal independente · markup sem double-count · CD constante · CD ruim reprova")


def _real() -> None:
    if not FIX.exists():
        print(f"SKIP {FIX.name} (gitignored).")
        return
    res = extrair_bdi_detalhe(json.loads(FIX.read_text()))
    g = gate_bdi(res, pv_anchor=611_400_000)
    assert res["n_rubricas"] == 18, res["n_rubricas"]
    subs = [r["descricao"] for r in res["rubricas"] if r["eh_subtotal"]]
    assert len(subs) == 2, subs
    assert abs(res["soma_folhas_rs"] - 140_129_221.74) < 1, res["soma_folhas_rs"]
    assert abs(res["cd_implicito"] - 471_180_974.25) < 1, res["cd_implicito"]
    assert g["status"] == "ok", g["findings"]
    print(f"PASS real · 18 rubricas · 2 subtotais · markup 140.129.221,74 · CD 471.180.974 · CD+markup≈PV · gate ok")


def run() -> None:
    _synthetic()
    _real()


if __name__ == "__main__":
    run()
