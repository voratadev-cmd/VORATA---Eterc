"""Golden · C.9 Chuvas. Real (SKIP se ausente): 52 meses · prev 5476mm · impedido 14M · 7 frentes ·
chuva real pendente (input vazio)."""
from __future__ import annotations
import json, pathlib
from .gate import gate_chuvas
from .resolvers import extrair_chuvas
FIX = pathlib.Path(__file__).parent / "fixtures" / "workbook_br101v11_c9_chuvas.json"


def _synthetic() -> None:
    secoes = [
        {"tipo": "tabela", "titulo": "C.9 Chuvas — Acompanhamento mensal",
         "colunas": ["MÊS OBRA", "MÊS/ANO", "CHUVA PREV (mm)", "CHUVA REAL (mm)", "CHUVA PREV ACUM (mm)", "DIAS PARADOS"],
         "linhas": [
             {"MÊS OBRA": "M1", "MÊS/ANO": "mar/26", "CHUVA PREV (mm)": "100", "CHUVA REAL (mm)": "", "CHUVA PREV ACUM (mm)": "100"},
             {"MÊS OBRA": "max rank →"},  # rótulo
             {"MÊS OBRA": "M2", "MÊS/ANO": "abr/26", "CHUVA PREV (mm)": "50", "CHUVA REAL (mm)": "", "CHUVA PREV ACUM (mm)": "150"},
         ]},
        {"tipo": "chave_valor", "titulo": "C.9 Resumo", "dados": {"impedidoTotalRS": 14000000, "frentesNaoIniciadasQtd": 7, "principalImpedido1": "Sinistro X"}},
    ]
    r = extrair_chuvas(secoes)
    assert r["n_meses"] == 2, r["n_meses"]
    assert r["eixo_real_vazio"] is True
    assert r["resumo"]["frentes_nao_iniciadas"] == 7
    assert gate_chuvas(r)["status"] == "ok"
    print("PASS synthetic · 2 meses · real vazio · resumo · prev_acum coerente")


def _real() -> None:
    if not FIX.exists():
        print(f"SKIP {FIX.name}")
        return
    r = extrair_chuvas(json.loads(FIX.read_text()))
    assert r["n_meses"] == 52, r["n_meses"]
    assert r["eixo_real_vazio"] is True
    assert abs(r["resumo"]["impedido_total_rs"] - 14_000_000) < 1
    assert r["resumo"]["frentes_nao_iniciadas"] == 7
    print("PASS real · 52 meses · impedido 14M · 7 frentes · chuva real pendente")


def run() -> None:
    _synthetic(); _real()


if __name__ == "__main__":
    run()
