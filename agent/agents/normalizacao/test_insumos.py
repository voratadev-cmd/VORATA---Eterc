"""Golden test da fatia INSUMOS → take-off FÍSICO mensal — assere por VALOR contra o envelope
REAL (Histograma de Insumos por Quantidades da Sorriso).

Ground-truth (medido no dado cru): 3.677 linhas-folha → 344 insumos distintos · Σ células
mensais == Σ 'Total' declarado == 6.108.526,3065 (conserva ao 1e-2) · 0 linhas com Total≠Σmeses
· 1 unidade por código. Âncoras: IM0029 'ACO CA-50' 62.359,69 KG · IS0004 'CONCRETO USINADO
FCK=40' 627,16 M3 · IM5422 'TELA SOLDADA Q196 AÇO' 27.071,73 Kilo.

NÃO toca preço (catálogo é pântano: 0/absurdo/unidade inconsistente) — preço/ABC entram depois.

Rodar: cd agent && venv/bin/python -m agents.normalizacao.test_insumos
"""

from __future__ import annotations

import json
import pathlib

from .engine import enriquecer_insumos_com_catalogo
from .gate import gate_insumos
from .resolvers import extrair_insumos_catalogo, extrair_insumos_histograma

FIX = pathlib.Path(__file__).parent / "fixtures" / "histograma_de_insumos_por_quantidades_xl.json"
FIX_CAT = pathlib.Path(__file__).parent / "fixtures" / "Cronograma_de_insumos_curva_abc_R1_xlsx.json"


def run() -> None:
    if not FIX.exists():
        print(f"SKIP · fixture ausente: {FIX.name} (gitignored · dado real). "
              "Regenere via worker/scripts/dump-envelope.mjs.")
        return
    payload = json.loads(FIX.read_text())
    secao = payload["secoes"][0]
    res = extrair_insumos_histograma(secao)
    g = gate_insumos(res)
    by = {i["codigo"]: i for i in res["insumos"]}

    print(f"status: {res['status']} · gate: {g['status']}")
    print(f"folhas: {res['n_folhas']} → insumos: {res['n_insumos']} · "
          f"violações linha (Total≠Σmeses): {res['n_violacoes_linha']}")
    print(f"conservação: Σ células={res['total_geral']:,.4f} · "
          f"Σ Total declarado={res['soma_total_declarado']:,.4f}")
    print(f"linhas-mês geradas: {len(res['meses'])}")

    assert res["status"] == "ok", f"status {res['status']}"
    assert g["status"] == "ok", f"gate {g['status']}: {g['findings']}"
    assert res["n_folhas"] == 3677, res["n_folhas"]
    assert res["n_insumos"] == 344, res["n_insumos"]
    assert res["n_violacoes_linha"] == 0, res["n_violacoes_linha"]
    # conservação por VALOR (o coração do gate)
    assert abs(res["total_geral"] - 6108526.3065) < 0.01, res["total_geral"]
    assert abs(res["total_geral"] - res["soma_total_declarado"]) < 0.01

    # âncoras por VALOR (insumo · qtde · unidade)
    aco = by["IM0029"]
    assert aco["unidade"] == "KG" and abs(aco["qtde_total"] - 62359.69) < 0.01, aco
    assert "ACO CA-50" in aco["descricao"].upper(), aco["descricao"]
    conc = by["IS0004"]
    assert conc["unidade"] == "M3" and abs(conc["qtde_total"] - 627.16) < 0.01, conc
    tela = by["IM5422"]
    assert tela["unidade"] == "Kilo" and abs(tela["qtde_total"] - 27071.73) < 0.01, tela

    # invariante por insumo: qtde_total == Σ seus meses
    soma_meses_aco = sum(m["qtde"] for m in res["meses"] if m["codigo"] == "IM0029")
    assert abs(soma_meses_aco - aco["qtde_total"]) < 0.01, (soma_meses_aco, aco["qtde_total"])

    # garbage 9999/'Teste' não entrou
    assert "9999" not in by, "garbage 9999 vazou"

    # ── ENRIQUECIMENTO: classe ABC + grupo de custo (join take-off × catálogo) ──
    if FIX_CAT.exists():
        cat_payload = json.loads(FIX_CAT.read_text())
        sec_cat = next(s for s in cat_payload["secoes"] if "Cadastro" in s.get("titulo", ""))
        cat = extrair_insumos_catalogo(sec_cat)
        m = cat["por_codigo"]
        assert cat["n"] == 495, cat["n"]  # 497 − 2 garbage (9999 + Teste)
        assert "9999" not in m, "garbage no catálogo"
        assert m["IM0029"]["classe_abc"] == "C" and m["IM0029"]["grupo_custo"] == "MATERIAIS", m["IM0029"]
        assert m["IS0004"]["classe_abc"] == "D" and m["IS0004"]["grupo_custo"] == "SUBEMPREITEIROS"
        # preço é PÂNTANO: catálogo guarda só CRU (valor_raw), nunca como preço unitário
        assert "valor_raw" in m["IM0029"] and "preco_orcado_unit" not in m["IM0029"]

        # join via ENGINE (o caminho REAL do builder/populate), não inline no teste
        enr = enriquecer_insumos_com_catalogo(res["insumos"], cat_payload)
        assert enr["n_catalogo"] == 495 and enr["n_enriquecidos"] == 344, enr
        assert enr["sem_catalogo"] == [], enr["sem_catalogo"][:5]  # join 344/344 completo
        ins = {i["codigo"]: i for i in enr["insumos"]}
        assert ins["IM0029"]["classe_abc"] == "C" and ins["IM0029"]["grupo_custo"] == "MATERIAIS", ins["IM0029"]
        assert all(i.get("classe_abc") for i in enr["insumos"]), "insumo sem classe após join"
        # INVARIANTE 1 · enriquecimento NÃO inventa preço (continua fora — pântano)
        assert all(i.get("preco_orcado_unit") is None for i in enr["insumos"]), "preço vazou no join"
        # INVARIANTE 2 · enriquecimento NÃO altera o take-off (qtde intocada)
        assert ins["IM0029"]["qtde_total"] == aco["qtde_total"], "enriquecimento mexeu na qtde!"
        dist: dict = {}
        for i in enr["insumos"]:
            dist[i["classe_abc"]] = dist.get(i["classe_abc"], 0) + 1
        assert dist == {"A": 30, "B": 50, "C": 157, "D": 79, "N": 28}, dist
        print(f"catálogo: {cat['n']} itens · join 344/344 · classe ABC {dist}")
    else:
        print("SKIP catálogo · fixture ausente")
    print("PASS · âncoras: AÇO CA-50 62.359,69 KG · CONCRETO 627,16 M3 · TELA 27.071,73 Kilo")


if __name__ == "__main__":
    run()
