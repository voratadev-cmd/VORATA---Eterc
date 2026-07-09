"""Honestidade · a Medição acumulada produz 3 entidades INDEPENDENTES (curva de faturamento,
orçamento, tarefas). Quando o orçamento ou as tarefas NÃO fecham o gate, o arquivo não pode sair
'normalized' em SILÊNCIO só porque a curva fechou — _resumo_sub_review carrega o aviso pro
reason/log do job. Sintético (sem fixture, sempre roda).

Rodar: cd agent && venv/bin/python -m agents.normalizacao.test_sub_review
"""

from __future__ import annotations

from .engine import _resumo_sub_review


def run() -> None:
    # tudo ok → sem notas (arquivo verde de verdade)
    assert _resumo_sub_review({"orcamento": {"status": "ok"}, "tarefas": {"status": "ok"}}) == []
    # doc só com a curva (sem orçamento/tarefas) → sem notas
    assert _resumo_sub_review({}) == []

    # orçamento quebrado → nota com os ERROS do gate (warns não entram)
    notas = _resumo_sub_review(
        {
            "orcamento": {
                "status": "needs_review",
                "gate": {
                    "findings": [
                        {"severity": "error", "msg": "Σ itens 10,00 ≠ preço-venda 12,00"},
                        {"severity": "warn", "msg": "ruído"},
                    ]
                },
            },
            "tarefas": {"status": "ok"},
        }
    )
    assert len(notas) == 1, notas
    assert notas[0].startswith("orçamento em revisão:"), notas[0]
    assert "preço-venda" in notas[0] and "ruído" not in notas[0], notas[0]

    # ambos quebrados → 2 notas; sem errors no gate → nota sem ':'
    notas2 = _resumo_sub_review(
        {
            "orcamento": {"status": "needs_review", "gate": {"findings": []}},
            "tarefas": {
                "status": "needs_review",
                "gate": {"findings": [{"severity": "error", "msg": "rollup pai≠Σfilhos"}]},
            },
        }
    )
    assert len(notas2) == 2, notas2
    assert notas2[0] == "orçamento em revisão", notas2[0]
    assert notas2[1] == "tarefas em revisão: rollup pai≠Σfilhos", notas2[1]

    print("✅ sub_review: orçamento/tarefas em revisão NÃO saem silenciosos (só errors no reason).")


if __name__ == "__main__":
    run()
