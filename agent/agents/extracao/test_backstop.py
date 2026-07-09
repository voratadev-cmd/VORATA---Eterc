"""Backstop determinístico (Fase 1 · fidelidade) · prova ANTI-COBERTURA-TEATRO. A verificação
adversarial mostrou que B-pura (colunas col_*) FECHA o gate mas capturar_secoes DESCARTA a seção em
silêncio → dado perdido com gate verde (pior que needs_review). Este teste trava que o backstop
endurecido (nomes de coluna reais + título com código da aba + guard de tabularidade) faz a matriz
anônima SOBREVIVER à normalização: capturar_secoes retorna ≥1 seção codigo=C.14 com o valor REAL —
NÃO 0 seções. Controle negativo: a mesma matriz com colunas col_* É descartada (por que sintetizamos)."""
from __future__ import annotations

from agents.extracao.backstop import ingerir_orfas_fonte
from agents.extracao.envelope import EnvelopeBuilder
from agents.normalizacao.resolvers import capturar_secoes

_SHEET = "C.14 Mapa da Obra"
_VALOR = 3595996.6  # Terraplenagem mês 3 — âncora do dado ÚNICO que o modelo perdia


class _FakeDoc:
    """Duck-type mínimo que o backstop/cobertura usam: ext + sheet_names + sheet_rows."""
    ext = "xlsx"

    def __init__(self, grid):
        self._g = grid

    def sheet_names(self):
        return list(self._g)

    def sheet_rows(self, name):
        return self._g[name]


def _grid() -> dict:
    return {_SHEET: [
        ["BLOCO 1 — SEGMENTOS (banner)"],                       # L1 banner (órfão, NÃO-tabular → pular)
        ["Item", "M1", "M2"],                                   # L2 cabeçalho (coberto)
        ["Seg A", 10.0, 20.0],                                  # L3 dado coberto
        ["Seg B", 11.0, 21.0],                                  # L4 dado coberto
        [], [], [],                                             # L5-7 separador
        ["Terraplenagem", 0.0, 0.0, _VALOR, 3552073.4],         # L8 MATRIZ ANÔNIMA (órfã, tabular → INGERIR)
        ["Drenagem", 0.0, 0.0, 931829.8, 927477.2],             # L9
        ["Pavimentação", 0.0, 0.0, 0.0, 1366300.5],             # L10
    ]}


def run() -> None:
    doc = _FakeDoc(_grid())
    builder = EnvelopeBuilder()
    builder.set_documento(tipo_documento="Workbook-motor")
    # Bloco 1 (L2-L4) JÁ capturado pelo modelo + coberto (track_ingestao). A matriz L8-L10 fica órfã.
    builder.open_secao("c14_b1", "C.14 Mapa da Obra — Bloco 1", "tabela", "sheet 'C.14' L2-L4",
                       colunas=["Item", "M1", "M2"])
    builder.append_linhas("c14_b1", [{"Item": "Seg A", "M1": 10.0, "M2": 20.0},
                                     {"Item": "Seg B", "M1": 11.0, "M2": 21.0}])
    builder.track_ingestao(_SHEET, 2, 3, 4)

    ingeridos = ingerir_orfas_fonte(builder, doc)

    # (1) ingeriu a MATRIZ (L8-L10), região-a-região; PULOU o banner L1 (não-tabular).
    regioes = {(a, de, ate) for a, de, ate, _ in ingeridos}
    assert (_SHEET, 8, 10) in regioes, f"a matriz L8-L10 tinha que ser auto-ingerida, veio {ingeridos}"
    assert not any(de == 1 for _, de, _, _ in ingeridos), f"banner L1 (não-tabular) NÃO pode ser ingerido: {ingeridos}"

    # (2) ANTI-TEATRO: a seção do backstop SOBREVIVE ao capturar_secoes — codigo=C.14, valor REAL presente.
    secoes = builder.build()["secoes"]
    capturadas = capturar_secoes(secoes)
    bs = [c for c in capturadas if "não-rotulado" in c["titulo"]]
    assert len(bs) >= 1, "a matriz auto-ingerida SUMIU no capturar_secoes (cobertura-teatro!) — 0 seções"
    assert bs[0]["codigo"] == "C.14", f"título sem código → modulo errado; veio codigo={bs[0]['codigo']!r}"
    assert bs[0]["modulo"] == "M2", f"C.14 é módulo M2, veio {bs[0]['modulo']!r}"
    assert str(_VALOR) in repr(bs[0]["dados"]), f"valor real {_VALOR} tem que persistir na seção, dados={bs[0]['dados']}"

    # (3) CONTROLE NEGATIVO: a MESMA matriz com colunas col_* É descartada → por isso sintetizamos nomes.
    teatro = [{
        "titulo": "C.14 Mapa da Obra — Bloco col_N", "tipo": "tabela",
        "colunas": ["col_0", "col_1", "col_2", "col_3", "col_4"],
        "linhas": [{"col_0": "Terraplenagem", "col_3": _VALOR, "col_4": 3552073.4}],
    }]
    assert len(capturar_secoes(teatro)) == 0, "colunas col_* DEVERIAM ser descartadas (prova do furo de B-pura)"

    print("PASS backstop · matriz anônima auto-ingerida em código SOBREVIVE ao capturar_secoes "
          "(codigo=C.14/M2, valor real persiste · banner não-tabular pulado) · col_* descartado (anti-teatro)")


if __name__ == "__main__":
    run()
