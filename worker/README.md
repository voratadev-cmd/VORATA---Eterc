# worker/ · tooling de migrations

> O pipeline de **mapeamento + extração** dos documentos da obra vive em **`agent/`**
> (Python · claude-agent-sdk). O antigo worker TS deste diretório foi **removido**
> (estava duplicado, consumia a MESMA fila do Supabase → risco de dupla-pega, e os
> schemas de domínio por-tipo — BM/RDO/Medição/… — foram portados para
> `agent/agents/extracao/doc_schemas.py`).

Sobrou aqui só o que ainda é usado: os **scripts de migration** do Supabase.

## Aplicar / verificar uma migration

```bash
cd worker && npm i pg --no-save   # uma vez

SUPABASE_DB_URL='postgresql://postgres.<ref>:<SENHA>@aws-0-us-east-1.pooler.supabase.com:5432/postgres' \
  node scripts/apply-migration.mjs ../supabase/migrations/<arquivo>.sql

# conferir:
SUPABASE_DB_URL='...' node scripts/verify-migration.mjs
```

Migrations são idempotentes (`if not exists` / `drop ... if exists`). Detalhes de
conexão (Session pooler IPv4, prefixo `aws-1`, porta 5432) no `CLAUDE.md`.
