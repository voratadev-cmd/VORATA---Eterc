"""Normalização determinística de células de planilha → valores fiéis do envelope.

Usado pela ingestão determinística (`ingerir_planilha`): em vez do modelo
TRANSCREVER linha a linha (centenas de tool-calls, lento e sujeito a erro de
digitação), lemos as células em código. openpyxl com `data_only=True` (e o xls
tipado em doc_tools) já devolvem tipos nativos, então isto é mais rápido E mais
fiel:

  · número nativo → número (float inteiro vira int p/ não virar "320.0")
  · data/datetime → ISO (YYYY-MM-DD, ou com hora se houver)
  · string numérica → número, RESPEITANDO O LOCALE DA COLUNA (BR vs US) — o
    ambíguo "1.234" vira 1234 numa coluna BR e 1.234 numa coluna US. Sem sinal,
    assume BR (produto pt-BR). Códigos com zero à esquerda ("007") ficam string.
  · célula vazia → None (omitida da linha)
"""

from __future__ import annotations

import datetime as _dt
import re

_MONEY = re.compile(r"^R\$\s*", re.IGNORECASE)

# Sobre a string já sem "R$"/espaços:
_PLAIN_INT = re.compile(r"^-?\d+$")  # 1234
_BR_THOUS = re.compile(r"^-?\d{1,3}(?:\.\d{3})+(?:,\d+)?$")  # 1.234 · 1.234.567 · 1.234,56
_BR_DEC = re.compile(r"^-?\d+,\d+$")  # 1234,56
_US_THOUS = re.compile(r"^-?\d{1,3}(?:,\d{3})+(?:\.\d+)?$")  # 1,234 · 1,234,567.89
_US_DEC = re.compile(r"^-?\d+\.\d+$")  # 1234.56 · 1.234 (decimal US)

# Sinais que desambiguam o locale de uma COLUNA:
_BR_MULTIGROUP = re.compile(r"\d\.\d{3}\.\d{3}")  # 2+ grupos de milhar com ponto → BR
# espaço-milhar: grupos de EXATAMENTE 3 dígitos separados por espaço ('39 775 999.99').
# Estrito de propósito: '327 00' (grupo de 2 = garbled) NÃO casa → fica string.
_SPACE_THOUS = re.compile(r"^-?\d{1,3}(?: \d{3})+(?:[.,]\d{1,2})?$")
_US_DEC_SIGNAL = re.compile(r"^-?\d+\.\d{1,2}$|^-?\d+\.\d{4,}$")  # decimal com ponto e ≠3 casas → US
# Parte inteira exatamente 0 + ponto-decimal: '0.850' SÓ pode ser 0.85 (ninguém escreve
# 850 mil como '0.850') → decimal inequívoco em QUALQUER locale. Resolve a inflação 1000x.
_LEADZERO_DOT_DEC = re.compile(r"^-?0\.\d+$")


def _int_part_digits(t: str) -> str:
    head = re.split(r"[.,]", t.lstrip("-"), maxsplit=1)[0]
    return re.sub(r"\D", "", head)


def _to_num(t: str):
    f = float(t)
    return int(f) if f.is_integer() else f


def parse_number(s: str, locale: str = "br"):
    """Converte uma string numérica em número segundo o `locale` ('br'|'us').
    Conservador: códigos com zero à esquerda e qualquer coisa com letra/unidade → None."""
    t = _MONEY.sub("", s.strip()).strip()
    # Negativo entre parênteses (convenção contábil BR: '(1.234,56)' = -1234,56). Sem isto,
    # glosas/estornos viravam None (perda de valor). Desembrulha e marca o sinal.
    neg_paren = False
    if len(t) >= 3 and t[0] == "(" and t[-1] == ")":
        inner = t[1:-1].strip()
        if inner and not any(c.isalpha() for c in inner):
            t = inner
            neg_paren = True
    if _SPACE_THOUS.match(t):  # '39 775 999.99' → espaço entre grupos de 3 = milhar → remove
        t = t.replace(" ", "")
    if not t or not any(c.isdigit() for c in t):
        return None
    if neg_paren:  # aplica o sinal negativo do parêntese ao resultado
        r = parse_number(t, locale)
        return -r if isinstance(r, (int, float)) and not isinstance(r, bool) else None
    intp = _int_part_digits(t)
    if len(intp) > 1 and intp.startswith("0"):  # '007', '0123' → é código, não número
        return None
    try:
        if _PLAIN_INT.match(t):
            return int(t)
        # '0.850' → 0.85 em QUALQUER locale (parte inteira 0 + ponto = decimal, nunca milhar).
        # Tem que vir ANTES de _BR_THOUS, que casaria '0.850' como milhar e inflaria 1000x.
        if _LEADZERO_DOT_DEC.match(t):
            return _to_num(t)
        if locale == "us":
            if _US_THOUS.match(t):
                return _to_num(t.replace(",", ""))
            if _US_DEC.match(t):
                return _to_num(t)
            if _BR_DEC.match(t):  # "1234,56" ainda é decimal mesmo em coluna US
                return _to_num(t.replace(",", "."))
        else:  # br
            if _BR_THOUS.match(t):
                return _to_num(t.replace(".", "").replace(",", "."))
            if _BR_DEC.match(t):
                return _to_num(t.replace(",", "."))
            if _US_THOUS.match(t):  # vírgula-milhar é inequivocamente US, mesmo em coluna BR
                return _to_num(t.replace(",", ""))
            if _US_DEC_SIGNAL.match(t):  # ponto-decimal INEQUÍVOCO (≠3 casas: 1.00, 168.52, 12.5) = decimal
                return _to_num(t)
    except ValueError:
        return None
    return None


