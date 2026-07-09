"""Checagem determinística do envelope (sem modelo · custo zero).

Rede de segurança secundária além do extrator: confere o que dá pra conferir
em Python — somas vs `totais_declarados`, coerência de datas, faixas de %, tabela
crítica vazia. CONSERVADOR de propósito: só aponta quando tem certeza, pra não
falsar `needs_review` (BR `1.234,56` tem tolerância de arredondamento).

Severidade → `needs_review`: qualquer `error`, ou ≥3 `warn`.
"""

from __future__ import annotations

import datetime as _dt
import re
import unicodedata
from dataclasses import dataclass, field


@dataclass
class SanityResult:
    findings: list[dict] = field(default_factory=list)
    failed: bool = False
    sum_failed: bool = False  # soma de coluna ≠ total declarado — reprova sozinho

    def add(self, severity: str, message: str, field_path: str = "") -> None:
        self.findings.append({"severity": severity, "message": message, "field": field_path, "source": "sanity"})


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]", "", s.lower())


_NUM_RE = re.compile(r"-?\d[\d.\,]*")
# Espaço (ou NBSP, já normalizado) como separador de milhar SÓ em grupos de 3 ('1 234 567').
# '327 00' (grupo de 2 = garbled) NÃO casa → fica fora da soma, alinhado com a ingestão.
_SPACE_THOUS_SANITY = re.compile(r"^-?\d{1,3}(?: \d{3})+(?:[.,]\d{1,2})?$")


def _num(v) -> float | None:  # noqa: ANN001
    """Coerção numérica tolerante (números já vêm como número; string é fallback)."""
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if not isinstance(v, str):
        return None
    raw = v.strip().replace("R$", "").replace("%", "").replace("\xa0", " ").strip()
    # Negativo entre parênteses (contábil BR: '(1.234,56)' = -1234,56). Alinha com
    # cells.parse_number — sem isto glosa/estorno virava None e caía fora da conferência
    # da soma → falso sum_failed num doc correto.
    neg = False
    if len(raw) >= 3 and raw[0] == "(" and raw[-1] == ")":
        inner = raw[1:-1].strip()
        if inner and not any(c.isalpha() for c in inner):
            raw, neg = inner, True
    # Espaço-milhar estrito (grupos de 3); senão (ex.: '327 00' garbled) não é número.
    if " " in raw:
        if _SPACE_THOUS_SANITY.match(raw):
            raw = raw.replace(" ", "")
        else:
            return None
    if not raw or not _NUM_RE.search(raw):
        return None
    has_comma, has_dot = "," in raw, "." in raw
    try:
        if has_comma and has_dot:
            # o separador decimal é o ÚLTIMO que aparece
            dec = "," if raw.rfind(",") > raw.rfind(".") else "."
            thou = "." if dec == "," else ","
            raw = raw.replace(thou, "").replace(dec, ".")
        elif has_comma:
            # vírgula sozinha = decimal BR (1.234 sem decimais usaria ponto)
            raw = raw.replace(".", "").replace(",", ".") if raw.count(",") == 1 else raw.replace(",", "")
        elif has_dot:
            if raw.count(".") > 1:
                raw = raw.replace(".", "")  # milhar BR: 1.234.567 → 1234567
            else:
                # 1 ponto, sem vírgula: '1.234' (3 dígitos após o ponto, parte inteira ≠ '0')
                # = milhar BR (alinha com a ingestão) → evita falso reprove da soma. '0.850'
                # (parte inteira 0) e '1.5'/'1.25' (≠3 casas) ficam DECIMAL.
                intp, frac = raw.lstrip("-").split(".")
                if len(frac) == 3 and intp not in ("", "0"):
                    raw = raw.replace(".", "")
        val = float(raw)
        return -val if neg else val
    except ValueError:
        return None


_ISO = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")
_BR_DATE = re.compile(r"^(\d{1,2})/(\d{1,2})/(\d{4})$")  # dd/mm/aaaa
# String que TEM cara de data (ISO ou BR) — usada pra flagar data INVÁLIDA
# ('31/04/2023', ano '20222') que hoje passava batido.
_DATE_LIKE = re.compile(r"^\d{1,2}/\d{1,2}/\d{2,5}$|^\d{1,5}-\d{1,2}-\d{1,2}$")


