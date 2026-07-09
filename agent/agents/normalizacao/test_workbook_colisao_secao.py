"""Regressão da Onda A (motor-hardening): a C.2 Indicadores (v45) ganhou uma 'Curva de Faturamento
mensal' (Previsto acum/Real acum R$) que SEQUESTRAVA as rotas C.3 Faturamento e C.5 Curva física,
gerando R$ 16,2 bi (26× o PV) no Faturamento e 611.357.314% no Prazo. As fixtures v11 são isoladas
(C.3-only) e NÃO reproduzem a colisão — este teste a constrói de propósito e trava o fix por âncora
de coluna (`coluna_ancora`) + fail-loud na ambiguidade residual."""
from __future__ import annotations

from agents.normalizacao.resolvers import (
    extrair_cronograma_curva_fisica,
    extrair_faturamento_curva,
)

_MESES = ["jan-26", "fev-26", "mar-26"]


def _c2_curva_faturamento() -> dict:
    # A intrusa: Previsto/Real ACUMULADO em R$ (some 1,2 bi se a rota errada a pegar).
    return {
        "titulo": "C.2 — Curva de Faturamento mensal (Contratado × Real · acumulado R$)",
        "tipo": "tabela",
        "colunas": ["BM", "Mês", "Previsto acum (R$)", "Real acum (R$)", "Previsto mês (R$)", "Real mês (R$)"],
        "linhas": [
            {"BM": i + 1, "Mês": m, "Previsto acum (R$)": 200_000_000 * (i + 1),
             "Real acum (R$)": 5_000_000 * (i + 1), "Previsto mês (R$)": 200_000_000, "Real mês (R$)": 5_000_000}
            for i, m in enumerate(_MESES)
        ],
    }


def _c3_curva(titulo="C.3 Faturamento — Curva mensal (Previsto × Real, por BM)") -> dict:
    # A correta: Previsto Todo (mensal, não-acum) soma 600.
    return {
        "titulo": titulo,
        "tipo": "tabela",
        "colunas": ["BM", "Mês", "Previsto Todo", "Previsto Serviços", "Previsto usado",
                    "Previsto Acum.", "Real (R$)", "Real Acum.", "Ader. mês", "Desvio acum %"],
        "linhas": [
            {"BM": i + 1, "Mês": m, "Previsto Todo": 100 * (i + 1), "Previsto Serviços": 0,
             "Previsto usado": 0, "Previsto Acum.": 100 * (i + 1) * (i + 2) // 2,
             "Real (R$)": 10 * (i + 1), "Real Acum.": 0, "Ader. mês": 0, "Desvio acum %": 0}
            for i, m in enumerate(_MESES)
        ],
    }


def _c5_fisica() -> dict:
    # % Físico acumulado → fração; fecha em 100% (1.0).
    return {
        "titulo": "C.5 — Curva S mensal: % físico previsto × real acumulado (serviços)",
        "tipo": "tabela",
        "colunas": ["Mês", "Período", "% Físico Previsto Acum.", "% Físico Real Acum.", "Projeção (tendência)"],
        "linhas": [
            {"Mês": m, "Período": m, "% Físico Previsto Acum.": pa, "% Físico Real Acum.": None, "Projeção (tendência)": None}
            for m, pa in zip(_MESES, [30.0, 70.0, 100.0])
        ],
    }


def run() -> None:
    secoes = [_c2_curva_faturamento(), _c3_curva(), _c5_fisica()]

    # Faturamento: tem que pegar a C.3 (Σ Previsto Todo = 600), NÃO a C.2 (1,2 bi).
    f = extrair_faturamento_curva(secoes)
    assert f["status"] == "ok", f["findings"]
    assert abs(f["soma_contratado"] - 600) < 1e-6, f"colisão C.2: soma={f['soma_contratado']} (esperado 600)"

    # Curva física: tem que pegar a C.5 (fecha 1.0), NÃO a C.2 (R$/100 = milhões).
    c = extrair_cronograma_curva_fisica(secoes)
    assert c["status"] == "ok", c["findings"]
    assert abs(c["final_previsto"] - 1.0) < 1e-6, f"colisão C.2 na física: final={c['final_previsto']} (esperado 1.0)"

    # FAIL-LOUD: 2 seções com a âncora 'Previsto Todo' (ambíguo) → needs_review, nunca pega a 1ª calada.
    ambiguo = [_c3_curva(), _c3_curva("C.3 Faturamento — Curva mensal (cópia ambígua)")]
    fa = extrair_faturamento_curva(ambiguo)
    assert fa["status"] == "needs_review" and fa["soma_contratado"] is None, \
        f"ambiguidade deveria falhar-alto, veio status={fa['status']} soma={fa['soma_contratado']}"

    print("PASS colisão-seção · C.2 não sequestra C.3 (600≠1,2bi) nem C.5 física (1.0≠611M%) · ambíguo→needs_review")


if __name__ == "__main__":
    run()
