// C:\Users\NELSON ATTAH\Desktop\carepoint\carepoint_hms_ui\src\features\landing\pages\LandingPage.tsx
// 

import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Activity,
  Ambulance,
  ArrowRight,
  BarChart3,
  Bed,
  Bell,
  Briefcase,
  Calendar,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Database,
  FileText,
  FlaskConical,
  Globe,
  HeartPulse,
  Layers,
  Lock,
  Menu,
  Moon,
  Network,
  Pill,
  Receipt,
  Scissors,
  Shield,
  ShieldCheck,
  Stethoscope,
  Sun,
  UserPlus,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { routes } from "@/config/routes";
import logo from "@/assets/logo.jpeg";

type SectionLink = { id: string; label: string };

const NAV_LINKS: SectionLink[] = [
  { id: "home", label: "Home" },
  { id: "features", label: "Features" },
  { id: "modules", label: "Modules" },
  { id: "journey", label: "Patient Journey" },
  { id: "security", label: "Security" },
  { id: "contact", label: "Get Started" },
];

export function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const [activeSection, setActiveSection] = useState<string>("home");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Highlight the nav link of whichever section is most in-view.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActiveSection(visible.target.id);
      },
      { rootMargin: "-30% 0px -50% 0px", threshold: [0.1, 0.4, 0.6] },
    );
    NAV_LINKS.forEach((link) => {
      const el = document.getElementById(link.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const handleAnchor = (id: string) => {
    setMobileNavOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary-50 via-white to-primary-50/40 dark:from-secondary-950 dark:via-secondary-900 dark:to-secondary-950 text-secondary-900 dark:text-secondary-100 selection:bg-primary-500/30 selection:text-primary-900">
      {/* Smooth scroll + scroll-margin for sticky nav */}
      <style>{`
        html { scroll-behavior: smooth; }
        section[id] { scroll-margin-top: 5rem; }
        @keyframes float-slow { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-12px); } }
        .float-slow { animation: float-slow 6s ease-in-out infinite; }
      `}</style>

      {/* ============== STICKY NAV ============== */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 dark:bg-secondary-950/70 border-b border-secondary-400 dark:border-white/50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
          <button
            onClick={() => handleAnchor("home")}
            className="flex items-center gap-3 group"
          >
            <div className="h-12 w-12 rounded-2xl bg-white flex items-center justify-center shadow-lg shadow-primary-500/10 ring-4 ring-white/5 group-hover:scale-105 transition-transform overflow-hidden p-1">
              <img src={logo} alt="Carepoint Logo" className="h-full w-full object-contain" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-base font-black tracking-tight">Carepoint</p>
              <p className="text-[9px] uppercase tracking-[0.25em] font-bold text-primary-600 dark:text-primary-400">
                HMS Suite
              </p>
            </div>
          </button>

          <nav className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <button
                key={link.id}
                onClick={() => handleAnchor(link.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeSection === link.id
                  ? "bg-primary-500 text-white shadow-md shadow-primary-500/20"
                  : "text-secondary-500 hover:text-secondary-900 dark:hover:text-white"
                  }`}
              >
                {link.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="relative p-2.5 rounded-xl hover:bg-secondary-100 dark:hover:bg-white/5 transition-all"
            >
              <Sun
                className={`h-5 w-5 text-secondary-600 dark:text-secondary-300 transition-all ${isDark ? "scale-0 rotate-90 opacity-0" : "scale-100 opacity-100"
                  }`}
              />
              <Moon
                className={`h-5 w-5 absolute inset-0 m-auto text-secondary-300 transition-all ${isDark ? "scale-100 opacity-100" : "scale-0 -rotate-90 opacity-0"
                  }`}
              />
            </button>
            <Link
              to={routes.tenantRegister}
              className="hidden md:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-secondary-200 dark:border-white/50 text-xs font-bold uppercase tracking-widest text-secondary-700 dark:text-secondary-200 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-300 transition-all"
            >
              Register Hospital
            </Link>
            <Link
              to={routes.saasLogin}
              className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold uppercase tracking-widest shadow-lg dark:bg-primary-500 dark:hover:bg-primary-600"
            >
              SaaS Login
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label="Toggle menu"
              className="lg:hidden p-2.5 rounded-xl hover:bg-secondary-100 dark:hover:bg-white/5"
            >
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {/* Mobile drawer */}
        {mobileNavOpen && (
          <div className="lg:hidden border-t border-secondary-400 dark:border-white/50 bg-white dark:bg-secondary-950 animate-fade-in">
            <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <button
                  key={link.id}
                  onClick={() => handleAnchor(link.id)}
                  className={`text-left px-4 py-3 rounded-xl text-sm font-bold ${activeSection === link.id
                    ? "bg-primary-500 text-white"
                    : "text-secondary-600 dark:text-secondary-300 hover:bg-secondary-50 dark:hover:bg-white/5"
                    }`}
                >
                  {link.label}
                </button>
              ))}
              <Link
                to={routes.tenantRegister}
                className="mt-2 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-xs font-bold uppercase tracking-widest"
              >
                Register Hospital <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                to={routes.saasLogin}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-secondary-200 dark:border-white/50 text-secondary-700 dark:text-secondary-200 text-xs font-bold uppercase tracking-widest"
              >
                SaaS Login
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ============== HERO ============== */}
      <section
        id="home"
        className="relative min-h-[calc(100vh-5rem)] flex items-center overflow-hidden"
      >
        <DecorOrbs />
        <div className="max-w-7xl mx-auto px-6 lg:px-8 grid lg:grid-cols-12 gap-10 items-center w-full py-16">
          <div className="lg:col-span-7 space-y-8">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary-500/20 bg-primary-500/10 text-primary-700 dark:text-primary-300 text-[10px] font-bold uppercase tracking-[0.25em]">
              <Zap className="h-3 w-3" /> Multi-Tenant Healthcare OS
            </span>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black font-display tracking-tight leading-[1.05]">
              The hospital management
              <br />
              system that{" "}
              <span className="bg-gradient-to-r from-primary-500 via-primary-600 to-emerald-500 bg-clip-text text-transparent">
                actually flows.
              </span>
            </h1>
            <p className="text-base md:text-lg text-secondary-600 dark:text-secondary-300 max-w-2xl leading-relaxed">
              Carepoint HMS streamlines every step of the clinical journey — from patient
              registration and queue triage to consultations, diagnostics, pharmacy and
              billing — across single clinics or multi-branch networks.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                to={routes.tenantRegister}
                className="inline-flex items-center gap-2 px-7 py-4 rounded-2xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-black uppercase tracking-widest shadow-2xl shadow-primary-500/30 transition-all hover:-translate-y-0.5"
              >
                Register Your Hospital
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to={routes.saasLogin}
                className="inline-flex items-center gap-2 px-7 py-4 rounded-2xl bg-white dark:bg-secondary-900 border border-secondary-200 dark:border-white/50 text-secondary-900 dark:text-secondary-100 text-sm font-black uppercase tracking-widest hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-300 transition-all"
              >
                <ShieldCheck className="h-4 w-4" />
                SaaS Login
              </Link>
            </div>
            <p className="text-[11px] text-secondary-500 dark:text-secondary-400 font-bold uppercase tracking-[0.2em]">
              New here? Register your hospital — no subdomain needed.
              <button
                onClick={() => handleAnchor("features")}
                className="ml-3 text-primary-600 dark:text-primary-400 hover:underline"
              >
                Or explore features →
              </button>
            </p>

            <dl className="grid grid-cols-3 gap-4 pt-6 max-w-xl">
              {[
                { k: "11+", v: "Modules" },
                { k: "Multi", v: "Tenant" },
                { k: "Edge", v: "Sync Ready" },
              ].map((s) => (
                <div
                  key={s.v}
                  className="rounded-2xl border border-secondary-200/60 dark:border-white/50 bg-white/60 dark:bg-secondary-900/60 backdrop-blur p-4"
                >
                  <dt className="text-2xl font-black text-secondary-900 dark:text-white">
                    {s.k}
                  </dt>
                  <dd className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                    {s.v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="lg:col-span-5">
            <HeroIllustration />
          </div>
        </div>
      </section>

      {/* ============== FEATURES ============== */}
      <section id="features" className="relative min-h-screen py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <SectionHeader
            tag="Core Capabilities"
            title="Everything a hospital needs, in one platform."
            subtitle="From front-desk registration to back-office payroll, Carepoint covers the full operational surface."
          />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* ============== MODULES ============== */}
      <section id="modules" className="relative min-h-screen py-20 md:py-28 bg-secondary-50/60 dark:bg-secondary-900/40 border-y border-secondary-400 dark:border-white/50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <SectionHeader
            tag="Available Modules"
            title="Toggle on what you need. Pay for what you use."
            subtitle="Each module is self-contained and independently activatable per tenant via the SaaS subscription."
          />
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {modules.map((m) => (
              <ModuleCard key={m.code} {...m} />
            ))}
          </div>
        </div>
      </section>

      {/* ============== PATIENT JOURNEY ============== */}
      <section id="journey" className="relative min-h-screen py-20 md:py-28 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <SectionHeader
            tag="Patient Journey"
            title="A typical outpatient flow, mapped."
            subtitle="Carepoint can be customised, but here's the seven-step OPD pathway it ships ready to run."
          />
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {journey.map((step, idx) => (
              <JourneyStep key={step.title} step={step} index={idx} total={journey.length} />
            ))}
          </div>
        </div>
      </section>

      {/* ============== SECURITY ============== */}
      <section id="security" className="relative min-h-screen py-20 md:py-28 bg-secondary-900 text-white overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-primary-500/15 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-[30rem] h-[30rem] bg-emerald-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
          <SectionHeader
            tag="Security & Trust"
            title="Built for healthcare-grade compliance."
            subtitle="Tenant isolation, RBAC, 2FA, and exhaustive audit trails — security is a first-class citizen, not a bolt-on."
            inverted
          />
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {securityFeatures.map((f) => (
              <SecurityCard key={f.title} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* ============== CTA / FOOTER ============== */}
      <section
        id="contact"
        className="relative py-20 md:py-28 border-t border-secondary-400 dark:border-white/50"
      >
        <div className="max-w-5xl mx-auto px-6 lg:px-8 text-center space-y-8">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary-500/20 bg-primary-500/10 text-primary-700 dark:text-primary-300 text-[10px] font-bold uppercase tracking-[0.25em]">
            <HeartPulse className="h-3 w-3" /> Ready When You Are
          </span>
          <h2 className="text-4xl md:text-6xl font-black font-display tracking-tight leading-tight">
            Bring every department onto{" "}
            <span className="bg-gradient-to-r from-primary-500 to-emerald-500 bg-clip-text text-transparent">
              one workspace.
            </span>
          </h2>
          <p className="text-base md:text-lg text-secondary-600 dark:text-secondary-300 max-w-2xl mx-auto">
            Sign in to your tenant workspace to access the full Carepoint Suite, or contact
            our team to spin up a new tenant for your facility.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to={routes.tenantRegister}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-black uppercase tracking-widest shadow-2xl shadow-primary-500/30 transition-all hover:-translate-y-0.5"
            >
              Register Your Hospital
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              to={routes.login}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white dark:bg-secondary-900 border border-secondary-200 dark:border-white/50 text-secondary-900 dark:text-secondary-100 text-sm font-black uppercase tracking-widest hover:border-primary-500 transition-all"
            >
              <ShieldCheck className="h-4 w-4" />
              Tenant Login
            </Link>


            <Link
              to={routes.saasLogin}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white dark:bg-secondary-900 border border-secondary-200 dark:border-white/50 text-secondary-900 dark:text-secondary-100 text-sm font-black uppercase tracking-widest hover:border-primary-500 transition-all"
            >
              <ShieldCheck className="h-4 w-4" />
              SaaS Login
            </Link>
          </div>
          <p className="text-xs text-secondary-500 dark:text-secondary-400 max-w-xl mx-auto">
            Already have a tenant workspace? Sign in via your tenant subdomain (e.g.{" "}
            <span className="font-mono font-bold">your-hospital.carepoint.com</span>).
          </p>
        </div>

        <footer className="mt-20 border-t border-secondary-400 dark:border-white/50 pt-10 pb-8">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] text-secondary-400 font-bold uppercase tracking-[0.2em]">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-white flex items-center justify-center border border-secondary-200 dark:border-white/50 overflow-hidden p-1">
                <img src={logo} alt="Carepoint Logo" className="h-full w-full object-contain" />
              </div>
              <span>Carepoint HMS · © 2026</span>
            </div>
            <div className="flex items-center gap-5">
              <a href="#features" onClick={(e) => { e.preventDefault(); handleAnchor("features"); }} className="hover:text-secondary-900 dark:hover:text-white">Features</a>
              <a href="#modules" onClick={(e) => { e.preventDefault(); handleAnchor("modules"); }} className="hover:text-secondary-900 dark:hover:text-white">Modules</a>
              <a href="#security" onClick={(e) => { e.preventDefault(); handleAnchor("security"); }} className="hover:text-secondary-900 dark:hover:text-white">Security</a>
              <Link to={routes.tenantRegister} className="text-primary-600 dark:text-primary-400 hover:text-primary-700">Register</Link>
              <Link to={routes.saasLogin} className="text-primary-600 dark:text-primary-400 hover:text-primary-700">SaaS Login</Link>
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
}

// ====================================================================
// Subcomponents
// ====================================================================

function SectionHeader({
  tag,
  title,
  subtitle,
  inverted,
}: {
  tag: string;
  title: string;
  subtitle: string;
  inverted?: boolean;
}) {
  return (
    <div className={`max-w-3xl mx-auto text-center mb-14 ${inverted ? "text-white" : ""}`}>
      <span
        className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-[0.25em] mb-5 ${inverted
          ? "border-white/15 bg-white/10 text-primary-300"
          : "border-primary-500/20 bg-primary-500/10 text-primary-700 dark:text-primary-300"
          }`}
      >
        {tag}
      </span>
      <h2 className="text-3xl md:text-5xl font-black font-display tracking-tight leading-tight mb-4">
        {title}
      </h2>
      <p
        className={`text-base md:text-lg leading-relaxed ${inverted ? "text-secondary-300" : "text-secondary-600 dark:text-secondary-300"
          }`}
      >
        {subtitle}
      </p>
    </div>
  );
}

type FeatureItem = {
  title: string;
  description: string;
  icon: typeof Activity;
  tone: "primary" | "rose" | "amber" | "emerald" | "slate" | "violet";
};

const toneStyles: Record<FeatureItem["tone"], string> = {
  primary: "from-primary-500/15 to-primary-500/5 text-primary-600",
  rose: "from-rose-500/15 to-rose-500/5 text-rose-600",
  amber: "from-amber-500/15 to-amber-500/5 text-amber-600",
  emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-600",
  slate: "from-slate-500/15 to-slate-500/5 text-slate-600",
  violet: "from-fuchsia-500/15 to-fuchsia-500/5 text-fuchsia-600",
};

function FeatureCard({ title, description, icon: Icon, tone }: FeatureItem) {
  return (
    <div className="group relative rounded-[2rem] p-7 bg-white dark:bg-secondary-900 border border-secondary-400 dark:border-white/50 hover:border-primary-500/30 hover:-translate-y-1 transition-all shadow-sm hover:shadow-xl hover:shadow-primary-500/5">
      <div
        className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${toneStyles[tone]} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}
      >
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-black font-display tracking-tight mb-2">{title}</h3>
      <p className="text-sm text-secondary-600 dark:text-secondary-400 leading-relaxed">
        {description}
      </p>
    </div>
  );
}

type ModuleItem = {
  code: string;
  label: string;
  icon: typeof Activity;
};

function ModuleCard({ label, icon: Icon }: ModuleItem) {
  return (
    <div className="group rounded-2xl p-5 bg-white dark:bg-secondary-900/60 border border-secondary-400 dark:border-white/50 hover:border-primary-500/40 transition-all flex items-center gap-4">
      <div className="h-11 w-11 rounded-xl bg-primary-500/10 text-primary-600 flex items-center justify-center group-hover:bg-primary-500 group-hover:text-white transition-all shrink-0">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-black tracking-tight">{label}</p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">
          Module
        </p>
      </div>
    </div>
  );
}

type JourneyItem = {
  title: string;
  description: string;
  icon: typeof Activity;
};

function JourneyStep({
  step,
  index,
  total,
}: {
  step: JourneyItem;
  index: number;
  total: number;
}) {
  const Icon = step.icon;
  return (
    <div className="relative rounded-[2rem] p-7 bg-white dark:bg-secondary-900 border border-secondary-400 dark:border-white/50 hover:border-primary-500/40 transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className="h-12 w-12 rounded-2xl bg-primary-500 text-white flex items-center justify-center shadow-lg shadow-primary-500/20">
          <Icon className="h-6 w-6" />
        </div>
        <span className="text-[10px] font-mono font-bold text-secondary-400 uppercase tracking-widest">
          Step {index + 1} / {total}
        </span>
      </div>
      <h3 className="text-base font-black font-display tracking-tight mb-2">{step.title}</h3>
      <p className="text-sm text-secondary-600 dark:text-secondary-400 leading-relaxed">
        {step.description}
      </p>
    </div>
  );
}

function SecurityCard({ title, description, icon: Icon }: FeatureItem) {
  return (
    <div className="rounded-[2rem] p-7 bg-white/5 backdrop-blur border border-secondary-400 dark:border-white/50 hover:border-primary-500/40 transition-all">
      <div className="h-14 w-14 rounded-2xl bg-primary-500/15 text-primary-300 flex items-center justify-center mb-5">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-black font-display tracking-tight mb-2 text-white">
        {title}
      </h3>
      <p className="text-sm text-secondary-300 leading-relaxed">{description}</p>
    </div>
  );
}

// Decorative gradient orbs behind the hero
function DecorOrbs() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div className="absolute -top-32 -right-32 w-[36rem] h-[36rem] rounded-full bg-primary-500/15 blur-3xl float-slow" />
      <div className="absolute top-1/2 -left-32 w-[28rem] h-[28rem] rounded-full bg-emerald-500/10 blur-3xl" />
      <div
        className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />
    </div>
  );
}

