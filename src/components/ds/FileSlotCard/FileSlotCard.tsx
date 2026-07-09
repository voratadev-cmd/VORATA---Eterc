import type { RmaDocType } from "@/lib/rma/documentTypes";
import { cn } from "@/lib/utils";
import { Badge } from "../Badge/Badge";
import { FileDropzone } from "../FileDropzone/FileDropzone";
import { I } from "../icons";
import { ProgressBar } from "../ProgressBar/ProgressBar";
import "./FileSlotCard.css";

/** Estado por arquivo dentro de um slot. */
export type SlotFile = {
  id: string;
  file: File;
  status: "queued" | "uploading" | "uploaded" | "error";
  progress?: number;
  errorMsg?: string;
};

export type FileSlotCardProps = {
  docType: RmaDocType;
  files: SlotFile[];
  /** Disparado quando arquivos chegam (dropzone ou input). */
  onAttach: (files: File[]) => void;
  /** Remove um arquivo da lista. */
  onRemove: (slotFileId: string) => void;
  /** Tenta re-subir um arquivo com erro (opcional). */
  onRetry?: (slotFileId: string) => void;
  /** Highlight visual quando o slot é alvo de validação falha. */
  highlight?: boolean;
  className?: string;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function FileSlotCard({
  docType,
  files,
  onAttach,
  onRemove,
  onRetry,
  highlight = false,
  className,
}: FileSlotCardProps) {
  const hasFiles = files.length > 0;
  const allowMore = docType.multiple || files.length === 0;
  const acceptStr = docType.accept.join(",");
  const anyUploading = files.some((f) => f.status === "uploading");
  const anyError = files.some((f) => f.status === "error");

  const stateClass = anyError
    ? "state-error"
    : anyUploading
      ? "state-uploading"
      : hasFiles
        ? "state-ready"
        : "state-empty";

  return (
    <div className={cn("file-slot", stateClass, highlight && "highlight", className)}>
      <header className="file-slot-header">
        <span className="file-slot-icon" aria-hidden>
          {I[docType.iconKey]({ size: 18 })}
        </span>
        <div className="file-slot-meta">
          <div className="file-slot-label">{docType.label}</div>
          <div className="file-slot-hint">{docType.hint}</div>
        </div>
        {hasFiles ? (
          <Badge tone="info" className="file-slot-badge">
            {files.length} {files.length === 1 ? "anexo" : "anexos"}
          </Badge>
        ) : null}
      </header>

      <div className="file-slot-body">
        {!hasFiles ? (
          <FileDropzone
            accept={acceptStr}
            multiple={docType.multiple}
            onFiles={onAttach}
            label="Arraste ou clique"
            hint={docType.accept.join(" · ")}
            size="md"
          />
        ) : (
          <ul className="file-slot-files">
            {files.map((sf) => (
              <li key={sf.id} className={cn("file-slot-file", `file-${sf.status}`)}>
                <span className="file-slot-file-icon" aria-hidden>
                  {sf.status === "uploaded"
                    ? I.check({ size: 14 })
                    : sf.status === "error"
                      ? I.close({ size: 14 })
                      : I.doc({ size: 14 })}
                </span>
                <div className="file-slot-file-meta">
                  <div className="file-slot-file-name" title={sf.file.name}>
                    {sf.file.name}
                  </div>
                  <div className="file-slot-file-sub">
                    {formatBytes(sf.file.size)}
                    {sf.status === "uploading" && sf.progress !== undefined
                      ? ` · ${sf.progress}%`
                      : ""}
                    {sf.status === "error" && sf.errorMsg ? ` · ${sf.errorMsg}` : ""}
                  </div>
                  {sf.status === "uploading" && sf.progress !== undefined ? (
                    <ProgressBar value={sf.progress} max={100} />
                  ) : null}
                </div>
                <div className="file-slot-file-actions">
                  {sf.status === "error" && onRetry ? (
                    <button
                      type="button"
                      className="file-slot-action"
                      onClick={() => onRetry(sf.id)}
                      aria-label="Tentar novamente"
                      title="Tentar novamente"
                    >
                      {I.repeat({ size: 14 })}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="file-slot-action"
                    onClick={() => onRemove(sf.id)}
                    aria-label="Remover arquivo"
                    title="Remover"
                  >
                    {I.close({ size: 14 })}
                  </button>
                </div>
              </li>
            ))}
            {allowMore ? (
              <FileDropzone
                accept={acceptStr}
                multiple={docType.multiple}
                onFiles={onAttach}
                label={docType.multiple ? "+ Adicionar outro" : "Substituir arquivo"}
                hint={docType.accept.join(" · ")}
                size="md"
                className="file-slot-add"
              />
            ) : null}
          </ul>
        )}
      </div>
    </div>
  );
}
