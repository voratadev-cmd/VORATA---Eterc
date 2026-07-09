"""Golden · C.8 Curvas Lib×Cap×Aloc. Real (SKIP se ausente): Lib 100% · Cap 17,7% · Aloc 50% ·
executado 20.522.771,5 == faturamento real (gate cross-check)."""
from __future__ import annotations
import json, pathlib
from .gate import gate_curvas_c8
from .resolvers import extrair_curvas_c8
FIX = pathlib.Path(__file__).parent / "fixtures" / "workbook_br101v11_c8_curvas.json"


def _synthetic() -> None:
    secoes = [{"tipo": "chave_valor", "titulo": "C.8 Cards", "dados": {
        "executadoAcum": 50, "totalContratadoAcum": 100, "liberadoParaExecucaoAcum": 100,
        "capacidadeProdutivaAcum": 20, "maiorGapEntreCurvasRS": 30,
        "pctLiberadoVsContratado": 1, "pctCapacidadeVsContratado": 0.2}}]
    r = extrair_curvas_c8(secoes)
    assert r["alocado_pct"] == 0.5, r["alocado_pct"]  # 50/100
    assert gate_curvas_c8(r, faturamento_real_acum=50)["status"] == "ok"
    assert gate_curvas_c8(r, faturamento_real_acum=999)["status"] == "needs_review", "executado errado reprova"
    print("PASS synthetic · alocado=executado/contratado · gate cruza executado×faturamento")


def _real() -> None:
    if not FIX.exists():
        print(f"SKIP {FIX.name}")
        return
    r = extrair_curvas_c8(json.loads(FIX.read_text()))
    assert abs(r["executado_acum"] - 20_522_771.5) < 0.5, r["executado_acum"]
    assert abs(r["alocado_pct"] - 0.5) < 0.001, r["alocado_pct"]
    assert gate_curvas_c8(r, faturamento_real_acum=20_522_771.5)["status"] == "ok"
    print("PASS real · Lib 100% Cap 17,7% Aloc 50% · executado 20,5M == faturamento real")


def run() -> None:
    _synthetic(); _real()


if __name__ == "__main__":
    run()
