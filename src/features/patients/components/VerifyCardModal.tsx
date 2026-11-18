import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  CreditCard,
  Keyboard,
  Loader2,
  ScanLine,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import { DxPopup, DxButton } from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import { membershipApi, formatCardMoney, type CardVerifyResult } from "../api/membership.api";

function safeDate(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export function VerifyCardModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const toast = useToast();
  const [manual, setManual] = useState("");
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [result, setResult] = useState<CardVerifyResult | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const detectorRef = useRef<any>(null);

  const supported =
    typeof window !== "undefined" && "BarcodeDetector" in (window as any);

  const verifyMut = useMutation({
    mutationFn: (code: string) => membershipApi.verify(code),
    onSuccess: (r) => setResult(r),
    onError: (err) => toast.error("Verification failed", apiErrorMessage(err, "Please try again.")),
  });

  function stopStream() {
    activeRef.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  }

  const tick = async () => {
    if (!activeRef.current || !videoRef.current || !detectorRef.current) return;
    try {
      const codes = await detectorRef.current.detect(videoRef.current);
      if (codes && codes.length > 0) {
        const raw = String(codes[0].rawValue || "").trim();
        if (raw) {
          stopStream();
          verifyMut.mutate(raw);
          return;
        }
      }
    } catch {
      /* transient decode error — keep scanning */
    }
    rafRef.current = requestAnimationFrame(tick);
  };

  async function startCamera() {
    setResult(null);
    setCameraError(null);
    if (!supported) {
      setCameraError("Live scanning isn't supported in this browser. Use manual entry below.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      detectorRef.current = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
      activeRef.current = true;
      setScanning(true);
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setCameraError(
        "Couldn't access the camera. Grant camera permission, or use manual entry below.",
      );
      stopStream();
    }
  }

  function reset() {
    stopStream();
    setResult(null);
    setManual("");
    setCameraError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  // Stop the camera whenever the modal closes or unmounts.
  useEffect(() => {
    if (!isOpen) reset();
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const submitManual = () => {
    const code = manual.trim();
    if (!code) return;
    stopStream();
    verifyMut.mutate(code);
  };

  // ---- Result styling ----
  const tone = !result
    ? null
    : !result.valid
    ? "invalid"
    : result.usable
    ? "valid"
    : "warning";

  const toneStyle =
    tone === "valid"
      ? { background: "var(--dx-success-soft)", color: "var(--dx-success)", borderColor: "var(--dx-success)" }
      : tone === "warning"
      ? { background: "var(--dx-warning-soft)", color: "var(--dx-warning)", borderColor: "var(--dx-warning)" }
      : { background: "var(--dx-danger-soft)", color: "var(--dx-danger)", borderColor: "var(--dx-danger)" };

  return (
    <DxPopup isOpen={isOpen} onClose={handleClose} title="Verify membership card" size="md">
      <div className="space-y-5">
        {!result ? (
          <>
            {/* Camera viewport — intentional dark scanner surface */}
            <div className="relative overflow-hidden rounded-md border border-[var(--dx-border)]" style={{ background: "#020617" }}>
              <video
                ref={videoRef}
                muted
                playsInline
                className={`h-64 w-full object-cover ${scanning ? "" : "hidden"}`}
              />
              {!scanning ? (
                <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
                  <ScanLine className="h-10 w-10" style={{ color: "var(--dx-accent)" }} />
                  <p className="text-[14px] font-semibold text-white">Scan a card's QR code</p>
                  <p className="max-w-xs text-[12px] text-white/50">
                    Point your camera at the QR code on the membership card to verify it.
                  </p>
                  <DxButton size="sm" variant="primary" onClick={startCamera} leftIcon={<Camera className="h-4 w-4" />} disabled={verifyMut.isPending}>
                    Start camera
                  </DxButton>
                </div>
              ) : (
                <>
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="h-40 w-40 rounded-xl border-2" style={{ borderColor: "var(--dx-accent)", boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)" }} />
                  </div>
                  <button onClick={stopStream} className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md bg-white/90 px-4 py-1.5 text-[12px] font-semibold text-slate-800 shadow">
                    Stop
                  </button>
                </>
              )}
            </div>

            {cameraError ? (
              <p className="flex items-center gap-2 text-[12px] font-medium text-[var(--dx-warning)]">
                <AlertTriangle className="h-4 w-4 shrink-0" /> {cameraError}
              </p>
            ) : null}

            {/* Manual entry */}
            <div className="rounded-md border border-[var(--dx-border)] p-4">
              <label className="dx-field-label mb-2 flex items-center gap-1.5">
                <Keyboard className="h-3.5 w-3.5" /> Or enter the code manually
              </label>
              <div className="flex gap-2">
                <input
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitManual()}
                  placeholder="Card number or scanned QR content"
                  className="dx-editor flex-1"
                />
                <DxButton variant="primary" onClick={submitManual} isLoading={verifyMut.isPending} disabled={!manual.trim()} leftIcon={<ShieldCheck className="h-4 w-4" />}>
                  Verify
                </DxButton>
              </div>
            </div>

            {verifyMut.isPending ? (
              <p className="flex items-center justify-center gap-2 text-[12px] text-[var(--dx-text-muted)]">
                <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
              </p>
            ) : null}
          </>
        ) : (
          /* ---- Result ---- */
          <div className="space-y-5">
            <div className="flex items-center gap-4 rounded-md border p-5" style={toneStyle}>
              {tone === "valid" ? (
                <CheckCircle2 className="h-10 w-10 shrink-0" />
              ) : tone === "warning" ? (
                <AlertTriangle className="h-10 w-10 shrink-0" />
              ) : (
                <XCircle className="h-10 w-10 shrink-0" />
              )}
              <div>
                <p className="text-[16px] font-bold">
                  {tone === "valid" ? "Valid card" : tone === "warning" ? "Card found — not usable" : "Not verified"}
                </p>
                <p className="text-[13px] font-medium">{result.message}</p>
              </div>
            </div>

            {result.valid ? (
              <div className="space-y-3 rounded-md border border-[var(--dx-border)] p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--dx-accent-soft)] text-[var(--dx-accent)]">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-[var(--dx-text)]">{result.patient_name || `Patient #${result.patient_id}`}</p>
                    {result.patient_mrn ? <p className="dx-mono text-[11px] text-[var(--dx-text-muted)]">{result.patient_mrn}</p> : null}
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 pt-1 text-sm">
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">Card number</dt>
                    <dd className="dx-mono flex items-center gap-1 font-semibold text-[var(--dx-text)]">
                      <CreditCard className="h-3.5 w-3.5 text-[var(--dx-text-muted)]" />
                      {result.card_number}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">Status</dt>
                    <dd className="font-semibold text-[var(--dx-text)]">{result.status || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">Wallet balance</dt>
                    <dd className="font-semibold text-[var(--dx-accent)]">{formatCardMoney(result.balance)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">Valid thru</dt>
                    <dd className="font-semibold text-[var(--dx-text)]">{safeDate(result.expiry_date)}</dd>
                  </div>
                  {result.hospital_name ? (
                    <div className="col-span-2">
                      <dt className="text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">Issued by</dt>
                      <dd className="font-semibold text-[var(--dx-text)]">{result.hospital_name}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              <DxButton onClick={handleClose}>Close</DxButton>
              <DxButton variant="primary" onClick={reset} leftIcon={<ScanLine className="h-4 w-4" />}>Verify another</DxButton>
            </div>
          </div>
        )}
      </div>
    </DxPopup>
  );
}
