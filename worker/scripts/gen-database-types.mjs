// Gera src/lib/supabase/database.types.ts por introspecção direta do Postgres
// (information_schema + pg_catalog), no MESMO formato do `supabase gen types
// typescript`. Substitui o gerador oficial porque: (a) o modo --db-url exige
// Docker (não temos), (b) a CLI local está logada na conta errada (viverdeia)
// e não enxerga o projeto vorata.
//
// Uso:
//   cd worker && SUPABASE_DB_URL='postgresql://postgres.<ref>:<SENHA>@aws-1-us-east-1.pooler.supabase.com:5432/postgres' \
//     node scripts/gen-database-types.mjs [saida.ts]
//
// Default de saída: ../src/lib/supabase/database.types.ts

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const DB_URL = process.env.SUPABASE_DB_URL;
if (!DB_URL) {
  console.error("Defina SUPABASE_DB_URL (session pooler IPv4 — ver CLAUDE.md).");
  process.exit(1);
}
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, process.argv[2] ?? "../../src/lib/supabase/database.types.ts");

const client = new pg.Client({ connectionString: DB_URL });
await client.connect();

// ── Introspecção ─────────────────────────────────────────────────────────────

const { rows: tabelas } = await client.query(`
  select table_name, table_type
  from information_schema.tables
  where table_schema = 'public' and table_type in ('BASE TABLE', 'VIEW')
  order by table_name`);

const { rows: colunas } = await client.query(`
  select table_name, column_name, is_nullable, column_default, udt_name, is_identity
  from information_schema.columns
  where table_schema = 'public'
  order by table_name, column_name`);

const { rows: enums } = await client.query(`
  select t.typname as nome, e.enumlabel as label
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
  order by t.typname, e.enumsortorder`);

const { rows: fks } = await client.query(`
  select
    c.conname as fk_name,
    rel.relname as table_name,
    (select array_agg(a.attname order by k.ord)::text[]
       from unnest(c.conkey) with ordinality k(attnum, ord)
       join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as cols,
    frel.relname as ref_table,
    (select array_agg(a.attname order by k.ord)::text[]
       from unnest(c.confkey) with ordinality k(attnum, ord)
       join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.attnum) as ref_cols,
    exists (
      select 1 from pg_constraint u
      where u.conrelid = c.conrelid and u.contype in ('p','u')
        and (select array_agg(x order by x) from unnest(u.conkey) x)
          = (select array_agg(x order by x) from unnest(c.conkey) x)
    ) as one_to_one
  from pg_constraint c
  join pg_class rel on rel.oid = c.conrelid
  join pg_class frel on frel.oid = c.confrelid
  join pg_namespace n on n.oid = rel.relnamespace
  where c.contype = 'f' and n.nspname = 'public'
  order by rel.relname, c.conname`);

// Funções do schema public que NÃO pertencem a extensões (deptype 'e').
const { rows: funcoes } = await client.query(`
  select p.proname as nome,
         pg_get_function_arguments(p.oid) as args,
         pg_get_function_result(p.oid) as result
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  order by p.proname`);

await client.end();

// ── Mapeamento de tipos ──────────────────────────────────────────────────────

const enumsPorNome = new Map();
for (const e of enums) {
  if (!enumsPorNome.has(e.nome)) enumsPorNome.set(e.nome, []);
  enumsPorNome.get(e.nome).push(e.label);
}

/** udt_name do information_schema → tipo TS (formato do gerador oficial). */
function tsDeUdt(udt) {
  if (udt.startsWith("_")) return `${tsDeUdt(udt.slice(1))}[]`;
  if (enumsPorNome.has(udt)) return `Database["public"]["Enums"]["${udt}"]`;
  switch (udt) {
    case "int2":
    case "int4":
    case "int8":
    case "float4":
    case "float8":
    case "numeric":
    case "oid":
      return "number";
    case "bool":
      return "boolean";
    case "json":
    case "jsonb":
      return "Json";
    case "text":
    case "varchar":
    case "bpchar":
    case "uuid":
    case "date":
    case "time":
    case "timetz":
    case "timestamp":
    case "timestamptz":
    case "interval":
    case "bytea":
    case "inet":
    case "citext":
    case "name":
      return "string";
    default:
      return "unknown";
  }
}

