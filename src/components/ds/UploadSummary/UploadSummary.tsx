import { cn } from "@/lib/utils";
import { I } from "../icons";
import "./UploadSummary.css";

export type UploadSummaryProps = {
  /** Total de arquivos anexados (em todos os tipos). */
  filesCount: number;
  /** Quantos tipos diferentes têm pelo menos 1 arquivo. */
  typesWithFiles: number;
  /** Total de tipos de documentos no catálogo (referência). */
  totalTypes: number;
  className?: string;
};

export function UploadSummary({
  filesCount,
  typesWithFiles,
  totalTypes,
  className,
}: UploadSummaryProps) {
  return (
    <div className={cn("upload-summary", filesCount === 0 && "empty", className)}>
      <span className="upload-summary-icon" aria-hidden>
        {I.doc({ size: 16 })}
      </span>
      <div className="upload-summary-text">
        <div className="upload-summary-title">
          {filesCount === 0
            ? "Nenhum documento anexado"
            : `${filesCount} ${filesCount === 1 ? "documento anexado" : "documentos anexados"}`}
        </div>
        <div className="upload-summary-sub">
          {filesCount === 0
            ? `${totalTypes} tipos disponíveis · anexe quando quiser`
            : `${typesWithFiles} de ${totalTypes} etapas com documento`}
        </div>
      </div>
    </div>
  );
}
