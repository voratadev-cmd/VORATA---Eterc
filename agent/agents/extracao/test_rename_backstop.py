"""Fase 2a · rename SEGURO das matrizes do backstop. Prova as 4 fronteiras (com modelo MOCKADO, sem
LLM): (1) colunas viram nomes reais (Disciplina/mes_NN); (2) VALORES intactos (modelo nunca toca número);
(3) TÍTULO intacto ('Bloco não-rotulado … auto-ingerido' = sentinela); (4) por causa de (3), a seção
NÃO é pega por um resolver typed → captura-only, SEM mis-routing (o risco que travou a Fase 2 automática)."""
from __future__ import annotations

import asyncio

from agents.extracao import rename_backstop as RB
from agents.extracao.backstop import ingerir_orfas_fonte
from agents.extracao.envelope import EnvelopeBuilder
from agents.normalizacao.resolvers import capturar_secoes, extrair_faturamento_disciplina_mes

_SHEET = "C.14 Mapa da Obra"
_VALOR = 3595996.6


class _FakeDoc:
    ext = "xlsx"

    def __init__(self, g):
        self._g = g

    def sheet_names(self):
        return list(self._g)

    def sheet_rows(self, n):
        return self._g[n]


def _grid() -> dict:
    return {_SHEET: [
        ["BLOCO 1 — SEGMENTOS (banner)"],
        ["Item", "M1", "M2"],
        ["Seg A", 10.0, 20.0],
        ["Seg B", 11.0, 21.0],
        [], [], [],
        ["Terraplenagem", 0.0, 0.0, _VALOR, 3552073.4],   # L8 matriz anônima
        ["Drenagem", 0.0, 0.0, 931829.8, 927477.2],       # L9
        ["Pavimentação", 0.0, 0.0, 0.0, 1366300.5],       # L10
    ]}


async def _fake_propor(aba, de, ate, cols, region_rows, context_rows):  # noqa: ANN001
    # modelo determinista: 1ª coluna = Disciplina, demais = mes_NN. NUNCA devolve valor.
    return ["Disciplina"] + [f"mes_{i:02d}" for i in range(1, len(cols))]


def run() -> None:
    doc = _FakeDoc(_grid())
    b = EnvelopeBuilder()
    b.set_documento(tipo_documento="WM")
    b.open_secao("c14_b1", "C.14 Mapa da Obra — Bloco 1", "tabela", "sheet 'C.14' L2-L4",
                 colunas=["Item", "M1", "M2"])
    b.append_linhas("c14_b1", [{"Item": "Seg A", "M1": 10.0, "M2": 20.0},
                               {"Item": "Seg B", "M1": 11.0, "M2": 21.0}])
    b.track_ingestao(_SHEET, 2, 3, 4)

    ing = ingerir_orfas_fonte(b, doc)
    assert any(de == 8 for _, de, _, _ in ing), ing
    sid = f"backstop::{_SHEET}::8-10"
    sec = b._secoes[sid]
    titulo_antes = sec["titulo"]
    assert sec["colunas"][:2] == ["rotulo", "valor_1"], sec["colunas"]

    # rename com modelo MOCKADO
    orig = RB._propor_colunas
    RB._propor_colunas = _fake_propor
    try:
        n = asyncio.run(RB.renomear_backstop_colunas(b, doc, ing))
    finally:
        RB._propor_colunas = orig
    assert n >= 1, "deveria renomear ≥1 seção"

    # (1) colunas renomeadas · (2) VALORES intactos
    assert sec["colunas"][:2] == ["Disciplina", "mes_01"], sec["colunas"]
    terra = next(r for r in sec["linhas"] if r.get("Disciplina") == "Terraplenagem")
    assert _VALOR in terra.values(), f"valor real sumiu após rename: {terra}"

    # (3) TÍTULO INTACTO (sentinela → captura-only)
    assert sec["titulo"] == titulo_antes and "não-rotulado" in sec["titulo"], sec["titulo"]

    # (4) NÃO roteia a resolver typed (mesmo com colunas semânticas) — captura-only, sem mis-routing
    secoes = b.build()["secoes"]
    cap = capturar_secoes(secoes)
    bs = [c for c in cap if "não-rotulado" in c["titulo"]]
    assert bs and bs[0]["coberta"] is False, "seção do backstop tem que seguir coberta=False"
    fdm = extrair_faturamento_disciplina_mes(secoes)
    assert fdm["status"] == "needs_review" and not fdm["linhas"], \
        "a matriz renomeada do backstop NÃO pode ser capturada pelo resolver de faturamento (mis-routing)"

    print("PASS rename-backstop · colunas reais (Disciplina/mes_NN) · VALORES intactos · título intacto "
          "(captura-only) · NÃO roteia a resolver typed (sem mis-routing)")


if __name__ == "__main__":
    run()
