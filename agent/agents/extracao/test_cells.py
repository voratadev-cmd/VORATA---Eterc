"""Golden test do guard determinístico audit_ingested (cells.py).

Cobre o fix de WORKBOOK-MOTOR (histogramas de blocos empilhados): uma linha-RÓTULO de
seção (célula mesclada espalhada nas colunas numéricas, MESMO texto em todas) é estrutural
e NÃO deve virar needs_review. Já cabeçalho-repetido / 2ª tabela (textos DIFERENTES por
coluna, ex.: meses) DEVE seguir reprovando — fail-loud honesto. E número/percent formatado
como string (não-coagido) nunca dispara.

Rodar: cd agent && venv/bin/python -m agents.extracao.test_cells
"""

from __future__ import annotations

from .cells import audit_ingested

COLS = ["RECURSO", "M1", "M2", "M3"]


def _base_numericas() -> list[dict]:
    # 6 linhas com M1/M2/M3 numéricas → as 3 viram colunas-numéricas (>=80%, >=5 amostras).
    return [
        {"RECURSO": f"Função {i}", "M1": 10 + i, "M2": 20 + i, "M3": 30 + i}
        for i in range(6)
    ]


def run() -> None:
    # 1) Só dados numéricos → nenhuma suspeita.
    base = _base_numericas()
    assert audit_ingested(COLS, base) == [], "dados limpos não deviam disparar"

    # 2) LINHA-RÓTULO de célula mesclada (mesmo texto nas 3 colunas numéricas) → NÃO flaga (fix).
    rotulo = base + [{"RECURSO": "MÃO DE OBRA DIRETA — 1º TURNO",
                      "M1": "SUPRESSÃO VEGETAL  ✓ reconciliado",
                      "M2": "SUPRESSÃO VEGETAL  ✓ reconciliado",
                      "M3": "SUPRESSÃO VEGETAL  ✓ reconciliado"}]
    assert audit_ingested(COLS, rotulo) == [], f"linha-rótulo de seção NÃO devia flagar: {audit_ingested(COLS, rotulo)}"

    # 3) CABEÇALHO REPETIDO / 2ª tabela (meses distintos por coluna) → DEVE flagar (índice 6).
    header2 = base + [{"RECURSO": "FUNÇÃO", "M1": "mar-26", "M2": "abr-26", "M3": "mai-26"}]
    assert audit_ingested(COLS, header2) == [6], f"cabeçalho repetido DEVIA flagar: {audit_ingested(COLS, header2)}"

    # 4) Dois textos DISTINTOS nas numéricas → anomalia real → flaga.
    distintos = base + [{"RECURSO": "x", "M1": "abc", "M2": "def", "M3": 99}]
    assert audit_ingested(COLS, distintos) == [6], "2 textos distintos deviam flagar"

    # 5) Número/percent como STRING (não-coagido) nunca dispara — preserva comportamento do BM.
    strnum = base + [{"RECURSO": "Total", "M1": "1.234,56", "M2": "2.000,00", "M3": "15,99%"}]
    assert audit_ingested(COLS, strnum) == [], f"número/percent string não devia flagar: {audit_ingested(COLS, strnum)}"

    # 6) UM texto só numa coluna numérica (text_in_numeric=1) → não flaga (precisa >=2).
    umtexto = base + [{"RECURSO": "y", "M1": "rótulo", "M2": 50, "M3": 60}]
    assert audit_ingested(COLS, umtexto) == [], "1 texto isolado não devia flagar"

    # 7) Sem >=2 colunas numéricas → não infere anomalia.
    assert audit_ingested(["A", "B"], [{"A": "x", "B": "y"}]) == [], "sem colunas numéricas não flaga"

    print("PASS · audit_ingested: linha-rótulo mesclada NÃO flaga · cabeçalho-repetido/2ª-tabela/2-textos-distintos flagam · número-string preservado")


if __name__ == "__main__":
    run()
