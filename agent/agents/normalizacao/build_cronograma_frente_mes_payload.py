"""Builder do payload da MATRIZ FÍSICA disciplina×mês (C.5 Prazo) para o populate
(worker/scripts/populate-cronograma-frente-mes.mjs).

Lê o envelope C.5 (fixture gitignored: BR-101 v11), roda extrair_cronograma_frente_mes + a âncora
snapshot_fisico_por_disciplina + o gate TIGHT (matriz[corte]==snapshot + monotônico), e escreve
{status, gate, config_version, linhas}. SEM banco, SEM LLM. % real fica NULL (pendente · PENDENTE≠0).

Rodar: cd agent && venv/bin/python -m agents.normalizacao.build_cronograma_frente_mes_payload [saida.json]
"""

from __future__ import annotations

import json
import pathlib
import sys

from .configs import CONFIG_VERSION_WORKBOOK
from .gate import gate_cronograma_frente_mes
from .resolvers import extrair_cronograma_frente_mes, snapshot_fisico_por_disciplina

FIX = pathlib.Path(__file__).parent / "fixtures"
WORKBOOK_C5 = FIX / "workbook_br101v11_c5_prazo.json"


def build() -> dict:
    if not WORKBOOK_C5.exists():
        raise SystemExit(f"fixture ausente: {WORKBOOK_C5.name} (gitignored · dado real).")
    secoes = json.loads(WORKBOOK_C5.read_text())
    res = extrair_cronograma_frente_mes(secoes)
    sn = snapshot_fisico_por_disciplina(secoes)
    gate = gate_cronograma_frente_mes(res, sn)

    for f in gate["findings"]:
        print(f"  finding[{f['severity']}] {f.get('campo', '')}: {f['msg']}", file=sys.stderr)

    return {"status": res["status"], "gate": gate["status"],
            "config_version": CONFIG_VERSION_WORKBOOK,
            "linhas": res["linhas"], "n_disciplinas": res["n_disciplinas"]}


if __name__ == "__main__":
    saida = (pathlib.Path(sys.argv[1]) if len(sys.argv) > 1
             else pathlib.Path("/tmp/cronograma_frente_mes_payload.json"))
    payload = build()
    saida.write_text(json.dumps(payload, ensure_ascii=False))
    print(f"escrito {saida} · status={payload['status']} gate={payload['gate']} · "
          f"{len(payload['linhas'])} linhas · {payload['n_disciplinas']} disc")
