import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Sparkles, Building2 } from "lucide-react";
import { TenantRegistrationForm } from "../components/TenantRegistrationForm";
import { routes } from "@/config/routes";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { Sun, Moon } from "lucide-react";

export function TenantRegisterPage() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary-50 via-white to-primary-50/40 dark:from-secondary-950 dark:via-secondary-900 dark:to-secondary-950 text-secondary-900 dark:text-secondary-100">
      {/* Top bar */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/70 dark:bg-secondary-950/70 border-b border-secondary-100 dark:border-white/5">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link to={routes.home} className="flex items-center gap-3 group">
            <div className="h-11 w-11 rounded-2xl bg-primary-500 flex items-center justify-center shadow-lg shadow-primary-500/30 ring-4 ring-primary-500/10 group-hover:scale-105 transition-transform">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-base font-black tracking-tight">Carepoint</p>
              <p className="text-[9px] uppercase tracking-[0.25em] font-bold text-primary-600 dark:text-primary-400">
                HMS Suite
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="relative p-2.5 rounded-xl hover:bg-secondary-100 dark:hover:bg-white/5"
            >
              <Sun
                className={`h-5 w-5 text-secondary-600 dark:text-secondary-300 transition-all ${
                  isDark ? "scale-0 rotate-90 opacity-0" : "scale-100 opacity-100"
                }`}
              />
              <Moon
                className={`h-5 w-5 absolute inset-0 m-auto text-secondary-300 transition-all ${
                  isDark ? "scale-100 opacity-100" : "scale-0 -rotate-90 opacity-0"
                }`}
              />
            </button>
            <Link
              to={routes.home}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-secondary-600 dark:text-secondary-300 hover:bg-secondary-100 dark:hover:bg-white/5"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Back to Home</span>
            </Link>
            <Link
              to={routes.login}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-secondary-200 dark:border-white/10 text-xs font-bold uppercase tracking-widest hover:border-primary-500 transition-all"
            >
              Already Onboarded? Sign In
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 lg:px-8 py-12 md:py-16">
        {/* Hero strip */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary-500/20 bg-primary-500/10 text-primary-700 dark:text-primary-300 text-[10px] font-bold uppercase tracking-[0.25em] mb-5">
            <Sparkles className="h-3 w-3" /> Hospital Onboarding
          </span>
          <h1 className="text-3xl md:text-5xl font-black font-display tracking-tight leading-tight mb-4">
            Bring your hospital onto{" "}
            <span className="bg-gradient-to-r from-primary-500 to-emerald-500 bg-clip-text text-transparent">
              Carepoint.
            </span>
          </h1>
          <p className="text-base md:text-lg text-secondary-600 dark:text-secondary-300 leading-relaxed">
            Tell us about your facility and create your administrator account. We'll
            provision your isolated workspace and email you setup instructions.
          </p>
        </div>

        {/* Three-step preview */}
        <div className="grid gap-4 md:grid-cols-4 max-w-4xl mx-auto mb-12">
          {[
            { n: 1, t: "Identity", d: "Hospital name & code" },
            { n: 2, t: "Billing", d: "Contact & address" },
            { n: 3, t: "Admin", d: "First user account" },
            { n: 4, t: "Plan", d: "Choose subscription" },
          ].map((s) => (
            <div
              key={s.n}
              className="p-4 rounded-2xl bg-white/60 dark:bg-secondary-900/60 border border-secondary-200/60 dark:border-white/5 backdrop-blur"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-8 rounded-xl bg-primary-500/15 text-primary-600 dark:text-primary-300 flex items-center justify-center text-xs font-black">
                  {s.n}
                </div>
                <p className="text-sm font-black tracking-tight">{s.t}</p>
              </div>
              <p className="text-[11px] font-bold text-secondary-500 uppercase tracking-widest">
                {s.d}
              </p>
            </div>
          ))}
        </div>

        {/* Form */}
        <TenantRegistrationForm />

        <p className="text-center mt-12 text-xs text-secondary-400 flex items-center justify-center gap-2">
          <Building2 className="h-3 w-3" />
          Already have a tenant workspace?{" "}
          <Link
            to={routes.login}
            className="font-bold text-primary-600 dark:text-primary-400 hover:underline"
          >
            Sign in via your subdomain
          </Link>
        </p>
      </main>
    </div>
  );
}
