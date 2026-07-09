"""Sanidades determinísticas que a CONSERVAÇÃO (Σ folhas == total) NÃO pega — achado da validação
adversarial do plano (lente "robustez 100% correto"): o gate prova consistência INTERNA, não
correção. Estes checks pegam o que o Σ deixa passar:

  • COLUNA TROCADA que ainda soma (Contratado↔Real invertidos): a Σ fica idêntica, mas 'real >
    contratado' em massa denuncia o swap.
  • UNIDADE/MAGNITUDE errada numa linha (R$ mil onde se espera R$): outlier de ordem-de-grandeza.
  • ESCALA de % errada (fração já dividida, ou % onde se espera fração): valor fora de [0,1].
  • NEGATIVO inesperado (qtde/preço).

São WARN (sinal), NUNCA veto — o gate de conservação é o veto. Reusável pelos engines genéricos.
"""

from __future__ import annotations

import statistics


def _nums(valores) -> list[float]:  # noqa: ANN001
    return [float(v) for v in (valores or []) if isinstance(v, (int, float)) and not isinstance(v, bool)]


def check_real_le_contratado(pares, *, campo: str, tol_rel: float = 0.0001) -> list[dict]:  # noqa: ANN001
    """`pares` = iterável de (contratado, real). real > contratado em obra de empreitada é suspeito
    (alocou/mediu mais que o planejado) — costuma ser coluna trocada. 1 finding por campo basta."""
    n_excede = 0
    for c, r in pares:
        if (isinstance(c, (int, float)) and isinstance(r, (int, float)) and not isinstance(c, bool)
                and c > 0 and r > c * (1 + tol_rel)):
            n_excede += 1
    if n_excede:
        return [{"severity": "warn", "campo": f"{campo}.real_gt_contratado",
                 "msg": f"{campo}: {n_excede} linha(s) com REAL > Contratado — conferir alinhamento "
                        "de coluna (Contratado↔Real trocados?)"}]
    return []


def check_pct_fracao(valores, *, campo: str, teto: float = 1.5) -> list[dict]:  # noqa: ANN001
    """% deve vir como FRAÇÃO em ~[0,1]. Valor > teto (1,5) ou << 0 = escala/unidade trocada
    (ex.: 109 onde se espera 1,09, ou 0,0109 onde se espera 1,09)."""
    ns = _nums(valores)
    fora = [v for v in ns if v < -0.0001 or v > teto]
    if fora:
        return [{"severity": "warn", "campo": f"{campo}.escala_pct",
                 "msg": f"{campo}: {len(fora)} valor(es) fora de [0,{teto}] (ex.: {fora[0]}) — "
                        "escala de % suspeita (fração × percentual?)"}]
    return []


def check_outlier_magnitude(valores, *, campo: str, k: float = 100.0) -> list[dict]:  # noqa: ANN001
    """Uma folha > k× a mediana das folhas = outlier de ordem-de-grandeza (unidade trocada numa
    linha — R$ mil vs R$, ou um '#' colado num valor). k generoso (100×): só pega erro GROSSO."""
    ns = [abs(v) for v in _nums(valores) if v]
    if len(ns) < 5:
        return []
    med = statistics.median(ns)
    if med <= 0:
        return []
    mx = max(ns)
    if mx > k * med:
        return [{"severity": "warn", "campo": f"{campo}.outlier_magnitude",
                 "msg": f"{campo}: valor {mx:.2f} > {k:.0f}× a mediana ({med:.2f}) — conferir "
                        "unidade/escala dessa linha"}]
    return []


def check_nao_negativo(valores, *, campo: str) -> list[dict]:  # noqa: ANN001
    """Qtde/preço/valor negativo inesperado (Δ pode ser negativo; qtde/preço não)."""
    neg = [v for v in _nums(valores) if v < 0]
    if neg:
        return [{"severity": "warn", "campo": f"{campo}.negativo",
                 "msg": f"{campo}: {len(neg)} valor(es) negativo(s) (ex.: {neg[0]}) — inesperado p/ "
                        "qtde/preço; conferir coluna"}]
    return []
