# Fixtures do golden-test (não-versionados)

Os `*.json` deste diretório são **envelopes REAIS** da extração (dado de cliente — contém
CNPJ/CPF e valores contratuais). Por isso são **gitignored** (`*.json`) — git history é
permanente e não se apaga fácil. Decisão de LGPD pendente (sanitizar vs manter local).

O golden-test (`test_fatia1.py`) precisa deles localmente. Para **regenerar**:

1. Tenha o `worker/node_modules` com `pg` (`cd worker && npm i pg --no-save`).
2. Conexão = session pooler IPv4 da vorata (ver `CLAUDE.md` · senha do banco vem na hora):

```
DB_URL='postgresql://postgres.<ref>:<SENHA>@aws-1-us-east-1.pooler.supabase.com:5432/postgres' \
NODE_PATH="$PWD/worker/node_modules" node <<'JS'
const pg = require('pg'); const fs = require('fs')
;(async () => {
  const c = new pg.Client({ connectionString: process.env.DB_URL, ssl: { rejectUnauthorized: false } })
  await c.connect()
  const obra = '5dd81834-f02c-4f34-8b7d-c186883acd75' // Aeroporto Sorriso (teste real)
  const rows = (await c.query(`
    select oa.nome_original, e.payload from obra_arquivos oa
    join lateral (select payload from obra_arquivo_extracoes ex where ex.arquivo_id=oa.id order by version desc limit 1) e on true
    where oa.obra_id=$1 and oa.nome_original ilike '%BM 03%'`, [obra])).rows
  for (const r of rows) fs.writeFileSync('BM_03_SBSO_pdf.json', JSON.stringify(r.payload, null, 1))
  await c.end(); console.log('ok')
})()
JS
```

O ground-truth do `BM_03_SBSO_pdf.json`: `totalMesValor = 6.353.552` (o golden assere por valor).
