import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  KeyRound,
  Mail,
  Send,
} from "lucide-react";
import { routes } from "@/config/routes";
import { forgotPassword } from "@/features/auth/api/auth.api";
import { resolveTenantCode } from "@/lib/tenant/tenant-resolver";

export function ForgotPasswordPage() {
  const urlTenant = resolveTenantCode();
  const [identifier, setIdentifier] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!identifier.trim()) {
      setError("Enter your email or username.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await forgotPassword(
        { identifier: identifier.trim() },
        // When the user is on a tenant subdomain, send the tenant header so
        // the backend can locate the user record. On the bare domain, omit it.
        urlTenant ?? undefined,
      );
      setSuccess(
        result?.message ||
          "If an account exists for that identifier, a reset link has been sent.",
      );
    } catch (err: any) {
      const data = err?.response?.data;
      setError(
        (typeof data?.message === "string" && data.message) ||
          (typeof data?.detail === "string" && data.detail) ||
          "We couldn't process that request. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500 shadow-xl shadow-amber-500/20">
            <KeyRound className="h-10 w-10 text-white" />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight">Forgot Your Password?</h1>
          <p className="mt-2 text-slate-500 text-sm max-w-xs mx-auto">
            Enter your account email or username — we'll send a reset link if a matching
            record is found.
          </p>
        </div>

        <div className="glass-card rounded-3xl p-8">
          {success ? (
            <div className="text-center py-6 space-y-5">
              <div className="mx-auto h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-9 w-9 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Check Your Inbox</h2>
                <p className="mt-2 text-sm text-slate-600">{success}</p>
              </div>
              <Link to={routes.login} className="btn-secondary inline-flex gap-2 px-6">
                <ArrowLeft className="h-4 w-4" />
                Back to Sign-In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-center gap-3 rounded-xl bg-rose-50 p-4 text-sm text-rose-600 border border-rose-100">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 ml-1">
                  Email or Username
                </label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-amber-500 transition-colors" />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="input-field pl-11"
                    placeholder="you@hospital.com"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full group py-3.5 bg-amber-500 hover:bg-amber-600 shadow-amber-500/20"
              >
                {isSubmitting ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    <span>Send Reset Link</span>
                    <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>

              <div className="mt-6 pt-6 border-t border-slate-100 text-center">
                <Link
                  to={routes.login}
                  className="inline-flex items-center gap-1 text-xs font-bold text-secondary-500 hover:text-secondary-800 uppercase tracking-widest"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back to Sign-In
                </Link>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 uppercase tracking-widest font-semibold">
          Carepoint HMS · Account Recovery
        </p>
      </div>
    </div>
  );
}
