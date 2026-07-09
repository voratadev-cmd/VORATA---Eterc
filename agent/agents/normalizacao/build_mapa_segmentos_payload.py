"""Builder do payload do MAPA DA OBRA por km (C.14 Bloco 1) para o populate
(worker/scripts/populate-mapa-segmentos.mjs).

Lê o envelope C.14 (fixture gitignored: BR-101 v11), roda extrair_mapa_segmentos + as âncoras
(BM corrente, resumo C.9 liberações×impedimentos, Contratado Total C.3, Bloco 2 seg×mês) + o gate
(derivação status/K/L ao centavo, Σ cruzadas, contiguidade km, mapa mensal recomputável), e escreve
{status, gate, config_version, bm_corrente, segmentos}. SEM banco, SEM LLM.

Rodar: cd agent && venv/bin/python -m agents.normalizacao.build_mapa_segmentos_payload [saida.json]
"""

from __future__ import annotations

import json
import pathlib
import sys

from .configs import CONFIG_VERSION_WORKBOOK
from .gate import gate_mapa_segmentos
from .resolvers import (
    extrair_mapa_liberacao_mensal,
    extrair_mapa_segmentos,
    snapshot_bm_corrente,
    snapshot_contratado_total,
    snapshot_resumo_liberacoes,
)

FIX = pathlib.Path(__file__).parent / "fixtures"
WORKBOOK_C14 = FIX / "workbook_br101v11_c14_mapa.json"


def build() -> dict:
    if not WORKBOOK_C14.exists():
        raise SystemExit(f"fixture ausente: {WORKBOOK_C14.name} (gitignored · dado real).")
    secoes = json.loads(WORKBOOK_C14.read_text())
    res = extrair_mapa_segmentos(secoes)
    bm = snapshot_bm_corrente(secoes)
    gate = gate_mapa_segmentos(res, bm=bm, resumo=snapshot_resumo_liberacoes(secoes),
                               contratado_total=snapshot_contratado_total(secoes),
                               mapa_mensal=extrair_mapa_liberacao_mensal(secoes))

    for f in gate["findings"]:
        print(f"  finding[{f['severity']}] {f.get('campo', '')}: {f['msg']}", file=sys.stderr)

    return {"status": res["status"], "gate": gate["status"],
            "config_version": CONFIG_VERSION_WORKBOOK, "bm_corrente": bm,
            "segmentos": res["segmentos"], "n_segmentos": res["n_segmentos"]}


if __name__ == "__main__":
    saida = (pathlib.Path(sys.argv[1]) if len(sys.argv) > 1
             else pathlib.Path("/tmp/mapa_segmentos_payload.json"))
    payload = build()
    saida.write_text(json.dumps(payload, ensure_ascii=False))
    print(f"escrito {saida} · status={payload['status']} gate={payload['gate']} · "
          f"{payload['n_segmentos']} segmentos · BM {payload['bm_corrente']}")
