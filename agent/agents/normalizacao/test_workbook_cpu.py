"""Golden · CPU Coeficientes (base de custo). Synthetic: invariante MOD+EQP ≤ CD, % como FRAÇÃO
(coluna exata, não R$/un), CPU sem Serviço preservada. Real (SKIP): 558 CPUs."""
from __future__ import annotations
import json, pathlib
from .resolvers import extrair_cpu_coeficientes
FIX = pathlib.Path(__file__).parent / "fixtures" / "workbook_br101v11_full.json"


def _synthetic() -> None:
    secoes = [{"tipo": "tabela", "titulo": "CPU — Coeficientes",
               "colunas": ["Código CPU", "Serviço", "Unid.", "Tipo", "Custo direto unit. (R$)", "MOD R$/un", "EQP R$/un", "%MOD", "%EQP", "%Mat/Transp"],
               "linhas": [
                   {"Código CPU": "1.1", "Serviço": "Terra", "Unid.": "m3", "Tipo": "Principal", "Custo direto unit. (R$)": "10", "MOD R$/un": "4", "EQP R$/un": "3", "%MOD": "0.4", "%EQP": "0.3", "%Mat/Transp": "0.3"},
                   {"Código CPU": "1.2", "Serviço": "Pav", "Unid.": "m2", "Custo direto unit. (R$)": "20", "MOD R$/un": "5", "EQP R$/un": "2", "%MOD": "0.25", "%EQP": "0.1", "%Mat/Transp": "0.65"},
                   # CPU sem Serviço (era descartada por engano) — preservada por ter código + custo.
                   {"Código CPU": "1.3", "Unid.": "un", "Tipo": "Principal", "Custo direto unit. (R$)": "10555.05", "MOD R$/un": "9406.36", "EQP R$/un": "0", "%MOD": "0.891", "%EQP": "0", "%Mat/Transp": "0.109"}]}]
    r = extrair_cpu_coeficientes(secoes)
    assert r["n_cpus"] == 3, r["n_cpus"]  # inclui a 1.3 sem Serviço
    assert r["n_consistente"] == 3, r["n_consistente"]
    c0 = r["cpus"][0]
    assert c0["custo_direto_unit"] == 10.0
    # % é FRAÇÃO da coluna exata, NÃO o R$/un (bug antigo: pct_mod==mod_rs_un).
    assert c0["pct_mod"] == 0.4 and c0["pct_mod"] != c0["mod_rs_un"], (c0["pct_mod"], c0["mod_rs_un"])
    assert c0["pct_eqp"] == 0.3 and c0["pct_eqp"] != c0["eqp_rs_un"], (c0["pct_eqp"], c0["eqp_rs_un"])
    c2 = r["cpus"][2]
    assert c2["servico"] is None and c2["codigo_cpu"] == "1.3", c2  # sem Serviço, mas mantida
    assert c2["pct_eqp"] == 0.0, c2["pct_eqp"]  # 0% legítimo preservado (não vira NULL)
    print("PASS synthetic · 3 CPUs (1 sem Serviço) · MOD+EQP≤CD · % é fração da coluna exata · 0% preservado")


def _real() -> None:
    if not FIX.exists():
        print(f"SKIP {FIX.name}")
        return
    r = extrair_cpu_coeficientes(json.loads(FIX.read_text()))
    assert r["n_cpus"] >= 555, r["n_cpus"]  # 558 na fonte (não dropa as 7 sem Serviço)
    assert r["n_consistente"] / r["n_com_cd"] > 0.95, (r["n_consistente"], r["n_com_cd"])
    # % nunca deve igualar o R$/un (sentinela do bug de mapeamento de coluna).
    iguais = sum(1 for c in r["cpus"] if c["pct_mod"] is not None and c["pct_mod"] == c["mod_rs_un"] and c["mod_rs_un"] not in (0.0, None))
    assert iguais == 0, f"{iguais} CPUs com pct_mod==mod_rs_un (mapeamento errado voltou)"
    # fração (≤~2 com raro outlier MOD>CD na fonte) — NUNCA o R$/un do bug antigo (chegava a 53257).
    assert all((c["pct_mod"] is None or 0 <= c["pct_mod"] <= 5) for c in r["cpus"]), "pct em escala de R$/un (bug)"
    print(f"PASS real · {r['n_cpus']} CPUs · {r['n_consistente']}/{r['n_com_cd']} consistentes · % é fração (0 colisões com R$/un)")


def run() -> None:
    _synthetic(); _real()


if __name__ == "__main__":
    run()
