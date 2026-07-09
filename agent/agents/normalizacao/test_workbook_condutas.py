"""Golden test · C.11 Condutas (RMA · catálogo de ações sugeridas pelo Adm Contratual IA)."""
from __future__ import annotations
import json, pathlib
from .gate import gate_condutas
from .resolvers import extrair_condutas
FIX = pathlib.Path(__file__).parent / "fixtures" / "workbook_br101v11_c11_condutas.json"


def _synthetic() -> None:
    secoes = [
        {"tipo": "tabela", "titulo": "C.11 Condutas — Catálogo de condutas",
         "colunas": ["Conduta / gatilho", "Documento a gerar", "Categoria", "Prioridade", "Farol"],
         "linhas": [
             {"Conduta / gatilho": "Cobrança taludes", "Categoria": "Carta", "Prioridade": "Urgente"},
             {"Conduta / gatilho": "max rank →"},  # rótulo → pulado
             {"Conduta / gatilho": "Take-off", "Categoria": "PPN", "Prioridade": "Importante"},
         ]},
        {"tipo": "chave_valor", "titulo": "C.11 Condutas — Cards", "dados": {"condutasSugeridasTotal": 2}},
    ]
    res = extrair_condutas(secoes)
    assert res["n_condutas"] == 2, res["n_condutas"]
    assert gate_condutas(res)["status"] == "ok"
    print("PASS synthetic · catálogo · linha-rótulo pulada · n == total card")


def _real() -> None:
    if not FIX.exists():
        print(f"SKIP {FIX.name} (gitignored).")
        return
    res = extrair_condutas(json.loads(FIX.read_text()))
    assert res["n_condutas"] == 8, res["n_condutas"]
    assert res["total_card"] == 8, res["total_card"]
    assert gate_condutas(res)["status"] == "ok"
    print(f"PASS real · 8 condutas · n == card (8) · gate ok")


def run() -> None:
    _synthetic()
    _real()


if __name__ == "__main__":
    run()
