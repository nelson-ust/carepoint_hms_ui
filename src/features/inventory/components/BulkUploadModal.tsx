import { useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  UploadCloud,
  X,
} from "lucide-react";
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

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-6 animate-fade-in">
      <div className="bg-white rounded-[2.5rem] p-10 max-w-2xl w-full shadow-2xl relative animate-slide-up max-h-[90vh] overflow-y-auto">
        <button
          onClick={close}
          className="absolute top-6 right-6 p-3 hover:bg-secondary-50 rounded-2xl transition-all"
          aria-label="Close"
        >
          <X className="h-5 w-5 text-secondary-400" />
        </button>

        <div className="flex items-center gap-5 mb-8">
          <div className="h-14 w-14 rounded-2xl bg-primary-600 text-white flex items-center justify-center shadow-xl shadow-primary-500/20">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-black font-display tracking-tight">Bulk Upload Stock Items</h3>
            <p className="text-secondary-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">
              Import Many Items From Excel
            </p>
          </div>
        </div>

        {/* Step 1 — download template */}
        <div className="rounded-2xl border border-secondary-200 p-5 mb-5">
          <div className="flex items-start gap-4">
            <div className="h-9 w-9 shrink-0 rounded-xl bg-primary-500/10 text-primary-600 flex items-center justify-center text-sm font-black">
              1
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-secondary-900">Download the template</p>
              <p className="mt-1 text-xs text-secondary-500 leading-relaxed">
                Item Type and Store Code are pre-filled dropdowns. Required columns are marked with *.
                Fill one row per item, then upload it below.
              </p>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="btn-secondary mt-3 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50"
              >
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Download Excel template
              </button>
            </div>
          </div>
        </div>

        {/* Step 2 — upload */}
        <div className="rounded-2xl border border-secondary-200 p-5">
          <div className="flex items-start gap-4">
            <div className="h-9 w-9 shrink-0 rounded-xl bg-primary-500/10 text-primary-600 flex items-center justify-center text-sm font-black">
              2
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-secondary-900">Upload the filled file</p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-dashed border-secondary-300 bg-secondary-50 px-5 py-6 text-left transition-colors hover:border-primary-400"
              >
                <UploadCloud className="h-6 w-6 text-primary-500" />
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-secondary-900">
                    {fileName || "Click to choose your .xlsx file"}
                  </span>
                  <span className="block text-xs text-secondary-400">Only the provided template is supported.</span>
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

        {error && (
          <div className="mt-5 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span className="text-sm font-bold">{error}</span>
          </div>
        )}

        {/* Result summary */}
        {result && (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <SummaryTile label="Total Rows" value={result.total_rows} tone="slate" />
              <SummaryTile label="Imported" value={result.created} tone="emerald" />
              <SummaryTile label="Failed" value={result.failed} tone={result.failed ? "rose" : "slate"} />
            </div>
            <div
              className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-bold ${
                result.failed === 0 && result.created > 0
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                  : result.created > 0
                    ? "bg-amber-50 text-amber-700 border border-amber-100"
                    : "bg-rose-50 text-rose-700 border border-rose-100"
              }`}
            >
              {result.failed === 0 && result.created > 0 ? (
                <CheckCircle2 className="h-5 w-5 shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 shrink-0" />
              )}
              <span>{result.message}</span>
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-2xl border border-secondary-200 overflow-hidden">
                <div className="bg-secondary-50 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-secondary-500 flex justify-between">
                  <span>Row</span>
                  <span className="flex-1 ml-6">Problem</span>
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-secondary-100">
                  {result.errors.map((e, i) => (
                    <div key={i} className="px-4 py-2.5 flex items-start gap-6 text-xs">
                      <span className="font-mono font-bold text-secondary-700 w-8 shrink-0">
                        {e.row ?? "—"}
                      </span>
                      <span className="flex-1 text-rose-600 font-medium">{e.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="pt-7 flex gap-4">
          <button onClick={close} disabled={uploading} className="flex-1 btn-secondary py-4 rounded-2xl font-bold">
            {result ? "Done" : "Cancel"}
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading || !fileName}
            className="flex-[2] btn-primary py-4 rounded-2xl font-black tracking-tight shadow-xl shadow-primary-500/20 flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            {uploading ? "Importing..." : "Import Items"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "emerald" | "rose";
}) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-600 border-emerald-100"
      : tone === "rose"
        ? "bg-rose-50 text-rose-600 border-rose-100"
        : "bg-secondary-50 text-secondary-600 border-secondary-200";
  return (
    <div className={`rounded-2xl border p-4 text-center ${cls}`}>
      <p className="text-2xl font-black tracking-tight">{value}</p>
      <p className="text-[9px] font-bold uppercase tracking-widest opacity-80 mt-0.5">{label}</p>
    </div>
  );
}
