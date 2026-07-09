"""Backstop determinístico de cobertura (Fase 1 · fidelidade v45) — fecha o gap das MATRIZES ANÔNIMAS.

O extrator (modelo) captura blocos ROTULADOS e pula matrizes sem banner/cabeçalho — ex.: C.14 Mapa da
Obra L200-222 (avanço físico-financeiro por disciplina/mês, dado ÚNICO, ~736 células sem rótulo,
flutuando após o BLOCO 6). O gate de cobertura as marca FONTE→needs_review (rede certa), mas o dado
fica FORA do envelope. Este backstop, DEPOIS da extração, lê EM CÓDIGO (mesma máquina determinística
do ingerir_planilha) os blocos FONTE órfãos que o gate aponta e os anexa ao builder — fecha a cobertura
sem o modelo e sem transcrever número.

Endurecido contra a armadilha "cobertura-teatro" (capturar_secoes DESCARTA colunas col_* · resolvers.py:2353):
  · NOMES DE COLUNA não-col_* ('rotulo' + 'valor_N') → a seção SOBREVIVE à normalização (não vira vazia).
  · TÍTULO prefixado pelo código da aba ('C.14 — …') → _secao_codigo_modulo dá codigo/modulo corretos
    (título genérico cairia em 'B'/'M1').
  · GUARD de TABULARIDADE (≥2 linhas, ≥2 colunas numéricas) → não auto-ingere texto solto/banner/rascunho.
  · REGIÃO-A-REGIÃO (uma matriz por seção) → nunca funde 2 matrizes sob 1 cabeçalho-fantasma.
A seção fica `coberta=False` (sem resolver/farol typed): é PISO de cobertura+persistência. A semântica
(título-token + nomes de coluna reais) vem na FASE 2 (passada dirigida ao modelo só p/ RENOMEAR — o
número segue sempre da ingestão determinística, NUNCA transcrito).
"""
from __future__ import annotations

from .cells import build_rows

# scope alto → as seções do backstop sortearem DEPOIS de todas as fatias no build() (ordem (scope,seq)).
_BACKSTOP_SCOPE = 10 ** 6
_MIN_LINHAS = 2
_MIN_COLS_NUM = 2


def _eh_num(v) -> bool:  # noqa: ANN001
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _largura(region_rows: list) -> int:
    return max((len(r) for r in region_rows if r), default=0)


def _tabular(region_rows: list) -> bool:
    """Tabular = ≥2 linhas E ≥2 colunas com pelo menos 2 numéricas alinhadas. Mata texto solto, banner,
    célula-param única, range de gráfico — que NÃO devem virar tabela auto-ingerida (ingestão de lixo)."""
    if len(region_rows) < _MIN_LINHAS:
        return False
    ncols = _largura(region_rows)
    cols_num = sum(
        1 for j in range(ncols)
        if sum(1 for r in region_rows if j < len(r) and _eh_num(r[j])) >= 2
    )
    return cols_num >= _MIN_COLS_NUM


def _sintetizar_colunas(region_rows: list) -> list[str]:
    """Nomes NÃO-col_* (senão capturar_secoes os strippa e a seção vira vazia → cobertura-teatro):
    coluna predominantemente TEXTO = 'rotulo' (rótulo de linha — disciplina/frente); coluna NUMÉRICA =
    'valor_N'. Distintos e legíveis. A semântica real (mês, etc.) fica p/ a Fase 2 (modelo renomeia),
    nunca p/ o backstop adivinhar e arriscar roteamento/farol errado."""
    ncols = _largura(region_rows)
    nomes: list[str] = []
    n_rot = n_val = 0
    for j in range(ncols):
        vals = [r[j] for r in region_rows if j < len(r) and r[j] is not None and str(r[j]).strip() != ""]
        n_num = sum(1 for v in vals if _eh_num(v))
        if vals and n_num < len(vals) / 2:  # predominantemente texto → rótulo de linha
            n_rot += 1
            nomes.append("rotulo" if n_rot == 1 else f"rotulo_{n_rot}")
        else:
            n_val += 1
            nomes.append(f"valor_{n_val}")
    return nomes


def ingerir_orfas_fonte(builder, doc) -> list[tuple]:  # noqa: ANN001
    """Auto-ingere, EM CÓDIGO, os blocos FONTE órfãos que o gate de cobertura aponta. MUTA o builder
    (open_secao + append_linhas + track_ingestao). Retorna [(aba, de, ate, n_linhas)] do que ingeriu.
    Região não-tabular é PULADA (continua needs_review honesto). Região-a-região (nunca range fundido)."""
    from .cobertura import cobertura_de_doc

    # As regiões FONTE órfãs do estado ATUAL (pós-extração). por_aba só traz 'regioes' p/ FONTE
    # (ZERO/DERIVADA não entram). extra_ranges credita o que o builder já ingeriu deterministicamente.
    cov = cobertura_de_doc(doc, builder.build(), extra_ranges=builder.ingested_ranges)
    ingeridos: list[tuple] = []
    for a in cov.get("por_aba", []):
        if not a.get("regioes"):
            continue
        aba = a["aba"]
        try:
            rows = doc.sheet_rows(aba)
        except Exception:  # noqa: BLE001 — aba ilegível: deixa o gate reprovar honesto
            continue
        for reg in a["regioes"]:
            de, ate = int(reg["de"]), int(reg["ate"])
            region_rows = [rows[i - 1] for i in range(de, ate + 1) if 0 < i <= len(rows)]
            if not _tabular(region_rows):
                continue  # não-tabular → NÃO ingere (fica needs_review honesto)
            cols = _sintetizar_colunas(region_rows)
            if not cols:
                continue
            data = build_rows(rows, cols, de, ate, skip_empty=True, parse_text_numbers=True)
            if not data:
                continue
            secao_id = f"backstop::{aba}::{de}-{ate}"
            titulo = f"{str(aba).strip()} — Bloco não-rotulado L{de}-L{ate} (auto-ingerido)"
            fonte = f"backstop determinístico · sheet '{aba}' L{de}-L{ate}"
            try:
                builder.open_secao(secao_id, titulo, "tabela", fonte, colunas=cols, scope_order=_BACKSTOP_SCOPE)
                builder.append_linhas(secao_id, data)
            except (KeyError, ValueError):
                continue
            builder.track_ingestao(aba, None, de, ate)
            ingeridos.append((aba, de, ate, len(data)))
    return ingeridos