# Retrocompat (testes/uso antigo): BR por padrão.
def to_number_br(s: str):
    return parse_number(s, "br")


def detect_column_locale(values) -> str:
    """Decide o locale ('br'|'us') de uma coluna a partir de sinais inequívocos
    nas strings dela. Sem sinal → 'br' (produto pt-BR)."""
    br = us = False
    for raw in values:
        if not isinstance(raw, str):
            continue
        t = _MONEY.sub("", raw.strip()).strip()
        if not t:
            continue
        if _BR_DEC.match(t):  # vírgula decimal → BR
            br = True
        if _BR_MULTIGROUP.search(t):  # 1.234.567 → BR
            br = True
        if _BR_THOUS.match(t) and "," in t:  # 85.350,00 = ponto-milhar + vírgula-decimal = BR inequívoco
            br = True
        if _US_THOUS.match(t):  # vírgula-milhar → US
            us = True
        if _US_DEC_SIGNAL.match(t):  # decimal com ponto e ≠3 casas → US
            us = True
        if _LEADZERO_DOT_DEC.match(t):  # '0.850' → coluna usa ponto-decimal (resgata coef. dot-3)
            us = True
    if us and not br:
        return "us"
    return "br"


def norm_value(v, parse_text_numbers: bool = True, locale: str = "br"):
    """Normaliza UMA célula nativa (openpyxl/xls tipado) p/ valor do envelope."""
    if v is None:
        return None
    if isinstance(v, bool):  # bool é subclasse de int → trata ANTES
        return v
    if isinstance(v, int):
        return v
    if isinstance(v, float):
        if v != v or v in (float("inf"), float("-inf")):  # NaN/inf não entram
            return None
        return int(v) if v.is_integer() else v
    if isinstance(v, _dt.datetime):  # datetime é subclasse de date → trata ANTES
        if v.hour == 0 and v.minute == 0 and v.second == 0 and v.microsecond == 0:
            return v.date().isoformat()
        return v.isoformat(sep=" ")
    if isinstance(v, _dt.date):
        return v.isoformat()
    s = str(v)
    if "_x000D_" in s or "\r" in s or "\xa0" in s:  # CR escapado/literal + NBSP-milhar → espaço
        s = re.sub(r"\s+", " ", s.replace("_x000D_", " ").replace("\r", " ").replace("\xa0", " "))
    s = s.strip()
    if not s or s in ("-", "–", "—", "−"):  # célula "sem valor"/sem execução → null (não a string "-")
        return None
    if parse_text_numbers:
        n = parse_number(s, locale)
        if n is not None:
            return n
    return s


def _clean_header(c, i: int) -> str:
    """Nome de coluna limpo: colapsa quebras de linha/tabs/espaços múltiplos (a grade
    de PDF quebra cabeçalho em várias linhas → 'Quantidade no\\nPeríodo') num espaço só.
    Vazio → col_N. Não altera o VALOR das células, só a chave da coluna."""
    if c is None:
        return f"col_{i + 1}"
    # _x000D_ = carriage-return XML escapado que o openpyxl não desconverte (cabeçalho
    # multi-linha de planilha) → vira nome de coluna garbled. Limpa antes de normalizar.
    raw = str(c).replace("_x000D_", " ").replace("\r", " ").replace("\xa0", " ")
    nm = re.sub(r"\s+", " ", raw).strip()
    return nm or f"col_{i + 1}"


