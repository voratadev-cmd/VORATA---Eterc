"""GUIA → CONTRATO (Passo 4) · lê a aba-META "Guia da IA" do envelope e produz o CONTRATO da obra:
a partição autoritativa que diz, por seção, se ela é ATÔMICA (precisa resolver/extração), DERIVADA
(recompute na Camada B · sem resolver) ou META (índice/catálogo · não é dado de obra) — mais as
ÂNCORAS de conservação (Saídas-chave) e o GRAFO de dependências (Lê-de / Alimenta).

Forma CERTA (da validação adversarial): isto é BUILD-TIME + um GATE DE COBERTURA — NÃO um engine de
runtime que roteia dado. O roteamento continua ESTRUTURAL (robusto a Guia ruidoso); o contrato:
  (1) me diz, na autoria, qual engine cada seção precisa (atômica) ou que ela não precisa (derivada);
  (2) vira gate de cobertura — toda ATÔMICA que o Guia declara e não foi roteada → needs_review
      (mata a omissão silenciosa por rename de título · o pior modo de falha).

Nuance crítica da classificação (descoberta no BR-101): "Inputs amarelo: Não (deriva)" NÃO é igual a
"pular" — a C.1 BDI Detalhe é "Não deriva" mas é a FONTE-MÃE (PV/BDI). O discriminador é Tipo +
Inputs + Instrução JUNTOS: Base★/Detalhe★/Auxiliar = SEMPRE fonte atômica (mesmo "Não deriva").
"""

from __future__ import annotations

import re

from .resolvers import _norm_key, _num_limpo

_COLS_GUIA = ("aba", "tipo", "finalidade", "inputs", "saidas", "le de", "alimenta", "instrucao")
# marcadores de DERIVADA na Instrução (a tela só LÊ de outras — recompute, não extração)
_DERIV_MARK = ("deriva", "nao editar", "não editar", "e leitura", "é leitura",
               "sao puxad", "são puxad", "puxado", "puxa de", "nao edita")
# Tipos que são FONTE atômica mesmo quando "Inputs: Não (deriva)" (têm o dado-motor)
_TIPO_FONTE = ("base", "detalhe", "auxiliar")
_TIPO_META = ("indice", "índice", "cadastro")


def _col(cols, *needles):  # noqa: ANN001
    """Acha a coluna do Guia cujo nome normalizado contém algum needle."""
    for c in cols:
        nk = _norm_key(str(c))
        if any(_norm_key(n) in nk for n in needles):
            return c
    return None


def _achar_guia(secoes: list[dict]) -> dict | None:
    """A aba 'Guia da IA' — ESTRUTURAL: colunas Aba + Tipo + Finalidade + 'Lê de' + Alimenta."""
    for s in secoes:
        if not isinstance(s, dict):
            continue
        cols = s.get("colunas") or []
        if (_col(cols, "aba") and _col(cols, "tipo") and _col(cols, "finalidade")
                and _col(cols, "le de", "lê de") and _col(cols, "alimenta")):
            return s
    return None


def _classe(tipo: str, inputs: str, instrucao: str) -> str:
    """ATÔMICA · DERIVADA · META — partição autoritativa (Tipo + Inputs + Instrução)."""
    t, inp, ins = _norm_key(tipo), _norm_key(inputs), _norm_key(instrucao)
    if any(m in t for m in ("indice", "cadastro")):
        return "meta"
    if any(m in t for m in _TIPO_FONTE):           # Base/Detalhe/Auxiliar = fonte, mesmo "Não deriva"
        return "atomica"
    # Tela: derivada se declara que só lê/deriva; senão atômica (tem input real a extrair)
    if "nao (deriva)" in inp or "nao(deriva)" in inp or any(m in ins for m in _DERIV_MARK):
        return "derivada"
    return "atomica"


def _parse_lista(v: str) -> list[str]:
    """'Lê de / Alimenta' → lista de abas (split por vírgula; descarta 'folha-fim'/'—')."""
    if not v:
        return []
    partes = [p.strip() for p in re.split(r"[·,]", str(v))]
    return [p for p in partes if p and "folha-fim" not in p.lower() and p not in ("—", "-")]


# âncora COM unidade (611,4M · 29,75%). Exige a unidade pra NÃO pegar refs de célula (B4, G11, C24).
_ANCORA_UNIT = re.compile(r"([\d][\d.,]*)\s*(M|mi|%)", re.I)
_NUM_RE = re.compile(r"[\d][\d.,]*")


