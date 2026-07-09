"""Builder do payload de PRODUTIVIDADE para o populate (worker/scripts/populate-produtividade.mjs).

Reproduz, de forma determinística, o /tmp/produtividade_payload.json que o populate consome. Lê a
fixture real (Controle de Armação e Concreto), roda extrair_produtividade (consolida Σaço/Σperson-h,
ignora o KPI errado do dashboard, sinaliza a anomalia de perda) e escreve {status, resumo, meses}.

Rodar: cd agent && venv/bin/python -m agents.normalizacao.build_produtividade_payload [saida.json]
"""

from __future__ import annotations

import json
import pathlib
import sys

from .resolvers import extrair_produtividade

FIX = pathlib.Path(__file__).parent / "fixtures" / "CONTROLE_ARMAC_A_O_E_CONCRETO_SBSO_xlsx.json"


def build() -> dict:
    if not FIX.exists():
        raise SystemExit(f"fixture ausente: {FIX.name} (gitignored · dado real).")
    r = extrair_produtividade(json.loads(FIX.read_text()))
    for f in r["findings"]:
        print(f"  finding[{f['severity']}]: {f['msg']}", file=sys.stderr)
    return {"status": r["status"], "resumo": r["resumo"], "meses": r["meses"]}


if __name__ == "__main__":
    saida = (
        pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path("/tmp/produtividade_payload.json")
    )
    pl = build()
    saida.write_text(json.dumps(pl, ensure_ascii=False))
    rz = pl["resumo"]
    print(
        f"escrito {saida} · status={pl['status']} · {rz['n_meses']} meses · "
        f"produtividade={rz['produtividade_real_kg_ph']} kg/person-h · perda_raw={rz['indice_perda_pct_raw']}%"
    )
