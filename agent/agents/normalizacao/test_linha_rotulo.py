"""Teste do filtro transversal eh_linha_rotulo (Fase 0 · P1 da auditoria das 139 seções).

Garante que os artefatos reais que vazaram pra linha de dado são reconhecidos como rótulo/helper
(o 'max rank →' das check-lists E.x, o separador 'M4 Check-list' do MAPA), sem falso-positivo em
linha de dado legítima nem em family-header de 1 célula (que o resolver trata pelo ID vazio).

Rodar: cd agent && venv/bin/python -m agents.normalizacao.test_linha_rotulo
"""

from __future__ import annotations

from .resolvers import eh_linha_rotulo


def run() -> None:
    # (a) helper de roll-up que vaza em TODAS as E.x
    assert eh_linha_rotulo({"Observação": "max rank →"}) is True
    # (b) separador de seção: mesmo texto em ≥3 colunas (linha-lixo idx 49 do MAPA)
    assert eh_linha_rotulo({"Cód": "M4 Check-list", "Status": "M4 Check-list", "Módulo": "M4 Check-list",
                            "Aba": "M4 Check-list", "Tela": "M4 Check-list", "Dados": "M4 Check-list"}) is True
    # (c) linha vazia
    assert eh_linha_rotulo({}) is True
    assert eh_linha_rotulo({"a": None, "b": "  "}) is True

    # NÃO-rótulo: linha de dado legítima
    assert eh_linha_rotulo({"ID": "PL-01", "Ação": "revisar", "Farol": "● Conforme"}) is False
    assert eh_linha_rotulo({"Recurso / Função": "PEDREIRO", "Contratado (q)": 10}) is False
    # family-header de 1 célula NÃO é coberto aqui (resolver trata pelo ID vazio) → não pode flagar
    assert eh_linha_rotulo({"Documento (tipo)": "CARTA CONVITE"}) is False
    # 2 colunas iguais não basta (precisa ≥3) — evita falso-positivo
    assert eh_linha_rotulo({"a": "x", "b": "x"}) is False

    print("PASS eh_linha_rotulo · 'max rank →' e separador-repetido = rótulo · dado/family-1-célula = não")


if __name__ == "__main__":
    run()
