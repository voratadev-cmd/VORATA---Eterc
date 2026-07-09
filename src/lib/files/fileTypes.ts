// Mapping de tipos de arquivo · label PT-BR + tom semântico do DS.
// Usado pra exibir badge colorido por extensão no ObraFileItem (e futuras telas
// de upload). Mantém uma só fonte de verdade pra não espalhar regex pelo app.

export type FileTone = "pdf" | "excel" | "word" | "mpp" | "csv" | "markdown" | "other";

export type FileTypeMeta = {
  /** Texto curto exibido no badge. */
  label: string;
  /** Tom CSS · usado pra construir classe .file-tone-{tone}. */
  tone: FileTone;
  /** Indica se preview inline (em nova aba) faz sentido pro tipo. */
  previewable: boolean;
};

const META_BY_EXT: Record<string, FileTypeMeta> = {
  ".pdf": { label: "PDF", tone: "pdf", previewable: true },
  ".xlsx": { label: "Excel", tone: "excel", previewable: false },
  ".xls": { label: "Excel", tone: "excel", previewable: false },
  ".csv": { label: "CSV", tone: "csv", previewable: true },
  ".doc": { label: "Word", tone: "word", previewable: false },
  ".docx": { label: "Word", tone: "word", previewable: false },
  ".mpp": { label: "MS Project", tone: "mpp", previewable: false },
  ".md": { label: "Markdown", tone: "markdown", previewable: true },
};

const FALLBACK: FileTypeMeta = { label: "Arquivo", tone: "other", previewable: false };

/** Extrai a extensão (com ponto, lowercase) do nome do arquivo. */
export function getExtension(fileName: string): string {
  return fileName.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase() ?? "";
}

/** Metadados de exibição pra um nome de arquivo. Cai pro FALLBACK se desconhecido. */
export function getFileTypeMeta(fileName: string): FileTypeMeta {
  const ext = getExtension(fileName);
  return META_BY_EXT[ext] ?? FALLBACK;
}
