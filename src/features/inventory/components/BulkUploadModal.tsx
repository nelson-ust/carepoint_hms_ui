import { useRef, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  UploadCloud,
} from "lucide-react";
import {
  DxPopup,
  DxButton,
  DxKpi,
  DxMessage,
} from "@/components/dx";
import {
  bulkUploadStockItems,
  downloadStockItemTemplate,
  type BulkUploadResult,
} from "../api/inventory.api";
import { apiErrorMessage } from "@/lib/api/api-error";

export function BulkUploadModal({
  isOpen,
  onClose,
  onImported,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Called after at least one item was created so the page can refresh. */
  onImported: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkUploadResult | null>(null);

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
      await downloadStockItemTemplate();
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
      const res = await bulkUploadStockItems(file);
      setResult(res);
      if (res.created > 0) onImported();
    } catch (err) {
      setError(apiErrorMessage(err, "Upload failed. Please check the file and retry."));
    } finally {
      setUploading(false);
    }
  };

  return (
    <DxPopup
      isOpen={isOpen}
      onClose={close}
      title="Bulk Upload Stock Items"
      size="lg"
      locked={uploading}
      footer={
        <>
          <DxButton onClick={close} disabled={uploading}>{result ? "Done" : "Cancel"}</DxButton>
          <DxButton
            variant="primary"
            onClick={handleUpload}
            isLoading={uploading}
            disabled={!fileName}
            leftIcon={<UploadCloud className="h-4 w-4" />}
          >
            Import items
          </DxButton>
        </>
      }
    >
      <div className="space-y-4">
        {/* Step 1 — download template */}
        <div className="rounded border border-[var(--dx-border)] p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[var(--dx-accent-soft)] text-[13px] font-bold text-[var(--dx-accent)]">1</div>
            <div className="flex-1">
              <p className="font-semibold text-[var(--dx-text)]">Download the template</p>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--dx-text-muted)]">
                Item Type and Store Code are pre-filled dropdowns. Required columns are marked with *.
                Fill one row per item, then upload it below.
              </p>
              <DxButton
                className="mt-3"
                size="sm"
                onClick={handleDownload}
                isLoading={downloading}
                leftIcon={<Download className="h-4 w-4" />}
              >
                Download Excel template
              </DxButton>
            </div>
          </div>
        </div>

        {/* Step 2 — upload */}
        <div className="rounded border border-[var(--dx-border)] p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[var(--dx-accent-soft)] text-[13px] font-bold text-[var(--dx-accent)]">2</div>
            <div className="flex-1">
              <p className="font-semibold text-[var(--dx-text)]">Upload the filled file</p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-3 flex w-full items-center gap-3 rounded border border-dashed border-[var(--dx-border-strong)] bg-[var(--dx-surface-sunken)] px-4 py-5 text-left transition-colors hover:border-[var(--dx-accent)]"
              >
                <FileSpreadsheet className="h-6 w-6 text-[var(--dx-accent)]" />
                <span className="min-w-0">
                  <span className="block font-semibold text-[var(--dx-text)]">
                    {fileName || "Click to choose your .xlsx file"}
                  </span>
                  <span className="block text-[12px] text-[var(--dx-text-muted)]">Only the provided template is supported.</span>
                </span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => {
                  setFileName(e.target.files?.[0]?.name ?? "");
                  setResult(null);
                  setError(null);
                }}
              />
            </div>
          </div>
        </div>

        {error ? <DxMessage tone="danger">{error}</DxMessage> : null}

        {/* Result summary */}
        {result ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <DxKpi label="Total Rows" value={result.total_rows} tone="neutral" />
              <DxKpi label="Imported" value={result.created} tone="success" />
              <DxKpi label="Failed" value={result.failed} tone={result.failed ? "danger" : "neutral"} />
            </div>
            <DxMessage tone={result.failed === 0 && result.created > 0 ? "success" : result.created > 0 ? "warning" : "danger"}>
              {result.message}
            </DxMessage>

            {result.errors.length > 0 ? (
              <div className="overflow-hidden rounded border border-[var(--dx-border)]">
                <div className="flex justify-between bg-[var(--dx-surface-sunken)] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">
                  <span>Row</span>
                  <span className="ml-6 flex-1">Problem</span>
                </div>
                <div className="max-h-56 divide-y divide-[var(--dx-border)] overflow-y-auto">
                  {result.errors.map((e, i) => (
                    <div key={i} className="flex items-start gap-6 px-4 py-2 text-[12px]">
                      <span className="w-8 shrink-0 dx-mono font-semibold text-[var(--dx-text-muted)]">{e.row ?? "—"}</span>
                      <span className="flex-1" style={{ color: "var(--dx-danger)" }}>{e.message}</span>
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
