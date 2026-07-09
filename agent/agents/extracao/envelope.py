"""Envelope da extração · estrutura LEVE e auto-documentada (não 8 schemas
rígidos, não JSON 100% caótico). Um frame fixo pra todo doc; DENTRO das seções
o agente organiza com a inteligência dele (objetos/arrays de objetos/aninhamento).

Validado pelo `output_format` json_schema (smoke test confirmou: o CLI aceita
`additionalProperties`/objetos livres via OAuth).
"""

from __future__ import annotations

import re

EXTRACTION_SCHEMA_VERSION = "faithful@1.0.0"

# Limpeza de chave/nome de coluna no PONTO DE ESCRITA — pega QUALQUER caminho (override,
# escrita direta), não só o resolve_columns. _x000D_ = carriage-return XML escapado que o
# openpyxl não desconverte (cabeçalho multi-linha de planilha) → polui nome de coluna E
# chave de linha. \r/\xa0 idem. Espaços colapsados.
_KEY_DIRT = re.compile(r"(?:_x000D_|\r|\xa0|\s)+")


def _clean_key(s) -> str:
    """Higieniza um nome de coluna / chave de linha (não toca em VALOR)."""
    return _KEY_DIRT.sub(" ", str(s)).strip()


def _clean_dados(dados: dict) -> dict:
    """Limpa as CHAVES de um dict de seção chave_valor (não toca nos valores).
    Só reconstrói se alguma chave tem lixo, pra não realocar à toa."""
    if not any(("_x000D_" in str(k)) or ("\r" in str(k)) or ("\xa0" in str(k)) for k in dados):
        return dados
    return {_clean_key(k): v for k, v in dados.items()}

# ── Schema do envelope (frouxo de propósito) ───────────────────────────
# `output_format = {"type":"json_schema","schema": ENVELOPE_SCHEMA}`.
ENVELOPE_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "tipo_documento": {
            "type": "string",
            "description": "Tipo do documento (use o do texto-mapa, ex.: 'Boletim de Medição (BM)').",
        },
        "resumo": {
            "type": "string",
            "description": "1-2 frases: o que é o documento, partes, período.",
        },
        "identificacao": {
            "type": "object",
            "additionalProperties": True,
            "description": (
                "Cabeçalho/metadados que identificam o doc (número, período, contratante, "
                "contratada, datas, contrato…). OBJETO bem estruturado; chaves nos termos do doc; "
                "números como número, datas em ISO YYYY-MM-DD quando possível."
            ),
        },
        "secoes": {
            "type": "array",
            "description": (
                "Blocos do documento, na ordem natural. Cada seção tem titulo + tipo + fonte. "
                "tipo='tabela' → colunas[] + linhas[] (UM OBJETO por linha). "
                "tipo='chave_valor' → dados (objeto campo:valor). "
                "tipo='texto' → conteudo (narrativa literal)."
            ),
            "items": {
                "type": "object",
                "properties": {
                    "titulo": {"type": "string"},
                    "tipo": {"type": "string", "enum": ["tabela", "chave_valor", "texto"]},
                    "fonte": {
                        "type": "string",
                        "description": "Onde no doc: ex 'págs 2-5', \"sheet 'Itens' linhas 1-870\", 'pág 1'.",
                    },
                    "colunas": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Só p/ tabela · nomes das colunas como no documento.",
                    },
                    "linhas": {
                        "type": "array",
                        "items": {"type": "object", "additionalProperties": True},
                        "description": (
                            "Só p/ tabela · UM OBJETO por linha no formato {coluna: valor}. "
                            "NUNCA arrays posicionais. Números como número; aninhe o que for hierárquico."
                        ),
                    },
                    "dados": {
                        "type": "object",
                        "additionalProperties": True,
                        "description": "Só p/ chave_valor · pares campo:valor (números como número).",
                    },
                    "conteudo": {
                        "type": "string",
                        "description": "Só p/ texto · transcrição literal da narrativa.",
                    },
                },
                "required": ["titulo", "tipo", "fonte"],
                "additionalProperties": True,
            },
        },
        "totais_declarados": {
            "type": "object",
            "additionalProperties": True,
            "description": (
                "Totais/subtotais que o DOCUMENTO declara (não calcule você) — usados p/ conferência. "
                "Números como número."
            ),
        },
        "alertas_extracao": {
            "type": "array",
            "items": {"type": "string"},
            "description": (
                "Ambiguidades, ilegibilidades, campos ausentes, valores duvidosos, ou qualquer "
                "coisa que o revisor humano precisa saber. Liste o que NÃO conseguiu ler com certeza."
            ),
        },
    },
    "required": ["tipo_documento", "secoes", "alertas_extracao"],
    "additionalProperties": True,
}