def _parse_iso(s) -> _dt.date | None:  # noqa: ANN001
    """Parseia data ISO (aaaa-mm-dd) OU BR (dd/mm/aaaa). None se inválida."""
    if not isinstance(s, str):
        return None
    s = s.strip()  # tolera espaço/NBSP nas pontas (par início>fim com whitespace escapava)
    m = _ISO.match(s)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    else:
        mb = _BR_DATE.match(s)
        if not mb:
            return None
        d, mo, y = int(mb.group(1)), int(mb.group(2)), int(mb.group(3))
    try:
        return _dt.date(y, mo, d)
    except ValueError:  # 2024-13-01, 31/04/2023, 2024-02-30
        return None


def _iter_kv(obj, prefix=""):  # noqa: ANN001
    """Percorre pares (caminho, chave, valor) em dicts/listas aninhados."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            path = f"{prefix}.{k}" if prefix else str(k)
            yield path, k, v
            yield from _iter_kv(v, path)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from _iter_kv(v, f"{prefix}[{i}]")


def _check_dates(payload: dict, res: SanityResult) -> None:
    pairs = [("inicio", "fim"), ("datainicio", "datafim"), ("dtinicio", "dtfim"), ("inicial", "final")]
    # procura objetos que tenham um par início/fim
    def scan(obj, path):  # noqa: ANN001
        if isinstance(obj, dict):
            keymap = {_norm(k): (k, v) for k, v in obj.items()}
            for a, b in pairs:
                if a in keymap and b in keymap:
                    va, vb = keymap[a][1], keymap[b][1]
                    da, db = _parse_iso(va), _parse_iso(vb)
                    if da and db and da > db:
                        res.add("error", f"data início {va} > fim {vb}", f"{path}.{keymap[a][0]}")
            for k, v in obj.items():
                scan(v, f"{path}.{k}" if path else str(k))
        elif isinstance(obj, list):
            for i, v in enumerate(obj):
                scan(v, f"{path}[{i}]")

    scan(payload, "")

    # Sweep global: qualquer valor com CARA de data (ISO/BR) que NÃO parseia é data
    # inválida real ('31/04/2023', '32/01/2026', ano '20222') — antes passava batido.
    seen = 0
    for p, _k, v in _iter_kv(payload):
        if seen >= 12:  # teto: não inundar findings num doc com muitas datas ruins
            break
        if isinstance(v, str) and _DATE_LIKE.match(v.strip()) and _parse_iso(v.strip()) is None:
            res.add("warn", f"data inválida: {v}", p)
            seen += 1


def _check_percent(payload: dict, res: SanityResult) -> int:
    warns = 0
    for path, k, v in _iter_kv(payload):
        nk = _norm(k)
        if ("percent" in nk or nk.endswith("perc") or "%" in str(k)) and not isinstance(v, (dict, list)):
            n = _num(v)
            if n is not None and (n < -0.01 or n > 100.01):
                res.add("warn", f"percentual fora de [0,100]: {k}={v}", path)
                warns += 1
    return warns


# Totais cujo NOME indica grandeza NÃO-somável (dias, datas, %) — somar uma coluna
# dessas pra comparar com o total é conceitualmente inválido (108 durações ≠ prazo).
_NONSUM_HINTS = ("dia", "prazo", "data", "percent", "perc", "duracao")


_TOTAL_LABELS = {
    "total", "totalgeral", "totaldaobra", "valortotal", "valortotaldaobra", "subtotal", "totalgeraldaobra",
}


def _is_total_label(s) -> bool:
    """A célula é rótulo de TOTAL/SUBTOTAL (rodapé OU subtotal de etapa)? Casa por PREFIXO no
    texto normalizado ('Subtotal Etapa 1'→'subtotaletapa1', 'Total da Etapa', 'TOTAL GERAL'), não
    membership EXATO — senão subtotal-de-etapa SEM código era somado como item e MASCARAVA erro
    real / inflava a soma (SAN-1/2). Conservador: descrição de item raramente começa com total/subtotal."""
    if not isinstance(s, str):
        return False
    n = _norm(s)
    return bool(n) and (n.startswith("total") or n.startswith("subtotal") or n in _TOTAL_LABELS)


def _is_footer_row(r: dict) -> bool:
    """Linha de RODAPÉ/TOTAL/SUBTOTAL (não é item) — alguma célula textual começa com total/subtotal."""
    return any(_is_total_label(v) for v in r.values())


def _total_row_values(secoes: list) -> list[float]:
    """Valores numéricos das linhas que são claramente a linha de TOTAL da tabela
    (alguma célula textual = TOTAL/TOTAL GERAL/VALOR TOTAL DA OBRA/SUBTOTAL). Usado
    pra CONFERIR totais_declarados contra a própria linha de total do documento."""
    vals: list[float] = []
    for sec in secoes:
        if not isinstance(sec, dict) or sec.get("tipo") != "tabela":
            continue
        for r in sec.get("linhas") or []:
            if not isinstance(r, dict):
                continue
            if any(_is_total_label(v) for v in r.values()):
                for v in r.values():
                    n = _num(v)
                    if n is not None:
                        vals.append(n)
    return vals


def _check_sums(payload: dict, res: SanityResult, critical: bool) -> int:
    """Para cada total declarado numérico, confere de 2 formas: (1) soma a coluna de
    mesmo nome (se houver e for somável); (2) casa o VALOR contra a linha TOTAL do
    documento. Só reprova quando a soma da coluna diverge de fato."""
    warns = 0
    totais = payload.get("totais_declarados")
    if not isinstance(totais, dict):
        return 0
    secoes = payload.get("secoes") or []
    declared = {(_norm(k)): (k, _num(v)) for k, v in totais.items() if _num(v) is not None}
    if not declared:
        return 0
    conferidos: set[str] = set()  # totais que casaram com alguma coluna (foram somados)
    # Para cada total declarado, AGREGA a coluna casada por TODAS as seções tabela
    # antes de comparar — senão uma tabela quebrada em várias seções reprova falso.
    for nk, (orig_total_key, total_val) in declared.items():
        if any(h in nk for h in _NONSUM_HINTS):
            continue  # dias/datas/% não somam pra um total — confere depois pela linha TOTAL
        # Coleta as linhas somáveis de TODAS as seções que têm a coluna casada, com o código de
        # CADA uma — pra decidir FOLHA globalmente: uma tabela hierárquica pode estar fatiada em
        # +1 seção (pai numa, filhos noutra), e somar pai+filhos contaria o mesmo valor 2×. Nunca
        # soma linha de rodapé TOTAL. É o que mata o falso "erro de soma" dos BMs/EAP.
        rows_val: list[tuple] = []  # (codigo|None, valor)
        all_codes: set[str] = set()
        n_secs = 0
        for sec in secoes:
            if not isinstance(sec, dict) or sec.get("tipo") != "tabela":
                continue
            linhas = sec.get("linhas") or []
            if not isinstance(linhas, list) or not linhas:
                continue
            col_keys: set = set()
            for r in linhas:
                if isinstance(r, dict):
                    col_keys.update(r.keys())
            match_col = next((c for c in col_keys if _norm(c) == nk), None)
            if not match_col:
                continue
            n_secs += 1
            code_col = next((c for c in col_keys if any(h in _norm(c) for h in _CODE_COL_HINTS)), None)
            for r in linhas:
                if not isinstance(r, dict) or match_col not in r:
                    continue
                n = _num(r.get(match_col))
                if n is None:
                    continue
                code = None
                if code_col is not None:
                    cv = r.get(code_col)
                    cs = str(cv).strip() if cv is not None else ""
                    if _CODE_OK.match(cs):
                        code = cs
                # Rodapé/subtotal: rótulo total/subtotal numa linha SEM código de item é
                # linha-RESUMO (não item) → fora da soma. Uma linha COM código é item, confia
                # no código (não exclui 'Total Station' etc., que tem código próprio na coluna).
                if code is None and _is_footer_row(r):
                    continue
                if code is not None:
                    all_codes.add(code)
                rows_val.append((code, n))
        # Pai = código que é PREFIXO de outro (1 é pai de 1.1; 1.1 de 1.1.2). Soma só as folhas
        # (+ linhas sem código, que não são pai de ninguém), atravessando TODAS as seções.
        parents = {c for c in all_codes if any(c2 != c and c2.startswith(c + ".") for c2 in all_codes)}
        leaves = [n for code, n in rows_val if code not in parents]
        if not leaves:
            continue
        s = sum(leaves)
        counted = len(leaves)
        conferidos.add(nk)
        # Tolerância por LINHA (arredondamento acumula com nº de itens, não com o
        # tamanho do total) — mais sensível a erro real que um % do total.
        tol = max(0.02, counted * 0.01)
        if abs(s - total_val) > tol:
            # Soma que não bate raramente é ruído (a tolerância por linha já absorve
            # arredondamento) → reprova SOZINHO, crítico ou não.
            res.sum_failed = True
            sev = "error" if critical else "warn"
            res.add(
                sev,
                f"soma da coluna '{orig_total_key}' agregada ({s:.2f}) ≠ total declarado ({total_val:.2f}) "
                f"[tol {tol:.2f}] · {counted} linha(s) em {n_secs} seção(ões)",
                f"totais_declarados/{orig_total_key}",
            )
            if sev == "warn":
                warns += 1
    # 2ª via: casa o VALOR do total declarado contra a linha TOTAL do próprio documento
    # (resolve o "não conferido" à toa — o doc tem a linha TOTAL e ela bate).
    total_row_vals = _total_row_values(secoes)
    for nk, (orig_total_key, total_val) in declared.items():
        if nk in conferidos:
            continue
        if any(abs(tv - total_val) <= max(0.02, abs(total_val) * 1e-6) for tv in total_row_vals):
            conferidos.add(nk)
            res.add(
                "info",
                f"total declarado '{orig_total_key}' ({total_val:.2f}) confere com a linha TOTAL do documento ✓",
                f"totais_declarados/{orig_total_key}",
            )
    # O que ainda não casou (nem coluna somável, nem linha TOTAL) → não conferido, visível.
    for nk, (orig_total_key, total_val) in declared.items():
        if nk not in conferidos:
            res.add(
                "info",
                f"total declarado '{orig_total_key}' ({total_val:.2f}) não casou com coluna nem linha TOTAL — NÃO conferido",
                f"totais_declarados/{orig_total_key}",
            )
    return warns


_CODE_COL_HINTS = ("item", "edt", "eap", "wbs", "codigo")
_CODE_OK = re.compile(r"^\d+(\.\d+)*$")  # 1 · 1.2 · 1.7.5.4
_SCRAMBLE = re.compile(r"\d[a-zà-ú]\d[a-zà-ú]", re.IGNORECASE)  # '3o2rr7id' = grade torta
# Dia-da-semana abreviado + data = célula de cronograma colada no cabeçalho ('Início sex
# 17/04/26'). Sinal de grade mesclada. NÃO casa período legítimo 'De 01/09 até 30/09'
# (que não tem dia-da-semana) → evita falso positivo em coluna de período de histograma.
_WEEKDAY_DATE = re.compile(
    r"\b(seg|ter|qua|qui|sex|s[áa]b|dom)\.?\s*\d{1,2}/\d{1,2}", re.IGNORECASE
)


def _looks_garbled_col(c) -> bool:
    """Nome de coluna que claramente é cabeçalho MESCLADO com dado (token embaralhado ou
    dia-da-semana+data). Sinal forte de grade de PDF multipágina mal detectada. CONSERVADOR:
    período legítimo ('De 01/09/2025 até 30/09/2025', 'jan/2026') NÃO é garbled."""
    s = str(c).strip()
    return bool(_SCRAMBLE.search(s) or _WEEKDAY_DATE.search(s))


def _check_key_consistency(payload: dict, res: SanityResult) -> None:
    """Detecta corrupção ESTRUTURAL (cabeçalho mesclado/grade torta em PDF tabular):
    linhas usando chaves fora das colunas canônicas, e códigos de item/EDT malformados
    ('1 7 5 4' em vez de '1.7.5.4'). Rede de segurança do fix de header-merge."""
    for sec in payload.get("secoes") or []:
        if not isinstance(sec, dict) or sec.get("tipo") != "tabela":
            continue
        cols = {str(c) for c in (sec.get("colunas") or [])}
        linhas = [r for r in (sec.get("linhas") or []) if isinstance(r, dict)]
        if not cols or len(linhas) < 5:
            continue
        sid = sec.get("_id", "")
        garbled_cols = [c for c in (sec.get("colunas") or []) if _looks_garbled_col(c)]
        if garbled_cols:
            res.add(
                "error",
                f"seção '{str(sec.get('titulo'))[:40]}': {len(garbled_cols)} coluna(s) com nome CORROMPIDO "
                f"(cabeçalho mesclado com dado, ex.: {str(garbled_cols[0])[:24]!r}) — grade de PDF multipágina mal detectada",
                f"secoes/{sid}",
            )
        off = sum(1 for r in linhas if any(str(k) not in cols for k in r))
        if off >= 3 and off / len(linhas) > 0.15:
            res.add(
                "error",
                f"seção '{str(sec.get('titulo'))[:40]}': {off}/{len(linhas)} linhas com chave FORA das "
                "colunas canônicas — provável cabeçalho mesclado/grade corrompida",
                f"secoes/{sid}",
            )
        code_col = next((c for c in cols if any(h in _norm(c) for h in _CODE_COL_HINTS)), None)
        if code_col:
            vals = [
                str(r[code_col]).strip()
                for r in linhas
                if isinstance(r.get(code_col), str) and r[code_col].strip()
            ]
            dotted = sum(1 for v in vals if _CODE_OK.match(v))
            # Só vale como EAP/EDT (onde "malformado" faz sentido) se a coluna é
            # MAJORITARIAMENTE dotted-numeric (1.2.3). Uma coluna de SKU de insumo
            # ('IS2005','CA2008') é 0% dotted → NÃO é EAP, não dispara (era falso-positivo).
            is_eap = bool(vals) and dotted / len(vals) >= 0.5
            bad = (
                [v for v in vals if any(ch.isdigit() for ch in v) and not _CODE_OK.match(v)]
                if is_eap
                else []
            )
            if len(bad) >= 3:
                res.add(
                    "warn",
                    f"seção '{str(sec.get('titulo'))[:40]}': {len(bad)} código(s) de item/EDT malformado(s) "
                    f"(ex.: {bad[0][:20]!r}) — possível corrupção de coluna",
                    f"secoes/{sid}",
                )


def sanity_check(payload: dict, *, critical: bool = False) -> SanityResult:
    res = SanityResult()
    if not isinstance(payload, dict):
        res.add("error", "payload não é um objeto")
        res.failed = True
        return res

    secoes = payload.get("secoes") or []
    has_linhas = any(
        isinstance(s, dict) and s.get("tipo") == "tabela" and (s.get("linhas") or [])
        for s in secoes
    )
    has_conteudo = any(
        isinstance(s, dict) and s.get("tipo") in ("chave_valor", "texto") and (s.get("dados") or s.get("conteudo"))
        for s in secoes
    )
    if critical and not has_linhas:
        res.add("error", "documento crítico sem nenhuma tabela com linhas — possível sub-extração")
    elif not has_linhas and not has_conteudo:
        res.add("warn", "envelope sem dados em nenhuma seção (0 linhas, 0 dados/conteúdo)")

    _check_dates(payload, res)
    _check_key_consistency(payload, res)
    warns = _check_percent(payload, res) + _check_sums(payload, res, critical)

    errors = sum(1 for f in res.findings if f["severity"] == "error")
    res.failed = errors > 0 or warns >= 3 or res.sum_failed
    return res
