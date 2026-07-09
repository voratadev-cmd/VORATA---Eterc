"""B3 (motor-hardening) · review_kinds = tag de ORIGEM dos reasons, SÓ display. Trava o invariante
DURO: needs_review é soberano (bool(reasons)) e NUNCA deriva de review_kinds — senão vira a alavanca
p/ um commit futuro afrouxar o gate ('se kinds ⊆ {derivada} então extracted'). O teste-âncora (3)
falha-alto se alguém inverter isso no código."""
from __future__ import annotations

import inspect
import re

from agents.extracao import runner as R
from agents.extracao.runner import ExtractionResult, _classificar_review_kinds


def run() -> None:
    # 1) classificação por origem
    assert _classificar_review_kinds(["cobertura: 5 numérica(s) de FONTE fora"]) == {"cobertura-fonte"}
    assert _classificar_review_kinds(["digitados: 8 de 522 não existem em célula"]) == {"digitado"}
    assert _classificar_review_kinds(["sanity_check reprovou (soma/datas/faixas)"]) == {"sanity"}
    assert _classificar_review_kinds(["envelope inválido: secao sem titulo"]) == {"schema"}
    assert _classificar_review_kinds([]) == set()
    assert _classificar_review_kinds(["cobertura: x de FONTE", "sanity_check reprovou"]) == {"cobertura-fonte", "sanity"}

    # 2) needs_review SOBERANO: vazio → False; qualquer reason → True (independente do kind ser 'soft')
    r = ExtractionResult(payload={}, doc_type="x")
    r.review_reasons = ["cobertura: 5 numérica(s) de FONTE fora"]
    r.needs_review = bool(r.review_reasons)
    r.review_kinds = _classificar_review_kinds(r.review_reasons)
    assert r.needs_review is True and r.review_kinds == {"cobertura-fonte"}
    vazio = ExtractionResult(payload={}, doc_type="x")
    assert vazio.needs_review is False and vazio.review_kinds == set()

    # 3) ANTI-INVERSÃO (trava de revisão de código): needs_review = bool(reasons), nunca f(review_kinds)
    src = inspect.getsource(R)
    assert re.search(r"res\.needs_review\s*=\s*bool\(reasons\)", src), "needs_review precisa ser bool(reasons)"
    for line in src.splitlines():
        code = line.split("#", 1)[0]  # ignora comentário (que MENCIONA review_kinds de propósito)
        if re.search(r"\bneeds_review\s*=", code) and "review_kinds" in code:
            raise AssertionError(f"INVERSÃO PROIBIDA (afrouxa o gate): {line.strip()}")

    print("PASS B3 · review_kinds tagueia origem · needs_review SOBERANO (bool(reasons)) · anti-inversão travada")


if __name__ == "__main__":
    run()
