"""Builder do payload da SÉRIE MENSAL DAS CURVAS (C.8 × C.3) para o populate
(worker/scripts/populate-curvas-serie-mes.mjs).

Lê o envelope (fixture gitignored: BR-101 v11), roda extrair_curvas_serie_mes (corte do carry no
BM) + o gate (cross-source C.8==C.3 ao centavo, corte==cards, fim==Contratado Total, monotônico),
e escreve {status, gate, config_version, bm_corrente, meses}. SEM banco, SEM LLM.

Rodar: cd agent && venv/bin/python -m agents.normalizacao.build_curvas_serie_mes_payload [saida.json]
"""

from __future__ import annotations

import json
import pathlib
import sys

from .configs import CONFIG_VERSION_WORKBOOK
from .gate import gate_curvas_serie_mes
from .resolvers import (
    extrair_curvas_serie_mes,
    snapshot_bm_corrente,
    snapshot_contratado_total,
    snapshot_curvas_cards,
)

FIX = pathlib.Path(__file__).parent / "fixtures"
WORKBOOK_SERIE = FIX / "workbook_br101v11_curvas_serie.json"


def build() -> dict:
    if not WORKBOOK_SERIE.exists():
        raise SystemExit(f"fixture ausente: {WORKBOOK_SERIE.name} (gitignored · dado real).")
    secoes = json.loads(WORKBOOK_SERIE.read_text())
    bm = snapshot_bm_corrente(secoes)
    res = extrair_curvas_serie_mes(secoes, bm=bm)
    gate = gate_curvas_serie_mes(res, cards=snapshot_curvas_cards(secoes), bm=bm,
                                 contratado_total=snapshot_contratado_total(secoes))

    for f in gate["findings"]:
        print(f"  finding[{f['severity']}] {f.get('campo', '')}: {f['msg']}", file=sys.stderr)

    return {"status": res["status"], "gate": gate["status"],
            "config_version": CONFIG_VERSION_WORKBOOK, "bm_corrente": bm,
            "meses": res["meses"], "n_meses": res["n_meses"]}


if __name__ == "__main__":
    saida = (pathlib.Path(sys.argv[1]) if len(sys.argv) > 1
             else pathlib.Path("/tmp/curvas_serie_mes_payload.json"))
    payload = build()
    saida.write_text(json.dumps(payload, ensure_ascii=False))
    print(f"escrito {saida} · status={payload['status']} gate={payload['gate']} · "
          f"{payload['n_meses']} meses · BM {payload['bm_corrente']}")
