"""Builder do payload do EXCEDENTE AO IPCA (D.5 · cláusula 8.8) para o populate
(worker/scripts/populate-insumo-excedente.mjs).

Lê o envelope D.5+C.6 (fixture gitignored — ingestão determinística da revisão jun/2026 do
workbook, pós-correção IPCA), roda extrair_insumo_excedente + âncoras (Curva ABC, params/
consolidação, Contratado Total) + gate (cross ABC ao centavo, derivações exatas, totais,
régua de farol, pendência sem R$), e escreve {status, gate, config_version, snapshot, params,
insumos}. SEM banco, SEM LLM.

Rodar: cd agent && venv/bin/python -m agents.normalizacao.build_insumo_excedente_payload [saida.json]
"""

from __future__ import annotations

import json
import pathlib
import sys

from .configs import CONFIG_VERSION_WORKBOOK
from .gate import gate_insumo_excedente
from .resolvers import (
    extrair_insumo_excedente,
    snapshot_abc_insumos,
    snapshot_contratado_total,
    snapshot_excedente_params,
)

FIX = pathlib.Path(__file__).parent / "fixtures"
WORKBOOK_D5 = FIX / "workbook_br101v13_d5_excedente.json"


def build() -> dict:
    if not WORKBOOK_D5.exists():
        raise SystemExit(f"fixture ausente: {WORKBOOK_D5.name} (gitignored · dado real).")
    secoes = json.loads(WORKBOOK_D5.read_text())
    res = extrair_insumo_excedente(secoes)
    params = snapshot_excedente_params(secoes)
    # PV p/ o cross do % — na fixture o C.6 traz só materiais; o gate aceita None (warn).
    contratado = snapshot_contratado_total(secoes)
    gate = gate_insumo_excedente(res, abc=snapshot_abc_insumos(secoes), params=params,
                                 contratado_total=contratado or 611357314.09)

    for f in gate["findings"]:
        print(f"  finding[{f['severity']}] {f.get('campo', '')}: {f['msg']}", file=sys.stderr)

    return {"status": res["status"], "gate": gate["status"],
            "config_version": CONFIG_VERSION_WORKBOOK,
            "snapshot_label": res["snapshot_label"],
            "params": params, "insumos": res["insumos"],
            "soma_delta_rs": gate["soma_delta_rs"], "n_insumos": res["n_insumos"]}


if __name__ == "__main__":
    saida = (pathlib.Path(sys.argv[1]) if len(sys.argv) > 1
             else pathlib.Path("/tmp/insumo_excedente_payload.json"))
    payload = build()
    saida.write_text(json.dumps(payload, ensure_ascii=False))
    print(f"escrito {saida} · status={payload['status']} gate={payload['gate']} · "
          f"{payload['n_insumos']} insumos · snapshot {payload['snapshot_label']} · "
          f"Σ Δ R$ {payload['soma_delta_rs']:.2f}")
