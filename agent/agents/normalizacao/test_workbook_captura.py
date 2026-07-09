"""Golden · captura genérica (rede de completude). Synthetic: pula META, captura tabela+KV com dado,
marca coberta. Real (SKIP se ausente): 131 seções · 25 cobertas · nada dropado."""
from __future__ import annotations
import json, pathlib
from .resolvers import capturar_secoes
FIX = pathlib.Path(__file__).parent / "fixtures" / "workbook_br101v11_full.json"


def _synthetic() -> None:
    secoes = [
        {"tipo": "tabela", "titulo": "C.6 Insumos — Curva ABC", "colunas": ["A"], "linhas": [{"A": "1"}]},
        {"tipo": "tabela", "titulo": "MAPA — Telas da Plataforma", "colunas": ["X"], "linhas": [{"X": "1"}]},  # META (prefixo) → pulada
        {"tipo": "tabela", "titulo": "INSTRUÇÕES — Guia da IA", "colunas": ["X"], "linhas": [{"X": "1"}]},      # META (prefixo) → pulada
        {"tipo": "tabela", "titulo": "D.4 Valor Agregado — por serviço", "colunas": ["B"], "linhas": [{"B": "9"}]},
        # Antes DROPADAS por substring 'mapa '/'índice' — agora PRESERVADAS (seção codificada, palavra no meio).
        {"tipo": "tabela", "titulo": "C.14 Mapa da Obra — Bloco 1", "colunas": ["seg"], "linhas": [{"seg": "S1"}]},
        {"tipo": "tabela", "titulo": "D.9 Mapa de Riscos — Cláusulas sancionatórias", "colunas": ["m"], "linhas": [{"m": "0,05%/dia"}]},
        {"tipo": "tabela", "titulo": "C.9 Chuvas — Quadro 1: Índices de chuva (mm)", "colunas": ["ano"], "linhas": [{"ano": "2024"}]},
        # NARRATIVA só-conteudo (Leitura IA) — antes DROPADA (sem linhas/dados); agora retida como texto.
        {"tipo": "texto", "titulo": "C.6 — Leitura IA (nota de rodapé)", "conteudo": "[LEITURA IA · L51]: 32 insumos monitorados (R$ 78,64 mi)."},
        {"tipo": "texto", "titulo": "W narrativa vazia", "conteudo": "   "},  # conteudo em branco → pulada
        {"tipo": "tabela", "titulo": "Z vazia", "colunas": [], "linhas": []},  # sem dado → pulada
    ]
    caps = capturar_secoes(secoes)
    titulos = [c["titulo"] for c in caps]
    assert len(caps) == 6, titulos  # 2 META + 1 vazia + 1 narrativa-vazia puladas; 5 tabelas + 1 narrativa
    assert not any("MAPA — Telas" in t or "INSTRUÇÕES" in t for t in titulos), "folha-meta vazou"
    assert any("C.14 Mapa da Obra" in t for t in titulos), "Mapa da Obra (real) foi dropado"
    assert any("D.9 Mapa de Riscos" in t for t in titulos), "Mapa de Riscos (real) foi dropado"
    assert any("Índices de chuva" in t for t in titulos), "Índices de chuva (real) foi dropado"
    nar = next((c for c in caps if "Leitura IA" in c["titulo"]), None)
    assert nar and nar["tipo"] == "texto" and "32 insumos" in nar["dados"]["conteudo"], "narrativa conteudo-only dropada (B4)"
    assert not any("narrativa vazia" in t for t in titulos), "narrativa de conteudo em branco deveria ser pulada"
    assert caps[0]["coberta"] is True, "C.6 Curva ABC tem resolver"
    print("PASS synthetic · folha-meta pulada · Mapa/Riscos/Índices preservados · narrativa Leitura IA retida (texto)")


def _real() -> None:
    if not FIX.exists():
        print(f"SKIP {FIX.name} (gitignored)")
        return
    caps = capturar_secoes(json.loads(FIX.read_text()))
    assert len(caps) >= 135, len(caps)  # recupera as 6 seções antes dropadas por falso-META
    n_cob = sum(1 for c in caps if c["coberta"])
    assert n_cob >= 20, n_cob
    titulos = [c["titulo"] for c in caps]
    for frag in ("C.14 Mapa da Obra", "D.9 Mapa de Riscos", "Índices de chuva", "D.10 Gerador de Claim — Quantificação"):
        assert any(frag in t for t in titulos), f"seção real ausente: {frag}"
    assert not any(t.strip().startswith(("MAPA —", "INSTRUÇÕES —")) for t in titulos), "folha-meta vazou no real"
    print(f"PASS real · {len(caps)} seções · {n_cob} cobertas · Mapa/Riscos/Índices/Claim recuperados · meta fora")


def run() -> None:
    _synthetic(); _real()


if __name__ == "__main__":
    run()