def resolve_columns(header_cells, override=None) -> list[str]:
    """Resolve nomes de coluna a partir do override (posicional) ou da linha de
    cabeçalho. Nomes vazios viram col_N; duplicatas ganham sufixo único (_2, _3…)
    sem colidir com um header literal já existente."""
    if override:
        names = [_clean_header(c, i) for i, c in enumerate(override)]
    elif header_cells is not None:
        cells = list(header_cells)
        while cells and (cells[-1] is None or str(cells[-1]).strip() == ""):
            cells.pop()
        names = [_clean_header(c, i) for i, c in enumerate(cells)]
    else:
        names = []
    used: set[str] = set()
    out: list[str] = []
    for nm in names:
        if nm not in used:
            out.append(nm)
            used.add(nm)
            continue
        k = 2
        while f"{nm}_{k}" in used:
            k += 1
        cand = f"{nm}_{k}"
        out.append(cand)
        used.add(cand)
    return out


def audit_ingested(columns: list[str], rows: list[dict], *, sample: int = 400) -> list[int]:
    """Detector determinístico de ANOMALIA ESTRUTURAL (alta precisão, baixo ruído).
    Acha linhas que provavelmente NÃO são dados — cabeçalho repetido, título de
    seção, ou uma 2ª tabela colada com schema diferente — pelo sinal: TEXTO em ≥2
    colunas que são majoritariamente NUMÉRICAS. Um "N/A" solto não dispara; um
    subtotal (que mantém números nas colunas numéricas) não dispara.

    Retorna os ÍNDICES (0-based) das linhas suspeitas. A ingestão usa isso pra
    mandar pra needs_review em vez de devolver uma tabela com lixo no meio."""
    if not rows or not columns:
        return []
    # Colunas majoritariamente numéricas (≥80%, mín. 5 amostras).
    numeric_cols: list[str] = []
    for c in columns:
        nums = total = 0
        for r in rows[:sample]:
            v = r.get(c)
            if v is None or v == "":
                continue
            total += 1
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                nums += 1
        if total >= 5 and nums / total >= 0.8:
            numeric_cols.append(c)
    if len(numeric_cols) < 2:
        return []  # sem ≥2 colunas numéricas não dá pra inferir anomalia com segurança
    suspeitas: list[int] = []
    for i, r in enumerate(rows):
        textos: list[str] = []
        for c in numeric_cols:
            v = r.get(c)
            if v is None or v == "":
                continue
            # Só conta como ANOMALIA texto com LETRA (rótulo de cabeçalho repetido / 2ª tabela,
            # ex.: 'TPS AEROPORTO', '#REF!'). Um número/percent formatado como string ('15,99%',
            # '1.234,56', 'R$ 100') é só tipo não-coagido (a Normalização resolve) — NÃO é sinal
            # de grade torta. Sem isto, a linha-mãe do BM (percentuais globais) reprovava à toa.
            if isinstance(v, str) and parse_number(v) is None and any(ch.isalpha() for ch in v):
                textos.append(v.strip())
        if len(textos) >= 2:
            # Linha-RÓTULO de seção (célula mesclada espalhada nas colunas numéricas): o MESMO
            # texto em todas elas é um subtítulo estrutural ('MÃO DE OBRA DIRETA — 1º TURNO',
            # 'SUPRESSÃO VEGETAL') de histograma de blocos EMPILHADOS — não é cabeçalho repetido /
            # 2ª tabela (esses trazem valores DIFERENTES por coluna, ex. meses). A normalização
            # pula a linha-rótulo; não vira needs_review à toa. Anomalia real (≥2 textos distintos)
            # segue reprovando — fail-loud honesto.
            if len(set(textos)) == 1:
                continue
            suspeitas.append(i)
    return suspeitas


_NOISE_HINTS = ("assinado de forma digital", "assinado digitalmente", "por extenso")
# Bloco nome + CPF (11 díg) ou CNPJ (14 díg), formatado ou não — ASSINATURA. Estreito de
# PROPÓSITO: NÃO casa EMPENHO/PROCESSO/CONTRATO/NOTA (6-10 díg), que são LINHA DE DADO real
# (antes o '\d{6,}' dropava 'EMPENHO: 2024001234' e o valor da linha sumia em silêncio).
_SIG_RE = re.compile(
    r"[A-ZÀ-Ú][A-ZÀ-Ú.\s]{3,}:\s*"
    r"(?:\d{3}\.\d{3}\.\d{3}-?\d{2}|\d{2}\.\d{3}\.\d{3}/\d{4}-?\d{2}|\d{14}|\d{11})(?!\d)"
)


