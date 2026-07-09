"""Golden test do SPLITTER · rota C.4 Recursos (MOD/MOI/EQP · workbook-motor).

Parte 1 (synthetic · SEMPRE roda): exercita extrair_recursos + extrair_recursos_histograma +
gate_recursos — conservação por categoria fecha; total errado reprova; MOI qtde-only (R$ ausente)
é warn não erro; eixo REAL vazio é warn; histograma divergente do detalhe vira warn (área-cega),
não reprova o factual.

Parte 2 (fixture REAL · SKIP se ausente, gitignored): o C.4 da BR-101 — assere por VALOR:
MOD 39 itens Σq=7109 ΣR$=105.135.426,96 · EQP 51 itens Σq=4352 ΣR$=298.611.676 · MOI 8 itens
Σq=662 (R$ vazio) · histograma 52 meses × 3 cat · MOI histograma 683 ≠ 662 detalhe (warn) ·
eixo REAL todo zero (obra pré-execução → farol pendente).

Rodar: cd agent && venv/bin/python -m agents.normalizacao.test_workbook_recursos
"""

from __future__ import annotations

import json
import pathlib

from .gate import gate_recursos
from .resolvers import (
    achar_histograma_recursos,
    extrair_recursos,
    extrair_recursos_histograma,
    parse_mes_abbr,
)

FIX_DIR = pathlib.Path(__file__).parent / "fixtures"

_COLS = ["Recurso / Função", "Contratado (q)", "Real (q)", "Δ (q)",
         "Contratado (R$)", "Real (R$)", "Δ (R$)"]


def _tab(titulo, linhas):  # noqa: ANN001
    return {"tipo": "tabela", "titulo": titulo, "colunas": _COLS, "linhas": linhas}


def _item(nome, cq, crs=None, rq=0, rrs=None):  # noqa: ANN001
    return {"Recurso / Função": nome, "Contratado (q)": cq, "Real (q)": rq,
            "Contratado (R$)": crs, "Real (R$)": rrs}


def _totais(mod_q, mod_rs, eqp_q, eqp_rs, moi_q):  # noqa: ANN001
    return {"tipo": "kv", "titulo": "C.4 Recursos — Totais por categoria (Contratado)",
            "dados": {"TOTAL_MOD": {"contratado_qtde": mod_q, "contratado_RS": mod_rs},
                      "TOTAL_EQP": {"contratado_qtde": eqp_q, "contratado_RS": eqp_rs},
                      "TOTAL_MOI": {"contratado_qtde": moi_q}}}


def _synthetic() -> None:
    secoes = [
        _tab("C.4 Recursos — MOD por função", [_item("PEDREIRO", 10, 1000.0), _item("SERVENTE", 5, 400.0)]),
        _tab("C.4 Recursos — EQP por item", [_item("ESCAVADEIRA", 2, 50000.0)]),
        _tab("C.4 Recursos — MOI por função", [_item("ENGENHEIRO", 3), _item("MESTRE", 1)]),
        _totais(15, 1400.0, 2, 50000.0, 4),
    ]
    res = extrair_recursos(secoes)
    assert res["n_itens"] == 5, res["n_itens"]
    assert res["eixo_real_vazio"] is True, "real vazio deveria ser detectado"
    g = gate_recursos(res)
    assert g["status"] == "ok", f"conservação deveria fechar · {g['findings']}"
    # MOI qtde-only: R$ ausente NÃO é erro (warn no máximo)
    assert not any("MOI.rs" in f.get("campo", "") and f["severity"] == "error" for f in g["findings"])

    # total MOD errado → needs_review
    bad = [s for s in secoes if "Totais" not in s["titulo"]] + [_totais(999, 1400.0, 2, 50000.0, 4)]
    gb = gate_recursos(extrair_recursos(bad))
    assert gb["status"] == "needs_review", "divergência de qtde MOD deveria reprovar"
    assert any("MOD.qtde" in f.get("campo", "") for f in gb["findings"]), gb["findings"]

    # R$ MOD errado → needs_review
    bad_rs = [s for s in secoes if "Totais" not in s["titulo"]] + [_totais(15, 99999.0, 2, 50000.0, 4)]
    assert gate_recursos(extrair_recursos(bad_rs))["status"] == "needs_review", "R$ errado deveria reprovar"

    # histograma + cross-check SOFT: histograma diverge do detalhe → warn, nunca error
    hsec = {"tipo": "tabela", "titulo": "C.4 Recursos — Histograma mensal MOD/MOI/EQP",
            "colunas": ["Período", "MOD Contr.(q)", "MOD Real(q)", "MOD Contr.(R$)", "MOD Real(R$)",
                        "MOI Contr.(q)", "MOI Real(q)", "EQP Contr.(q)", "EQP Real(q)",
                        "EQP Contr.(R$)", "EQP Real(R$)"],
            "linhas": [{"Período": "jan-26", "MOD Contr.(q)": 15, "MOD Contr.(R$)": 1400.0,
                        "MOI Contr.(q)": 99, "EQP Contr.(q)": 2, "EQP Contr.(R$)": 50000.0}]}
    histo = extrair_recursos_histograma(hsec)
    assert histo["n_meses"] == 3, histo["n_meses"]  # 1 mês × 3 categorias
    gh = gate_recursos(res, histo)
    assert gh["status"] == "ok", "histograma divergente NÃO deve reprovar o factual"
    assert any(f["campo"].startswith("MOI") and "histograma" in f["campo"] for f in gh["findings"]), (
        "faltou warn de área-cega (lista por função < histograma)"
    )

    # ROBUSTEZ p/ template novo (achados da revisão adversarial) ────────────────────────
    # [0] categoria DECLARADA nos Totais mas com seção por função AUSENTE → error (não passa em silêncio)
    sem_mod = [_tab("C.4 Recursos — EQP por item", [_item("ESCAVADEIRA", 2, 50000.0)]),
               _tab("C.4 Recursos — MOI por função", [_item("ENGENHEIRO", 3)]),
               _totais(15, 1400.0, 2, 50000.0, 4)]
    g_sem = gate_recursos(extrair_recursos(sem_mod))
    assert g_sem["status"] == "needs_review", "MOD declarado mas ausente deveria REPROVAR"
    assert any("MOD.ausente" in f.get("campo", "") for f in g_sem["findings"]), g_sem["findings"]

    # [1] histograma com rótulos de mês que COLIDEM (mar-26 repetido) → dedup/soma, sem duplicar chave
    dup = {"tipo": "tabela", "titulo": "C.4 Recursos — Histograma mensal MOD/MOI/EQP",
           "colunas": ["Período", "MOD Contr.(q)"],
           "linhas": [{"Período": "mar-26", "MOD Contr.(q)": 10},
                      {"Período": "mar-26", "MOD Contr.(q)": 5}]}
    hd = extrair_recursos_histograma(dup)
    mod_mar = [m for m in hd["meses"] if m["categoria"] == "MOD" and (m["ano"], m["mes"]) == (2026, 3)]
    assert len(mod_mar) == 1 and mod_mar[0]["contratado_qtde"] == 15, hd["meses"]

    # [2] ano de 4 dígitos / barra ('mar/2026') é parseável; lixo total vira finding error
    assert parse_mes_abbr("mar/2026") == (2026, 3) and parse_mes_abbr("mar-2026") == (2026, 3)
    lixo = {"tipo": "tabela", "titulo": "C.4 Recursos — Histograma mensal MOD/MOI/EQP",
            "colunas": ["Período", "MOD Contr.(q)"], "linhas": [{"Período": "???", "MOD Contr.(q)": 10}]}
    hl = extrair_recursos_histograma(lixo)
    assert hl["n_meses"] == 0 and any(f["severity"] == "error" for f in hl["findings"]), hl

    print("PASS synthetic · conservação fecha · qtde/R$ errados reprovam · MOI qtde-only sem erro · "
          "eixo real warn · histograma divergente=warn · [robustez] seção ausente reprova · "
          "dedup de mês · ano 4-díg + período-lixo viram finding")


