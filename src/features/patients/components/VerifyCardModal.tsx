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
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
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

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Verify membership card" size="md">
      <div className="space-y-5">
        {!result ? (
          <>
            {/* Camera viewport */}
            <div className="relative overflow-hidden rounded-2xl border border-secondary-200 bg-secondary-950 dark:border-white/10">
              <video
                ref={videoRef}
                muted
                playsInline
                className={`h-64 w-full object-cover ${scanning ? "" : "hidden"}`}
              />
              {!scanning ? (
                <div className="flex h-64 flex-col items-center justify-center gap-3 text-center text-secondary-300">
                  <ScanLine className="h-10 w-10 text-primary-400" />
                  <p className="text-sm font-semibold text-white">Scan a card's QR code</p>
                  <p className="max-w-xs text-xs text-secondary-400">
                    Point your camera at the QR code on the membership card to verify it.
                  </p>
                  <Button
                    size="sm"
                    onClick={startCamera}
                    leftIcon={<Camera className="h-4 w-4" />}
                    disabled={verifyMut.isPending}
                  >
                    Start camera
                  </Button>
                </div>
              ) : (
                <>
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="h-40 w-40 rounded-2xl border-2 border-primary-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                  </div>
                  <button
                    onClick={stopStream}
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-xl bg-white/90 px-4 py-1.5 text-xs font-bold text-secondary-800 shadow"
                  >
                    Stop
                  </button>
                </>
              )}
            </div>

            {cameraError ? (
              <p className="flex items-center gap-2 text-xs font-medium text-amber-600">
                <AlertTriangle className="h-4 w-4 shrink-0" /> {cameraError}
              </p>
            ) : null}

            {/* Manual entry */}
            <div className="rounded-2xl border border-secondary-200 p-4 dark:border-white/10">
              <label className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-secondary-500">
                <Keyboard className="h-3.5 w-3.5" /> Or enter the code manually
              </label>
              <div className="flex gap-2">
                <input
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitManual()}
                  placeholder="Card number or scanned QR content"
                  className="flex-1 rounded-xl border border-secondary-300 bg-white/70 px-3 py-2.5 text-sm outline-none focus:border-primary-500 dark:bg-white/5"
                />
                <Button
                  onClick={submitManual}
                  isLoading={verifyMut.isPending}
                  disabled={!manual.trim()}
                  leftIcon={<ShieldCheck className="h-4 w-4" />}
                >
                  Verify
                </Button>
              </div>
            </div>

            {verifyMut.isPending ? (
              <p className="flex items-center justify-center gap-2 text-xs text-secondary-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
              </p>
            ) : null}
          </>
        ) : (
          /* ---- Result ---- */
          <div className="space-y-5">
            <div
              className={`flex items-center gap-4 rounded-2xl border p-5 ${
                tone === "valid"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : tone === "warning"
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {tone === "valid" ? (
                <CheckCircle2 className="h-10 w-10 shrink-0" />
              ) : tone === "warning" ? (
                <AlertTriangle className="h-10 w-10 shrink-0" />
              ) : (
                <XCircle className="h-10 w-10 shrink-0" />
              )}
              <div>
                <p className="text-base font-black">
                  {tone === "valid"
                    ? "Valid card"
                    : tone === "warning"
                    ? "Card found — not usable"
                    : "Not verified"}
                </p>
                <p className="text-sm font-medium">{result.message}</p>
              </div>
            </div>

            {result.valid ? (
              <div className="space-y-3 rounded-2xl border border-secondary-200 p-5 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary-900 text-white">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-secondary-900">
                      {result.patient_name || `Patient #${result.patient_id}`}
                    </p>
                    {result.patient_mrn ? (
                      <p className="data-mono text-[11px] text-secondary-400">{result.patient_mrn}</p>
                    ) : null}
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 pt-1 text-sm">
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">
                      Card number
                    </dt>
                    <dd className="data-mono flex items-center gap-1 font-semibold text-secondary-800">
                      <CreditCard className="h-3.5 w-3.5 text-secondary-400" />
                      {result.card_number}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">
                      Status
                    </dt>
                    <dd className="font-semibold text-secondary-800">{result.status || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">
                      Wallet balance
                    </dt>
                    <dd className="font-semibold text-primary-600">{formatCardMoney(result.balance)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">
                      Valid thru
                    </dt>
                    <dd className="font-semibold text-secondary-800">{safeDate(result.expiry_date)}</dd>
                  </div>
                  {result.hospital_name ? (
                    <div className="col-span-2">
                      <dt className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">
                        Issued by
                      </dt>
                      <dd className="font-semibold text-secondary-800">{result.hospital_name}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            ) : null}

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={handleClose}>
                Close
              </Button>
              <Button onClick={reset} leftIcon={<ScanLine className="h-4 w-4" />}>
                Verify another
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
