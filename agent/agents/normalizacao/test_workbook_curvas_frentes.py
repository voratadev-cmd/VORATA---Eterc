"""Golden · C.8 Matriz por frente. PENDENTE≠ZERO: Gap/Responsabilidade derivam de Executado/Capacidade
(inputs); pendentes → veredito de culpa NULL, não '● Contratada (subdim.)' fabricado. Real (SKIP):
12 frentes · Σ contratado 41.045.544 · inputs pendentes → responsabilidade pendente."""
from __future__ import annotations
import json, pathlib
from .resolvers import extrair_curvas_frentes
FIX = pathlib.Path(__file__).parent / "fixtures" / "workbook_br101v11_c8_curvas.json"
_COLS = ["Frente", "Contratado (R$)", "Liberado (R$ input)", "Produtiv. frente (R$/HH)",
         "HH real frente", "Capacidade (R$)", "Executado (R$)", "Gap dominante (R$)", "Responsabilidade preliminar"]


def _synthetic() -> None:
    # inputs PENDENTES (Executado/Capacidade = 0) → a fonte fabrica Gap=Contratado e culpa Contratada.
    pend = [{"tipo": "tabela", "titulo": "C.8 Aderência das Curvas — Matriz por frente", "colunas": _COLS,
             "linhas": [
                 {"Frente": "Terraplenagem", "Contratado (R$)": "100", "Capacidade (R$)": "0", "Executado (R$)": "0", "Gap dominante (R$)": "100", "Produtiv. frente (R$/HH)": "426", "Responsabilidade preliminar": "● Contratada (subdim.)"},
                 {"Frente": "max rank →"},
                 {"Frente": "Drenagem", "Contratado (R$)": "50", "Capacidade (R$)": "0", "Executado (R$)": "0", "Gap dominante (R$)": "50", "Produtiv. frente (R$/HH)": "426", "Responsabilidade preliminar": "● Contratada (subdim.)"}]}]
    r = extrair_curvas_frentes(pend)
    assert r["n_frentes"] == 2, r["n_frentes"]
    assert r["soma_contratado"] == 150.0, r["soma_contratado"]
    assert r["real_pendente"] is True
    assert all(f["responsabilidade"] is None for f in r["frentes"]), "culpa fabricada não nulada"
    assert all(f["gap_dominante_rs"] is None for f in r["frentes"]), "gap fabricado não nulado"
    assert all(f["contratado_rs"] is not None for f in r["frentes"]), "contratado (real) deve ficar"
    # inputs ALOCADOS (≥1 Executado>0) → preserva veredito + gap reais.
    aloc = [{"tipo": "tabela", "titulo": "C.8 Aderência das Curvas — Matriz por frente", "colunas": _COLS,
             "linhas": [
                 {"Frente": "Terraplenagem", "Contratado (R$)": "100", "Capacidade (R$)": "90", "Executado (R$)": "80", "Gap dominante (R$)": "20", "Responsabilidade preliminar": "● Contratante"},
                 {"Frente": "Drenagem", "Contratado (R$)": "50", "Capacidade (R$)": "0", "Executado (R$)": "0", "Gap dominante (R$)": "50", "Responsabilidade preliminar": "● Contratada (subdim.)"}]}]
    ra = extrair_curvas_frentes(aloc)
    assert ra["real_pendente"] is False
    assert ra["frentes"][0]["responsabilidade"] == "● Contratante", "veredito real preservado"
    assert ra["frentes"][0]["gap_dominante_rs"] == 20.0
    print("PASS synthetic · inputs pendentes → culpa/gap NULL · inputs alocados → veredito preservado · rótulo pulado")


def _real() -> None:
    if not FIX.exists():
        print(f"SKIP {FIX.name}")
        return
    r = extrair_curvas_frentes(json.loads(FIX.read_text()))
    assert r["n_frentes"] == 12, r["n_frentes"]
    assert abs(r["soma_contratado"] - 41_045_544) < 2, r["soma_contratado"]
    # BR-101: Executado/Capacidade por frente todos 0 → eixo real pendente, sem culpa fabricada.
    assert r["real_pendente"] is True, "inputs por frente são pendentes na BR-101"
    assert all(f["responsabilidade"] is None for f in r["frentes"]), "responsabilidade Crítica/culpa fabricada"
    assert all(f["gap_dominante_rs"] is None for f in r["frentes"]), "gap = contratado fabricado"
    assert all(f["contratado_rs"] is not None for f in r["frentes"]), "contratado real preservado"
    print("PASS real · 12 frentes · Σ contratado 41.045.544 · culpa/gap PENDENTES (não fabricados)")


def run() -> None:
    _synthetic(); _real()


if __name__ == "__main__":
    run()
