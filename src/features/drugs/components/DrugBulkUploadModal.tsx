import { useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  Loader2,
  UploadCloud,
} from "lucide-react";
import { DxPopup, DxButton, DxMessage } from "@/components/dx";
import {
  bulkUploadDrugs,
  downloadDrugTemplate,
  type BulkDrugUploadResult,
} from "../api/drugs.api";
import { apiErrorMessage } from "@/lib/api/api-error";

export function DrugBulkUploadModal({
  isOpen,
  onClose,
  onImported,
  title = "Bulk Upload Drugs",
  description = "Dosage Form, Category and Controlled are pre-filled dropdowns. Only Drug Name is required. Fill one row per drug, then upload it below.",
  importLabel = "Import Drugs",
  download = downloadDrugTemplate,
  upload = bulkUploadDrugs,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Called after at least one row was created so the page can refresh. */
  onImported: () => void;
  title?: string;
  subtitle?: string;
  description?: string;
  importLabel?: string;
  download?: () => Promise<void>;
  upload?: (file: File) => Promise<BulkDrugUploadResult>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkDrugUploadResult | null>(null);

  const reset = () => {
    setFileName("");
    setResult(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const close = () => {
    if (uploading) return;
    reset();
    onClose();
  };

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      await download();
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't download the template. Please retry."));
    } finally {
      setDownloading(false);
    }
  };

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a filled .xlsx template first.");
      return;
    }
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const res = await upload(file);
      setResult(res);
      if (res.created > 0) onImported();
    } catch (err) {
      setError(apiErrorMessage(err, "Upload failed. Please check the file and retry."));
    } finally {
      setUploading(false);
    }
  };

  const resultTone = result ? (result.failed === 0 && result.created > 0 ? "success" : result.created > 0 ? "warning" : "danger") : "info";

  return (
    <DxPopup
      isOpen={isOpen}
      onClose={close}
      title={title}
      size="lg"
      locked={uploading}
      footer={
        <>
          <DxButton onClick={close} disabled={uploading}>{result ? "Done" : "Cancel"}</DxButton>
          <DxButton variant="primary" onClick={handleUpload} isLoading={uploading} disabled={!fileName} leftIcon={<UploadCloud className="h-4 w-4" />}>{importLabel}</DxButton>
        </>
      }
    >
      <div className="space-y-5">
        {/* Step 1 — download template */}
        <div className="rounded-md border border-[var(--dx-border)] p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--dx-accent-soft)] text-[13px] font-bold text-[var(--dx-accent)]">1</div>
            <div className="flex-1">
              <p className="text-[13px] font-semibold text-[var(--dx-text)]">Download the template</p>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--dx-text-muted)]">{description}</p>
              <DxButton className="mt-3" size="sm" onClick={handleDownload} isLoading={downloading} leftIcon={<Download className="h-4 w-4" />}>Download Excel template</DxButton>
            </div>
          </div>
        </div>

        {/* Step 2 — upload */}
        <div className="rounded-md border border-[var(--dx-border)] p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--dx-accent-soft)] text-[13px] font-bold text-[var(--dx-accent)]">2</div>
            <div className="flex-1">
              <p className="text-[13px] font-semibold text-[var(--dx-text)]">Upload the filled file</p>
              <button type="button" onClick={() => fileRef.current?.click()} className="mt-3 flex w-full items-center gap-3 rounded-md border border-dashed border-[var(--dx-border-strong)] bg-[var(--dx-surface-sunken)] px-5 py-6 text-left transition-colors hover:border-[var(--dx-accent)]">
                <UploadCloud className="h-6 w-6 text-[var(--dx-accent)]" />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-[var(--dx-text)]">{fileName || "Click to choose your .xlsx file"}</span>
                  <span className="block text-[12px] text-[var(--dx-text-muted)]">Only the provided template is supported.</span>
                </span>
              </button>
              <input ref={fileRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden"
                onChange={(e) => { setFileName(e.target.files?.[0]?.name ?? ""); setResult(null); setError(null); }} />
            </div>
          </div>
        </div>

        {error ? <DxMessage tone="danger">{error}</DxMessage> : null}

        {result ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <SummaryTile label="Total Rows" value={result.total_rows} tone="neutral" />
              <SummaryTile label="Imported" value={result.created} tone="success" />
              <SummaryTile label="Failed" value={result.failed} tone={result.failed ? "danger" : "neutral"} />
            </div>
            <DxMessage tone={resultTone}>
              <span className="flex items-center gap-2">{result.failed === 0 && result.created > 0 ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : null}{result.message}</span>
            </DxMessage>

            {result.errors.length > 0 ? (
              <div className="overflow-hidden rounded-md border border-[var(--dx-border)]">
                <div className="flex justify-between bg-[var(--dx-surface-sunken)] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">
                  <span>Row</span><span className="ml-6 flex-1">Problem</span>
                </div>
                <div className="max-h-56 divide-y divide-[var(--dx-border)] overflow-y-auto">
                  {result.errors.map((e, i) => (
                    <div key={i} className="flex items-start gap-6 px-4 py-2.5 text-[12px]">
                      <span className="dx-mono w-8 shrink-0 font-bold text-[var(--dx-text)]">{e.row ?? "—"}</span>
                      <span className="flex-1 font-medium" style={{ color: "var(--dx-danger)" }}>{e.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </DxPopup>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "success" | "danger";
}) {
  const style = tone === "success"
    ? { background: "var(--dx-success-soft)", color: "var(--dx-success)", borderColor: "var(--dx-success)" }
    : tone === "danger"
      ? { background: "var(--dx-danger-soft)", color: "var(--dx-danger)", borderColor: "var(--dx-danger)" }
      : { background: "var(--dx-surface-sunken)", color: "var(--dx-text-muted)", borderColor: "var(--dx-border)" };
  return (
    <div className="rounded-md border p-4 text-center" style={style}>
      <p className="text-[22px] font-bold tracking-tight">{value}</p>
      <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-widest opacity-80">{label}</p>
    </div>
  );
}
