"""Paridade com a Camada B nos fatos que a IA cita: o corte (projeção≈realizado, = acharCorteIdx) e
o farol oficial de faturamento (cortes -1/-5/-10 = farol.ts). Golden trava a paridade — se a régua
TS mudar e a Python não, este teste quebra. Sintético.
Rodar: cd agent && venv/bin/python -m agents.adm_contratual.test_contexto
"""

from __future__ import annotations

from agents.adm_contratual.contexto import _achar_corte, _farol_faturamento_desvio


def run() -> None:
    meses = [
        {"ano": 2026, "mes": 3, "projecao_rs_acumulado": 5_000_000},
        {"ano": 2026, "mes": 5, "projecao_rs_acumulado": 9_927_488},  # ← bate o realizado
        {"ano": 2026, "mes": 6, "projecao_rs_acumulado": 16_000_000},
    ]
    assert _achar_corte(meses, 9_927_488.02) == (2026, 5), "corte = projeção mais próxima do realizado"
    assert _achar_corte(meses, None) is None
    assert _achar_corte([], 100.0) is None

    # régua oficial faturamento_desvio_acumulado (≥-1 Conforme · ≥-5 Obs · ≥-10 Risco · senão Crítico)
    assert _farol_faturamento_desvio(7.05) == "conforme"  # aderência 107% → Conforme (= a aba)
    assert _farol_faturamento_desvio(-1.0) == "conforme"
    assert _farol_faturamento_desvio(-3.0) == "observacao"
    assert _farol_faturamento_desvio(-8.0) == "risco"
    assert _farol_faturamento_desvio(-12.0) == "critico"
    assert _farol_faturamento_desvio(None) is None

    print("✅ contexto: corte por projeção≈realizado · farol oficial (107%→Conforme) — paridade Camada B.")


if __name__ == "__main__":
    run()
