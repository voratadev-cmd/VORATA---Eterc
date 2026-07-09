"""Golden test · D.1 Indiretos (v2 · M3 · maior componente do desequilíbrio).

Synthetic: Bloco 2 com 4 métodos (M2, M2.1, M2.2, M3 · UM ativo) + Base Contratual + Bloco 3
(grupos da Adm Local) + Cenários A/B → o total = método ATIVO (NÃO a soma de cenários) e o gate
cruza com o D.0. Real (SKIP se ausente OU se a fixture for v11 antiga, incompatível com o resolver
v2): BR-101 — método ativo M2.2 (gasto − medido), composição 2.491.837 == Custos Indiretos no D.0.

Rodar: cd agent && venv/bin/python -m agents.normalizacao.test_workbook_indiretos
"""

from __future__ import annotations

import json
import pathlib

from .gate import gate_indiretos
from .resolvers import extrair_indiretos

FIX = pathlib.Path(__file__).parent / "fixtures" / "workbook_br101v11_d1_indiretos.json"


def _synthetic() -> None:
    secoes = [
        # Bloco 2 (KV) — os 4 métodos paralelos + qual está ativo + o desequilíbrio do ativo.
        {"tipo": "chave_valor", "titulo": "D.1 Indiretos — Bloco 2 · métodos",
         "dados": {
             "metodoAtivo": "M2.2",
             "desequilibrioMetodoAtivo": 2_491_837.0,
             "M2_comparativoHistograma": {
                 "admLocalRealAteOPeriodo": 9_000_000.0,
                 "admLocalContratadaAteOPeriodo": 6_000_000.0,
                 "desequilibrioM2_realMenosContratada": 3_000_000.0,
             },
             "M2_1_realXMedido": {
                 "admLocalMedidaBoletimAteOPeriodo": 6_508_163.0,
                 "desequilibrioM2_1_realMenosMedida": 2_491_837.0,
             },
             "M2_2_gastoXMedido": {
                 "admLocalGastoAteOPeriodo": 9_000_000.0,
                 "admLocalMedidaBoletimAteOPeriodo": 6_508_163.0,
                 "desequilibrioM2_2_gastoMenosMedida": 2_491_837.0,
             },
         }},
        # Base Contratual (KV) — custo direto + adm local mensal (sem isso a base fica incompleta).
        {"tipo": "chave_valor", "titulo": "D.1 Indiretos — Base Contratual",
         "dados": {"admLocalMensalCheio": 200_000.0, "custoDiretoCD": 471_000_000.0,
                   "admLocalValorCheio": 9_600_000.0, "prazoContratualMeses": 46, "bmCorrenteMesNo": 30}},
        # Detalhe (KV) — PV + fallbacks.
        {"tipo": "chave_valor", "titulo": "D.1 Indiretos — Detalhe",
         "dados": {"precoVendaPV": 611_000_000.0, "admLocalValorCheioTotalSemBDI": 9_600_000.0,
                   "custoDiretoCD": 471_000_000.0, "prazoOriginalMeses": 46}},
        # KPIs (KV).
        {"tipo": "chave_valor", "titulo": "D.1 Indiretos — KPIs", "dados": {"percentSobreOPV": 0.41}},
        # Cenários A/B (KV) — alimentam D.10, NÃO somam à D.1.
        {"tipo": "chave_valor", "titulo": "Cenário A · redução de escopo",
         "dados": {"totalAdmLocalNaoRemuneradaReducao": 1_200_000.0, "reducaoEscopoPercentSContrato": 5.0}},
        {"tipo": "chave_valor", "titulo": "Cenário B · extensão de prazo",
         "dados": {"totalAdmLocalNaoRemuneradaExtensao": 1_800_000.0, "extensaoPrazoDeltaTMeses": 9.0}},
        # Bloco 3 (tabela) — grupos da Adm Local (M2 contratado × real). Δ = real − contratado.
        {"tipo": "tabela", "titulo": "D.1 Indiretos — Bloco 3 · grupos da Adm Local",
         "colunas": ["Item / Grupo", "Qtd contr.", "Qtd real", "Custo contr. (R$)", "Custo real (R$)"],
         "linhas": [
             {"Item / Grupo": "Engenharia", "Qtd contr.": "10", "Qtd real": "12",
              "Custo contr. (R$)": "1.000.000", "Custo real (R$)": "1.300.000"},
             {"Item / Grupo": "max rank →"},  # rótulo/helper → pulado
             {"Item / Grupo": "Administração", "Qtd contr.": "5", "Qtd real": "5",
              "Custo contr. (R$)": "500.000", "Custo real (R$)": "480.000"},
             {"Item / Grupo": "TOTAL", "Custo contr. (R$)": "1.500.000", "Custo real (R$)": "1.780.000"},  # pulado
         ]},
    ]
    res = extrair_indiretos(secoes)
    assert res["status"] == "ok", res["findings"]
    assert res["n_metodos"] == 4, res["n_metodos"]
    ativo = [m for m in res["metodos"] if m["ativo"]]
    assert len(ativo) == 1 and ativo[0]["codigo"] == "M2.2", ativo
    # total = método ATIVO (não a soma de cenários/parcelas)
    assert res["desequilibrio_total"] == 2_491_837.0, res["desequilibrio_total"]
    # 2 grupos (rótulo "→" e "TOTAL" pulados); Δ = real − contratado
    assert res["n_itens"] == 2, res["n_itens"]
    eng = res["itens"][0]
    assert eng["grupo"] == "Engenharia" and eng["delta_custo"] == 300_000.0, eng
    # base completa
    assert res["base"]["custo_direto"] == 471_000_000.0, res["base"]
    assert res["base"]["metodo_ativo"] == "M2.2", res["base"]
    # cenários alimentam o D.10, NÃO somam à D.1
    assert res["base"]["reducao_escopo"] == 1_200_000.0, res["base"]
    assert res["base"]["desequilibrio_extensao"] == 1_800_000.0, res["base"]
    # gate cruza com o D.0 = o método ATIVO (não a soma)
    assert gate_indiretos(res, total_d0=2_491_837.0)["status"] == "ok"
    assert gate_indiretos(res, total_d0=999.0)["status"] == "needs_review", "divergência vs D.0 reprova"
    print("PASS synthetic · 4 métodos (M2.2 ativo) · total=ativo · grupos Δ · cenários→D.10 · cross-check D.0")

    # guarda defensiva: Base ausente reprova (needs_review) — não grava por cima do vigente
    sem_base = extrair_indiretos([secoes[0]])  # só Bloco 2, sem Base Contratual
    assert sem_base["status"] == "needs_review", sem_base["findings"]
    assert any(f["campo"] == "base" for f in sem_base["findings"]), sem_base["findings"]
    print("PASS guarda · Base ausente → needs_review (não grava por cima do vigente)")


def _real() -> None:
    if not FIX.exists():
        print(f"SKIP {FIX.name} (gitignored).")
        return
    res = extrair_indiretos(json.loads(FIX.read_text()))
    # fixture v11 antiga (pré-Bloco 2) é incompatível com o resolver v2 — pula com mensagem clara
    # em vez de falhar (o dado real vive em obra_secoes e é validado por renorm-indiretos.mjs).
    if res["n_metodos"] != 4:
        print(f"SKIP {FIX.name}: estrutura v11 antiga (n_metodos={res['n_metodos']}) — incompatível com resolver v2.")
        return
    g = gate_indiretos(res, total_d0=2_491_837.0)
    ativo = [m for m in res["metodos"] if m["ativo"]]
    assert len(ativo) == 1 and ativo[0]["codigo"] == "M2.2", ativo
    assert abs(res["desequilibrio_total"] - 2_491_837.0) < 0.5, res["desequilibrio_total"]
    assert g["status"] == "ok", g["findings"]
    print("PASS real · 4 métodos (M2.2 ativo) · composição 2.491.837 == D.0 D.1 · gate ok")


def run() -> None:
    _synthetic()
    _real()


if __name__ == "__main__":
    run()
