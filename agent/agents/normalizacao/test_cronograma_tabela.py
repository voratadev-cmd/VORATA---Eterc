"""c3 · Cronograma físico em formato TABELA (EDT × colunas-mês 'out.-25') — o Cronograma FF PDF
standalone. Prova: parse de mês PT abreviado, REORDENAÇÃO cronológica (a extração vem em ordem
alfabética), % → fração, Σ=100%, datas da linha-raiz. Sintético.
Rodar: cd agent && venv/bin/python -m agents.normalizacao.test_cronograma_tabela
"""

from __future__ import annotations

from .resolvers import extrair_cronograma_fisico_tabela, parse_mes_abbr


def run() -> None:
    assert parse_mes_abbr("out.-25") == (2025, 10)
    assert parse_mes_abbr("mai-26") == (2026, 5)
    assert parse_mes_abbr("Valor total") is None

    # colunas FORA de ordem (alfabética: abr antes de out) — o resolver reordena cronologicamente
    secao = {
        "colunas": ["EDT", "Nome da Tarefa", "Início", "Término", "abr.-26", "out.-25", "mai.-26"],
        "linhas": [
            {"EDT": "1", "Nome da Tarefa": "OBRA", "Início": "ter 16/09/25",
             "Término": "ter 09/03/27", "out.-25": "50,00%", "abr.-26": "30,00%", "mai.-26": 20.0},
            {"EDT": "1.1", "out.-25": 10.0},  # filho — ignorado (raiz é EDT=1)
        ],
    }
    r = extrair_cronograma_fisico_tabela(secao)
    assert r["status"] == "ok", r
    assert [(m["ano"], m["mes"]) for m in r["meses"]] == [(2025, 10), (2026, 4), (2026, 5)], r["meses"]
    assert abs(r["meses"][0]["previsto_pct"] - 0.5) < 1e-9  # 50% → 0,5
    assert abs(r["meses"][-1]["previsto_pct_acumulado"] - 1.0) < 1e-9  # 0,5+0,3+0,2 = 1,0
    assert abs(r["soma_pct"] - 1.0) < 1e-6
    assert r["header"]["termino_obra"] == "2027-03-09", r["header"]  # da linha-raiz
    assert r["header"]["inicio_obra"] == "2025-09-16", r["header"]
    assert r["header"]["custo_total_obra"] is None  # 'Valor total' corrompido → None (honesto)

    # raiz ausente → needs_review (falha-loud)
    assert extrair_cronograma_fisico_tabela({"linhas": [{"EDT": "2"}]})["status"] == "needs_review"

    print("✅ cronograma tabela física: reordena cronológico · % → fração · Σ=100% · datas raiz · custo None.")


if __name__ == "__main__":
    run()
