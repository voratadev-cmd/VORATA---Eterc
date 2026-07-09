"""Golden test da fatia FATURAMENTO (Curva S financeira) — assere por VALOR contra a Medição
acumulada real (Sorriso). As 2 curvas R$ (Contratado baseline ← seção diária; Projeção ←
seção mensal R$) fecham 39.776.000,00 cada. Projeção bate os BMs nos meses medidos; baseline
DIVERGE deles (prova de que é plano, não realizado).

Rodar: cd agent && venv/bin/python -m agents.normalizacao.test_faturamento
"""

from __future__ import annotations

import json
import pathlib

from .configs import acumulada_v1
from .engine import normalizar_acumulada

FIX = pathlib.Path(__file__).parent / "fixtures" / "Medic_a_o_acumulada_ate_31_05_26_r1_1_xl.json"


def run() -> None:
    if not FIX.exists():
        print(f"SKIP · fixture ausente: {FIX.name} (gitignored · dado real).")
        return
    payload = json.loads(FIX.read_text())
    res = normalizar_acumulada(payload, acumulada_v1(), nome_original="Medição acumulada.xlsx")

    meses = res["entidades"].get("obra_faturamento_meses", [])
    gate = res["gate"] or {}
    por_comp = {(m["ano"], m["mes"]): m for m in meses}

    print(f"status: {res['status']}")
    print(f"meses (união): {len(meses)}")
    print(f"gate: projeção={gate.get('proj_total')} · baseline={gate.get('base_total')} → {gate.get('status')}")
    print("amostra (meses dos BMs):")
    for ano, mes, bm in ((2025, 10, "BM-1"), (2026, 3, "BM-2"), (2026, 5, "BM-3")):
        m = por_comp.get((ano, mes), {})
        print(f"   {ano}-{mes:02d} [{bm}] projeção={m.get('projecao_rs')} · baseline={m.get('contratado_rs')}")

    # ── asserts por VALOR ──
    assert res["status"] == "ok", f"status deveria ser ok, veio {res['status']}"
    assert len(meses) >= 20, f"esperava ~21 meses, veio {len(meses)}"
    # as 2 curvas fecham o custo total
    assert abs((gate.get("proj_total") or 0) - 39776000) <= 1, f"Σ projeção ≠ 39.776.000 ({gate.get('proj_total')})"
    assert abs((gate.get("base_total") or 0) - 39776000) <= 1, f"Σ baseline ≠ 39.776.000 ({gate.get('base_total')})"
    # PROJEÇÃO bate os BMs medidos (out/25, mar/26, mai/26)
    assert abs(por_comp[(2025, 10)]["projecao_rs"] - 1648346.88) <= 1, "projeção out/25 ≠ BM-1"
    assert abs(por_comp[(2026, 3)]["projecao_rs"] - 1925589.14) <= 1, "projeção mar/26 ≠ BM-2"
    assert abs(por_comp[(2026, 5)]["projecao_rs"] - 6353552.0) <= 1, "projeção mai/26 ≠ BM-3"
    # BASELINE diverge do realizado nos meses dos BMs (prova de plano)
    assert abs(por_comp[(2025, 10)]["contratado_rs"] - 1648346.88) > 1000, "baseline out/25 NÃO deveria bater o realizado"

    # ── orçamento (mesma normalização da Medição acumulada) ──
    orc = res.get("orcamento") or {}
    resumo = orc.get("resumo") or {}
    orc_itens = res["entidades"].get("obra_orcamento_itens", [])
    print("\norçamento:", orc.get("status"), "| itens=", len(orc_itens),
          "| preço-venda=", resumo.get("preco_venda"), "| BDI=", resumo.get("bdi"))
    assert orc.get("status") == "ok", f"orçamento status {orc.get('status')}"
    assert len(orc_itens) == 167, f"esperava 167 itens BASE1, veio {len(orc_itens)}"
    assert abs((resumo.get("preco_venda") or 0) - 39776000) <= 1, "Σ BASE1 ≠ 39.776.000"
    assert abs((resumo.get("custo_direto") or 0) - 27050084.92) <= 1, "custo direto ≠ 27.050.084,92"
    assert abs((resumo.get("receita") or 0) - 49397553.89) <= 1, "receita ≠ 49.397.553,89"
    assert abs((resumo.get("bdi") or 0) - 1.24465) <= 0.001, f"BDI ≠ 1.24465 ({resumo.get('bdi')})"

    # ── cronograma-fonte (tarefas/marcos) ──
    tar = res.get("tarefas") or {}
    tar_itens = res["entidades"].get("obra_cronograma_tarefas", [])
    raiz = next((t for t in tar_itens if t["numero_item"] == "1"), {})
    print("tarefas:", tar.get("status"), "| EDTs=", tar.get("n_distintos"), "| marcos=", tar.get("n_marcos"),
          "| raiz", raiz.get("data_inicio"), "→", raiz.get("data_termino"))
    assert tar.get("status") == "ok", f"tarefas status {tar.get('status')}"
    assert tar.get("n_distintos") == 424, f"esperava 424 EDTs, veio {tar.get('n_distintos')}"
    assert tar.get("n_marcos") == 12, f"esperava 12 marcos, veio {tar.get('n_marcos')}"
    assert raiz.get("data_inicio") == "2025-09-16" and raiz.get("data_termino") == "2027-03-09", "raiz span errado"
    print("\n✅ GOLDEN PASSOU — Curva S + Orçamento (BDI 24,47%) + Cronograma (424 EDTs, 12 marcos) por valor.")


if __name__ == "__main__":
    run()