/** Nome SQL de tipo (das assinaturas de função) → tipo TS. */
function tsDeSql(sql) {
  const s = sql.trim().toLowerCase();
  if (s.endsWith("[]")) return `${tsDeSql(s.slice(0, -2))}[]`;
  if (enumsPorNome.has(s)) return `Database["public"]["Enums"]["${s}"]`;
  if (
    [
      "smallint",
      "integer",
      "int",
      "bigint",
      "numeric",
      "decimal",
      "real",
      "double precision",
    ].includes(s)
  )
    return "number";
  if (s === "boolean") return "boolean";
  if (["json", "jsonb"].includes(s)) return "Json";
  if (s === "void") return "undefined";
  if (
    s.startsWith("character") ||
    s.startsWith("timestamp") ||
    s.startsWith("time") ||
    ["text", "uuid", "date", "interval", "bytea", "citext", "name"].includes(s)
  )
    return "string";
  return "unknown";
}

// ── Montagem do bloco Database ───────────────────────────────────────────────

const colsPorTabela = new Map();
for (const c of colunas) {
  if (!colsPorTabela.has(c.table_name)) colsPorTabela.set(c.table_name, []);
  colsPorTabela.get(c.table_name).push(c);
}
const fksPorTabela = new Map();
for (const f of fks) {
  if (!fksPorTabela.has(f.table_name)) fksPorTabela.set(f.table_name, []);
  fksPorTabela.get(f.table_name).push(f);
}

function linhasRow(cols, modo) {
  return cols
    .map((c) => {
      const base = tsDeUdt(c.udt_name);
      const anulavel = c.is_nullable === "YES";
      const temDefault = c.column_default != null || c.is_identity === "YES";
      const tipo = anulavel ? `${base} | null` : base;
      if (modo === "Row") return `          ${c.column_name}: ${tipo};`;
      if (modo === "Update") return `          ${c.column_name}?: ${tipo};`;
      // Insert: opcional quando anulável OU com default/identity
      return anulavel || temDefault
        ? `          ${c.column_name}?: ${tipo};`
        : `          ${c.column_name}: ${tipo};`;
    })
    .join("\n");
}

function blocoRelationships(nome) {
  const lista = fksPorTabela.get(nome) ?? [];
  if (lista.length === 0) return "        Relationships: [];";
  const itens = lista
    .map(
      (f) => `          {
            foreignKeyName: "${f.fk_name}";
            columns: [${f.cols.map((c) => `"${c}"`).join(", ")}];
            isOneToOne: ${f.one_to_one};
            referencedRelation: "${f.ref_table}";
            referencedColumns: [${f.ref_cols.map((c) => `"${c}"`).join(", ")}];
          },`,
    )
    .join("\n");
  return `        Relationships: [\n${itens}\n        ];`;
}

const nomesTabelas = tabelas.filter((t) => t.table_type === "BASE TABLE").map((t) => t.table_name);
const nomesViews = tabelas.filter((t) => t.table_type === "VIEW").map((t) => t.table_name);

const blocoTables = nomesTabelas
  .map((nome) => {
    const cols = colsPorTabela.get(nome) ?? [];
    return `      ${nome}: {
        Row: {
${linhasRow(cols, "Row")}
        };
        Insert: {
${linhasRow(cols, "Insert")}
        };
        Update: {
${linhasRow(cols, "Update")}
        };
${blocoRelationships(nome)}
      };`;
  })
  .join("\n");