# ── Criticidade (decide dupla-passada + reconciler) ────────────────────
# Críticos = onde o erro custa caro: Boletim de Medição, Medição Acumulada,
# Cronograma/MS Project (valores financeiros / base de pleito).
_CRITICAL_PATTERNS = [
    re.compile(r"medi[cç][aã]o\s*acumul", re.IGNORECASE),
    re.compile(r"\bboletim\s+de\s+medi[cç][aã]o\b", re.IGNORECASE),
    re.compile(r"\bBM[\s_-]?\d", re.IGNORECASE),
    re.compile(r"\bcronograma\b", re.IGNORECASE),
    re.compile(r"f[ií]sico.?financeiro", re.IGNORECASE),
    re.compile(r"\bcurva\s*s\b", re.IGNORECASE),
    re.compile(r"ms[\s_-]?project", re.IGNORECASE),
]


def is_critical(doc_type_text: str | None, filename: str) -> bool:
    """True se o doc é crítico (dupla-passada + reconciler). Baseado no tipo
    detectado pelo mapa + nome do arquivo (NFC p/ acentos do macOS)."""
    hay = f"{doc_type_text or ''} {filename}".strip()
    try:
        hay = hay.encode("utf-8").decode("utf-8")
    except Exception:  # noqa: BLE001
        pass
    import unicodedata

    hay = unicodedata.normalize("NFC", hay)
    return any(p.search(hay) for p in _CRITICAL_PATTERNS)


# ── Validação do envelope montado ──────────────────────────────────────
def validate_envelope(payload: dict) -> list[str]:
    """Valida o envelope montado contra ENVELOPE_SCHEMA. Retorna a lista de
    mensagens de erro (vazia = válido). Usado no `finalizar_extracao` e no runner
    — substitui a validação que o `output_format` fazia, agora que montamos o
    envelope incrementalmente pelas tools (pra não estourar o teto de saída)."""
    try:
        import jsonschema
    except ImportError:  # jsonschema é dep do projeto · ausência NÃO é "válido"
        return ["jsonschema não instalado — não foi possível validar o envelope"]
    try:
        validator = jsonschema.Draft7Validator(ENVELOPE_SCHEMA)
        errs = []
        for e in sorted(validator.iter_errors(payload), key=lambda e: list(e.path)):
            loc = "/".join(str(p) for p in e.path) or "(raiz)"
            errs.append(f"{loc}: {e.message}")
        return errs[:20]
    except Exception as exc:  # noqa: BLE001
        return [f"validação falhou: {type(exc).__name__}: {exc}"]


