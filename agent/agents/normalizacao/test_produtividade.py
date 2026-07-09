"""Golden da fatia PRODUTIVIDADE — Controle de Armação e Concreto (Sorriso).

Ground-truth (medido no dado cru): Σ aço executado = 4.138 kg · Σ person-horas (horas×armadores) =
1.785 → produtividade REAL = 2,3182 kg/person-h. O Dashboard do XLSX reporta 0,4946 kg/hh (MÉDIA
ARITMÉTICA das razões diárias — estatisticamente errada) — o resolver NÃO usa, recomputa do diário.
Índice de perda de aço = 2152% é ANOMALIA (erro de unidade/fórmula na origem) → vira finding.

Rodar: cd agent && venv/bin/python -m agents.normalizacao.test_produtividade
"""

from __future__ import annotations

import json
import pathlib

from .resolvers import extrair_produtividade

FIX = pathlib.Path(__file__).parent / "fixtures" / "CONTROLE_ARMAC_A_O_E_CONCRETO_SBSO_xlsx.json"


def run() -> None:
    if not FIX.exists():
        print(f"SKIP · fixture ausente: {FIX.name} (gitignored · dado real).")
        return
    r = extrair_produtividade(json.loads(FIX.read_text()))
    res = r["resumo"]
    print(f"status: {r['status']}")
    print(f"resumo: {res}")
    print(f"meses: {r['meses']}")
    for f in r["findings"]:
        print(f"   [{f['severity']}] {f['msg']}")

    assert r["status"] == "ok", r["status"]
    # produtividade REAL recomputada (Σaço/Σperson-h), NÃO o 0,4946 errado do dashboard
    assert abs(res["produtividade_real_kg_ph"] - 2.3182) < 1e-3, res["produtividade_real_kg_ph"]
    assert abs(res["aco_total_kg"] - 4138.0) < 1.0, res["aco_total_kg"]
    assert res["person_horas_total"] == 1785.0, res["person_horas_total"]
    assert res["n_meses"] == 1, res["n_meses"]
    assert r["meses"][0]["ano"] == 2026 and r["meses"][0]["mes"] == 5
    # avanço físico (contexto) + anomalia de perda sinalizada (não publicada como verdade limpa)
    assert abs(res["avanco_fisico_pct"] - 39.31) < 0.1, res["avanco_fisico_pct"]
    assert any("ANOMALIA" in f["msg"] for f in r["findings"]), "perda 2152% deveria virar finding"
    print("\n✅ GOLDEN PASSOU — produtividade real 2,32 kg/person-h (não o KPI errado) · anomalia sinalizada.")


if __name__ == "__main__":
    run()
