"""O "gate" de honestidade da IA: o validador de ancoragem barra número de VALOR (R$/%) que a IA
inventar (não estiver nos fatos resolvidos), tolerando formatação/arredondamento/abreviação e %
estruturais. Sintético. Rodar: cd agent && venv/bin/python -m agents.adm_contratual.test_validador
"""

from __future__ import annotations

from agents.adm_contratual.validador import validar_ancoragem

FATOS = {
    "faturamento": {"realizado_acumulado_rs": 9927488.02, "contratado_total_rs": 9274076.48,
                    "aderencia_pct": 107.05},
    "fisico": {"real_acumulado_pct": 24.99},
    "insumos": {"n_insumos": 344, "valor_orcado_total_rs": 39255964.0,
                "n_concentram_80pct_do_valor": 36},
}


def run() -> None:
    # ANCORADO: todo R$/% sai dos fatos; '80%' é estrutural; '36'/'344' são contagens (não R$/%)
    ok = ("Aderência financeira de 107% (realizado R$ 9.927.488,02 de R$ 9.274.076,48). "
          "Físico 24,99%. Os 36 insumos que concentram 80% do valor somam R$ 39,26 mi (referência).")
    r = validar_ancoragem(ok, FATOS)
    assert r["ancorado"], r["suspeitos"]

    # R$ INVENTADO (desequilíbrio que não temos) → BARRADO
    r2 = validar_ancoragem("O desequilíbrio acumulado é de R$ 4.500.000,00.", FATOS)
    assert not r2["ancorado"] and any(s["tipo"] == "rs" for s in r2["suspeitos"]), r2

    # % MÉTRICA inventado → BARRADO
    r3 = validar_ancoragem("A aderência despencou para 62%.", FATOS)
    assert not r3["ancorado"] and any(abs(s["valor"] - 62) < 0.01 for s in r3["suspeitos"]), r3

    # tolerância: 107 ≈ 107,05 e R$ 39,26 mi ≈ 39.255.964 → ANCORADO (não falso-positivo)
    r4 = validar_ancoragem("Aderência ~107%, insumos somam R$ 39,26 mi.", FATOS)
    assert r4["ancorado"], r4["suspeitos"]

    print("✅ validador: ancora R$/% reais (c/ tolerância) · BARRA R$/% inventados · % estrutural ok.")


if __name__ == "__main__":
    run()
