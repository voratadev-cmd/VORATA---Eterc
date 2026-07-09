"""Builder do payload de INSUMOS para o populate (worker/scripts/populate-insumos.mjs).

Reproduz, de forma determinística e auditável, o `/tmp/insumos_payload.json` que o one-off de
populate consome — SUBSTITUI o comando ad-hoc anterior (a fatia nasceu de um snippet efêmero).
Lê os DOIS envelopes reais (gitignored): o Histograma de Insumos por Quantidades (take-off físico)
e o Cronograma curva ABC (catálogo: classe ABC + grupo de custo). Roda o engine
(`normalizar_insumos` + `enriquecer_insumos_com_catalogo`) e escreve {status, gate, insumos, meses}.
SEM banco, SEM LLM. Preço fica NULL de propósito (catálogo é pântano).

Rodar: cd agent && venv/bin/python -m agents.normalizacao.build_insumos_payload [saida.json]
"""

from __future__ import annotations

import json
import pathlib
import sys

from .engine import enriquecer_insumos_com_catalogo, normalizar_insumos

FIX = pathlib.Path(__file__).parent / "fixtures"
HISTOGRAMA = FIX / "histograma_de_insumos_por_quantidades_xl.json"
CATALOGO = FIX / "Cronograma_de_insumos_curva_abc_R1_xlsx.json"


def build() -> dict:
    """Monta o payload {status, gate, insumos, meses} pronto para o populate."""
    if not HISTOGRAMA.exists():
        raise SystemExit(f"fixture ausente: {HISTOGRAMA.name} (gitignored · dado real). "
                         "Regenere via worker/scripts/dump-envelope.mjs.")
    res = normalizar_insumos(json.loads(HISTOGRAMA.read_text()))
    insumos = res["entidades"]["obra_insumos"]
    meses = res["entidades"]["obra_insumo_meses"]
    gate = (res.get("gate") or {}).get("status")

    if CATALOGO.exists():
        enr = enriquecer_insumos_com_catalogo(insumos, json.loads(CATALOGO.read_text()))
        insumos = enr["insumos"]
        print(f"enriquecido: catálogo {enr['n_catalogo']} itens · join "
              f"{enr['n_enriquecidos']}/{len(insumos)} c/ classe ABC", file=sys.stderr)
        for f in enr["findings"]:
            print(f"  finding[{f['severity']}]: {f['msg']}", file=sys.stderr)
    else:
        print(f"SEM catálogo ({CATALOGO.name} ausente) · classe ABC fica NULL", file=sys.stderr)

    return {"status": res["status"], "gate": gate, "insumos": insumos, "meses": meses}


if __name__ == "__main__":
    saida = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path("/tmp/insumos_payload.json")
    payload = build()
    saida.write_text(json.dumps(payload, ensure_ascii=False))
    n_abc = sum(1 for i in payload["insumos"] if i.get("classe_abc"))
    print(f"escrito {saida} · status={payload['status']} gate={payload['gate']} · "
          f"{len(payload['insumos'])} insumos ({n_abc} c/ ABC) · {len(payload['meses'])} linhas-mês")
