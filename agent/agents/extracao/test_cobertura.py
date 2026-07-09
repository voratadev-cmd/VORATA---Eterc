"""Golden do GATE DE COBERTURA célula-a-célula (xlsx × envelope).

Synthetic: aba coberta passa limpa; bloco numérico fora de cobertura vira região órfã com
amostra; aba com dado e sem nenhuma região é denunciada; parser de `fonte` entende os formatos
reais ("aba 'X' L5-L19", "sheet 'X' linhas 13-44 de 100", refs soltas "(TOTAL L18)").

Rodar: cd agent && venv/bin/python -m agents.extracao.test_cobertura
"""

from __future__ import annotations

from .cobertura import auditar_cobertura, ranges_do_envelope


def run() -> None:
    # parser de fontes (formatos reais do envelope)
    payload = {"secoes": [
        {"fonte": "aba 'C.3 Faturamento' L5-L19"},
        {"fonte": "sheet 'C.4 Recursos' linhas 13-44 de 100"},
        {"fonte": "aba 'C.14 Mapa da Obra' L6-L17 (TOTAL L18: contrato 625.357.315)"},
        {"fonte": "sem referência de aba"},
    ]}
    cob = ranges_do_envelope(payload)
    assert cob["C.3 Faturamento"] == set(range(5, 20))
    assert cob["C.4 Recursos"] == set(range(13, 45))
    assert 18 in cob["C.14 Mapa da Obra"] and 6 in cob["C.14 Mapa da Obra"]
    # número-intervalo solto ("2024-2026" de período, "600–190" de km) NÃO pode cobrir linha
    falso = ranges_do_envelope({"secoes": [
        {"fonte": "aba 'X' período 2024-2026 · km 144+600–190+300"}]})
    assert falso.get("X", set()) == set(), falso

    # aba coberta · bloco órfão numérico · aba sem nenhuma região
    abas = {
        "Coberta": [["título"], ["a", 1.0], ["b", 2.0]],
        "ComBuraco": [["hdr"], ["x", 10.0], [], [None, "rótulo"], ["ESCONDIDO", 999.0],
                      [None, 123.45]],
        "SemRegiao": [["dado", 7.0]],
        "Vazia": [[None, ""], []],
    }
    cobertas = {"Coberta": {1, 2, 3}, "ComBuraco": {1, 2}}
    res = auditar_cobertura(abas, cobertas)
    por = {a["aba"]: a for a in res["por_aba"]}
    assert "Coberta" not in por and "Vazia" not in por
    cb = por["ComBuraco"]
    assert cb["n_numericas_orfas"] == 2 and cb["n_celulas_orfas"] == 4
    # L4 (rótulo) e L5-L6 (numéricas) agrupadas em regiões contíguas
    assert [(r["de"], r["ate"]) for r in cb["regioes"]] == [(4, 6)]
    assert "ESCONDIDO" in cb["regioes"][0]["amostra"] or "rótulo" in cb["regioes"][0]["amostra"]
    sr = por["SemRegiao"]
    assert sr["sem_regiao"] and res["abas_sem_regiao"] == ["SemRegiao"]
    assert res["total_numericas"] == 3
    print("PASS cobertura · parser de fontes (3 formatos) · órfãs agrupadas com amostra · "
          "numéricas contadas · aba sem região denunciada · aba coberta/vazia limpa")

    # gate dos digitados: número copiado de célula passa; arredondado/inventado é órfão
    from .cobertura import auditar_digitados

    abas2 = {"Cards": [["Contratado Total", 611357314.09], ["BM", 4],
                       ["pct", 0.000187541191985415], ["texto-num", "3.319.716,00"]]}
    env = {
        "identificacao": {"bm": 4},
        "totais_declarados": {"contratado": 611357314.09},
        "secoes": [
            {"tipo": "chave_valor", "titulo": "Cards", "fonte": "aba 'Cards' L1-L4",
             "dados": {"pctSobrePV": 0.000187541191985415, "realStr": "3319716",
                       "ARREDONDADO": 611357314.0, "INVENTADO": 12345.67}},
            {"tipo": "tabela", "titulo": "t", "fonte": "aba 'Cards' L1-L4",
             "linhas": [{"a": 1}]},
        ],
    }
    dig = auditar_digitados(abas2, env)
    orfaos = {o["campo"]: o["valor"] for o in dig["orfaos"]}
    assert "ARREDONDADO" in orfaos and "INVENTADO" in orfaos, dig
    assert "pctSobrePV" not in orfaos and "realStr" not in orfaos and "bm" not in orfaos
    assert dig["n_verificados"] >= 6
    print("PASS digitados · cópia exata e string-numérica passam · arredondado e inventado "
          "viram órfãos com seção+campo apontados · zero fora do jogo")


if __name__ == "__main__":
    run()
