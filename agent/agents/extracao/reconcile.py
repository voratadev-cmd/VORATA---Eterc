"""Reconciliação POR VALOR de duas extrações independentes (docs críticos).

Para o dado de maior valor (BM, Medição, Cronograma — base de pleito), rodamos a
extração DUAS vezes e exigimos que os NÚMEROS concordem. A comparação é
VALUE-CENTRIC: compara o conjunto/multiconjunto de VALORES numéricos extraídos,
IGNORANDO nome de campo, formato de texto e ordem.

Por quê (decisão de mai/2026): duas passadas independentes do modelo escolhem nomes
de chave e formatos diferentes para o MESMO dado — `valor_total_psq` vs
`valor_total_obra`; `numeroBM`="Medição 3" vs `numeroMedicao`=3; "agosto/2024" vs
"2024-08"; coluna "Custo" vs "custo". Isso NÃO é divergência de dado, é variação
COSMÉTICA. Comparar a estrutura livre gerava falso `needs_review` em TODO doc (a
planilha é lida em código — células idênticas por construção — mas o rótulo da coluna
mudava e fazia 377/381 linhas "parecerem" diferentes). Aqui só conta o que importa:
o modelo leu um NÚMERO diferente?

  · tabela            → MULTICONJUNTO de números das células (contagem importa: uma
                        linha a menos = um número a menos). Determinístico → idêntico
                        por construção; divergência aqui = leitura real diferente.
  · totais_declarados → CONJUNTO de números distintos (a mesma cifra pode aparecer sob
    + chave_valor        várias chaves redundantes; só os VALORES distintos importam).
  · identificação     → IGNORADA (metadado: nome/data/nº do doc — texto/código, não é
                        a carga financeira; comparar gera ruído tipo "Medição 3" → 3).
"""

from __future__ import annotations

from collections import Counter

_ROUND = 4  # absorve ruído de float (39765999.9999 == 39766000) e preserva % (0.1599)


def _as_number(v):
    """Número canônico (float arredondado) se v É número ou string PURAMENTE numérica
    (BR/US). Data, código com letra, texto → None (fora da comparação)."""
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        try:
            f = float(v)
        except (TypeError, ValueError):
            return None
        if f != f or f in (float("inf"), float("-inf")):  # NaN/inf fora
            return None
        return round(f, _ROUND)
    if isinstance(v, str):
        from .cells import to_number_br

        n = to_number_br(v.strip())
        return round(float(n), _ROUND) if n is not None else None
    return None


def _walk(v, out: list) -> None:
    """Coleta recursivamente todos os números de v (escalar/dict/list)."""
    if isinstance(v, dict):
        for x in v.values():
            _walk(x, out)
    elif isinstance(v, (list, tuple)):
        for x in v:
            _walk(x, out)
    else:
        n = _as_number(v)
        if n is not None:
            out.append(n)


def _table_numbers(env: dict) -> Counter:
    """Multiconjunto dos números de TODAS as células de tabela (contagem importa)."""
    nums: list = []
    for s in env.get("secoes") or []:
        if isinstance(s, dict) and s.get("tipo") == "tabela":
            for row in s.get("linhas") or []:
                _walk(row, nums)
    return Counter(nums)


def _kv_numbers(env: dict) -> set:
    """Conjunto de números distintos de totais_declarados + seções chave_valor."""
    nums: list = []
    _walk(env.get("totais_declarados"), nums)
    for s in env.get("secoes") or []:
        if isinstance(s, dict) and s.get("tipo") == "chave_valor":
            _walk(s.get("dados"), nums)
    return set(nums)


def _fmt(n) -> str:
    return str(int(n)) if isinstance(n, float) and n.is_integer() else str(n)


def _declared_totals(env: dict) -> set:
    """Conjunto de números que são TOTAIS declarados — uma passada pode pôr o total como
    LINHA de tabela e a outra não; divergir nisso é estrutural, não erro de item."""
    nums: list = []
    _walk((env or {}).get("totais_declarados"), nums)
    return set(nums)


def _is_edge(n: float, totals: set) -> bool:
    """Número de BORDA: divergir nele NÃO é erro de dado de item — é variação estrutural/
    de formato. Borda = zero, total declarado (total-como-linha numa passada só), ou
    percentual/fração COMPUTADA (|n|<1 com ≥3 casas decimais, ex.: 0.1599 = 15,99%, que
    varia por arredondamento entre passadas). NÚCLEO = valor de item/custo, incluindo
    preço/quantidade sub-R$1 redondo (0.50, 0.75) — divergir nesses É erro real a revisar."""
    if n == 0:
        return True
    a = abs(float(n))
    if a < 1:
        # casas decimais do valor: ≥3 = fração computada/percentual (borda); ≤2 = possível
        # preço/quantidade redondo (núcleo).
        dec = 0
        r = round(a, _ROUND)
        s = f"{r:.{_ROUND}f}".rstrip("0")
        if "." in s:
            dec = len(s.split(".", 1)[1])
        if dec >= 3:
            return True
    return round(float(n), _ROUND) in totals


def _sumario(counter: Counter, full: Counter) -> str:
    n = sum(counter.values())
    if not n:
        return "—"
    return f"{n} de {sum(full.values())}: " + ", ".join(_fmt(x) for x in sorted(counter)[:6])


def diff_envelopes(a: dict, b: dict, *, max_diffs: int = 60) -> list[dict]:
    """Divergências POR VALOR entre dois envelopes. Lista de {field, valueA, valueB}.
    VAZIA = as duas passadas concordam nos NÚMEROS (ainda que tenham rotulado/formatado
    diferente). Só dispara quando uma passada leu um número que a outra não confirma."""
    a, b = a or {}, b or {}
    diffs: list[dict] = []

    def add(field, va, vb, core=True):
        if len(diffs) < max_diffs:
            diffs.append({"field": field, "valueA": va, "valueB": vb, "core": core})

    totals = _declared_totals(a) | _declared_totals(b)

    # 1) Tabela · multiconjunto. Separa NÚCLEO (item/custo → revisão) de BORDA (%/total/
    #    zero → só info). Divergir num percentual ou em total-como-linha não é erro de dado.
    ta, tb = _table_numbers(a), _table_numbers(b)
    if ta != tb:
        only_a, only_b = ta - tb, tb - ta
        core_a = Counter({n: c for n, c in only_a.items() if not _is_edge(n, totals)})
        core_b = Counter({n: c for n, c in only_b.items() if not _is_edge(n, totals)})
        edge_a, edge_b = only_a - core_a, only_b - core_b
        if sum(core_a.values()) or sum(core_b.values()):
            add("valores de tabela divergentes (NÚCLEO)", _sumario(core_a, ta), _sumario(core_b, tb), core=True)
        if sum(edge_a.values()) or sum(edge_b.values()):
            add("valores de tabela divergentes (borda %/total/zero)", _sumario(edge_a, ta), _sumario(edge_b, tb), core=False)

    # 2) Totais + chave_valor · conjunto de valores (chave/redundância não importa).
    ka, kb = _kv_numbers(a), _kv_numbers(b)
    for n in sorted(ka - kb):
        add("valor não confirmado pela 2ª passada", _fmt(n), None, core=not _is_edge(n, totals))
    for n in sorted(kb - ka):
        add("valor não confirmado pela 1ª passada", None, _fmt(n), core=not _is_edge(n, totals))

    return diffs
