"""#4 · Códigos-raiz da EAP parametrizados — generalidade multi-obra. As raízes de orçamento
(custo/receita) e o edt_raiz variam por obra; antes eram hardcoded ('001'/'003'/'1') e bloqueavam
a obra #2 (needs_review). Agora vêm da config (defaults Sorriso, override declarativo). Sintético.
Rodar: cd agent && venv/bin/python -m agents.normalizacao.test_config_raiz
"""

from __future__ import annotations

from .config import load_config
from .resolvers import extrair_orcamento_resumo

SECAO = {
    "linhas": [
        {"Código da Tarefa": "001", "Custo Parcial": 100.0, "Custo Parcial Indireto": 20.0},
        {"Código da Tarefa": "003", "Custo Parcial": 150.0},
    ]
}


def run() -> None:
    # default Sorriso (001 custo / 003 receita)
    r = extrair_orcamento_resumo(SECAO)
    assert r["status"] == "ok", r
    assert r["custo_direto"] == 100.0 and r["custo_indireto"] == 20.0, r
    assert r["custo_total_atividades"] == 120.0 and r["receita"] == 150.0, r

    # raiz de custo ausente → needs_review (falha-loud, NÃO inventa número)
    r2 = extrair_orcamento_resumo(SECAO, raiz_custo="999")
    assert r2["status"] == "needs_review" and "999" in r2["motivo"], r2

    # obra #2 com codificação diferente → override pelos parâmetros
    secao2 = {"linhas": [{"Código da Tarefa": "100", "Custo Parcial": 5.0, "Custo Parcial Indireto": 1.0}]}
    r3 = extrair_orcamento_resumo(secao2, raiz_custo="100", raiz_receita="300")
    assert r3["status"] == "ok" and r3["custo_total_atividades"] == 6.0, r3

    # config: defaults presentes + override valida (extra="forbid" não atrapalha)
    base = {"config_version": "config@1.0.0", "doc_types": ["X"], "entidades": []}
    cfg = load_config(base)
    assert cfg.codigos_raiz.orcamento_custo == "001" and cfg.codigos_raiz.edt_raiz == "1"
    cfg2 = load_config({**base, "codigos_raiz": {
        "orcamento_custo": "100", "orcamento_receita": "300", "edt_raiz": "0", "edt_key": "WBS"}})
    assert cfg2.codigos_raiz.orcamento_custo == "100" and cfg2.codigos_raiz.edt_key == "WBS"

    print("✅ codigos_raiz: defaults Sorriso · override obra #2 · falha-loud sem inventar.")


if __name__ == "__main__":
    run()