# ── EnvelopeBuilder · montagem incremental via tools ───────────────────
# Em vez de devolver o envelope INTEIRO num único structured_output (que estoura
# o orçamento de tokens de SAÍDA do modelo em docs tabulares — ver auditoria:
# Cronograma exigiu 54k+ tokens e truncou), o modelo monta o envelope chamando
# tools que ACUMULAM aqui (linhas em lotes). Bounded por chamada, checkpoint
# natural, sem perda de contexto entre fatias. Um builder por documento;
# compartilhado entre N chamadas query() quando o doc é fatiado (slices).
class EnvelopeBuilder:
    _TIPOS = ("tabela", "chave_valor", "texto")

    def __init__(self) -> None:
        self.tipo_documento: str | None = None
        self.resumo: str | None = None
        self.identificacao: dict = {}
        self.totais_declarados: dict = {}
        self.alertas: list[str] = []
        self._secoes: dict[str, dict] = {}  # secao_id -> dict (ordem de inserção)
        # ORDEM DETERMINÍSTICA sob paralelização: cada seção carrega (_scope, _seq). Sob asyncio.gather
        # a ordem de INSERÇÃO vira a de CONCLUSÃO (não-determinística) — ordenar por (scope_da_fatia,
        # seq_global) no build() reproduz EXATAMENTE a ordem sequencial. _seq é atômico (open_secao é
        # síncrono → sem corrida). Em modo sequencial o sort é no-op (ordena == inserção).
        self._open_seq = 0
        self._documento_set = False
        self.finalized = False
        # Motivos que FORÇAM needs_review (ex.: fórmula sem valor em cache na
        # ingestão) — o runner os adiciona às review_reasons. Nunca "extracted" calado.
        self.force_review: list[str] = []
        # Intervalos REALMENTE ingeridos por código (aba → linhas), independentes do que o
        # modelo escreveu em `fonte` — insumo preciso do gate de cobertura célula-a-célula.
        self.ingested_ranges: dict[str, set[int]] = {}

    def track_ingestao(self, sheet: str, header_row: int | None, de: int, ate: int) -> None:
        linhas = self.ingested_ranges.setdefault(str(sheet), set())
        if header_row:
            linhas.add(int(header_row))
        linhas.update(range(int(de), int(ate) + 1))

    def flag_review(self, reason: str) -> None:
        r = str(reason).strip()
        if r and r not in self.force_review:
            self.force_review.append(r)

    # — frame —
    def set_documento(self, *, tipo_documento=None, resumo=None, identificacao=None, totais_declarados=None) -> None:  # noqa: ANN001
        if tipo_documento:
            self.tipo_documento = str(tipo_documento)
        if resumo:
            self.resumo = str(resumo)
        # Limpa as CHAVES (não os valores) — cabeçalho Excel multi-linha vaza '_x000D_'
        # ('Total Geral_x000D_') e aí _check_sums não casa o total → conferência pulada.
        if isinstance(identificacao, dict):
            self.identificacao.update(_clean_dados(identificacao))
        if isinstance(totais_declarados, dict):
            self.totais_declarados.update(_clean_dados(totais_declarados))
        self._documento_set = True

    # — seções —
    def open_secao(self, secao_id, titulo, tipo, fonte, *, colunas=None, dados=None, conteudo=None, scope_order=0) -> dict:  # noqa: ANN001
        sid = str(secao_id)
        if tipo not in self._TIPOS:
            raise ValueError(f"tipo inválido '{tipo}' (use {self._TIPOS})")
        if colunas is not None and not isinstance(colunas, list):
            raise ValueError("'colunas' deve ser uma lista de strings")
        sec = self._secoes.get(sid)
        if sec is None:
            sec = {"_id": sid, "_scope": scope_order, "_seq": self._open_seq,
                   "titulo": str(titulo), "tipo": tipo, "fonte": str(fonte)}
            self._open_seq += 1
            if tipo == "tabela":
                sec["colunas"] = [_clean_key(c) for c in (colunas or [])]
                sec["linhas"] = []
            self._secoes[sid] = sec
        else:  # reabrir NÃO apaga linhas; e NÃO troca o tipo (evitaria envelope corrompido)
            # COLISÃO sob concorrência: secao_id reaberto por OUTRA fatia = merge de sheets distintos →
            # fail-loud (o roteamento por código pode pegar a seção fundida errada). Mesma fatia = ok.
            if sec.get("_scope") != scope_order:
                self.flag_review(
                    f"secao_id '{sid}' aberto por 2 fatias concorrentes (scope {sec.get('_scope')}≠{scope_order}) "
                    "— possível merge de sheets distintos, conferir")
            if sec.get("tipo") != tipo:
                raise ValueError(
                    f"seção '{sid}' já é '{sec.get('tipo')}'; não troque pra '{tipo}' (use outro secao_id)"
                )
            if titulo:
                sec["titulo"] = str(titulo)
            if fonte:
                sec["fonte"] = str(fonte)
            if tipo == "tabela" and colunas:
                # UNIÃO preservando ordem — não clobbera as colunas de fatias anteriores
                merged = list(sec.get("colunas") or [])
                for c in colunas:
                    ck = _clean_key(c)
                    if ck not in merged:
                        merged.append(ck)
                sec["colunas"] = merged
                sec.setdefault("linhas", [])
        if tipo == "chave_valor" and isinstance(dados, dict):
            sec["dados"] = {**sec.get("dados", {}), **_clean_dados(dados)}
        if tipo == "texto" and conteudo is not None:
            sec["conteudo"] = (sec.get("conteudo") or "") + str(conteudo)
        return sec

    def get_colunas(self, secao_id) -> list | None:  # noqa: ANN001
        """Colunas canônicas de uma seção tabela já aberta (None se nova/inexistente).
        Usado pela ingestão de PDF multipágina pra REUSAR as colunas da 1ª página nas
        seguintes (o cabeçalho repetido das próximas páginas costuma vir mesclado com
        dados pelo find_tables → não pode criar colunas novas/garbled)."""
        sec = self._secoes.get(str(secao_id))
        if sec and sec.get("tipo") == "tabela":
            cols = sec.get("colunas")
            return list(cols) if cols else None
        return None

    def append_linhas(self, secao_id, linhas) -> int:  # noqa: ANN001
        sid = str(secao_id)
        sec = self._secoes.get(sid)
        if sec is None:
            raise KeyError(f"seção '{sid}' não existe — chame abrir_secao antes")
        if sec.get("tipo") != "tabela":
            raise ValueError(f"seção '{sid}' não é do tipo 'tabela'")
        if not isinstance(linhas, list):
            raise ValueError("'linhas' deve ser uma lista de objetos {coluna: valor}")
        # Falha em vez de DESCARTAR silenciosamente linha malformada (perda de dado).
        if not all(isinstance(r, dict) for r in linhas):
            raise ValueError("cada item de 'linhas' deve ser um objeto {coluna: valor} (não array/string/null)")
        # Higieniza as CHAVES de cada linha (_x000D_/CR/espaços) — só a chave, nunca o valor.
        limpas = []
        for r in linhas:
            if any(("_x000D_" in str(k)) or ("\r" in str(k)) or ("\xa0" in str(k)) for k in r):
                limpas.append({_clean_key(k): v for k, v in r.items()})
            else:
                limpas.append(r)
        sec.setdefault("linhas", []).extend(limpas)
        return len(sec["linhas"])

    def set_dados(self, secao_id, dados) -> int:  # noqa: ANN001
        sec = self._secoes.get(str(secao_id))
        if sec is None:
            raise KeyError(f"seção '{secao_id}' não existe")
        if not isinstance(dados, dict):
            raise ValueError("'dados' deve ser um objeto campo:valor")
        sec["dados"] = {**sec.get("dados", {}), **_clean_dados(dados)}
        return len(sec["dados"])

    def set_conteudo(self, secao_id, conteudo) -> int:  # noqa: ANN001
        sec = self._secoes.get(str(secao_id))
        if sec is None:
            raise KeyError(f"seção '{secao_id}' não existe")
        sec["conteudo"] = (sec.get("conteudo") or "") + str(conteudo)
        return len(sec["conteudo"])

    def add_alerta(self, texto) -> int:  # noqa: ANN001
        t = str(texto).strip()
        if t:
            self.alertas.append(t)
        return len(self.alertas)

    # — leitura —
    def count_linhas(self) -> int:
        return sum(len(s.get("linhas", [])) for s in self._secoes.values() if s.get("tipo") == "tabela")

    def is_empty(self) -> bool:
        return not self._documento_set and not self._secoes

    def has_data(self) -> bool:
        """Tem dado REAL (não só seções vazias de placeholder)."""
        if self.count_linhas() > 0:
            return True
        return any(
            (s.get("tipo") == "chave_valor" and s.get("dados"))
            or (s.get("tipo") == "texto" and (s.get("conteudo") or "").strip())
            for s in self._secoes.values()
        )

    def build(self) -> dict:
        # ORDEM DETERMINÍSTICA: sorteia por (scope_da_fatia, seq) → sob asyncio.gather o envelope é
        # byte-idêntico ao sequencial (a ordem de seção importa: resolvers que pegam "a 1ª que casa").
        # Sequencial: o sort é no-op (já inserido nessa ordem). Tira os metadados internos _scope/_seq.
        ordenadas = sorted(self._secoes.values(), key=lambda s: (s.get("_scope", 0), s.get("_seq", 0)))
        secoes = [{k: v for k, v in s.items() if k not in ("_id", "_scope", "_seq")} for s in ordenadas]
        payload: dict = {
            "tipo_documento": self.tipo_documento or "Documento",
            "secoes": secoes,
            "alertas_extracao": list(self.alertas),
        }
        if self.resumo:
            payload["resumo"] = self.resumo
        if self.identificacao:
            payload["identificacao"] = self.identificacao
        if self.totais_declarados:
            payload["totais_declarados"] = self.totais_declarados
        # Serializa os intervalos INGERIDOS deterministicamente (ingerir_planilha) → o gate de cobertura
        # CLI/auditoria pode creditá-los SEM ter o builder (runtime usa self.ingested_ranges direto). Sem
        # isto o gate standalone super-conta as linhas-fonte ingeridas como órfãs (era o "14.881" do verify).
        if self.ingested_ranges:
            # Chaves (abas) ORDENADAS: sob asyncio.gather a ordem de REGISTRO das ingestões varia entre
            # fatias; ordenar deixa o _ingestao byte-idêntico ao sequencial (o gate itera, não depende
            # da ordem — mas a serialização determinística importa p/ hash/diff a jusante).
            payload["_ingestao"] = {aba: sorted(self.ingested_ranges[aba]) for aba in sorted(self.ingested_ranges)}
        return payload
