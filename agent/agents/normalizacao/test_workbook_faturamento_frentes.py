"""Golden · C.3 Faturamento por frente. Real (SKIP se ausente): 12 frentes · Σ Total 611.353.199
(== PV) · Σ Acum 41.045.544 (== C.8)."""
from __future__ import annotations
import json, pathlib
from .gate import gate_faturamento_frentes
from .resolvers import extrair_faturamento_frentes
FIX = pathlib.Path(__file__).parent / "fixtures" / "workbook_br101v11_c3_fatfrentes.json"


def _synthetic() -> None:
    secoes = [{"tipo": "tabela", "titulo": "C.3 Faturamento — Por frente/disciplina (resumo)",
               "colunas": ["Frente (disciplina)", "Serviço?", "Contratado Total", "Contratado Acum. até BM", "Real Acum. até BM", "%", "Farol"],
               "linhas": [
                   {"Frente (disciplina)": "Terra", "Serviço?": "Sim", "Contratado Total": "100", "Contratado Acum. até BM": "10", "Real Acum. até BM": "0", "Farol": "● Crítico"},
                   {"Frente (disciplina)": "TOTAL", "Contratado Total": "100"},  # linha TOTAL pulada
                   {"Frente (disciplina)": "Pav", "Serviço?": "Não", "Contratado Total": "50", "Contratado Acum. até BM": "5", "Farol": "● Crítico"}]}]
    r = extrair_faturamento_frentes(secoes)
    assert r["n_frentes"] == 2, r["n_frentes"]
    assert r["soma_contratado_total"] == 150.0
    assert r["soma_contratado_acum"] == 15.0
    # PENDENTE ≠ ZERO: real por frente NÃO alocado (fonte traz 0 + farol Crítico derivado) →
    # banco grava real/pct/farol = NULL, nunca 0 nem Crítico fabricado.
    assert r["real_pendente"] is True, "real não alocado → pendente"
    assert all(f["real_acum"] is None for f in r["frentes"]), "real=NULL (não 0)"
    assert all(f["farol"] is None for f in r["frentes"]), "sem farol Crítico fabricado"
    assert all(f["pct"] is None for f in r["frentes"]), "pct=NULL (não 0)"
    assert gate_faturamento_frentes(r, pv=150, contratado_corte=15)["status"] == "ok"
    assert gate_faturamento_frentes(r, pv=999)["status"] == "needs_review", "PV errado reprova"
    # Caso espelho: quando o real É alocado por frente, preserva real/farol (não zera).
    secoes_alocado = [{"tipo": "tabela", "titulo": "C.3 Faturamento — Por frente/disciplina (resumo)",
                       "colunas": ["Frente (disciplina)", "Contratado Total", "Contratado Acum. até BM", "Real Acum. até BM", "Farol"],
                       "linhas": [
                           {"Frente (disciplina)": "Terra", "Contratado Total": "100", "Contratado Acum. até BM": "10", "Real Acum. até BM": "8", "Farol": "● Conforme"},
                           {"Frente (disciplina)": "Pav", "Contratado Total": "50", "Contratado Acum. até BM": "5", "Real Acum. até BM": "0", "Farol": "● Crítico"}]}]
    ra = extrair_faturamento_frentes(secoes_alocado)
    assert ra["real_pendente"] is False, "real alocado em ≥1 frente → não pendente"
    assert ra["frentes"][0]["real_acum"] == 8.0, "frente com real preserva valor"
    assert ra["frentes"][0]["farol"] == "● Conforme", "frente com real preserva farol"
    print("PASS synthetic · TOTAL pulado · Σ cruza PV+corte · real-pendente NULL · real-alocado preservado")


def _real() -> None:
    if not FIX.exists():
        print(f"SKIP {FIX.name}")
        return
    r = extrair_faturamento_frentes(json.loads(FIX.read_text()))
    assert r["n_frentes"] == 12, r["n_frentes"]
    assert abs(r["soma_contratado_total"] - 611_353_199) < 2, r["soma_contratado_total"]
    assert abs(r["soma_contratado_acum"] - 41_045_544) < 2, r["soma_contratado_acum"]
    print("PASS real · 12 frentes · Σ Total 611.353.199 (PV) · Σ Acum 41.045.544 (C.8)")


def run() -> None:
    _synthetic(); _real()


if __name__ == "__main__":
    run()