// Hero illustration: a stylised dashboard preview using SVG + cards
function HeroIllustration() {
  return (
    <div className="relative aspect-[4/5] max-w-md mx-auto">
      <div className="absolute inset-0 rounded-[3rem] bg-gradient-to-br from-primary-500/20 via-emerald-500/10 to-transparent blur-2xl" />
      <div className="relative h-full w-full rounded-[2.5rem] overflow-hidden bg-slate-900 text-white shadow-2xl border border-white/10">
        {/* Glow */}
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-primary-500/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl" />

        <div className="relative p-7 space-y-5">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span className="ml-3 text-[9px] font-mono font-bold text-white/40 uppercase tracking-widest">
              carepoint · clinical dashboard
            </span>
          </div>

          {/* Stat strip */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { k: "47", v: "Waiting" },
              { k: "12", v: "Serving" },
              { k: "189", v: "Today" },
            ].map((s, i) => (
              <div
                key={i}
                className="rounded-2xl bg-white/5 border border-white/10 p-3"
              >
                <p className="text-2xl font-black tracking-tight">{s.k}</p>
                <p className="text-[8px] font-bold uppercase tracking-widest text-white/40 mt-0.5">
                  {s.v}
                </p>
              </div>
            ))}
          </div>

          {/* "Now serving" card */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-display font-black tracking-tight">
                A-014
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[8px] font-bold uppercase tracking-widest border border-emerald-500/30">
                Serving
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-[10px] font-black">
                JS
              </div>
              <div>
                <p className="text-xs font-bold">John Smith</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 mt-0.5">
                  Consultation Bay 4
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {["Vitals", "SOAP", "Rx"].map((p) => (
                <div
                  key={p}
                  className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-center text-[9px] font-bold uppercase tracking-widest text-white/60"
                >
                  {p}
                </div>
              ))}
            </div>
          </div>

          {/* Mock chart */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-3">
              Visit Volume · 7d
            </p>
            <svg viewBox="0 0 200 60" className="w-full h-16">
              <defs>
                <linearGradient id="chartGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgb(16,185,129)" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="rgb(16,185,129)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0,45 L25,38 L50,42 L75,28 L100,32 L125,18 L150,22 L175,12 L200,16 L200,60 L0,60 Z"
                fill="url(#chartGrad)"
              />
              <path
                d="M0,45 L25,38 L50,42 L75,28 L100,32 L125,18 L150,22 L175,12 L200,16"
                fill="none"
                stroke="rgb(16,185,129)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

// ====================================================================
// Data
// ====================================================================

const features: FeatureItem[] = [
  {
    title: "Multi-Tenant SaaS",
    description:
      "Schema-per-tenant isolation, custom domains, automated backups, usage tracking, and tier-based module toggling — out of the box.",
    icon: Globe,
    tone: "primary",
  },
  {
    title: "OPD & Patient Flow",
    description:
      "Streamlined registration, hospital-number generation, queue routing, vitals capture, and visit lifecycle orchestration across service points.",
    icon: Users,
    tone: "emerald",
  },
  {
    title: "Clinical Workflows",
    description:
      "Doctor calendars, SOAP-based consultations, ICD-10 diagnoses, clinical templates, e-prescriptions and adherence tracking.",
    icon: Stethoscope,
    tone: "rose",
  },
  {
    title: "Inpatient & Surgery",
    description:
      "Real-time bed boards, admission and discharge workflows, theatre scheduling, and ambulance fleet dispatch coordination.",
    icon: Bed,
    tone: "amber",
  },
  {
    title: "LIS & RIS",
    description:
      "Lab order management with sample tracking and result publication, plus radiology requests, modality scheduling, and reporting.",
    icon: FlaskConical,
    tone: "violet",
  },
  {
    title: "Pharmacy & Inventory",
    description:
      "Multi-store stock control, prescription verification, dispensing workflows, procurement, requisitions and goods receipt.",
    icon: Pill,
    tone: "primary",
  },
  {
    title: "Billing & Finance",
    description:
      "Consolidated invoices, cashier desk, Paystack integration, HMO claims processing, tax rules, wallets and refunds.",
    icon: CreditCard,
    tone: "emerald",
  },
  {
    title: "HR & Payroll",
    description:
      "Staff profiles, digital contracts, leave workflows, shift rosters, timesheets, payslips, salary advances and approvals.",
    icon: Briefcase,
    tone: "amber",
  },
  {
    title: "Reporting & Integrations",
    description:
      "Omnichannel notifications, scheduled jobs, advanced reports and connectors for accounting, EMR and compliance APIs.",
    icon: BarChart3,
    tone: "slate",
  },
];

const modules: ModuleItem[] = [
  { code: "CORE", label: "Core Administration", icon: Layers },
  { code: "OPD", label: "Outpatient (OPD)", icon: Users },
  { code: "IPD", label: "Inpatient (IPD)", icon: Bed },
  { code: "PHARM", label: "Pharmacy & Inventory", icon: Pill },
  { code: "LIS", label: "Laboratory (LIS)", icon: FlaskConical },
  { code: "RIS", label: "Radiology (RIS)", icon: Activity },
  { code: "BILL", label: "Billing & Finance", icon: Receipt },
  { code: "HR", label: "Human Resources", icon: Briefcase },
  { code: "OT", label: "Operating Theatre", icon: Scissors },
  { code: "AMB", label: "Ambulance Services", icon: Ambulance },
  { code: "PORTAL", label: "Patient Portal", icon: UserPlus },
  { code: "COMMS", label: "Notifications", icon: Bell },
];

const journey: JourneyItem[] = [
  {
    title: "Registration & Check-In",
    description:
      "Front-desk registration creates or verifies the patient and initiates a new visit with a unique hospital number.",
    icon: ClipboardList,
  },
  {
    title: "Upfront Billing (Optional)",
    description:
      "For fee-for-service models, the patient settles the consultation fee at the cashier desk before triage.",
    icon: Wallet,
  },
  {
    title: "Triage & Vitals",
    description:
      "The nursing station captures BP, temperature, weight, and brief triage notes that flow to the doctor.",
    icon: HeartPulse,
  },
  {
    title: "Consultation",
    description:
      "The doctor sees the patient, records SOAP notes and ICD-10 diagnoses, and raises labs, imaging and prescriptions.",
    icon: Stethoscope,
  },
  {
    title: "Investigations",
    description:
      "Lab samples and imaging studies are processed, and results stream straight back to the doctor's dashboard.",
    icon: FlaskConical,
  },
  {
    title: "Pharmacy",
    description:
      "Pharmacists verify the e-prescription against stock, dispense, and counsel the patient at the counter.",
    icon: Pill,
  },
  {
    title: "Final Billing & Discharge",
    description:
      "Outstanding balances are settled and the visit is officially closed — ready for analytics and follow-up.",
    icon: CheckCircle2,
  },
  {
    title: "Follow-Up & Adherence",
    description:
      "Reminders, refill alerts and the patient portal keep care continuous after discharge.",
    icon: Calendar,
  },
];

const securityFeatures: FeatureItem[] = [
  {
    title: "Tenant Isolation",
    description:
      "Schema-per-tenant or database-per-tenant architecture ensures one customer's data can never leak into another's.",
    icon: Database,
    tone: "primary",
  },
  {
    title: "RBAC",
    description:
      "Fine-grained, customisable role hierarchies — every permission, scoped to the right person at the right service point.",
    icon: Lock,
    tone: "primary",
  },
  {
    title: "Two-Factor Auth",
    description:
      "Email or SMS OTP enforcement plus session policies that protect every privileged login.",
    icon: ShieldCheck,
    tone: "primary",
  },
  {
    title: "Audit Logs",
    description:
      "Every PHI access and sensitive change is logged with actor, timestamp and diff — replayable for compliance.",
    icon: FileText,
    tone: "primary",
  },
  {
    title: "Edge Sync",
    description:
      "Offline-first boundary boxes let remote clinics keep operating during outages, then journal-sync when online.",
    icon: Network,
    tone: "primary",
  },
  {
    title: "Compliance-Ready",
    description:
      "Encryption at rest, TLS in transit, and structured event streams designed to fit healthcare compliance regimes.",
    icon: Shield,
    tone: "primary",
  },
];

