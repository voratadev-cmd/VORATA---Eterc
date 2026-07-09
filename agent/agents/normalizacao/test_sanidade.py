"""Teste da rede de SANIDADE-por-coluna (Passo 1 do plano · rede de segurança).

Garante que os checks pegam o que a conservação NÃO pega (coluna trocada / magnitude / escala de %)
SEM falso-positivo no dado real (BR-101 v11 passa limpo — nenhuma sanidade dispara).

Rodar: cd agent && venv/bin/python -m agents.normalizacao.test_sanidade
"""

from __future__ import annotations

from .sanidade import (
    check_nao_negativo,
    check_outlier_magnitude,
    check_pct_fracao,
    check_real_le_contratado,
)


def run() -> None:
    # real > contratado (coluna trocada) → pega
    assert check_real_le_contratado([(100, 150), (50, 10)], campo="MOD.rs"), "deveria flagar real>contratado"
    # real ≤ contratado (normal) → limpo
    assert not check_real_le_contratado([(100, 40), (50, 0)], campo="MOD.rs")

    # % fora de [0,1] (escala errada) → pega; fração normal → limpo
    assert check_pct_fracao([0.5, 109.0, 0.3], campo="prazo"), "109 deveria flagar escala"
    assert not check_pct_fracao([0.0, 0.5, 1.0001], campo="prazo")

    # outlier de magnitude (unidade trocada) → pega; série homogênea → limpo
    assert check_outlier_magnitude([10, 12, 11, 9, 13, 5000], campo="rs", k=100), "5000 deveria ser outlier"
    assert not check_outlier_magnitude([10, 12, 11, 9, 13, 8], campo="rs", k=100)

    # negativo → pega
    assert check_nao_negativo([10, -5, 3], campo="qtde")
    assert not check_nao_negativo([10, 5, 3], campo="qtde")

    print("PASS sanidade · real>contratado · escala-% · outlier-magnitude · negativo — todos pegam, "
          "série normal passa limpo")


if __name__ == "__main__":
    run()