def _is_noise_row(obj: dict) -> bool:
    """RODAPÉ/ASSINATURA — nunca é item de dado: 'Assinado de forma digital', linha de
    'valor por extenso', bloco nome+CPF/CNPJ. Determinístico (o modelo nem sempre corta via
    persona). Dropar também TIRA o CPF da tabela (a favor de LGPD)."""
    # Linha com QUALQUER valor numérico nativo (int/float) é DADO, nunca rodapé/assinatura —
    # protege a linha de item cujo rótulo casa o padrão ('1 | EMPENHO: 2024001234 | 50000').
    if any(isinstance(v, (int, float)) and not isinstance(v, bool) for v in obj.values()):
        return False
    parts = [v for v in obj.values() if isinstance(v, str)]
    if not parts:
        return False
    joined = " ".join(parts)
    low = joined.lower()
    if any(h in low for h in _NOISE_HINTS):
        return True
    return bool(_SIG_RE.search(joined))


def _norm_colname(name) -> str:
    import unicodedata

    s = unicodedata.normalize("NFKD", str(name)).encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"\s+", " ", s).strip()


# Colunas-código fortes (substring no nome normalizado, sem ambiguidade).
_CODE_COL_STRONG = ("numeroitem", "numerodocumento", "numerobm", "edt", "eap", "wbs")
# Colunas-código por token exato (evita casar 'custo', 'descrição'…).
_CODE_COL_TOKENS = ("item", "codigo", "cod", "nivel", "ordem", "sequencia")
# Valor INEQUIVOCAMENTE código hierárquico (impossível ser decimal/preço): ≥2 pontos
# (1.2.3), separador -// (1-2, 2025/01), ou zero à esquerda (007). Um '1.10' isolado é
# AMBÍGUO e NÃO casa aqui — mas se a coluna tiver QUALQUER valor inequívoco, toda a coluna
# vira código e o '1.10' também é preservado (decisão por coluna, em build_rows).
_CODE_VALUE_STRONG = re.compile(r"^\d+\.\d+\.\d+(\.\d+)*$|^\d+[-/]\d+([-/]\d+)*$|^0\d+$")
# Forma INEQUÍVOCA de código hierárquico de ITEM p/ o detector de DESLOCAMENTO de coluna —
# só dotted com ≥2 pontos (1.2.3) ou zero à esquerda (007). NÃO inclui a forma slash/dash de
# 2 partes, que casaria DATA ('2025/01','30/09') e falsa-positivava uma coluna legítima de
# Período/mês → hard-block (_err) da tabela inteira. O caso PSQ (códigos dotted) segue pego.
_HIER_CODE_STRICT = re.compile(r"^\d+\.\d+\.\d+(\.\d+)*$|^0\d+$")


def is_code_column(name) -> bool:
    """A coluna tem NOME de CÓDIGO/identificador hierárquico (Item, EDT, EAP, WBS, Código…)?
    Sinal NECESSÁRIO mas não suficiente — build_rows confirma pelo CONTEÚDO (só preserva
    string verbatim se os valores realmente parecem código, p/ não transformar um contador
    inteiro 'Nível'/'Ordem' 1,2,3 em string à toa)."""
    n = _norm_colname(name)
    if not n:
        return False
    if any(h in n for h in _CODE_COL_STRONG):
        return True
    toks = n.split(" ")
    return any(t in toks for t in _CODE_COL_TOKENS)


def _has_strong_code_value(values) -> bool:
    """A coluna tem ALGUM valor inequivocamente código (1.2.3 / 1-2 / 007)? Decisão por
    COLUNA: se sim, toda a coluna é código (e mesmo o '1.10' ambíguo vira string verbatim,
    preservando o zero). Sem sinal forte, decimais/preços seguem número."""
    return any(isinstance(s, str) and _CODE_VALUE_STRONG.match(s.strip()) for s in values)


def _is_strong_code_column(name) -> bool:
    """NOME inequivocamente de código hierárquico (EDT/EAP/WBS/Nº Item/Nº BM/Nº Doc) — SEMPRE
    código, sem precisar de confirmação por conteúdo. Sem isto, uma coluna EDT só de 2 níveis
    ('1.1'…'1.10','1.100') vira FLOAT e 1.10/1.100 COLIDEM em 1.1 (identidade destruída). Tokens
    FRACOS ('Item'/'Código'/'Nível'/'Ordem') seguem precisando do conteúdo (podem ser contador)."""
    n = _norm_colname(name)
    return bool(n) and any(h in n for h in _CODE_COL_STRONG)


