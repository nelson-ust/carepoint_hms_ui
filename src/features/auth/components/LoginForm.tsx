import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Mail, Building2, ChevronRight, AlertCircle, ShieldCheck } from "lucide-react";
import { routes } from "@/config/routes";
import { login } from "@/features/auth/api/auth.api";
import { localStorageService, storageKeys } from "@/lib/storage/local-storage";
import { resolveTenantCode } from "@/lib/tenant/tenant-resolver";

export function LoginForm() {
  const navigate = useNavigate();
  const urlTenant = resolveTenantCode();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [tenantCode, setTenantCode] = useState(urlTenant || "");
  const [isSaaSAdmin, setIsSaaSAdmin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Sync tenantCode if URL changes or on mount
  useEffect(() => {
    if (urlTenant) {
      setTenantCode(urlTenant);
      setIsSaaSAdmin(false);
    }
  }, [urlTenant]);

  // Show a friendly notice if the api-client bounced the user here after a 401
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reason = params.get("reason");
    if (reason === "session_expired") {
      setInfo("Your session has expired. Please sign in again to continue.");
    } else if (reason === "unauthorized") {
      setInfo("Please sign in to access this page.");
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Header strategy:
      //  - SaaS admin: pass "" so the api-client suppresses the auto-injected
      //    X-Tenant-Code header (SaaS endpoints don't expect it).
      //  - Tenant login from subdomain: pass undefined to let the interceptor
      //    pick the tenant code from the URL / localStorage.
      //  - Manual tenant entry: pass the typed code explicitly.
      const effectiveTenantCode = isSaaSAdmin
        ? ""
        : urlTenant
          ? urlTenant
          : tenantCode || undefined;

      // Persist or clear the tenant code for subsequent requests
      if (effectiveTenantCode && effectiveTenantCode !== "") {
        localStorageService.set(storageKeys.tenantCode, effectiveTenantCode);
      } else if (isSaaSAdmin) {
        localStorageService.remove(storageKeys.tenantCode);
      }

      const result = await login(
        { identifier, password, remember_me: false },
        effectiveTenantCode,
      );

      // ----- Two-factor branch -----
      // If the backend says 2FA is required, we DON'T store the tokens yet —
      // they'll be returned after a successful /auth/two-factor/verify call.
      // Route the user to the dedicated 2FA challenge page with the context
      // they need to complete the flow.
      if (result.tokens?.two_factor_required && !result.tokens.two_factor_verified) {
        navigate(routes.twoFactor, {
          state: {
            userId: result.user.id,
            identifier,
            tenantCode: effectiveTenantCode === "" ? null : effectiveTenantCode,
            isSaaSAdmin,
            // Some backends embed a pre-issued access token even when 2FA is
            // pending — pass it along so the verify call can authenticate.
            preToken: result.tokens.access_token,
          },
        });
        return;
      }

      // ----- Normal login path -----
      if (result.tokens.access_token) {
        localStorageService.set(storageKeys.accessToken, result.tokens.access_token);
      }
      if (result.tokens.refresh_token) {
        localStorageService.set(storageKeys.refreshToken, result.tokens.refresh_token);
      }
      localStorageService.set(storageKeys.user, JSON.stringify(result.user));

      // If the api-client redirected the user here from a 401, take them back
      // to where they were after a successful login. Otherwise go to dashboard.
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
      console.error("Login failed:", err);
      const data = err?.response?.data;
      const message =
        (typeof data?.message === "string" && data.message) ||
        (typeof data?.detail === "string" && data.detail) ||
        (Array.isArray(data?.detail) &&
          data.detail
            .map((d: any) => `${d.loc?.join(".") ?? "field"}: ${d.msg ?? "invalid"}`)
            .join(" · ")) ||
        "Invalid credentials or tenant code. Please try again.";
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
          <h1 className="mt-6 text-3xl font-bold tracking-tight">
            {urlTenant ? `${urlTenant} Workspace` : "Welcome back"}
          </h1>
          <p className="mt-2 text-slate-500 text-sm">
            {isSaaSAdmin
              ? "Secure platform administration portal"
              : urlTenant
                ? `Authorized access for ${urlTenant}  staff`
                : "Enter your credentials to access your workspace"}
          </p>
        </div>

        <div className="glass-card rounded-3xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {info && !error && (
              <div className="flex items-center gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-700 border border-amber-100 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p>{info}</p>
              </div>
            )}
            {error && (
              <div className="flex items-center gap-3 rounded-xl bg-rose-50 p-4 text-sm text-rose-600 border border-rose-100 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {/* Only show Tenant Code field if not resolved from URL and not SaaS Admin */}
            {!urlTenant && !isSaaSAdmin && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <label className="text-sm font-semibold text-slate-700 ml-1">Tenant Code</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <input
                    value={tenantCode}
                    onChange={(e) => setTenantCode(e.target.value.toUpperCase())}
                    className="input-field pl-11"
                    placeholder="e.g. STNICHOLAS"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1">Email or Username</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="input-field pl-11"
                  placeholder="admin@live.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="text-sm font-semibold text-slate-700">Password</label>
                <a href="#" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                  Forgot?
                </a>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-11"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full group py-3 mt-2"
            >
              {isSubmitting ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  <span>Sign in to dashboard</span>
                  <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          {/* Only show SaaS Admin toggle if no tenant is resolved from URL */}
          {!urlTenant && (
            <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col items-center gap-4">
              <button
                onClick={() => {
                  setIsSaaSAdmin(!isSaaSAdmin);
                  setError(null);
                }}
                className="text-sm font-medium text-slate-600 hover:text-brand-navy transition-colors flex items-center gap-2"
              >
                <div className={`h-2 w-2 rounded-full ${isSaaSAdmin ? 'bg-amber-500 animate-pulse' : 'bg-slate-300'}`} />
                {isSaaSAdmin ? "Switch to Tenant Login" : "Are you a SaaS Administrator?"}
              </button>
            </div>
          )}

          {urlTenant && (
            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-400">
                Not your workspace? <a href={`http://${window.location.host.split('.').slice(1).join('.')}`} className="text-emerald-600 font-bold hover:underline">Go back to main portal</a>
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 uppercase tracking-widest font-semibold">
          Powered by Carepoint HMS v1.0
        </p>
      </div>
    </div>
  );
}

