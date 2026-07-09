"""Normalização (Camada A · factual) — envelope JSON da extração → entidades canônicas cruas.

3ª etapa da pipeline (Cadastro → Mapeamento → Extração → NORMALIZAÇÃO → módulos).
Determinística, falha-alto. Grava só FATO atômico (número/data/id); label/farol/narrativa
são camada de view (front). Ver docs/09-normalizacao.md.
"""
