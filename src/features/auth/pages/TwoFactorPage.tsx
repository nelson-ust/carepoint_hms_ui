import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  Send,
  ShieldCheck,
} from "lucide-react";
import { routes } from "@/config/routes";
import { resendOtp, verifyTwoFactor } from "@/features/auth/api/auth.api";
import { localStorageService, storageKeys } from "@/lib/storage/local-storage";

type LocationState = {
  userId?: number;
  identifier?: string;
  tenantCode?: string | null;
  isSaaSAdmin?: boolean;
  preToken?: string;
  challengeReference?: string;
} | null;

export function TwoFactorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? null) as LocationState;

  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  // Send the pre-issued access token so the verify endpoint can correlate the
  // 2FA challenge with the in-flight session.
  useEffect(() => {
    if (state?.preToken) {
      localStorageService.set(storageKeys.accessToken, state.preToken);
    }
  }, [state?.preToken]);

  useEffect(() => {
    if (!state?.userId && !state?.identifier) {
      setError("Sign in again to receive a new verification code.");
    }
  }, [state]);

  const handleChange = (idx: number, raw: string) => {
    const value = raw.replace(/\D/g, "");
    if (value.length === 0) {
      setDigits((prev) => prev.map((d, i) => (i === idx ? "" : d)));
      return;
    }
    if (value.length === 1) {
      setDigits((prev) => prev.map((d, i) => (i === idx ? value : d)));
      if (idx < 5) inputsRef.current[idx + 1]?.focus();
      return;
    }
    // Paste of the full code
    const chars = value.slice(0, 6).split("");
    setDigits((prev) => prev.map((d, i) => chars[i] ?? d));
    const last = Math.min(chars.length - 1, 5);
    inputsRef.current[last]?.focus();
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = digits.join("");
    if (code.length !== 6) {
      setError("Enter the 6-digit code we sent you.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setInfo(null);
    try {
      const tenantHeader = state?.isSaaSAdmin
        ? ""
        : state?.tenantCode || undefined;
      const result = await verifyTwoFactor(
        {
          user_id: state?.userId,
          identifier: state?.identifier,
          otp_code: code,
          challenge_reference: state?.challengeReference,
        },
        tenantHeader as string | undefined,
      );

      if (!result.success) {
        throw new Error(result.message || "Verification failed. Please try again.");
      }

      const accessToken = result.tokens?.access_token || result.access_token;
      const refreshToken = result.tokens?.refresh_token || result.refresh_token;

      if (accessToken) {
        localStorageService.set(storageKeys.accessToken, accessToken);
      }
      if (refreshToken) {
        localStorageService.set(storageKeys.refreshToken, refreshToken);
      }

      // Reconstruct user object from flat response if needed
      const user = result.user || {
        id: result.admin_id || 0,
        email: result.email || "",
        first_name: result.first_name || "",
        last_name: result.last_name || "",
        username: result.email || "",
        status: "ACTIVE",
        is_superuser: true,
        is_email_verified: true,
        is_phone_verified: true,
        is_two_factor_enabled: false,
      };

      localStorageService.set(storageKeys.user, JSON.stringify(user));

      let target: string = routes.dashboard;
      try {
        const stored = window.sessionStorage.getItem("carepoint.return_to");
        if (stored && stored !== "/login" && !stored.startsWith("/login")) {
          target = stored;
          window.sessionStorage.removeItem("carepoint.return_to");
        }
      } catch {
        /* ignore */
      }
      navigate(target);
    } catch (err: any) {
      const data = err?.response?.data;
      const message =
        (typeof data?.message === "string" && data.message) ||
        (typeof data?.detail === "string" && data.detail) ||
        "Invalid or expired verification code.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    setIsResending(true);
    setError(null);
    setInfo(null);
    try {
      const tenantHeader = state?.isSaaSAdmin
        ? ""
        : state?.tenantCode || undefined;
      const result = await resendOtp(
        {
          user_id: state?.userId,
          identifier: state?.identifier,
          purpose: "TWO_FACTOR",
        },
        tenantHeader as string | undefined,
      );
      setInfo(
        result?.message ||
          `New code sent${result?.delivery_method ? ` via ${result.delivery_method}` : ""}.`,
      );
      setDigits(["", "", "", "", "", ""]);
      inputsRef.current[0]?.focus();
    } catch (err: any) {
      const data = err?.response?.data;
      setError(
        (typeof data?.message === "string" && data.message) ||
          (typeof data?.detail === "string" && data.detail) ||
          "We couldn't send a new code. Please try again in a moment.",
      );
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 shadow-xl shadow-emerald-500/20">
            <ShieldCheck className="h-10 w-10 text-white" />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight">Two-Factor Authentication</h1>
          <p className="mt-2 text-slate-500 text-sm max-w-xs mx-auto">
            We sent a 6-digit verification code
            {state?.identifier ? ` to ${state.identifier}` : ""}. Enter it below to finish
            signing in.
          </p>
        </div>

        <div className="glass-card rounded-3xl p-8">
          {info && (
            <div className="mb-5 flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700 border border-emerald-100">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <p>{info}</p>
            </div>
          )}
          {error && (
            <div className="mb-5 flex items-center gap-3 rounded-xl bg-rose-50 p-4 text-sm text-rose-600 border border-rose-100">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-between gap-2">
              {digits.map((d, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    inputsRef.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={6}
                  value={d}
                  onChange={(e) => handleChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  autoFocus={idx === 0}
                  className="h-14 w-12 text-center text-2xl font-black font-mono rounded-2xl border-2 border-secondary-100 bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 focus:outline-none transition-all"
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full group py-3.5"
            >
              {isSubmitting ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  <span>Verify & Sign In</span>
                  <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-secondary-100 text-center space-y-2">
            <button
              onClick={handleResend}
              disabled={isResending}
              className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
            >
              {isResending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {isResending ? "Sending..." : "Resend Code"}
            </button>
            <div>
              <Link
                to={routes.login}
                className="inline-flex items-center gap-1 text-xs font-bold text-secondary-500 hover:text-secondary-800 uppercase tracking-widest"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to Sign-In
              </Link>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 uppercase tracking-widest font-semibold">
          Carepoint HMS · Two-Factor
        </p>
      </div>
    </div>
  );
}
