import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { routes } from "@/config/routes";
import { resetPassword } from "@/features/auth/api/auth.api";
import { resolveTenantCode } from "@/lib/tenant/tenant-resolver";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const urlTenant = resolveTenantCode();
  const [searchParams] = useSearchParams();
  const initialToken = searchParams.get("token") ?? "";

  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Strength heuristics — give the user a hint as they type
  const strength = passwordStrength(newPassword);

  useEffect(() => {
    if (!initialToken) {
      setError("Open this page from the reset link in your email.");
    }
  }, [initialToken]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token.trim()) {
      setError("A reset token is required.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Choose a password with at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The two passwords don't match.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await resetPassword(
        {
          reset_token: token.trim(),
          new_password: newPassword,
          confirm_new_password: confirmPassword,
        },
        urlTenant ?? undefined,
      );
      setSuccess(true);
      // Auto-bounce back to login after a beat
      window.setTimeout(() => navigate(routes.login), 1800);
    } catch (err: any) {
      const data = err?.response?.data;
      const message =
        (typeof data?.message === "string" && data.message) ||
        (typeof data?.detail === "string" && data.detail) ||
        (Array.isArray(data?.detail) &&
          data.detail
            .map((d: any) => `${d.loc?.join(".") ?? "field"}: ${d.msg ?? "invalid"}`)
            .join(" · ")) ||
        "We couldn't reset your password. The link may have expired.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 shadow-xl shadow-emerald-500/20">
            <ShieldCheck className="h-10 w-10 text-white" />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight">Set a New Password</h1>
          <p className="mt-2 text-slate-500 text-sm max-w-xs mx-auto">
            Choose a strong password to secure your account.
          </p>
        </div>

        <div className="glass-card rounded-3xl p-8">
          {success ? (
            <div className="text-center py-6 space-y-5">
              <div className="mx-auto h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-9 w-9 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Password Updated</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Redirecting you back to sign-in...
                </p>
              </div>
              <Link to={routes.login} className="btn-primary inline-flex gap-2 px-6">
                <ChevronRight className="h-4 w-4" />
                Sign In Now
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

              {/* Hidden / shown reset token — usually carried in the URL but we
                  let the user paste it manually as a fallback. */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 ml-1">
                  Reset Token
                </label>
                <div className="relative group">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                  <input
                    type="text"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="input-field pl-11 font-mono text-xs"
                    placeholder="From your reset link"
                    required
                  />
                </div>
                {!initialToken && (
                  <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">
                    Token auto-fills when opened from the email link
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 ml-1">
                  New Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input-field pl-11 pr-11"
                    placeholder="••••••••"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-secondary-100 text-secondary-500"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {newPassword && <StrengthMeter strength={strength} />}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 ml-1">
                  Confirm New Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input-field pl-11"
                    placeholder="••••••••"
                    minLength={8}
                    required
                  />
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">
                    Passwords don't match
                  </p>
                )}
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
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    <span>Update Password</span>
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
          Carepoint HMS · Account Security
        </p>
      </div>
    </div>
  );
}

// =====================================================================
// Helpers
// =====================================================================

type Strength = "weak" | "fair" | "good" | "strong";

function passwordStrength(value: string): Strength {
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[A-Z]/.test(value)) score++;
  if (/[0-9]/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  if (score <= 1) return "weak";
  if (score === 2) return "fair";
  if (score === 3) return "good";
  return "strong";
}

const strengthStyles: Record<Strength, { label: string; bar: string; text: string }> = {
  weak: { label: "Weak", bar: "w-1/4 bg-rose-500", text: "text-rose-500" },
  fair: { label: "Fair", bar: "w-2/4 bg-amber-500", text: "text-amber-600" },
  good: { label: "Good", bar: "w-3/4 bg-primary-500", text: "text-primary-600" },
  strong: { label: "Strong", bar: "w-full bg-emerald-500", text: "text-emerald-600" },
};

function StrengthMeter({ strength }: { strength: Strength }) {
  const s = strengthStyles[strength];
  return (
    <div className="space-y-1.5 pt-1">
      <div className="h-1.5 bg-secondary-100 rounded-full overflow-hidden">
        <div className={`h-full ${s.bar} transition-all duration-300`} />
      </div>
      <p className={`text-[10px] font-bold uppercase tracking-widest ${s.text}`}>
        {s.label} password
      </p>
    </div>
  );
}
