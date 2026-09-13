import { useEffect, useRef, useState } from "react";
import { AlertCircle, Building2, ImageUp, Loader2, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import { resolveAssetUrl } from "@/lib/api/asset-url";
import { useTenantSettings, useUploadTenantLogo } from "../hooks/use-branding";

const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"];
const MAX_MB = 20;

export function BrandingPage() {
  const toast = useToast();
  const { data: settings, isLoading, isError, refetch } = useTenantSettings();
  const uploadMutation = useUploadTenantLogo();

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Build/tear down an object URL for the locally selected file preview.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const currentLogo = resolveAssetUrl(settings?.logo_url);
  const shownLogo = previewUrl ?? currentLogo;

  const pickFile = () => fileRef.current?.click();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!f) return;
    if (!ACCEPTED.includes(f.type)) {
      toast.error("Unsupported file", "Upload a PNG, JPG, WEBP, SVG or GIF image.");
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      toast.error("File too large", `Keep the logo under ${MAX_MB}MB.`);
      return;
    }
    setFile(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (!ACCEPTED.includes(f.type)) {
      toast.error("Unsupported file", "Upload a PNG, JPG, WEBP, SVG or GIF image.");
      return;
    }
    setFile(f);
  };

  const save = () => {
    if (!file) return;
    uploadMutation.mutate(file, {
      onSuccess: () => {
        toast.success("Logo updated", "Your hospital logo now appears across the app and patient portal.");
        setFile(null);
      },
      onError: (err) =>
        toast.error("Upload failed", apiErrorMessage(err, "Could not upload the logo. Please try again.")),
    });
  };

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <PageHeader
          title="Hospital Branding"
          description="Upload your hospital logo. It appears in the app sidebar and across your patient portal."
        />
        <button
          onClick={() => refetch()}
          className="btn-secondary self-start rounded-2xl border-secondary-400 bg-white/80 p-4"
          aria-label="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {isError ? (
        <div className="flex items-center justify-between gap-4 rounded-[2rem] border border-rose-100 bg-rose-50 p-6 text-rose-600">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6" />
            <p className="text-sm font-bold">Unable to load branding settings.</p>
          </div>
          <button onClick={() => refetch()} className="btn-secondary px-5 py-2 text-xs">
            Retry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          {/* Current identity preview */}
          <div className="lg:col-span-1">
            <div className="glass-card rounded-[2.5rem] border border-secondary-400/50 bg-white/40 p-8 shadow-premium">
              <h4 className="mb-6 text-[10px] font-black uppercase tracking-[0.3em] text-secondary-400">
                Current logo
              </h4>
              <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-[2rem] border border-secondary-200/70 bg-white p-6 dark:bg-white">
                {shownLogo ? (
                  <img
                    src={shownLogo}
                    alt="Hospital logo"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-secondary-300">
                    <Building2 className="h-12 w-12" />
                    <p className="text-xs font-bold">No logo yet</p>
                  </div>
                )}
              </div>
              {previewUrl ? (
                <p className="mt-4 text-center text-[11px] font-bold uppercase tracking-widest text-primary-500">
                  Preview — not saved yet
                </p>
              ) : null}
            </div>
          </div>

          {/* Uploader */}
          <div className="space-y-6 lg:col-span-2">
            <div className="glass-card rounded-[2.5rem] border border-secondary-400/50 bg-white/40 p-8 shadow-premium">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-900 text-white shadow-lg">
                  <ImageUp className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-secondary-900">Upload a new logo</h4>
                  <p className="text-xs text-secondary-500">
                    PNG, JPG, WEBP, SVG or GIF, up to {MAX_MB}MB. A square or wide transparent PNG works best.
                  </p>
                </div>
              </div>

              <div
                onClick={pickFile}
                onDrop={onDrop}
                onDragOver={(e) => e.preventDefault()}
                role="button"
                tabIndex={0}
                className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[2rem] border-2 border-dashed border-secondary-300 bg-white/40 py-14 text-center transition-colors hover:border-primary-400 hover:bg-primary-50/40"
              >
                <UploadCloud className="h-10 w-10 text-secondary-300" />
                <p className="text-sm font-bold text-secondary-700">
                  {file ? file.name : "Click to choose a file, or drag it here"}
                </p>
                <p className="text-xs text-secondary-400">Your logo displays instantly once saved.</p>
              </div>

              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED.join(",")}
                onChange={onFileChange}
                className="hidden"
              />

              <div className="mt-6 flex items-center justify-end gap-3">
                {file ? (
                  <Button
                    variant="secondary"
                    onClick={() => setFile(null)}
                    leftIcon={<Trash2 className="h-4 w-4" />}
                    disabled={uploadMutation.isPending}
                  >
                    Discard
                  </Button>
                ) : null}
                <Button
                  onClick={save}
                  disabled={!file || uploadMutation.isPending}
                  leftIcon={
                    uploadMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UploadCloud className="h-4 w-4" />
                    )
                  }
                >
                  {uploadMutation.isPending ? "Uploading…" : "Save logo"}
                </Button>
              </div>
            </div>

            <p className="px-2 text-xs leading-relaxed text-secondary-400">
              Once saved, your logo replaces the default mark in the staff sidebar and appears in your
              patients' portal header. It may take a moment to refresh on already-open pages.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
