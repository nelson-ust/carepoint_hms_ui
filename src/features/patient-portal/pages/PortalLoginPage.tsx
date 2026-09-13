import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClipboardEvent, FormEvent, KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  ChevronRight,
  HeartPulse,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  portalErrorMessage,
  storePortalSession,
} from "../api/portal.api";
import type { RequestPortalOtpResponse } from "../api/portal.api";
import {
  useRequestPortalOtp,
  useResendPortalOtp,
  useVerifyPortalOtp,
} from "../hooks/use-portal";

/**
 * The backend generates a 5-digit numeric OTP
 * (OTP_CODE_LENGTH = 5 in patient_portal_auth_service.py).
 */
const OTP_LENGTH = 5;
const RESEND_COOLDOWN_SECONDS = 30;

type Step = "identify" | "verify";

const channelOptions = [
  { value: "", label: "Auto-detect" },
  { value: "EMAIL", label: "Email" },
  { value: "SMS", label: "SMS" },
];

export function PortalLoginPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("identify");
  const [tenantCode, setTenantCode] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [channel, setChannel] = useState("");
  const [otpMeta, setOtpMeta] = useState<RequestPortalOtpResponse | null>(null);
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const requestOtp = useRequestPortalOtp();
  const verifyOtp = useVerifyPortalOtp();
  const resendOtp = useResendPortalOtp();

  // ---- resend cooldown ticker -------------------------------------
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(
      () => setCooldown((s) => (s > 0 ? s - 1 : 0)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const otpCode = useMemo(() => digits.join(""), [digits]);
  const normalizedTenant = tenantCode.trim().toUpperCase();

  // ---- step 1: identify --------------------------------------------
  function handleRequestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    requestOtp.mutate(
      {
        payload: {
          identifier: identifier.trim(),
          channel: channel ? (channel as "EMAIL" | "SMS") : undefined,
        },
        tenantCode: normalizedTenant,
      },
      {
        onSuccess: (result) => {
          setOtpMeta(result);
          setDigits(Array(OTP_LENGTH).fill(""));
          setCooldown(RESEND_COOLDOWN_SECONDS);
          setStep("verify");
          window.setTimeout(() => inputRefs.current[0]?.focus(), 60);
        },
        onError: (err) => {
          setError(
            portalErrorMessage(
              err,
              "We could not find a matching patient. Check the hospital code and your details.",
            ),
          );
        },
      },
    );
  }

  // ---- step 2: verify ----------------------------------------------
  const submitVerification = useCallback(
    (code: string) => {
      if (!otpMeta || verifyOtp.isPending) return;
      setError(null);

      verifyOtp.mutate(
        {
          payload: { otp_id: otpMeta.otp_id, otp_code: code },
          tenantCode: normalizedTenant,
        },
        {
          onSuccess: (result) => {
            storePortalSession(normalizedTenant, result);
            navigate("/portal/home", { replace: true });
          },
          onError: (err) => {
            setDigits(Array(OTP_LENGTH).fill(""));
            window.setTimeout(() => inputRefs.current[0]?.focus(), 60);
            setError(
              portalErrorMessage(err, "That code did not match. Please try again."),
            );
          },
        },
      );
    },
    [otpMeta, verifyOtp, normalizedTenant, navigate],
  );

  function setDigitAt(index: number, value: string) {
    setDigits((prev) => {
      const next = [...prev];
      next[index] = value;
      const complete = next.join("");
      if (complete.length === OTP_LENGTH && next.every((d) => d !== "")) {
        window.setTimeout(() => submitVerification(complete), 40);
      }
      return next;
    });
  }

  function handleDigitChange(index: number, raw: string) {
    const value = raw.replace(/\D/g, "");
    if (!value) {
      setDigitAt(index, "");
      return;
    }
    // Handle multi-character input (mobile keyboards, quick typing)
    const chars = value.slice(0, OTP_LENGTH - index).split("");
    setDigits((prev) => {
      const next = [...prev];
      chars.forEach((c, offset) => {
        next[index + offset] = c;
      });
      const focusIndex = Math.min(index + chars.length, OTP_LENGTH - 1);
      window.setTimeout(() => inputRefs.current[focusIndex]?.focus(), 0);
      const complete = next.join("");
      if (complete.length === OTP_LENGTH && next.every((d) => d !== "")) {
        window.setTimeout(() => submitVerification(complete), 40);
      }
      return next;
    });
  }

  function handleDigitKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      if (digits[index]) {
        setDigitAt(index, "");
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
        setDigitAt(index - 1, "");
      }
      event.preventDefault();
    } else if (event.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;
    const chars = pasted.slice(0, OTP_LENGTH).split("");
    const next = Array(OTP_LENGTH).fill("") as string[];
    chars.forEach((c, i) => {
      next[i] = c;
    });
    setDigits(next);
    const focusIndex = Math.min(chars.length, OTP_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();
    if (chars.length === OTP_LENGTH) {
      window.setTimeout(() => submitVerification(next.join("")), 40);
    }
  }

  function handleResend() {
    if (!otpMeta || cooldown > 0 || resendOtp.isPending) return;
    setError(null);
    resendOtp.mutate(
      { payload: { otp_id: otpMeta.otp_id }, tenantCode: normalizedTenant },
      {
        onSuccess: (result) => {
          setOtpMeta(result);
          setDigits(Array(OTP_LENGTH).fill(""));
          setCooldown(RESEND_COOLDOWN_SECONDS);
          window.setTimeout(() => inputRefs.current[0]?.focus(), 60);
        },
        onError: (err) => {
          setError(portalErrorMessage(err, "Could not resend the code. Try again."));
        },
      },
    );
  }

  function backToIdentify() {
    setStep("identify");
    setOtpMeta(null);
    setDigits(Array(OTP_LENGTH).fill(""));
    setError(null);
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
      {/* Ambient gradient background */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-emerald-950 via-slate-950 to-teal-950" />
      <div className="absolute -top-32 -left-32 z-0 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="absolute -bottom-40 -right-24 z-0 h-[28rem] w-[28rem] rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="absolute inset-0 z-[1] bg-gradient-to-br from-slate-950/80 via-slate-900/50 to-emerald-950/80" />

      <div className="relative z-10 flex w-full max-w-lg flex-col items-center">
        {/* Branding */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[2rem] bg-emerald-500/15 text-emerald-400 shadow-[0_20px_50px_rgba(16,185,129,0.25)] ring-8 ring-white/5">
            <HeartPulse className="h-10 w-10" aria-hidden />
          </div>
          <h1 className="font-display text-4xl font-black tracking-tighter text-white">
            CarePoint<span className="text-emerald-400"> Patient</span>
          </h1>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.4em] text-emerald-400/80">
            Your health, in your hands
          </p>
        </div>

        {/* Card */}
        <div className="w-full rounded-[2.5rem] border border-white/15 bg-white/10 p-8 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] backdrop-blur-3xl sm:p-10">
          {step === "identify" ? (
            <>
              <div className="mb-8 text-center">
                <h2 className="text-2xl font-black tracking-tight text-white">
                  Welcome back
                </h2>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <Sparkles className="h-4 w-4 animate-pulse text-emerald-400" />
                  <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
                    Sign in with a one-time code
                  </p>
                </div>
              </div>

              <form onSubmit={handleRequestOtp} className="space-y-5">
                {error ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <p className="font-medium">{error}</p>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <label
                    htmlFor="portal-tenant"
                    className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400"
                  >
                    Hospital code
                  </label>
                  <div className="group relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-5 text-slate-500 transition-colors group-focus-within:text-emerald-400">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <input
                      id="portal-tenant"
                      type="text"
                      value={tenantCode}
                      onChange={(e) => setTenantCode(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-12 pr-5 font-medium uppercase tracking-widest text-white outline-none transition-all placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-600 focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/40"
                      placeholder="e.g. STNICHOLAS"
                      autoComplete="organization"
                      required
                    />
                  </div>
                  <p className="ml-1 text-xs text-slate-500">
                    The short code your hospital gave you.
                  </p>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="portal-identifier"
                    className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400"
                  >
                    Phone, email or hospital number
                  </label>
                  <div className="group relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-5 text-slate-500 transition-colors group-focus-within:text-emerald-400">
                      <UserRound className="h-5 w-5" />
                    </div>
                    <input
                      id="portal-identifier"
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-12 pr-5 font-medium text-white outline-none transition-all placeholder:text-slate-600 focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/40"
                      placeholder="you@example.com or 0801 234 5678"
                      autoComplete="username"
                      required
                      minLength={3}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="portal-channel"
                    className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400"
                  >
                    Send my code via
                  </label>
                  <select
                    id="portal-channel"
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                    className="w-full cursor-pointer appearance-none rounded-2xl border border-white/10 bg-white/5 px-5 py-4 font-medium text-white outline-none transition-all focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/40"
                  >
                    {channelOptions.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-slate-900">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={requestOtp.isPending}
                  className="group mt-2 flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-500 py-4 text-xs font-black uppercase tracking-widest text-white shadow-[0_10px_30px_rgba(16,185,129,0.3)] transition-all hover:scale-[1.02] hover:bg-emerald-600 active:scale-[0.98] disabled:opacity-50"
                >
                  {requestOtp.isPending ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <>
                      <span>Send my code</span>
                      <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="mb-8 text-center">
                <h2 className="text-2xl font-black tracking-tight text-white">
                  Enter your code
                </h2>
                <p className="mt-2 text-sm font-medium text-slate-400">
                  We sent a {OTP_LENGTH}-digit code to{" "}
                  <span className="font-bold text-emerald-400">
                    {otpMeta?.masked_destination}
                  </span>{" "}
                  via {otpMeta?.channel === "SMS" ? "SMS" : "email"}.
                </p>
              </div>

              {error ? (
                <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <p className="font-medium">{error}</p>
                </div>
              ) : null}

              {/* OTP boxes */}
              <div className="flex items-center justify-center gap-3">
                {digits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    maxLength={OTP_LENGTH}
                    value={digit}
                    onChange={(e) => handleDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(index, e)}
                    onPaste={handlePaste}
                    onFocus={(e) => e.target.select()}
                    aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
                    className={cn(
                      "h-14 w-12 rounded-2xl border bg-white/5 text-center font-display text-2xl font-black text-white outline-none transition-all sm:h-16 sm:w-14",
                      digit
                        ? "border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                        : "border-white/10",
                      "focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/40",
                    )}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => submitVerification(otpCode)}
                disabled={otpCode.length < OTP_LENGTH || verifyOtp.isPending}
                className="group mt-8 flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-500 py-4 text-xs font-black uppercase tracking-widest text-white shadow-[0_10px_30px_rgba(16,185,129,0.3)] transition-all hover:scale-[1.02] hover:bg-emerald-600 active:scale-[0.98] disabled:opacity-50"
              >
                {verifyOtp.isPending ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    <span>Verify &amp; sign in</span>
                  </>
                )}
              </button>

              {/* Resend + back */}
              <div className="mt-6 flex flex-col items-center gap-4">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || resendOtp.isPending}
                  className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-400 transition-colors hover:text-emerald-300 disabled:cursor-not-allowed disabled:text-slate-500"
                >
                  <RefreshCw
                    className={cn("h-3.5 w-3.5", resendOtp.isPending && "animate-spin")}
                  />
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                </button>
                <button
                  type="button"
                  onClick={backToIdentify}
                  className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-colors hover:text-slate-300"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Use different details
                </button>
              </div>
            </>
          )}
        </div>

        <p className="mt-10 text-center text-[9px] font-black uppercase tracking-[0.4em] text-slate-600">
          CarePoint HMS • Patient Portal
        </p>
      </div>
    </div>
  );
}