def _real_fixture(fn: str, *, tem_declarados: bool, tem_real: bool) -> bool:
    """Assere o MESMO resolver/gate nos DOIS workbooks (títulos diferentes) → robustez estrutural."""
    p = FIX_DIR / fn
    if not p.exists():
        print(f"SKIP {fn} (gitignored · dado real). Regenere via dump.")
        return False
    secoes = json.loads(p.read_text())
    res = extrair_recursos(secoes)
    histo = extrair_recursos_histograma(achar_histograma_recursos(secoes))  # estrutural
    g = gate_recursos(res, histo)
    por = res["por_categoria"]

    assert res["n_itens"] == 98, (fn, res["n_itens"])
    assert por["MOD"]["n"] == 39 and por["MOD"]["soma_qtde"] == 7109, (fn, por["MOD"])
    assert abs(por["MOD"]["soma_rs"] - 105135426.96) < 0.01, (fn, por["MOD"])
    assert por["EQP"]["n"] == 51 and por["EQP"]["soma_qtde"] == 4352, (fn, por["EQP"])
    assert abs(por["EQP"]["soma_rs"] - 298611676.0) < 0.01, (fn, por["EQP"])
    assert por["MOI"]["n"] == 8 and por["MOI"]["soma_qtde"] == 662, (fn, por["MOI"])
    assert por["MOI"]["soma_rs"] is None, (fn, "MOI sem R$ por função")
    assert g["status"] == "ok", (fn, g["findings"])
    # presença da seção de Totais (âncora extra) e eixo real variam ENTRE os workbooks — o gate
    # conserva nos dois (com Totais OU por cruzamento histograma):
    assert bool(res["declarados"]) is tem_declarados, (fn, "declarados", res["declarados"])
    assert res["eixo_real_vazio"] is (not tem_real), (fn, "eixo_real_vazio", res["eixo_real_vazio"])
    assert histo["n_meses"] == 156, (fn, histo["n_meses"])
    assert histo["soma_hist"]["MOD"]["q"] == 7109 and histo["soma_hist"]["EQP"]["q"] == 4352, fn
    assert histo["soma_hist"]["MOI"]["q"] == 683, (fn, histo["soma_hist"]["MOI"])
    assert any(f["campo"].startswith("MOI") and "histograma" in f["campo"] for f in g["findings"]), (
        fn, "faltou área-cega MOI (662<683)"
    )
    print(f"PASS {fn} · 98 itens · MOD 7109/105,1M · EQP 4352/298,6M · MOI 662 · "
          f"Totais={'sim' if tem_declarados else 'não'} · real={'sim' if tem_real else 'não'} · gate ok")
    return True


def _real() -> None:
    # MESMO resolver casa os DOIS workbooks apesar dos títulos diferentes (robustez estrutural):
    #  • antigo: 'MOD por função' + seção Totais (âncora forte) · pré-execução (sem real)
    #  • novo v11: 'MOD recurso a recurso' · SEM Totais (conserva por cruzamento histograma) · COM real
    ok_old = _real_fixture("workbook_br101_c_4.json", tem_declarados=True, tem_real=False)
    ok_new = _real_fixture("workbook_br101v11_c_4.json", tem_declarados=False, tem_real=True)
    if not (ok_old or ok_new):
        print("SKIP real · nenhuma fixture presente (gitignored)")


def run() -> None:
    _synthetic()
    _real()


if __name__ == "__main__":
    run()
