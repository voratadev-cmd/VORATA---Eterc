"""Builder do payload de RECURSOS (C.4 MOD/MOI/EQP) para o populate
(worker/scripts/populate-recursos.mjs).

Reproduz, de forma determinística e auditável, o `/tmp/recursos_payload.json` que o one-off de
populate consome — mesma filosofia do build_insumos_payload. Lê o envelope REAL do workbook-motor
(gitignored: as seções C.4 da BR-101), roda o splitter (`extrair_recursos` +
`extrair_recursos_histograma`) + o gate de conservação (`gate_recursos`) e escreve
{status, gate, itens, meses, config_version}. SEM banco, SEM LLM. Eixo REAL fica NULL de propósito
(obra pré-execução → farol de mobilização pendente).

Rodar: cd agent && venv/bin/python -m agents.normalizacao.build_recursos_payload [saida.json]
"""

from __future__ import annotations

import json
import pathlib
import sys

from .configs import CONFIG_VERSION_WORKBOOK
from .gate import gate_recursos
from .resolvers import extrair_recursos, extrair_recursos_histograma

FIX = pathlib.Path(__file__).parent / "fixtures"
# v11 (alinha com test_golden_br101): a fixture VELHA é pré-execução (real=0) e zerava o eixo real.
WORKBOOK_C4 = FIX / "workbook_br101v11_c_4.json"


def build() -> dict:
    """Monta o payload {status, gate, itens, meses, config_version} pronto para o populate."""
    if not WORKBOOK_C4.exists():
        raise SystemExit(f"fixture ausente: {WORKBOOK_C4.name} (gitignored · dado real). "
                         "Regenere via worker/scripts/_inspect-br101.mjs 'c.4'.")
    secoes = json.loads(WORKBOOK_C4.read_text())
    res = extrair_recursos(secoes)
    hsec = next((s for s in secoes if "Histograma mensal MOD/MOI/EQP" in s.get("titulo", "")), None)
    histo = extrair_recursos_histograma(hsec) if hsec is not None else {"meses": [], "soma_hist": {}}
    gate = gate_recursos(res, histo)

    for f in gate["findings"]:
        print(f"  finding[{f['severity']}] {f.get('campo', '')}: {f['msg']}", file=sys.stderr)

    return {"status": res["status"], "gate": gate["status"],
            "config_version": CONFIG_VERSION_WORKBOOK,
            "itens": res["itens"], "meses": histo["meses"],
            "por_categoria": res["por_categoria"]}


if __name__ == "__main__":
    saida = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path("/tmp/recursos_payload.json")
    payload = build()
    saida.write_text(json.dumps(payload, ensure_ascii=False))
    cats = {c: payload["por_categoria"][c]["n"] for c in payload["por_categoria"]}
    print(f"escrito {saida} · status={payload['status']} gate={payload['gate']} · "
          f"{len(payload['itens'])} itens {cats} · {len(payload['meses'])} linhas-mês")
