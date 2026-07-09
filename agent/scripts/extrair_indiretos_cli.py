#!/usr/bin/env python3
"""CLI fino: lê `secoes` (JSON via stdin) → roda extrair_indiretos → imprime o
resultado (JSON) no stdout. Usado pela re-normalização da D.1 (renorm-indiretos.mjs),
que faz a I/O de banco via pooler e delega só o cálculo determinístico aqui."""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from agents.normalizacao.resolvers import extrair_indiretos  # noqa: E402

secoes = json.load(sys.stdin)
res = extrair_indiretos(secoes)
json.dump(res, sys.stdout, ensure_ascii=False)
