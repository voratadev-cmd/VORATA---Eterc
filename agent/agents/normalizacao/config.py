"""Schema da CONFIG declarativa da normalização factual (Camada A).

A config é DADO, não código: mapeia colunas do envelope → campos canônicos atômicos.
Versionada (config@x.y.z), validada por pydantic. As 3 PROIBIÇÕES DURAS estão embutidas
no schema — não há onde escrever lógica:

  1. SEM if/condicional/aritmética inline — todo transform é um RESOLVER NOMEADO (str que
     aponta resolvers.py) ou um eixo/perfil TIPADO. O schema não tem campo de "expressão".
     Pin: se você se pega "debugando a config", ela apodreceu — mova pro resolver.
  2. ALIAS-SET é (eixo_período × eixo_grandeza), não dicionário plano — o BM é uma MATRIZ:
     no BM-03 real, 'Valor (R$) no Período' vs 'Valor (R$) acumulado no Período' vs
     'Custo Total' são a MESMA grandeza (valor) em 3 eixos (período/acumulado/contratado).
  3. O "caminho" é um SELETOR ROBUSTO (seção por tipo+papel; coluna por alias normalizado +
     perfil-de-conteúdo de fallback), NUNCA chave-literal — a chave de coluna não é estável
     (col_N, sufixo _2/_3, _x000D_ — ver cells.py/envelope.py).

O conteúdo (quais aliases) é deliberadamente NÃO-travado aqui — depende de ver o 2º projeto.
Este arquivo trava só a GRAMÁTICA do que uma config pode dizer.
"""

from __future__ import annotations

import re
from enum import Enum

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

_CONFIG_VERSION_RE = re.compile(r"^config@\d+\.\d+\.\d+$")


class Perfil(str, Enum):
    """Perfil de CONTEÚDO da coluna — usado no fallback de casamento (quando o alias não
    casa, confere se os VALORES batem o perfil) e na validação do valor extraído."""

    CODIGO_DOTTED = "codigo_dotted"   # '1.1.1' — EDT/EAP (string verbatim, preserva zero)
    MONETARIO = "monetario"           # R$ — numérico
    QUANTIDADE = "quantidade"         # numérico (qtd medida/contratada)
    PRECO = "preco"                   # numérico (preço unitário)
    PERCENTUAL = "percentual"         # fração 0..1 (NÃO '15,99%' string)
    TEXTO = "texto"                   # descrição livre
    UNIDADE = "unidade"               # 'm³','kg','conj.' — string curta
    DATA = "data"                     # ISO


class Periodo(str, Enum):
    """Eixo temporal do dado (o BM traz a mesma grandeza em vários eixos)."""

    CONTRATADO = "contratado"   # previsto/orçado (ex.: 'Custo Total', 'Custo Unitário')
    PERIODO = "periodo"         # realizado no mês deste BM (ex.: 'Valor (R$) no Período')
    ACUMULADO = "acumulado"     # realizado acumulado até o BM


class Grandeza(str, Enum):
    VALOR = "valor"
    QUANTIDADE = "quantidade"
    PRECO_UNITARIO = "preco_unitario"
    PERCENTUAL = "percentual"


class Papel(str, Enum):
    """Papel da SEÇÃO no documento — o seletor de seção casa por (tipo_doc + papel),
    não por título/id literal (que varia entre docs/projetos)."""

    TABELA_MEDICAO = "tabela_medicao"   # a tabela de itens medidos (a fatia-1)
    CRONOGRAMA = "cronograma"           # tabela transposta de avanço (Camada B · unpivot)
    IDENTIFICACAO = "identificacao"     # chave_valor de cabeçalho (nº BM, datas, contrato)


class Role(str, Enum):
    DIMENSAO = "dimensao"   # identifica a linha (numero_item, descricao, unidade)
    MEDIDA = "medida"       # valor numérico num eixo (precisa de `eixo`)


class Eixo(BaseModel):
    """(período × grandeza) — desambigua qual das N colunas de 'valor' é qual."""

    model_config = ConfigDict(extra="forbid")
    periodo: Periodo
    grandeza: Grandeza


