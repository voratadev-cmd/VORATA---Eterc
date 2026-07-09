"""#3 · Gate de PERTINÊNCIA — barra documento de OUTRA obra antes de contaminar as tabelas. O
acervo real tinha o Anexo PSQ/CFF de Sorocaba e o Pluviométrico do Consórcio Novo Túnel filtrados
pra obra do Sorriso. Determinístico (token distintivo da obra × resumo do doc), genérico (nada de
'Sorriso' hardcoded). Sintético + resumos reais. Rodar: cd agent && venv/bin/python -m agents.normalizacao.test_pertinencia
"""

from __future__ import annotations

from .resolvers import gate_pertinencia, tokens_obra_de


def run() -> None:
    # derivação de tokens distintivos: remove genéricos (aeroporto/teste/real), fica o nome próprio
    assert tokens_obra_de("Aeroporto Sorriso ( teste real )") == ["sorriso"], tokens_obra_de(
        "Aeroporto Sorriso ( teste real )"
    )
    # cidade + uf + contratante entram; genéricos saem
    t = tokens_obra_de("Terminal de Passageiros", cidade="Sorriso", uf="MT", contratante="INFRAERO")
    assert "sorriso" in t and "infraero" in t and "mt" in t, t
    assert "terminal" not in t and "passageiros" not in t, t
    # obra sem identidade no cadastro → tokens vazios
    assert tokens_obra_de(None) == []

    tokens = ["sorriso"]
    # doc REAL da obra (resumo do BM-03) → pertinente
    bm = gate_pertinencia(
        "Planilha de Medição (BM) da obra do novo Terminal de Passageiros do Aeroporto Regional de Sorriso/MT (SBSO)",
        tokens,
    )
    assert bm["pertinente"] is True and "sorriso" in bm["tokens_casados"], bm

    # doc de OUTRA obra (resumo do Anexo de Sorocaba): tem 'SBSO' (código ambíguo) mas NÃO 'sorriso'
    soroc = gate_pertinencia(
        "Anexo de licitação pública LICITAÇÃO ELETRÔNICA Nº 188/ADLI-1/SBSO/2024 da EMPRESA BRASILEIRA DE INFRAESTRUTURA, Aeroporto de Sorocaba/SP",
        tokens,
    )
    assert soroc["pertinente"] is False, soroc
    assert "sorriso" in soroc["motivo"], soroc

    # pluviométrico MISTO (tem 'sorriso' real E resíduo de outra obra) → pertinente (tem dado da obra)
    mix = gate_pertinencia(
        "Controle pluviométrico do Aeroporto de Sorriso; abas com resíduo do Consórcio Novo Túnel 2022",
        tokens,
    )
    assert mix["pertinente"] is True, mix

    # obra SEM identidade → passa (não inventa bloqueio sem base)
    assert gate_pertinencia("qualquer texto", [])["pertinente"] is True

    print("✅ pertinência: obra real passa · Sorocaba BARRADO · misto passa · sem-identidade passa.")


if __name__ == "__main__":
    run()
