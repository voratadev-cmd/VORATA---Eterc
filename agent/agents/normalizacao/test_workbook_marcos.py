"""Golden · C.5 Marcos detalhados. Real (SKIP): 24 marcos · % concluído pendente."""
from __future__ import annotations
import json, pathlib
from .resolvers import extrair_prazo_marcos
FIX = pathlib.Path(__file__).parent / "fixtures" / "workbook_br101v11_full.json"


def _synthetic() -> None:
    secoes = [{"tipo": "tabela", "titulo": "C.5 Prazo — Marcos contratuais detalhados",
               "colunas": ["Categoria", "Trecho / Obra", "Data-limite (vigente)", "% concluído (input)", "Farol"],
               "linhas": [{"Categoria": "DUPLICAÇÃO", "Trecho / Obra": "km 144", "Data-limite (vigente)": "2027-09-04", "Farol": "○ No prazo"}]}]
    r = extrair_prazo_marcos(secoes)
    assert r["n_marcos"] == 1 and r["eixo_pct_vazio"] is True
    print("PASS synthetic · marco extraído · % pendente")


def _real() -> None:
    if not FIX.exists():
        print(f"SKIP {FIX.name}"); return
    r = extrair_prazo_marcos(json.loads(FIX.read_text()))
    assert r["n_marcos"] == 24, r["n_marcos"]
    print(f"PASS real · 24 marcos contratuais")


def run() -> None:
    _synthetic(); _real()


if __name__ == "__main__":
    run()
