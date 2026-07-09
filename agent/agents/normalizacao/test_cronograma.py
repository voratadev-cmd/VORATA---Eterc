"""Golden test da fatia CRONOGRAMA → curva PREVISTA FÍSICA — assere por VALOR contra o
envelope REAL (a seção 'Cronograma Físico-Financeiro' que vem dentro do BM-02 da Sorriso).

Ground-truth conhecido: custoTotalObra = R$ 39.776.000 · 14 competências mensais ·
Σ(% físico) == 100,0000%. O critério de sucesso é a forma INTEIRA: o resolver unpivot_temporal
transpõe a distribuição mensal em linhas atômicas, e o GATE confere Σ% == 100% por VALOR.

Físico ≠ financeiro: o financeiro declarado é PARCIAL no PDF (6/14 meses) — por design NÃO
entra no gate (não se inventa a curva financeira a partir do físico).

Rodar: cd agent && venv/bin/python -m agents.normalizacao.test_cronograma
"""

from __future__ import annotations

import json
import pathlib

from .configs import cronograma_v1
from .engine import normalizar_cronograma

FIX = pathlib.Path(__file__).parent / "fixtures" / "BM_02_SBSO_pdf.json"


def run() -> None:
    if not FIX.exists():
        print(f"SKIP · fixture ausente: {FIX.name} (gitignored · dado real). "
              "Regenere — ver fixtures/README.md.")
        return
    payload = json.loads(FIX.read_text())
    cfg = cronograma_v1()
    res = normalizar_cronograma(payload, cfg, nome_original="Cronograma Fisico-financeiro - SBSO.pdf")

    meses = res["entidades"].get("obra_cronograma_previsto", [])
    header = res["header"] or {}
    gate = res["gate"] or {}
    n_fin = sum(1 for m in meses if m.get("previsto_financeiro_declarado") is not None)

    print(f"status: {res['status']}")
    print(f"meses normalizados: {len(meses)}")
    print(f"header: custo_total={header.get('custo_total_obra'):,.2f} · "
          f"início={header.get('inicio_obra')} · término={header.get('termino_obra')}")
    print(f"gate físico: Σ%={gate.get('soma_pct', 0) * 100:.4f}% ({gate.get('n_meses')} meses) → {gate.get('status')}")
    print(f"financeiro declarado (parcial): {n_fin}/{len(meses)} meses")
    print("findings:")
    for f in res["findings"]:
        print(f"   [{f['severity']}] {f['msg']}")

    print("\namostra (1ª · meio · última):")
    for m in (meses[:1] + meses[len(meses) // 2: len(meses) // 2 + 1] + meses[-1:]):
        print("  ", {k: m.get(k) for k in
                     ("ordem", "ano", "mes", "previsto_pct", "previsto_pct_acumulado") if k in m})

    # ── asserts por VALOR ──
    assert res["status"] == "ok", f"status deveria ser ok, veio {res['status']}"
    assert len(meses) == 14, f"esperava 14 competências, veio {len(meses)}"
    assert header.get("custo_total_obra") == 39776000, \
        f"custo total = 39.776.000, veio {header.get('custo_total_obra')}"
    # o gate é o coração: a curva física tem que fechar 100%
    assert abs(gate.get("soma_pct", 0) - 1.0) <= 0.01, \
        f"Σ% físico ({gate.get('soma_pct')}) ≠ 100%"
    # ordenado por competência; 1º mês = out/2025
    assert (meses[0]["ano"], meses[0]["mes"]) == (2025, 10), \
        f"1ª competência deve ser 2025-10, veio {meses[0]['ano']}-{meses[0]['mes']}"
    # acumulado físico fecha em ~100% no último mês
    assert abs(meses[-1].get("previsto_pct_acumulado", 0) - 1.0) <= 0.01, \
        f"acumulado físico final ({meses[-1].get('previsto_pct_acumulado')}) ≠ 100%"
    # financeiro é parcial por design (não inventamos os meses ilegíveis)
    assert 0 < n_fin < len(meses), f"financeiro deveria ser PARCIAL, veio {n_fin}/{len(meses)}"
    print("\n✅ GOLDEN PASSOU — curva prevista física provada por valor (Σ=100%) no cronograma real.")


if __name__ == "__main__":
    run()
