import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  Crown,
  Lock,
  Mail,
  Moon,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { routes } from "@/config/routes";
import { login } from "@/features/auth/api/auth.api";
import { localStorageService, storageKeys } from "@/lib/storage/local-storage";
import { useTheme } from "@/lib/theme/ThemeProvider";
import logo from "@/assets/logo.jpeg";

/**
 * SaaS Administrator login.
 *
 * Lives at /saas/login on the bare domain (no tenant subdomain). Authenticates
 * platform admins who manage tenants, billing, modules, etc. The login call is
 * made WITHOUT a tenant code header so the backend treats it as a SaaS-level
 * authentication.
 */
export function SaasLoginPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Strip any cached tenant context — SaaS admins are not bound to a tenant.
      localStorageService.remove(storageKeys.tenantCode);

      // Passing "" as the tenant code tells the api-client helper to explicitly
      // SUPPRESS the auto-injected X-Tenant-Code header. SaaS-level endpoints
      // reject the header even when it would resolve to nothing.
      const result = await login(
        { identifier, password, remember_me: false },
        "",
      );

      if (!result.success) {
        throw new Error(result.message || "Login failed.");
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

      navigate(routes.saasDashboard);
    } catch (err: any) {
      console.error("SaaS login failed:", err);
      setError(
        err?.response?.data?.message ||
        "Invalid SaaS administrator credentials. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary-950 via-secondary-900 to-secondary-950 text-white relative overflow-hidden">
      {/* Decorative orbs */}
      <div className="absolute top-0 right-0 w-[40rem] h-[40rem] rounded-full bg-primary-500/15 blur-3xl -translate-y-1/3 translate-x-1/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[32rem] h-[32rem] rounded-full bg-amber-500/10 blur-3xl translate-y-1/3 -translate-x-1/3 pointer-events-none" />

      {/* Top bar */}
      <header className="relative z-10 max-w-6xl mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
        <Link to={routes.home} className="flex items-center gap-3 group">
          <div className="h-11 w-11 rounded-2xl bg-white flex items-center justify-center shadow-lg shadow-primary-500/10 ring-4 ring-white/5 group-hover:scale-105 transition-transform overflow-hidden p-1">
            <img src={logo} alt="Carepoint Logo" className="h-full w-full object-contain" />
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-base font-black tracking-tight">Carepoint</p>
            <p className="text-[9px] uppercase tracking-[0.25em] font-bold text-primary-300">
              SaaS Console
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="relative p-2.5 rounded-xl hover:bg-white/10 transition-all"
          >
            <Sun
              className={`h-5 w-5 text-secondary-300 transition-all ${isDark ? "scale-0 rotate-90 opacity-0" : "scale-100 opacity-100"
                }`}
            />
            <Moon
              className={`h-5 w-5 absolute inset-0 m-auto text-secondary-300 transition-all ${isDark ? "scale-100 opacity-100" : "scale-0 -rotate-90 opacity-0"
                }`}
            />
          </button>
          <Link
            to={routes.home}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-secondary-300 hover:bg-white/10"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Back to Home</span>
          </Link>
        </div>
      </header>

      {/* Body */}
      <main className="relative z-10 flex flex-col items-center justify-center px-6 py-12 md:py-20">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <div className="mx-auto h-20 w-20 rounded-[1.75rem] bg-gradient-to-br from-amber-400 via-amber-500 to-rose-500 flex items-center justify-center shadow-2xl shadow-amber-500/20">
              {/* <Crown className="h-10 w-10 text-white" /> */}
              <img src={logo} alt="Carepoint Logo" className="h-full w-full object-cover" />
            </div>
            <span className="inline-flex items-center gap-2 mt-6 px-4 py-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 text-amber-300 text-[10px] font-bold uppercase tracking-[0.25em]">
              <ShieldCheck className="h-3 w-3" /> Platform Administration
            </span>
            <h1 className="mt-6 text-3xl md:text-4xl font-black font-display tracking-tight">
              SaaS Administrator
            </h1>
            <p className="mt-3 text-secondary-300 text-sm leading-relaxed max-w-sm mx-auto">
              Secure portal for Carepoint platform staff. Manage tenants, billing, modules,
              and platform-level operations.
            </p>
          </div>

          <div className="rounded-[2rem] p-8 bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-center gap-3 rounded-xl bg-rose-500/10 border border-rose-500/20 p-4 text-sm text-rose-300">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <p className="font-bold">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-300 ml-1">
                  Email or Username
                </label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-400 group-focus-within:text-primary-400 transition-colors" />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full h-12 pl-12 pr-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-secondary-500 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 transition-all"
                    placeholder="admin@carepoint.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-300">
                    Password
                  </label>
                  <Link
                    to={routes.forgotPassword}
                    className="text-[10px] font-bold text-primary-300 hover:text-primary-200 uppercase tracking-widest"
                  >
                    Forgot?
                  </Link>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-400 group-focus-within:text-primary-400 transition-colors" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-12 pl-12 pr-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-secondary-500 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 transition-all"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-black uppercase tracking-widest shadow-2xl shadow-primary-500/30 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {isSubmitting ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    <span>Access Console</span>
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-white/10 text-center">
              <p className="text-[11px] text-secondary-400 font-bold">
                Need a tenant workspace instead?
              </p>
              <Link
                to={routes.login}
                className="mt-2 inline-block text-xs font-bold text-primary-300 hover:text-primary-200 underline-offset-4 hover:underline"
              >
                Tenant staff sign-in
              </Link>
            </div>
          </div>

          <p className="text-center text-[10px] text-secondary-500 uppercase tracking-[0.25em] font-bold">
            Powered by Carepoint HMS · v1.0
          </p>
        </div>
      </main>
    </div>
  );
}
