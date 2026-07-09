"""Golden · C.10 Panorama. Real (SKIP se ausente): 3/6 avaliados · consolidado conforme ·
áreas liberadas 100% · impedido 14M. Faróis '—' → None (pendente, não verde)."""
from __future__ import annotations
import json, pathlib
from .resolvers import extrair_panorama
FIX = pathlib.Path(__file__).parent / "fixtures" / "workbook_br101v11_c10_panorama.json"


def _synthetic() -> None:
    secoes = [{"tipo": "chave_valor", "titulo": "C.10 Panorama", "dados": {
        "consolidadoPior": "● Conforme", "farolInterferencias": "● Conforme",
        "farolProjetos": "—", "liberacoes_pctAreasLiberadas": 1}}]
    r = extrair_panorama(secoes)
    assert r["consolidado"] == "conforme"
    assert r["farois"]["projetos"] is None, "'—' → pendente (não verde)"
    assert r["farois"]["interferencias"] == "conforme"
    assert r["n_avaliados"] == 1
    print("PASS synthetic · consolidado · '—' vira pendente (não verde sobre área cega)")


def _real() -> None:
    if not FIX.exists():
        print(f"SKIP {FIX.name}")
        return
    r = extrair_panorama(json.loads(FIX.read_text()))
    assert r["n_avaliados"] == 3, r["n_avaliados"]
    assert r["consolidado"] == "conforme"
    assert abs(r["frentes_impedidas_rs"] - 14_000_000) < 1
    print("PASS real · 3/6 avaliados · consolidado conforme · impedido 14M")


def run() -> None:
    _synthetic(); _real()


if __name__ == "__main__":
    run()
