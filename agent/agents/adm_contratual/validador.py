"""Validador de ANCORAGEM — o "gate" de honestidade da IA. Confere, de forma DETERMINÍSTICA, que
todo número de VALOR (R$ e %) na saída da IA está ancorado nos FATOS resolvidos (com tolerância de
formatação/arredondamento). Se a IA inventar uma cifra, vira 'suspeito' → revisão/rejeição.

Não é um gate duro sozinho (texto tem números estruturais legítimos: '80% do valor', '100%') — é a
rede de segurança equivalente ao gate de conservação, mas pra texto. O chamador decide o rigor.
"""

from __future__ import annotations

import re

# % estruturais comuns que não são métricas a validar (limiares/definições)
_PCT_ESTRUTURAIS = {0.0, 50.0, 80.0, 100.0}
_MULT = {"mil": 1_000, "mi": 1_000_000, "milhao": 1_000_000, "milhoes": 1_000_000,
         "milhão": 1_000_000, "milhões": 1_000_000, "bi": 1_000_000_000}


def _parse_br_num(s: str) -> float | None:
    """'39.255.964,02' / '39,26' / '107' / '24,99' → float. ',' = decimal; '.' = milhar (ou decimal
    se for o único separador sem vírgula)."""
    s = s.strip()
    if not s:
        return None
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    elif s.count(".") > 1:
        s = s.replace(".", "")
    try:
        return float(s)
    except ValueError:
        return None


def _numeros_de_valor(texto: str) -> list[tuple[str, float, str]]:
    """Extrai (trecho, valor, tipo) dos números de VALOR: R$ (com multiplicador) e %. Ignora o resto
    (contagens, anos, EDTs) — não são as cifras perigosas."""
    out: list[tuple[str, float, str]] = []
    for m in re.finditer(r"R\$\s*([\d.,]+)\s*(mil|mi|milh[õo]es|milh[ãa]o|bi)?", texto, re.IGNORECASE):
        v = _parse_br_num(m.group(1))
        if v is None:
            continue
        mult = _MULT.get((m.group(2) or "").lower(), 1)
        out.append((m.group(0).strip(), v * mult, "rs"))
    for m in re.finditer(r"([\d.,]+)\s*%", texto):
        v = _parse_br_num(m.group(1))
        if v is not None:
            out.append((m.group(0).strip(), v, "pct"))
    return out


def _flatten_numeros(fatos) -> list[float]:  # noqa: ANN001
    out: list[float] = []

    def rec(v) -> None:  # noqa: ANN001
        if isinstance(v, dict):
            for x in v.values():
                rec(x)
        elif isinstance(v, list):
            for x in v:
                rec(x)
        elif isinstance(v, (int, float)) and not isinstance(v, bool):
            out.append(float(v))

    rec(fatos)
    return out


def _casa(val: float, base: list[float], tol_rel: float) -> bool:
    """val casa algum fato com tolerância RELATIVA (formatação/arredondamento/abreviação)."""
    return any(abs(val - b) <= tol_rel * max(abs(b), 1.0) for b in base)


def validar_ancoragem(texto: str, fatos: dict, tol_rel: float = 0.02) -> dict:
    """Todo R$/% no texto está nos fatos? Devolve {ancorado, suspeitos:[{trecho,valor,tipo}]}.
    % estruturais (80/100/50/0) são tolerados. Tolerância relativa cobre '39,26 mi' ≈ 39.255.964."""
    base = _flatten_numeros(fatos)
    suspeitos: list[dict] = []
    for trecho, val, tipo in _numeros_de_valor(texto):
        if tipo == "pct" and any(abs(val - e) < 0.01 for e in _PCT_ESTRUTURAIS):
            continue
        if not _casa(val, base, tol_rel):
            suspeitos.append({"trecho": trecho, "valor": val, "tipo": tipo})
    return {"ancorado": not suspeitos, "suspeitos": suspeitos}
