"""Golden test do SPLITTER · D.4 Valor Agregado (earned value · AACE 25R-03).

Synthetic com os números REAIS da BR-101 v45 (aba 'D.4 Valor Agregado'): resumo transposto
(MOD/EQP/TOTAL × VA necessário / Real alocado / Perda / %PV / Farol) + VA por serviço (Supressão
Vegetal, 2× Escavação 1ª/2ª com CPUs distintos, + linha TOTAL que deve ser EXCLUÍDA). Confere os 3
gates ao centavo (perda==alocado−agregado · TOTAL==MOD+EQP · Σ serviço==resumo) e que perda/farol
trocados reprovam.

Rodar: cd agent && venv/bin/python -m agents.normalizacao.test_workbook_valor_agregado
"""

from __future__ import annotations

from .gate import gate_valor_agregado
from .resolvers import extrair_valor_agregado

PV = 611357314.09  # contratado total (âncora do %PV)


def _secoes() -> list[dict]:
    # RESUMO no formato REAL da extração: chave_valor com dicts {MOD,EQP,TOTAL} por métrica.
    resumo = {
        "tipo": "chave_valor",
        "titulo": "D.4 Valor Agregado — Resumo (Valor Agregado × Real alocado · MOD/EQP/TOTAL)",
        "dados": {
            "Valor Agregado (necessário · R$)": {"MOD": 19840.17, "EQP": 956363.15, "TOTAL": 976203.32},
            "Real alocado (histograma C.4 · R$)": {"MOD": 887470.64, "EQP": 6791408.0, "TOTAL": 7678878.64},
            "Perda de produtividade (Alocado − Agregado) (R$)": {"MOD": 867630.47, "EQP": 5835044.85, "TOTAL": 6702675.32},
            "% sobre o PV (fração)": {"MOD": 867630.47 / PV, "EQP": 5835044.85 / PV, "TOTAL": 6702675.32 / PV},
            "Farol da perda": "● Observação",
        },
    }
    servico = {
        "tipo": "tabela",
        "titulo": "VALOR AGREGADO POR SERVIÇO (Qtd medida · BM · input)",
        "colunas": ["Código CPU", "Serviço", "Unid.", "%MOD", "%EQP", "MOD R$/un", "EQP R$/un",
                    "Qtd medida (BM · input)", "VA MOD (R$)", "VA EQP (R$)"],
        "linhas": [
            {"Código CPU": "1.  1.  1. 23.", "Serviço": "Supressão Vegetal com destocamento",
             "Unid.": "m²", "%EQP": 1.0, "EQP R$/un": 2.76,
             "Qtd medida (BM · input)": 118427.65, "VA MOD (R$)": 0.0, "VA EQP (R$)": 326860.31},
            {"Código CPU": "1.  1.  1. 26.", "Serviço": "Escavação de material de 1ª e 2ª categoria",
             "Unid.": "m³", "%MOD": 0.0181, "%EQP": 0.7306, "MOD R$/un": 0.29, "EQP R$/un": 11.49,
             "Qtd medida (BM · input)": 38642.21, "VA MOD (R$)": 11206.24, "VA EQP (R$)": 443998.99},
            # 2ª "Escavação" com CPU distinto (homônimo) — keya por CPU, não por nome.
            {"Código CPU": "1.  1.  1. 27.", "Serviço": "Escavação de material de 1ª e 2ª categoria",
             "Unid.": "m³", "Qtd medida (BM · input)": 4191.23, "VA MOD (R$)": 8633.93, "VA EQP (R$)": 185503.84},
            # serviço sem produção (0 é default de fórmula, não medição)
            {"Código CPU": "1.  1.  1.  3.", "Serviço": "Mobilização (*)", "Unid.": "vb",
             "Qtd medida (BM · input)": 0.0, "VA MOD (R$)": 0.0, "VA EQP (R$)": 0.0},
            # linha TOTAL — âncora do gate, NÃO é serviço → excluir
            {"Código CPU": None, "Serviço": "TOTAL", "VA MOD (R$)": 19840.17, "VA EQP (R$)": 956363.15},
        ],
    }
    # Série mensal (transposta: métricas=linhas, meses=colunas). Σ por cat == resumo.
    serie = {
        "tipo": "tabela",
        "titulo": "D.4 Valor Agregado — Série mensal p/ gráfico SaaS (métrica × mês)",
        "colunas": ["Mês", "mar-26", "abr-26", "mai-26"],
        "linhas": [
            {"Mês": "VA medido MOD (R$/mês)", "mar-26": 0, "abr-26": 8633.93, "mai-26": 11206.24},
            {"Mês": "VA medido EQP (R$/mês)", "mar-26": 0, "abr-26": 185503.84, "mai-26": 770859.31},
            {"Mês": "Real alocado MOD (R$/mês)", "mar-26": 0, "abr-26": 53372.88, "mai-26": 834097.76},
            {"Mês": "Real alocado EQP (R$/mês)", "mar-26": 0, "abr-26": 617146.0, "mai-26": 6174262.0},
            {"Mês": "VA medido TOTAL — acum.", "abr-26": 194137.77, "mai-26": 976203.28},
            {"Mês": "Real alocado TOTAL — acum.", "abr-26": 670518.88, "mai-26": 7678878.64},
        ],
    }
    return [resumo, servico, serie]


