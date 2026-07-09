"""Golden test da FATIA-1 — assere por VALOR contra o envelope REAL do BM-03 (Sorriso).

Ground-truth conhecido: totalMesValor declarado = R$ 6.353.552. O critério de sucesso é a
forma INTEIRA funcionar: config+engine produzem os itens atômicos, a competência resolve, e
o GATE confere Σ(folhas) == total declarado por VALOR (nunca por string formatada).

Rodar: cd agent && venv/bin/python -m agents.normalizacao.test_fatia1
"""

from __future__ import annotations

import json
import pathlib

from .configs import medicao_v1
from .engine import normalizar

FIX = pathlib.Path(__file__).parent / "fixtures" / "BM_03_SBSO_pdf.json"


def run() -> None:
    if not FIX.exists():
        print(f"SKIP · fixture ausente: {FIX.name} (gitignored · dado real). "
              "Regenere — ver fixtures/README.md.")
        return
    payload = json.loads(FIX.read_text())
    cfg = medicao_v1()
    res = normalizar(payload, cfg, nome_original="BM 03 - SBSO.pdf")

    itens = res["entidades"].get("obra_medicao_itens", [])
    totais = res["entidades"].get("obra_medicao_totais", {})
    gate = res["gate"]
    comp = res["competencia"]

    print(f"status: {res['status']}")
    print(f"itens normalizados: {len(itens)}")
    print(f"competência: bm={comp['bm_numero']} ({comp['status']})")
    print(f"totais: {totais}")
    print(f"gate: Σfolhas={gate['soma_folhas']:,.2f} vs total={gate['total_declarado']} → {gate['status']}")
    print("findings:")
    for f in res["findings"]:
        print(f"   [{f['severity']}] {f['msg']}")

    # amostra de itens
    print("\namostra de itens:")
    for it in itens[:3] + itens[-2:]:
        print("  ", {k: it[k] for k in ("ordem", "numero_item", "nivel", "valor_medido_periodo", "valor_contratado") if k in it})

    # ── asserts por VALOR ──
    assert len(itens) >= 150, f"esperava ~186 itens, veio {len(itens)}"
    assert itens[0]["numero_item"] == "1", "primeiro item deve ser o '1' (raiz)"
    assert any(it.get("numero_item") == "1.1.1.1" for it in itens), "EDT profundo preservado"
    assert comp["bm_numero"] == 3, f"competência bm=3, veio {comp['bm_numero']}"
    assert totais.get("total_periodo_valor") == 6353552, f"total período = 6.353.552, veio {totais.get('total_periodo_valor')}"
    # o gate é o coração: Σ folhas tem que bater o total declarado por VALOR
    assert abs(gate["soma_folhas"] - 6353552) <= max(0.02, 0.01 * len(itens)), \
        f"Σ folhas ({gate['soma_folhas']}) ≠ total declarado (6.353.552)"

    # ── FÍSICO do BM (eixo aberto na migration medicao_fisico) — frações 0..1 ──
    # 15,99% do mês · 24,99% acumulado (oficial §4.1). Da identificacao, cross-check c/ linha-raiz.
    assert abs(totais.get("fisico_pct_periodo", -1) - 0.1599) < 1e-6, \
        f"físico mês = 0.1599 (15,99%), veio {totais.get('fisico_pct_periodo')}"
    assert abs(totais.get("fisico_pct_acumulado", -1) - 0.2499) < 1e-6, \
        f"físico acumulado = 0.2499 (24,99%), veio {totais.get('fisico_pct_acumulado')}"
    print(f"físico BM-03: mês={totais['fisico_pct_periodo']:.4f} · "
          f"acum={totais['fisico_pct_acumulado']:.4f} (oficial)")
    print("\n✅ GOLDEN PASSOU — forma provada por valor no BM-03 real.")


if __name__ == "__main__":
    run()