const blocoViews =
  nomesViews.length === 0
    ? "      [_ in never]: never;"
    : nomesViews
        .map((nome) => {
          const cols = colsPorTabela.get(nome) ?? [];
          return `      ${nome}: {
        Row: {
${linhasRow(cols, "Row")}
        };
        Relationships: [];
      };`;
        })
        .join("\n");

// Funções: parse das assinaturas textuais do pg_get_function_*.
function parseArgs(texto) {
  if (!texto.trim()) return [];
  // split em vírgulas de nível 0 (sem parênteses aninhados nas assinaturas que usamos)
  return texto.split(",").map((parte) => {
    const temDefault = /\bDEFAULT\b/i.test(parte);
    const semDefault = parte.replace(/\s+DEFAULT\s+.*$/i, "").trim();
    const m = semDefault.match(/^(?:(?:IN|OUT|INOUT|VARIADIC)\s+)?(\w+)\s+(.+)$/i);
    if (!m)
      return { nome: semDefault.replaceAll(/\W/g, "_"), tipo: "unknown", opcional: temDefault };
    return { nome: m[1], tipo: tsDeSql(m[2]), opcional: temDefault };
  });
}

function parseReturns(texto) {
  const t = texto.trim();
  const mTable = t.match(/^TABLE\((.+)\)$/i);
  if (mTable) {
    const campos = mTable[1].split(",").map((parte) => {
      const m = parte.trim().match(/^(\w+)\s+(.+)$/);
      return m ? `          ${m[1]}: ${tsDeSql(m[2])};` : null;
    });
    return `{\n${campos.filter(Boolean).join("\n")}\n        }[]`;
  }
  const mSetof = t.match(/^SETOF\s+(\w+)$/i);
  if (mSetof) {
    const alvo = mSetof[1];
    if (nomesTabelas.includes(alvo)) return `Database["public"]["Tables"]["${alvo}"]["Row"][]`;
    return `${tsDeSql(alvo)}[]`;
  }
  return tsDeSql(t);
}

const blocoFunctions =
  funcoes.length === 0
    ? "      [_ in never]: never;"
    : funcoes
        .map((f) => {
          const args = parseArgs(f.args);
          const blocoArgs =
            args.length === 0
              ? "        Args: Record<PropertyKey, never>;"
              : `        Args: {\n${args
                  .map((a) => `          ${a.nome}${a.opcional ? "?" : ""}: ${a.tipo};`)
                  .join("\n")}\n        };`;
          return `      ${f.nome}: {
${blocoArgs}
        Returns: ${parseReturns(f.result)};
      };`;
        })
        .join("\n");

const blocoEnums =
  enumsPorNome.size === 0
    ? "      [_ in never]: never;"
    : [...enumsPorNome.entries()]
        .map(([nome, labels]) => `      ${nome}: ${labels.map((l) => `"${l}"`).join(" | ")};`)
        .join("\n");

const constEnums =
  enumsPorNome.size === 0
    ? "      // sem enums"
    : [...enumsPorNome.entries()]
        .map(([nome, labels]) => `      ${nome}: [${labels.map((l) => `"${l}"`).join(", ")}],`)
        .join("\n");

// ── Arquivo final (Database + helpers padrão do gerador oficial) ────────────

const arquivo = `// GERADO por worker/scripts/gen-database-types.mjs — NÃO editar à mão.
// Regenerar após cada migration:
//   cd worker && SUPABASE_DB_URL='...' node scripts/gen-database-types.mjs
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
${blocoTables}
    };
    Views: {
${blocoViews}
    };
    Functions: {
${blocoFunctions}
    };
    Enums: {
${blocoEnums}
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
${constEnums}
    },
  },
} as const;
`;

writeFileSync(OUT, arquivo);
console.log(
  `OK → ${OUT}\n` +
    `   ${nomesTabelas.length} tabelas · ${nomesViews.length} views · ` +
    `${funcoes.length} funções · ${enumsPorNome.size} enums`,
);
