"""Golden · C.3 Frente×Trecho drill-down. PENDENTE≠ZERO: Real input não medido → Real/Déficit/
Aderência/Farol NULL + real_pendente (tela mostra "a medir" no drill-down). Real medido → calcula."""
from __future__ import annotations
from .resolvers import extrair_faturamento_frente_trecho
from .gate import gate_faturamento_frente_trecho

_COLS = ["Frente", "Trecho", "Share %", "Contratado (R$)", "Previsto acum. até BM (R$)",
         "Real acum. (R$ · input)", "Déficit (real−prev)", "Aderência", "Farol"]


def _sec(linhas):  # noqa: ANN001
    return [{"tipo": "tabela", "titulo": "C.3 Faturamento — Faturamento por Frente × Trecho (drill-down)",
             "colunas": _COLS, "linhas": linhas}]


def _synthetic() -> None:
    # Real em branco (input não medido) → pendente, sem déficit/aderência/farol fabricados.
    pend = _sec([
        {"Frente": "Terraplenagem", "Trecho": "KM 144", "Share %": "0.2", "Contratado (R$)": "100", "Previsto acum. até BM (R$)": "10", "Farol": "● Crítico"},
        {"Frente": "Terraplenagem", "Trecho": "TOTAL", "Contratado (R$)": "100"},  # TOTAL pulado
        {"Frente": "Drenagem", "Trecho": "KM 152", "Share %": "0.1", "Contratado (R$)": "50", "Previsto acum. até BM (R$)": "5", "Farol": "● Crítico"},
    ])
    r = extrair_faturamento_frente_trecho(pend)
    assert r["n_linhas"] == 2, r["n_linhas"]
    assert r["n_frentes"] == 2, r["n_frentes"]
    assert r["soma_contratado"] == 150.0, r["soma_contratado"]
    assert r["real_pendente"] is True
    assert all(ln["real_acum_rs"] is None for ln in r["linhas"]), "real NULL (não 0)"
    assert all(ln["deficit_rs"] is None for ln in r["linhas"]), "déficit NULL (não −prev fabricado)"
    assert all(ln["aderencia"] is None for ln in r["linhas"]), "aderência NULL (não 0)"
    assert all(ln["farol"] is None for ln in r["linhas"]), "farol NULL (front mostra 'a medir')"
    assert all(ln["real_pendente"] for ln in r["linhas"])
    assert gate_faturamento_frente_trecho(r, pv=150)["status"] == "ok"
    assert gate_faturamento_frente_trecho(r, pv=999)["status"] == "needs_review", "PV errado reprova"

    # Real medido → Déficit/Aderência/Farol calculados (verde ≥85% · amarelo 70-85% · vermelho <70%).
    medido = _sec([
        {"Frente": "Terra", "Trecho": "A", "Contratado (R$)": "100", "Previsto acum. até BM (R$)": "10", "Real acum. (R$ · input)": "9"},   # ader 90% → conforme
        {"Frente": "Terra", "Trecho": "B", "Contratado (R$)": "100", "Previsto acum. até BM (R$)": "10", "Real acum. (R$ · input)": "8"},   # ader 80% → observacao
        {"Frente": "Terra", "Trecho": "C", "Contratado (R$)": "100", "Previsto acum. até BM (R$)": "10", "Real acum. (R$ · input)": "5"},   # ader 50% → critico
    ])
    rm = extrair_faturamento_frente_trecho(medido)
    assert rm["real_pendente"] is False
    a, b, c = rm["linhas"]
    assert a["aderencia"] == 0.9 and a["farol"] == "conforme", a
    assert b["aderencia"] == 0.8 and b["farol"] == "observacao", b
    assert c["aderencia"] == 0.5 and c["farol"] == "critico", c
    assert a["deficit_rs"] == -1.0, a["deficit_rs"]
    print("PASS synthetic · pendente → NULL+'a medir' · medido → déficit/aderência/farol calculados · TOTAL pulado · gate")


def run() -> None:
    _synthetic()


if __name__ == "__main__":
    run()