def _parse_ancoras(saidas: str) -> list[dict]:
    """Saídas-chave → âncoras de conservação. 'B4=PV 611,4M · B5=BDI 29,75%' → [{rotulo, valor, un}].
    Pula refs de célula (B4, G11): exige UNIDADE (M/%) ou número grande (≥1000). Valores são
    ARREDONDADOS no Guia (cross-check com tolerância, não ao centavo)."""
    out: list[dict] = []
    if not saidas:
        return out
    for parte in re.split(r"[·]", str(saidas)):
        rotulo = parte.strip()[:60]
        m = _ANCORA_UNIT.search(parte)
        if m:
            base = _num_limpo(m.group(1))
            un = m.group(2).lower()
            if isinstance(base, float):
                if un in ("m", "mi"):
                    out.append({"rotulo": rotulo, "valor": base * 1e6, "unidade": "rs"})
                else:
                    out.append({"rotulo": rotulo, "valor": base / 100.0, "unidade": "fracao"})
            continue
        # sem unidade: só aceita número GRANDE (≥1000) — descarta refs de célula (B4→4, B5→5)
        for nm in _NUM_RE.findall(parte):
            base = _num_limpo(nm)
            if isinstance(base, float) and abs(base) >= 1000:
                out.append({"rotulo": rotulo, "valor": base, "unidade": "abs"})
                break
    return out


def parse_guia_contrato(secoes: list[dict]) -> dict:
    """Contrato da obra a partir da aba 'Guia da IA'. Retorna {abas:[...], resumo, grafo, status}.
    Cada aba: {aba, modulo, tipo, classe, finalidade, ancoras, le_de, alimenta, instrucao}."""
    g = _achar_guia(secoes)
    if g is None:
        return {"abas": [], "resumo": {}, "grafo": {}, "status": "sem_guia",
                "findings": [{"severity": "warn", "campo": "guia",
                              "msg": "aba 'Guia da IA' não encontrada — sem contrato (cobertura não checável)"}]}
    cols = g.get("colunas") or []
    c = {k: _col(cols, *ns) for k, ns in {
        "aba": ("aba",), "mod": ("modulo", "módulo"), "tipo": ("tipo",), "fin": ("finalidade",),
        "inp": ("inputs",), "sai": ("saidas", "saídas"), "le": ("le de", "lê de"),
        "ali": ("alimenta",), "ins": ("instrucao", "instrução"),
    }.items()}
    abas: list[dict] = []
    grafo: dict[str, list[str]] = {}
    for r in (g.get("linhas") or []):
        if not isinstance(r, dict):
            continue
        aba = str(r.get(c["aba"]) or "").strip()
        if not aba or aba.startswith("col_"):
            continue
        tipo = str(r.get(c["tipo"]) or "")
        inputs = str(r.get(c["inp"]) or "")
        instrucao = str(r.get(c["ins"]) or "")
        le_de = _parse_lista(r.get(c["le"]))
        alimenta = _parse_lista(r.get(c["ali"]))
        entry = {
            "aba": aba, "modulo": str(r.get(c["mod"]) or "").strip(), "tipo": tipo.strip(),
            "classe": _classe(tipo, inputs, instrucao),
            "finalidade": str(r.get(c["fin"]) or "").strip(),
            "ancoras": _parse_ancoras(r.get(c["sai"])),
            "le_de": le_de, "alimenta": alimenta,
            "instrucao": instrucao.strip()[:200],
        }
        abas.append(entry)
        grafo[aba] = alimenta
    resumo = {cl: sum(1 for a in abas if a["classe"] == cl) for cl in ("atomica", "derivada", "meta")}
    return {"abas": abas, "resumo": resumo, "grafo": grafo,
            "status": "ok" if abas else "vazio", "findings": []}


_CODIGO_RE = re.compile(r"([A-Za-z]+)[._ ]?(\d+(?:\.\d+)?)")


def _codigo_aba(aba: str) -> str | None:
    """Código curto da aba p/ casar com o título roteado. 'C.6 Insumos'→'c.6' · 'auxiliar_C.4 MOD
    Detalhe'→'c.4' · 'D.1 Indiretos'→'d.1'. None se a aba não tem código (ex.: 'Matriz de Riscos')."""
    m = _CODIGO_RE.search(aba)
    return f"{m.group(1).lower()}.{m.group(2)}" if m else None


def cobertura_atomica(contrato: dict, titulos_roteados: list[str]) -> dict:
    """GATE DE COBERTURA (o valor de runtime do contrato): das abas ATÔMICAS que o Guia declara,
    quais foram roteadas (algum título roteado contém o código da aba) e quais FALTAM. Numa obra
    completa, `pendente` não-vazio = seção que o Guia esperava mas o splitter não achou (rename de
    título / sumiço) → o caller marca needs_review. Mata a omissão silenciosa (pior modo de falha).
    Coberta por CÓDIGO (c.4 cobre C.4 Recursos + os auxiliares C.4) — granularidade de área."""
    rot = [str(t).lower() for t in titulos_roteados]
    coberto: list[str] = []
    pendente: list[str] = []
    for a in contrato.get("abas", []):
        if a["classe"] != "atomica":
            continue
        cod = _codigo_aba(a["aba"])
        achou = bool(cod) and any(cod in t for t in rot)
        (coberto if achou else pendente).append(a["aba"])
    return {"coberto": coberto, "pendente": pendente, "n_atomica": len(coberto) + len(pendente)}
