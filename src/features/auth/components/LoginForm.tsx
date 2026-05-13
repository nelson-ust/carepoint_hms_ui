import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Mail, Building2, ChevronRight, AlertCircle, ShieldCheck, Heart, Sparkles, Eye, EyeOff } from "lucide-react";
import { routes } from "@/config/routes";
import { login } from "@/features/auth/api/auth.api";
import { localStorageService, storageKeys } from "@/lib/storage/local-storage";
import { resolveTenantCode } from "@/lib/tenant/tenant-resolver";
import logo from "@/assets/logo.jpeg";

const backgroundImages = [
  "/nigeria_hospital_reception_1_1778593918777.png",
  "/nigeria_hospital_doctors_2_1778593934424.png",
  "/nigeria_hospital_tech_3_1778593950760.png",
  "/nigeria_hospital_pediatrics_4_1778593966044.png",
  "/nigeria_hospital_exterior_5_1778593988122.png",
  "/nigeria_hospital_surgery_6_1778594007242.png",
  "/nigeria_hospital_consultation_7_1778594026243.png",
];

export function LoginForm() {
  const navigate = useNavigate();
  const urlTenant = resolveTenantCode();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [tenantCode, setTenantCode] = useState(urlTenant || "");
  const [isSaaSAdmin, setIsSaaSAdmin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Slideshow State
  const [bgIndex, setBgIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setBgIndex((prev) => (prev + 1) % backgroundImages.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (urlTenant) {
      setTenantCode(urlTenant);
      setIsSaaSAdmin(false);
    }
  }, [urlTenant]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reason = params.get("reason");
    if (reason === "session_expired") {
      setInfo("Your session has expired. Please sign in again.");
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const effectiveTenantCode = isSaaSAdmin ? "" : urlTenant || tenantCode || undefined;

      if (effectiveTenantCode && effectiveTenantCode !== "") {
        localStorageService.set(storageKeys.tenantCode, effectiveTenantCode);
      } else if (isSaaSAdmin) {
        localStorageService.remove(storageKeys.tenantCode);
      }

      const result = await login({ identifier, password, remember_me: rememberMe }, effectiveTenantCode);

      if (result.tokens?.two_factor_required && !result.tokens.two_factor_verified) {
        navigate(routes.twoFactor, {
          state: {
            userId: result.user?.id || result.admin_id,
            identifier,
            tenantCode: effectiveTenantCode === "" ? null : effectiveTenantCode,
            isSaaSAdmin,
            preToken: result.tokens.access_token,
          },
        });
        return;
      }

      if (!result.success) throw new Error(result.message || "Login failed.");

      const accessToken = result.tokens?.access_token || result.access_token;
      const refreshToken = result.tokens?.refresh_token || result.refresh_token;

      if (!accessToken) throw new Error("No access token received.");

      localStorageService.set(storageKeys.accessToken, accessToken);
      if (refreshToken) localStorageService.set(storageKeys.refreshToken, refreshToken);

      const rawUser = (result.user || result) as any;
      const user = {
        id: rawUser.id || rawUser.admin_id || 0,
        email: rawUser.email || "",
        first_name: rawUser.first_name || "",
        last_name: rawUser.last_name || "",
        name: rawUser.name || `${rawUser.first_name || ""} ${rawUser.last_name || ""}`.trim() || "User",
        username: rawUser.username || rawUser.email || "",
        status: rawUser.status || "ACTIVE",
        role: rawUser.role || (isSaaSAdmin ? "SAAS_ADMIN" : "STAFF"),
        is_superuser: !!rawUser.is_superuser,
        is_email_verified: !!rawUser.is_email_verified,
        is_phone_verified: !!rawUser.is_phone_verified,
        is_two_factor_enabled: !!rawUser.is_two_factor_enabled,
        is_saas_admin: isSaaSAdmin,
      };

      localStorageService.set(storageKeys.user, JSON.stringify(user));

      let target: string = isSaaSAdmin ? routes.saasDashboard : routes.dashboard;
      try {
        const stored = window.sessionStorage.getItem("carepoint.return_to");
        if (stored && stored !== "/login" && !stored.startsWith("/login")) {
          target = stored;
          window.sessionStorage.removeItem("carepoint.return_to");
        }
      } catch { /* ignore */ }
      navigate(target);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Invalid credentials. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-slate-950">
      {/* Background Slideshow */}
      {backgroundImages.map((src, idx) => (
        <div
          key={src}
          className={`absolute inset-0 z-0 transition-opacity duration-[3000ms] ease-in-out ${idx === bgIndex ? "opacity-40 scale-105" : "opacity-0 scale-100"
            } transform-gpu`}
          style={{
            backgroundImage: `url(${src})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      ))}

      {/* Glass Overlay */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-br from-slate-950/80 via-slate-900/40 to-emerald-950/80" />

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-xl p-4 lg:p-8 flex flex-col items-center">
        {/* Branding */}
        <div className="text-center mb-10 group">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[2.5rem] bg-white shadow-[0_20px_50px_rgba(0,0,0,0.3)] ring-8 ring-white/10 mb-6 transition-transform group-hover:scale-110 duration-500 overflow-hidden p-2">
            <img src={logo} alt="Carepoint Logo" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tighter font-display">
            Carepoint<span className="text-emerald-400">.</span>
          </h1>
          <p className="mt-3 text-emerald-400/80 font-bold text-[10px] uppercase tracking-[0.4em]">
            Enterprise Health Management
          </p>
        </div>

        {/* Login Card */}
        <div className="w-full glass-card rounded-[3rem] p-8 lg:p-12 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] bg-white/10 backdrop-blur-3xl border border-white/20">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-black text-white tracking-tight">
              {urlTenant ? `${urlTenant} Portal` : "Welcome Back"}
            </h2>
            <div className="flex items-center justify-center gap-2 mt-2">
              {/* <span className="h-1 w-8 bg-emerald-500 rounded-full" /> */}
              <p className="text-slate-400 text-xs font-medium">
                {isSaaSAdmin ? "SaaS Administration Access" : "Secure Authentication"}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="flex items-center gap-3 rounded-2xl bg-rose-500/10 p-4 text-sm text-rose-400 border border-rose-500/20 animate-shake">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="font-medium">{error}</p>
              </div>
            )}

            {!urlTenant && !isSaaSAdmin && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Active Tenant Code</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-5 text-slate-500 group-focus-within:text-emerald-400 transition-colors">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <input
                    value={tenantCode}
                    onChange={(e) => setTenantCode(e.target.value.toUpperCase())}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-5 py-4 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all outline-none"
                    placeholder="e.g. EVERCARE"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Identity</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 flex items-center pl-5 text-slate-500 group-focus-within:text-emerald-400 transition-colors">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-5 py-4 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all outline-none font-medium"
                  placeholder="Email or Username"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Passkey</label>
                <a href="#" className="text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors">Forgot Password?</a>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 flex items-center pl-5 text-slate-500 group-focus-within:text-emerald-400 transition-colors">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-14 py-4 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all outline-none"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-5 text-slate-500 hover:text-emerald-400 transition-colors focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 animate-in zoom-in duration-300" />
                  ) : (
                    <Eye className="h-5 w-5 animate-in zoom-in duration-300" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="peer appearance-none h-5 w-5 rounded-lg border border-white/10 bg-white/5 checked:bg-emerald-500 checked:border-emerald-500 transition-all cursor-pointer"
                  />
                  <div className="absolute opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none">
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-300 transition-colors">Remember Session</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full btn-primary group py-4 mt-2 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-widest text-xs shadow-[0_10px_30px_rgba(16,185,129,0.3)] flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          {!urlTenant && (
            <div className="mt-10 pt-8 border-t border-white/5 text-center">
              <button
                onClick={() => {
                  setIsSaaSAdmin(!isSaaSAdmin);
                  setError(null);
                }}
                className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-emerald-400 transition-colors"
              >
                <Sparkles className={`h-3 w-3 ${isSaaSAdmin ? 'text-amber-500 animate-pulse' : ''}`} />
                {isSaaSAdmin ? "Switch to Hospital Portal" : "Platform Administrator?"}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center space-y-4">
          <div className="flex items-center justify-center gap-6">
            <div className="flex flex-col items-center">
              <p className="text-white font-black text-xl">250+</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Hospitals</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="flex flex-col items-center">
              <p className="text-white font-black text-xl">1.2M</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Patients</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="flex flex-col items-center">
              <p className="text-white font-black text-xl">15k</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Doctors</p>
            </div>
          </div>
          <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-600">
            Carepoint HMS • Secure Health Cloud v1.0
          </p>
        </div>
      </div>
    </div>
  );
}