class ColunaSelector(BaseModel):
    """SELETOR de coluna robusto: alias-set (nomes normalizados) + perfil de conteúdo de
    fallback. NUNCA uma chave-literal."""

    model_config = ConfigDict(extra="forbid")
    alias_set: list[str]            # ['Valor (R$) no Período', 'Vlr Medido', 'Valor Medido']
    perfil: Perfil

    @field_validator("alias_set")
    @classmethod
    def _alias_nao_vazio(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("alias_set não pode ser vazio — uma coluna precisa de ≥1 alias")
        return v


class CampoMap(BaseModel):
    """Mapeia UM campo canônico (= coluna do DDL) ← coluna do envelope. Sem expressão:
    o transform é o `eixo`/`perfil` tipado, ou um `resolver` nomeado."""

    model_config = ConfigDict(extra="forbid")
    canonico: str                   # nome da coluna canônica (ex.: 'valor_medido_periodo')
    coluna: ColunaSelector
    role: Role
    eixo: Eixo | None = None        # obrigatório se role=MEDIDA; proibido se DIMENSAO
    resolver: str | None = None     # nome de resolver em resolvers.py (ex.: 'parse_edt')

    @model_validator(mode="after")
    def _eixo_coerente_com_role(self) -> CampoMap:
        if self.role is Role.MEDIDA and self.eixo is None:
            raise ValueError(f"campo MEDIDA '{self.canonico}' precisa de `eixo` (período×grandeza)")
        if self.role is Role.DIMENSAO and self.eixo is not None:
            raise ValueError(f"campo DIMENSAO '{self.canonico}' não pode ter `eixo`")
        return self


class SecaoSelector(BaseModel):
    """Acha a seção-alvo por TIPO+PAPEL, não por título/id literal."""

    model_config = ConfigDict(extra="forbid")
    papel: Papel
    # resolver de região: nomeado, roda quando a seção precisa ser localizada/recortada
    # (header em linha N, 2 sub-grades empilhadas). Default None = a seção já é limpa.
    localizar_regiao: str | None = None


class EntidadeMap(BaseModel):
    """Mapeia uma SEÇÃO do envelope → uma ENTIDADE canônica (tabela)."""

    model_config = ConfigDict(extra="forbid")
    entidade: str                   # 'obra_medicao_itens' | 'obra_medicao_totais'
    seletor_secao: SecaoSelector
    campos: list[CampoMap] = []
    # resolvers nomeados que rodam SOBRE a entidade montada (ordem importa):
    # ex.: 'rollup_hierarquico' (confere pai=Σfilhos), 'resolver_competencia' (chave).
    resolvers: list[str] = []

    @field_validator("campos")
    @classmethod
    def _sem_canonico_duplicado(cls, v: list[CampoMap]) -> list[CampoMap]:
        nomes = [c.canonico for c in v]
        dup = {n for n in nomes if nomes.count(n) > 1}
        if dup:
            raise ValueError(f"campo canônico duplicado: {sorted(dup)}")
        return v


class CodigosRaiz(BaseModel):
    """Códigos-raiz da EAP/EDT — DADO que varia por obra (orçamentos/cronogramas distintos), não
    lógica. Defaults = Sorriso (a obra-teste). Parametrizado pra obra #2 não precisar EDITAR código:
    se a codificação dela difere, é só declarar na config (falha-loud vira config declarativa)."""

    model_config = ConfigDict(extra="forbid")
    orcamento_custo: str = "001"     # raiz de custo (direto+indireto) no resumo de Atividades
    orcamento_receita: str = "003"   # raiz de receita
    edt_raiz: str = "1"              # linha roll-up das curvas temporais (unpivot modo='raiz')
    edt_key: str = "EDT"             # nome da coluna do código EDT nas tabelas temporais


class NormConfig(BaseModel):
    """A config completa de um tipo de doc. Versionada e validada."""

    model_config = ConfigDict(extra="forbid")
    config_version: str             # 'config@1.0.0'
    doc_types: list[str]            # padrões de doc_type que esta config atende (substring)
    entidades: list[EntidadeMap]
    # códigos-raiz da EAP (variam por obra) — defaults Sorriso; obra #2 sobrescreve na config.
    codigos_raiz: CodigosRaiz = CodigosRaiz()

    @field_validator("config_version")
    @classmethod
    def _versao_valida(cls, v: str) -> str:
        if not _CONFIG_VERSION_RE.match(v):
            raise ValueError(f"config_version inválida '{v}' — use 'config@MAJOR.MINOR.PATCH'")
        return v

    @field_validator("doc_types")
    @classmethod
    def _doc_types_nao_vazio(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("doc_types não pode ser vazio")
        return v


def load_config(data: dict) -> NormConfig:
    """Valida um dict (de YAML/JSON) contra o schema. Erro de schema = config malformada,
    falha-alto ANTES de tocar qualquer dado."""
    return NormConfig.model_validate(data)