def detectar_deslocamento_colunas(columns: list[str], data: list[dict]):
    """Detecta DESLOCAMENTO de coluna por CONTEÚDO (robusto a qualquer nome de placeholder).
    Sintoma: uma coluna cujo NOME não é de código carrega valores que são MAJORITARIAMENTE
    código hierárquico (1.2.3) — ou seja, os códigos de item vazaram pra uma coluna errada
    porque o override do modelo está desalinhado (caso PSQ: '_colA_vazia'/'x'/'(em branco)'
    com os códigos de item). Retorna uma string descritiva (motivo) ou None se OK.

    NÃO usa o nome 'vazia' — só o conteúdo — então pega qualquer placeholder. E NÃO
    falsa-positiva numa coluna legítima 'Item'/'EDT' (nome É de código) nem em 'Peso vazio
    (kg)' (pesos não são código hierárquico)."""
    if not data:
        return None
    n = len(data)
    thresh = max(3, int(0.30 * n))
    for col in columns:
        if is_code_column(col):
            continue  # coluna que JÁ é nomeada como código → códigos ali são esperados
        code_hits = sum(
            1
            for r in data
            if isinstance(r, dict)
            and isinstance(r.get(col), str)
            and _HIER_CODE_STRICT.match(r[col].strip())
        )
        if code_hits >= thresh:
            return (
                f"a coluna '{col}' (nome não-código) contém {code_hits} de {n} valores com forma "
                f"de CÓDIGO hierárquico (ex.: 1.2.3) — os códigos de item caíram na coluna errada"
            )
    return None


def build_rows(
    sheet_rows: list,
    columns: list[str],
    de: int,
    ate: int,
    *,
    skip_empty: bool = True,
    parse_text_numbers: bool = True,
) -> list[dict]:
    """Constrói os objetos {coluna: valor} para [de, ate] (1-based, inclusive).
    Detecta o locale numérico POR COLUNA (1 passada) antes de montar, p/ não
    alterar valores ambíguos. Colunas de CÓDIGO (Item/EDT/EAP…) ficam string verbatim
    ('1.10' não pode virar 1.1). Células vazias são omitidas; linhas totalmente
    vazias são puladas (se skip_empty)."""
    ncols = len(columns)
    lo = max(1, de)
    hi = min(ate, len(sheet_rows))

    # Passada 1 · coleta as strings de cada coluna (p/ locale numérico E p/ confirmar
    # colunas de código pelo CONTEÚDO).
    col_strings: list[list[str]] = [[] for _ in range(ncols)]
    for idx in range(lo, hi + 1):
        raw = sheet_rows[idx - 1]
        for ci in range(ncols):
            v = raw[ci] if ci < len(raw) else None
            if isinstance(v, str) and v.strip():
                col_strings[ci].append(v)

    locales = ["br"] * ncols
    if parse_text_numbers and ncols:
        locales = [detect_column_locale(col_strings[ci]) for ci in range(ncols)]

    # Coluna de código = NOME de código E pelo menos um valor INEQUIVOCAMENTE código
    # (1.2.3, 1-2, 007) na coluna. Aí toda a coluna fica string verbatim (até o '1.10'
    # ambíguo, preservando o zero). 'Item'/'EDT' EAP → string; 'Peso Nível'/'Nível d'água'
    # (decimais) e contador 'Ordem' 1,2,3 → número (sem efeito colateral).
    code_cols = [
        is_code_column(columns[ci])
        and (_is_strong_code_column(columns[ci]) or _has_strong_code_value(col_strings[ci]))
        for ci in range(ncols)
    ]

    # Passada 2 · monta as linhas.
    out: list[dict] = []
    for idx in range(lo, hi + 1):
        raw = sheet_rows[idx - 1]
        obj: dict = {}
        for ci in range(ncols):
            v = raw[ci] if ci < len(raw) else None
            # Coluna de código → preserva o texto verbatim (não vira número).
            ptn = parse_text_numbers and not code_cols[ci]
            nv = norm_value(v, ptn, locales[ci])
            if nv is None or nv == "":
                continue
            obj[columns[ci]] = nv
        if skip_empty and not obj:
            continue
        if _is_noise_row(obj):  # rodapé/assinatura → fora da tabela (rede determinística)
            continue
        out.append(obj)
    return out
