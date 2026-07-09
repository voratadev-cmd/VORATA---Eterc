"""Builder do payload da MATRIZ disciplina×mês (C.3 Faturamento) para o populate
(worker/scripts/populate-faturamento-disciplina-mes.mjs).

Lê o envelope REAL do workbook-motor (fixture gitignored: C.3 da BR-101 v11), roda o splitter
(extrair_faturamento_curva p/ a competência ano/mes + extrair_faturamento_disciplina_mes) e o gate
de conservação (gate_faturamento_disciplina_mes · Σ matriz ≈ PV + cross-check por mês), e escreve
{status, gate, config_version, linhas}. SEM banco, SEM LLM. Real fica NULL (pendente · PENDENTE≠ZERO).

Rodar: cd agent && venv/bin/python -m agents.normalizacao.build_faturamento_matriz_payload [saida.json]
"""

from __future__ import annotations

import json
import pathlib
import sys

from .configs import CONFIG_VERSION_WORKBOOK
from .gate import gate_faturamento_disciplina_mes
from .resolvers import extrair_faturamento_curva, extrair_faturamento_disciplina_mes

FIX = pathlib.Path(__file__).parent / "fixtures"
WORKBOOK_C3 = FIX / "workbook_br101v11_c3_faturamento.json"


def build() -> dict:
    """Monta {status, gate, config_version, linhas} pronto para o populate."""
    if not WORKBOOK_C3.exists():
        raise SystemExit(f"fixture ausente: {WORKBOOK_C3.name} (gitignored · dado real).")
    secoes = json.loads(WORKBOOK_C3.read_text())
    curva = extrair_faturamento_curva(secoes)
    res = extrair_faturamento_disciplina_mes(secoes, meses_curva=curva.get("meses"))
    pv = curva.get("soma_contratado")
    curva_mes = {(m["ano"], m["mes"]): m["contratado_rs"] for m in (curva.get("meses") or [])}
    gate = gate_faturamento_disciplina_mes(res, pv=pv, curva_por_mes=curva_mes)

    for f in gate["findings"]:
        print(f"  finding[{f['severity']}] {f.get('campo', '')}: {f['msg']}", file=sys.stderr)

    return {"status": res["status"], "gate": gate["status"],
            "config_version": CONFIG_VERSION_WORKBOOK,
            "linhas": res["linhas"], "n_disciplinas": res["n_disciplinas"],
            "soma_previsto": res["soma_previsto"]}


if __name__ == "__main__":
    saida = (pathlib.Path(sys.argv[1]) if len(sys.argv) > 1
             else pathlib.Path("/tmp/faturamento_matriz_payload.json"))
    payload = build()
    saida.write_text(json.dumps(payload, ensure_ascii=False))
    print(f"escrito {saida} · status={payload['status']} gate={payload['gate']} · "
          f"{len(payload['linhas'])} linhas · {payload['n_disciplinas']} disc · "
          f"Σ={(payload['soma_previsto'] or 0):,.0f}")
