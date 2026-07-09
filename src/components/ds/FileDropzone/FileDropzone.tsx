import { useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { I } from "../icons";
import "./FileDropzone.css";

export type FileDropzoneProps = {
  /** Lista de extensões aceitas separadas por vírgula (ex.: ".pdf,.xlsx"). */
  accept?: string;
  /** Permite múltiplos arquivos no input nativo e no drop. Default `true`. */
  multiple?: boolean;
  /** Callback ao selecionar/dropar arquivos. */
  onFiles: (files: File[]) => void;
  /** Texto principal centralizado. */
  label?: ReactNode;
  /** Texto secundário menor. */
  hint?: ReactNode;
  /** Tamanho visual. `lg` é a dropzone gigante hero; `md` é a inline em slots. */
  size?: "lg" | "md";
  disabled?: boolean;
  className?: string;
};

export function FileDropzone({
  accept,
  multiple = true,
  onFiles,
  label = "Arraste arquivos aqui",
  hint = "ou clique para selecionar",
  size = "md",
  disabled = false,
  className,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const [dragItemsCount, setDragItemsCount] = useState(0);

  function emit(filesList: FileList | File[] | null) {
    if (!filesList) return;
    const files = Array.from(filesList);
    if (files.length === 0) return;
    onFiles(multiple ? files : files.slice(0, 1));
  }

  function onDragEnter(e: DragEvent<HTMLDivElement>) {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((c) => c + 1);
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setDragOver(true);
      // Conta apenas items do tipo "file" · ignora text/uri-list etc.
      const fileCount = Array.from(e.dataTransfer.items).filter((it) => it.kind === "file").length;
      setDragItemsCount(fileCount > 0 ? fileCount : e.dataTransfer.items.length);
    }
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((c) => {
      const next = c - 1;
      if (next <= 0) {
        setDragOver(false);
        setDragItemsCount(0);
      }
      return Math.max(0, next);
    });
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    setDragCounter(0);
    setDragItemsCount(0);
    emit(e.dataTransfer?.files ?? null);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      inputRef.current?.click();
    }
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-label={typeof label === "string" ? label : "Selecionar arquivos"}
      className={cn(
        "dropzone",
        `dropzone-${size}`,
        dragOver && "drag-over",
        disabled && "disabled",
        className,
      )}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={onKeyDown}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <span className="dropzone-illu" aria-hidden>
        {I.plus({ size: size === "lg" ? 24 : 18 })}
      </span>
      <span className="dropzone-label">
        {dragOver && dragItemsCount > 0
          ? `Solte ${dragItemsCount} ${dragItemsCount === 1 ? "arquivo" : "arquivos"} aqui`
          : label}
      </span>
      {hint && !dragOver ? <span className="dropzone-hint">{hint}</span> : null}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="dropzone-input"
        disabled={disabled}
        onChange={(e) => {
          emit(e.target.files);
          // reset pra permitir re-selecionar o mesmo arquivo
          e.target.value = "";
        }}
      />
    </div>
  );
}
