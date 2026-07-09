// Helper de upload de arquivo bruto da obra. O usuário sobe os documentos
// da obra inteira sem categorizar — o agente SDK posterior é quem identifica
// que arquivo é qual.
//
// Path canônico no Storage: {obraId}/raw/{ts}-{nome-sanitizado}
// A sub-pasta 'raw' reserva espaço para 'extracted/', 'normalized/', etc.
// nas fases futuras do pipeline.

import { getSupabase, MAX_FILE_SIZE, RMA_BUCKET } from "./client";

export type UploadResult = {
  path: string;
  size: number;
  uploadedAt: string;
};

export type UploadError = {
  code:
    | "INVALID_EXTENSION"
    | "FILE_TOO_LARGE"
    | "FILE_EMPTY"
    | "INVALID_CONTENT"
    | "UPLOAD_FAILED"
    | "NOT_CONFIGURED"
    | "REMOVE_FAILED";
  message: string;
};

/** Extensões permitidas no client antes de subir.
 *  Mantenha sincronizado com `ALL_RMA_ACCEPT` em src/lib/rma/documentTypes.ts. */
const ALLOWED_EXT = new Set([".pdf", ".xlsx", ".xls", ".mpp", ".csv", ".doc", ".docx", ".md"]);

/** Assinaturas (magic numbers) por extensão binária. Barra arquivo renomeado
 *  (ex.: .exe → .pdf) ANTES de gastar upload/tokens da IA. Formatos de texto
 *  (.csv/.md) não têm assinatura confiável → não checamos. */
const MAGIC: Record<string, number[][]> = {
  ".pdf": [[0x25, 0x50, 0x44, 0x46]], //  %PDF
  ".xlsx": [[0x50, 0x4b, 0x03, 0x04]], // PK\x03\x04 (zip/ooxml)
  ".docx": [[0x50, 0x4b, 0x03, 0x04]],
  ".xls": [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]], // OLE2
  ".doc": [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
  ".mpp": [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
};

async function contentMatchesExtension(file: File, ext: string): Promise<boolean> {
  const sigs = MAGIC[ext];
  if (!sigs) return true; // .csv/.md (texto) — sem assinatura confiável
  try {
    const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    return sigs.some((sig) => sig.every((b, i) => head[i] === b));
  } catch {
    return true; // se não der pra ler o head, não bloqueia (degrada seguro)
  }
}

function sanitizeFileName(name: string): string {
  const m = name.match(/^(.*?)(\.[a-z0-9]+)?$/i);
  const base = (m?.[1] ?? name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 110); // trunca a BASE, preservando a extensão abaixo
  const ext = (m?.[2] ?? "").toLowerCase().replace(/[^a-z0-9.]/g, "");
  return (base || "arquivo") + ext;
}

function getExtension(fileName: string): string {
  return fileName.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase() ?? "";
}

/**
 * Sobe um arquivo bruto pra pasta raw/ da obra.
 *
 * @param obraId  UUID da obra (gerado no mount do form de cadastro).
 * @param file    File da seleção/dropzone.
 */
export async function uploadObraRawFile(
  obraId: string,
  file: File,
): Promise<{ ok: true; result: UploadResult } | { ok: false; error: UploadError }> {
  const ext = getExtension(file.name);
  if (!ALLOWED_EXT.has(ext)) {
    return {
      ok: false,
      error: {
        code: "INVALID_EXTENSION",
        message: `Formato ${ext || "desconhecido"} não suportado.`,
      },
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      ok: false,
      error: {
        code: "FILE_TOO_LARGE",
        message: `Arquivo excede o limite de ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
      },
    };
  }

  // Piso: arquivo vazio/truncado (0 byte) não pode entrar na fila da IA.
  if (file.size === 0) {
    return {
      ok: false,
      error: { code: "FILE_EMPTY", message: "Arquivo vazio (0 byte) — verifique o original." },
    };
  }

  // Conteúdo bate com a extensão? (barra binário renomeado de .exe/.zip → .pdf)
  if (!(await contentMatchesExtension(file, ext))) {
    return {
      ok: false,
      error: {
        code: "INVALID_CONTENT",
        message: `O conteúdo não corresponde a um arquivo ${ext} válido (corrompido ou renomeado).`,
      },
    };
  }

  let supabase;
  try {
    supabase = getSupabase();
  } catch {
    return {
      ok: false,
      error: {
        code: "NOT_CONFIGURED",
        message: "Storage não configurado. Defina as variáveis VITE_SUPABASE_* em .env.local.",
      },
    };
  }

  const timestamp = Date.now();
  const sanitized = sanitizeFileName(file.name);
  const path = `${obraId}/raw/${timestamp}-${sanitized}`;

  const { error } = await supabase.storage.from(RMA_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });

  if (error) {
    return { ok: false, error: { code: "UPLOAD_FAILED", message: error.message } };
  }

  return {
    ok: true,
    result: { path, size: file.size, uploadedAt: new Date().toISOString() },
  };
}

/** Remove um arquivo do bucket pelo path. */
export async function removeObraStorageFile(
  path: string,
): Promise<{ ok: true } | { ok: false; error: UploadError }> {
  let supabase;
  try {
    supabase = getSupabase();
  } catch {
    return {
      ok: false,
      error: { code: "NOT_CONFIGURED", message: "Storage não configurado." },
    };
  }
  const { error } = await supabase.storage.from(RMA_BUCKET).remove([path]);
  if (error) {
    return { ok: false, error: { code: "REMOVE_FAILED", message: error.message } };
  }
  return { ok: true };
}

/** Remove TODA a árvore da obra (usado em rollback de cancelamento). */
export async function removeObraTree(
  obraId: string,
): Promise<{ ok: true; count: number } | { ok: false; error: UploadError }> {
  const supabase = (() => {
    try {
      return getSupabase();
    } catch {
      return null;
    }
  })();
  if (!supabase) {
    return {
      ok: false,
      error: { code: "NOT_CONFIGURED", message: "Storage não configurado." },
    };
  }

  async function listAll(prefix: string): Promise<string[]> {
    const acc: string[] = [];
    const { data, error } = await supabase!.storage.from(RMA_BUCKET).list(prefix, {
      limit: 1000,
    });
    if (error || !data) return acc;
    for (const entry of data) {
      const full = `${prefix}/${entry.name}`;
      if (entry.id === null) {
        const inner = await listAll(full);
        acc.push(...inner);
      } else {
        acc.push(full);
      }
    }
    return acc;
  }

  const paths = await listAll(obraId);
  if (paths.length === 0) return { ok: true, count: 0 };

  const { error } = await supabase.storage.from(RMA_BUCKET).remove(paths);
  if (error) {
    return { ok: false, error: { code: "REMOVE_FAILED", message: error.message } };
  }
  return { ok: true, count: paths.length };
}