def _synthetic() -> None:
    res = extrair_valor_agregado(_secoes())
    por = {c["categoria"]: c for c in res["categorias"]}
    assert set(por) == {"MOD", "EQP", "TOTAL"}, por
    assert abs(por["TOTAL"]["va_medido_rs"] - 976203.32) < 0.005
    assert abs(por["TOTAL"]["perda_rs"] - 6702675.32) < 0.005
    assert abs(por["EQP"]["real_alocado_rs"] - 6791408.0) < 0.005
    assert por["TOTAL"]["farol"] == "Observação" and res["farol_total"] == "Observação"
    assert por["MOD"]["farol"] is None  # farol só na TOTAL
    # serviços: só os 3 COM produção (Supressão + 2 Escavação); TOTAL e Mobilização-zero filtrados
    assert res["n_servicos"] == 3, [s["servico"] for s in res["servicos"]]
    nomes = [s["servico"] for s in res["servicos"]]
    assert "TOTAL" not in nomes and "Mobilização (*)" not in nomes, nomes
    cpus = [s["codigo_cpu"] for s in res["servicos"]]
    assert "1.1.1.26." in cpus and "1.1.1.27." in cpus, cpus  # CPU normalizado (sem espaços)

    # série mensal: só os 2 meses com produção (abr/mai-26); mar-26 (tudo 0) fora
    assert res["n_meses"] == 2, res.get("serie")
    assert {m["mes"] for m in res["serie"]} == {4, 5}

    g = gate_valor_agregado(res, pv=PV)
    assert g["status"] == "ok", g["findings"]
    assert abs(g["soma_va_mod"] - 19840.17) < 0.05 and abs(g["soma_va_eqp"] - 956363.15) < 0.5

    # Σ série mensal ≠ resumo reprova
    s5 = _secoes()
    s5[2]["linhas"][0]["abr-26"] = 99999.0
    g5 = gate_valor_agregado(extrair_valor_agregado(s5), pv=PV)
    assert any(f["campo"].startswith("serie") and f["severity"] == "error" for f in g5["findings"]), g5

    # perda trocada (não fecha alocado − agregado) reprova
    s2 = _secoes()
    s2[0]["dados"]["Perda de produtividade (Alocado − Agregado) (R$)"]["MOD"] = 999999.0
    g2 = gate_valor_agregado(extrair_valor_agregado(s2), pv=PV)
    assert any(f["campo"] == "perda" and f["severity"] == "error" for f in g2["findings"]), g2

    # TOTAL ≠ MOD+EQP reprova
    s3 = _secoes()
    s3[0]["dados"]["Valor Agregado (necessário · R$)"]["TOTAL"] = 123.0
    g3 = gate_valor_agregado(extrair_valor_agregado(s3), pv=PV)
    assert any(f["campo"].startswith("total") and f["severity"] == "error" for f in g3["findings"]), g3

    # VA por serviço derivado errado (qtd × R$/un) reprova
    s4 = _secoes()
    s4[1]["linhas"][1]["VA EQP (R$)"] = 1.0  # Escavação: 38642.21 × 11.49 ≠ 1
    g4 = gate_valor_agregado(extrair_valor_agregado(s4), pv=PV)
    assert any(f["campo"] in ("va_eqp_rs", "servicos.eqp") and f["severity"] == "error"
               for f in g4["findings"]), g4

    print("PASS synthetic · resumo transposto MOD/EQP/TOTAL (VA 976.203 · perda 6.702.675 · farol "
          "Observação) · 3 serviços com VA (2 Escavação por CPU) · TOTAL excluído · 3 gates ao "
          "centavo · perda/TOTAL/derivação trocados reprovam")


def run() -> None:
    _synthetic()


if __name__ == "__main__":
    run()
