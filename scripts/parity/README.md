# Gate de paridade · chat × tela × oráculo

Garante que o **chat** (agente Python, `agent/agents/adm_contratual/tools.py`) responde os **mesmos
números** que as **telas** (read-models TS, `src/lib/supabase/*.ts`) — e que esses números batem com o
**oráculo** (a verdade: valor declarado no workbook / valor validado). Nasceu depois do bug do D.0
(chat dizia 11,5mi, tela 6,34mi, fonte 6,29mi — três fórmulas diferentes do mesmo número).

## Por que existe

A mesma grandeza é calculada em **dois lugares, duas linguagens, sobre o mesmo banco**. Sem um gate,
elas divergem silenciosamente toda vez que uma tela é refinada e o Python não acompanha. O gate torna a
divergência **visível e barrável**.

São **duas garantias** distintas:

- **Consistência** — `chat == tela` (o usuário do chat vê o mesmo da tela).
- **Correção** — `chat == oráculo` (o número é o verdadeiro; consistência sozinha pode estar errada junto).

## Como roda

```bash
scripts/parity/run.sh            # BR-101 (default)
scripts/parity/run.sh <obra_id>  # outra obra
```

Passo a passo (o que `run.sh` faz):

1. **lado chat** — `docker compose exec api python scripts/parity_chat.py <id>` no Droplet → chama cada
   tool isolada (sem LLM) → `chat_<obra>.json`.
2. **lado tela** — `bun run scripts/parity/parity_tela.ts <id>` → roda cada probe (`probes/<tool>.ts`,
   cada um chama o read-model real) → `tela_<obra>.json`.
3. **scorecard** — `node scripts/parity/parity_gate.mjs` → junta com `anchors.json` (âncora + oráculo
   por domínio) e imprime a tabela. **Sai !=0 em qualquer divergência** (CI / pré-deploy).

## Arquivos

| arquivo                              | papel                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| `../../agent/scripts/parity_chat.py` | runner do lado chat (roda no container)                                        |
| `parity_tela.ts`                     | runner do lado tela (bun; importa os probes)                                   |
| `probes/<tool>.ts`                   | 1 por domínio: `telaValue(id)` devolve a âncora do read-model                  |
| `anchors.json`                       | por domínio: `chat_path`, `oracle`, `tela_mult` (normaliza unidade), `numeric` |
| `manifest.json`                      | mapa completo (campo-âncora ↔ read-model ↔ oráculo + suspeitas)                |
| `parity_gate.mjs`                    | orquestrador + veredito                                                        |

`chat_*.json` / `tela_*.json` são **regenerados** a cada run (não versionados).

## Fase B · fonte única (`obra_kpis`)

Para os headlines de maior aposta, o chat **não re-deriva mais** — ele LÊ o canônico de `obra_kpis`:

1. `scripts/persist_kpis.ts` roda os read-models das telas e grava o headline de cada domínio em
   `public.obra_kpis` (1 linha por `contrato_id, kpi_key`). **Escreve via pooler** (a tela é a autoridade
   da fórmula; o motor não re-implementa nada).
   ```bash
   SUPABASE_DB_URL='postgresql://…pooler…:5432/postgres' bun run scripts/persist_kpis.ts [obra_id]
   ```
2. As tools do chat (`tools.py`) são embrulhadas por `_pin_tool` (mapa `_CANON_FIELD`): o campo-headline é
   **fixado** ao valor de `obra_kpis` → chat == tela por construção. Fallback = computação própria se a
   chave ainda não existe (best-effort, nunca quebra). `obra_kpis` precisa de `grant ... to service_role`
   (o chat lê via service key).
3. **Rodar `persist_kpis` após mudar um read-model** (ou na pipeline de deploy) — senão o chat lê canônico
   _stale_. O gate **pega** isso: ele NÃO persiste antes de checar, então `chat(stale) ≠ tela(atual)` → vermelho.

Hoje pinados (top-level escalar): desequilíbrio, faturamento, indiretos, BDI-deseq, insumos, excedente,
BDI-buildup, curvas, mapa, marcos (×2), curva física, panorama, chuvas. Aninhados (encargos/VA/pontuais/
recursos) seguem na computação própria + gate até serem portados.

## Cobertura (honesta)

- **21 domínios numéricos** cobertos (1 âncora por domínio). Domínios qualitativos (busca, condutas,
  plano de ação, orçamento pendente na BR-101) entram sem âncora numérica.
- O gate compara **1 número-âncora** por domínio — não todos os campos. Ampliar = adicionar âncoras em
  `anchors.json` + o campo no probe.
- Oráculos são por-obra; ao trocar de obra, revisar `anchors.json` (vários valores são da BR-101 v46).
