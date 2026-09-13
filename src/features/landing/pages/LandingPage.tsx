import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Activity,
  Ambulance,
  ArrowRight,
  Banknote,
  BarChart3,
  Bed,
  Bell,
  Boxes,
  Briefcase,
  Building2,
  Calendar,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  Clock,
  CreditCard,
  Database,
  FileText,
  Fingerprint,
  FlaskConical,
  Gift,
  Globe,
  HeartPulse,
  Hospital,
  Layers,
  LayoutDashboard,
  Lock,
  Mail,
  Menu,
  MessageSquare,
  Monitor,
  Moon,
  Network,
  Package,
  Percent,
  Pill,
  Receipt,
  Scissors,
  Send,
  Settings as SettingsIcon,
  Shield,
  ShieldCheck,
  ShoppingCart,
  Stethoscope,
  Sun,
  Timer,
  UserRound,
  Users,
  Wallet,
  X,
  Code2,
  Coins,
  KeyRound,
  Landmark,
  Scale,
  Plug,
  Share2,
  Smartphone,
  Zap,
} from "lucide-react";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { routes } from "@/config/routes";
import logo from "@/assets/logo.jpeg";

type IconType = typeof Activity;
type SectionLink = { id: string; label: string };

const NAV_LINKS: SectionLink[] = [
  { id: "home", label: "Home" },
  { id: "features", label: "Highlights" },
  { id: "catalog", label: "All Features" },
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

  const totalFeatures = FEATURE_CATALOG.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary-50 via-white to-primary-50/40 dark:from-secondary-950 dark:via-secondary-900 dark:to-secondary-950 text-secondary-900 dark:text-secondary-100 selection:bg-primary-500/30 selection:text-primary-900">
      <style>{`
        html { scroll-behavior: smooth; }
        section[id] { scroll-margin-top: 5rem; }
        @keyframes float-slow { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-12px); } }
        .float-slow { animation: float-slow 6s ease-in-out infinite; }
      `}</style>

      {/* ============== STICKY NAV ============== */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 dark:bg-secondary-950/70 border-b border-secondary-400 dark:border-white/50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
          <button onClick={() => handleAnchor("home")} className="flex items-center gap-3 group">
            <div className="h-12 w-12 rounded-2xl bg-white flex items-center justify-center shadow-lg shadow-primary-500/10 ring-4 ring-white/5 group-hover:scale-105 transition-transform overflow-hidden p-1">
              <img src={logo} alt="Carepoint Logo" className="h-full w-full object-contain" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-base font-black tracking-tight">Carepoint</p>
              <p className="text-[9px] uppercase tracking-[0.25em] font-bold text-primary-600 dark:text-primary-400">HMS Suite</p>
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
            <button onClick={toggleTheme} aria-label="Toggle theme" className="relative p-2.5 rounded-xl hover:bg-secondary-100 dark:hover:bg-white/5 transition-all">
              <Sun className={`h-5 w-5 text-secondary-600 dark:text-secondary-300 transition-all ${isDark ? "scale-0 rotate-90 opacity-0" : "scale-100 opacity-100"}`} />
              <Moon className={`h-5 w-5 absolute inset-0 m-auto text-secondary-300 transition-all ${isDark ? "scale-100 opacity-100" : "scale-0 -rotate-90 opacity-0"}`} />
            </button>
            <Link to={routes.tenantRegister} className="hidden md:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-secondary-200 dark:border-white/50 text-xs font-bold uppercase tracking-widest text-secondary-700 dark:text-secondary-200 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-300 transition-all">
              Register Hospital
            </Link>
            <Link to={routes.saasLogin} className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold uppercase tracking-widest shadow-lg dark:bg-primary-500 dark:hover:bg-primary-600">
              SaaS Login <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button onClick={() => setMobileNavOpen((v) => !v)} aria-label="Toggle menu" className="lg:hidden p-2.5 rounded-xl hover:bg-secondary-100 dark:hover:bg-white/5">
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileNavOpen && (
          <div className="lg:hidden border-t border-secondary-400 dark:border-white/50 bg-white dark:bg-secondary-950 animate-fade-in">
            <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <button
                  key={link.id}
                  onClick={() => handleAnchor(link.id)}
                  className={`text-left px-4 py-3 rounded-xl text-sm font-bold ${activeSection === link.id ? "bg-primary-500 text-white" : "text-secondary-600 dark:text-secondary-300 hover:bg-secondary-50 dark:hover:bg-white/5"}`}
                >
                  {link.label}
                </button>
              ))}
              <Link to={routes.tenantRegister} className="mt-2 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-xs font-bold uppercase tracking-widest">
                Register Hospital <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link to={routes.saasLogin} className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-secondary-200 dark:border-white/50 text-secondary-700 dark:text-secondary-200 text-xs font-bold uppercase tracking-widest">
                SaaS Login
              </Link>
              <Link to={routes.portalLogin} className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-secondary-200 dark:border-white/50 text-secondary-700 dark:text-secondary-200 text-xs font-bold uppercase tracking-widest">
                <HeartPulse className="h-3.5 w-3.5" /> Patient Portal
              </Link>
              <Link to={routes.developerPortal} className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-secondary-200 dark:border-white/50 text-secondary-700 dark:text-secondary-200 text-xs font-bold uppercase tracking-widest">
                <Code2 className="h-3.5 w-3.5" /> Developer Portal
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ============== HERO ============== */}
      <section id="home" className="relative min-h-[calc(100vh-5rem)] flex items-center overflow-hidden">
        <DecorOrbs />
        <div className="max-w-7xl mx-auto px-6 lg:px-8 grid lg:grid-cols-12 gap-10 items-center w-full py-16">
          <div className="lg:col-span-7 space-y-8">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary-500/20 bg-primary-500/10 text-primary-700 dark:text-primary-300 text-[10px] font-bold uppercase tracking-[0.25em]">
              <Zap className="h-3 w-3" /> Multi-Tenant Healthcare OS
            </span>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black font-display tracking-tight leading-[1.05]">
              The hospital management<br />
              system that{" "}
              <span className="bg-gradient-to-r from-primary-500 via-primary-600 to-emerald-500 bg-clip-text text-transparent">actually flows.</span>
            </h1>
            <p className="text-base md:text-lg text-secondary-600 dark:text-secondary-300 max-w-2xl leading-relaxed">
              Carepoint HMS streamlines every step of the clinical journey — from patient
              registration and queue triage to consultations, diagnostics, pharmacy and
              billing — across single clinics or multi-branch networks.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link to={routes.tenantRegister} className="inline-flex items-center gap-2 px-7 py-4 rounded-2xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-black uppercase tracking-widest shadow-2xl shadow-primary-500/30 transition-all hover:-translate-y-0.5">
                Register Your Hospital <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to={routes.saasLogin} className="inline-flex items-center gap-2 px-7 py-4 rounded-2xl bg-white dark:bg-secondary-900 border border-secondary-200 dark:border-white/50 text-secondary-900 dark:text-secondary-100 text-sm font-black uppercase tracking-widest hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-300 transition-all">
                <ShieldCheck className="h-4 w-4" /> SaaS Login
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-secondary-500 dark:text-secondary-400">Portals</span>
              <Link to={routes.portalLogin} className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline underline-offset-4">
                <HeartPulse className="h-3.5 w-3.5" /> Patient Portal
              </Link>
              <span className="text-secondary-300 dark:text-white/20">·</span>
              <Link to={routes.developerPortal} className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline underline-offset-4">
                <Code2 className="h-3.5 w-3.5" /> Developer Portal
              </Link>
            </div>
            <p className="text-[11px] text-secondary-500 dark:text-secondary-400 font-bold uppercase tracking-[0.2em]">
              New here? Register your hospital — no subdomain needed.
              <button onClick={() => handleAnchor("catalog")} className="ml-3 text-primary-600 dark:text-primary-400 hover:underline">
                Or explore every feature →
              </button>
            </p>

            <dl className="grid grid-cols-3 gap-4 pt-6 max-w-xl">
              {[
                { k: `${totalFeatures}+`, v: "Features" },
                { k: "Multi", v: "Tenant" },
                { k: "Edge", v: "Sync Ready" },
              ].map((s) => (
                <div key={s.v} className="rounded-2xl border border-secondary-200/60 dark:border-white/50 bg-white/60 dark:bg-secondary-900/60 backdrop-blur p-4">
                  <dt className="text-2xl font-black text-secondary-900 dark:text-white">{s.k}</dt>
                  <dd className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="lg:col-span-5">
            <HeroIllustration />
          </div>
        </div>
      </section>

      {/* ============== HIGHLIGHTS ============== */}
      <section id="features" className="relative py-20 md:py-28">
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

      {/* ============== FULL FEATURE CATALOG ============== */}
      <section id="catalog" className="relative py-20 md:py-28 bg-secondary-50/60 dark:bg-secondary-900/40 border-y border-secondary-400 dark:border-white/50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <SectionHeader
            tag="Full Feature Catalog"
            title="Every capability, and what it does."
            subtitle={`All ${totalFeatures}+ features across the suite, grouped by area. Each module is self-contained and independently activatable per tenant.`}
          />
          <div className="space-y-16">
            {FEATURE_CATALOG.map((group) => (
              <CatalogGroup key={group.title} group={group} />
            ))}
          </div>
        </div>
      </section>

      {/* ============== PATIENT JOURNEY ============== */}
      <section id="journey" className="relative py-20 md:py-28 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <SectionHeader
            tag="Patient Journey"
            title="A typical outpatient flow, mapped."
            subtitle="Carepoint can be customised, but here's the pathway it ships ready to run."
          />
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {journey.map((step, idx) => (
              <JourneyStep key={step.title} step={step} index={idx} total={journey.length} />
            ))}
          </div>
        </div>
      </section>

      {/* ============== SECURITY ============== */}
      <section id="security" className="relative py-20 md:py-28 bg-secondary-900 text-white overflow-hidden">
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
      <section id="contact" className="relative py-20 md:py-28 border-t border-secondary-400 dark:border-white/50">
        <div className="max-w-5xl mx-auto px-6 lg:px-8 text-center space-y-8">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary-500/20 bg-primary-500/10 text-primary-700 dark:text-primary-300 text-[10px] font-bold uppercase tracking-[0.25em]">
            <HeartPulse className="h-3 w-3" /> Ready When You Are
          </span>
          <h2 className="text-4xl md:text-6xl font-black font-display tracking-tight leading-tight">
            Bring every department onto{" "}
            <span className="bg-gradient-to-r from-primary-500 to-emerald-500 bg-clip-text text-transparent">one workspace.</span>
          </h2>
          <p className="text-base md:text-lg text-secondary-600 dark:text-secondary-300 max-w-2xl mx-auto">
            Sign in to your tenant workspace to access the full Carepoint Suite, or contact
            our team to spin up a new tenant for your facility.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link to={routes.tenantRegister} className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-black uppercase tracking-widest shadow-2xl shadow-primary-500/30 transition-all hover:-translate-y-0.5">
              Register Your Hospital <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to={routes.login} className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white dark:bg-secondary-900 border border-secondary-200 dark:border-white/50 text-secondary-900 dark:text-secondary-100 text-sm font-black uppercase tracking-widest hover:border-primary-500 transition-all">
              <ShieldCheck className="h-4 w-4" /> Tenant Login
            </Link>
            <Link to={routes.saasLogin} className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white dark:bg-secondary-900 border border-secondary-200 dark:border-white/50 text-secondary-900 dark:text-secondary-100 text-sm font-black uppercase tracking-widest hover:border-primary-500 transition-all">
              <ShieldCheck className="h-4 w-4" /> SaaS Login
            </Link>
            <Link to={routes.portalLogin} className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white dark:bg-secondary-900 border border-secondary-200 dark:border-white/50 text-secondary-900 dark:text-secondary-100 text-sm font-black uppercase tracking-widest hover:border-primary-500 transition-all">
              <HeartPulse className="h-4 w-4" /> Patient Portal
            </Link>
            <Link to={routes.developerPortal} className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white dark:bg-secondary-900 border border-secondary-200 dark:border-white/50 text-secondary-900 dark:text-secondary-100 text-sm font-black uppercase tracking-widest hover:border-primary-500 transition-all">
              <Code2 className="h-4 w-4" /> Developer Portal
            </Link>
          </div>
          <p className="text-xs text-secondary-500 dark:text-secondary-400 max-w-xl mx-auto">
            Already have a tenant workspace? Sign in via your tenant subdomain (e.g.{" "}
            <span className="font-mono font-bold">your-hospital.carepointhms.com</span>).
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
              <a href="#features" onClick={(e) => { e.preventDefault(); handleAnchor("features"); }} className="hover:text-secondary-900 dark:hover:text-white">Highlights</a>
              <a href="#catalog" onClick={(e) => { e.preventDefault(); handleAnchor("catalog"); }} className="hover:text-secondary-900 dark:hover:text-white">All Features</a>
              <a href="#security" onClick={(e) => { e.preventDefault(); handleAnchor("security"); }} className="hover:text-secondary-900 dark:hover:text-white">Security</a>
              <Link to={routes.tenantRegister} className="text-primary-600 dark:text-primary-400 hover:text-primary-700">Register</Link>
              <Link to={routes.saasLogin} className="text-primary-600 dark:text-primary-400 hover:text-primary-700">SaaS Login</Link>
              <Link to={routes.portalLogin} className="text-primary-600 dark:text-primary-400 hover:text-primary-700">Patient Portal</Link>
              <Link to={routes.developerPortal} className="text-primary-600 dark:text-primary-400 hover:text-primary-700">Developers</Link>
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

function SectionHeader({ tag, title, subtitle, inverted }: { tag: string; title: string; subtitle: string; inverted?: boolean }) {
  return (
    <div className={`max-w-3xl mx-auto text-center mb-14 ${inverted ? "text-white" : ""}`}>
      <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-[0.25em] mb-5 ${inverted ? "border-white/15 bg-white/10 text-primary-300" : "border-primary-500/20 bg-primary-500/10 text-primary-700 dark:text-primary-300"}`}>
        {tag}
      </span>
      <h2 className="text-3xl md:text-5xl font-black font-display tracking-tight leading-tight mb-4">{title}</h2>
      <p className={`text-base md:text-lg leading-relaxed ${inverted ? "text-secondary-300" : "text-secondary-600 dark:text-secondary-300"}`}>{subtitle}</p>
    </div>
  );
}

type Tone = "primary" | "rose" | "amber" | "emerald" | "slate" | "violet";
type FeatureItem = { title: string; description: string; icon: IconType; tone: Tone };

const toneStyles: Record<Tone, string> = {
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
      <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${toneStyles[tone]} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-black font-display tracking-tight mb-2">{title}</h3>
      <p className="text-sm text-secondary-600 dark:text-secondary-400 leading-relaxed">{description}</p>
    </div>
  );
}

type CatalogItem = { name: string; description: string; icon: IconType };
type CatalogGroupT = { title: string; blurb: string; items: CatalogItem[] };

function CatalogGroup({ group }: { group: CatalogGroupT }) {
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-xl md:text-2xl font-black font-display tracking-tight">{group.title}</h3>
        <span className="text-sm text-secondary-500 dark:text-secondary-400">{group.blurb}</span>
        <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-secondary-400">{group.items.length} features</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {group.items.map((it) => (
          <CatalogCard key={it.name} {...it} />
        ))}
      </div>
    </div>
  );
}

function CatalogCard({ name, description, icon: Icon }: CatalogItem) {
  return (
    <div className="group rounded-2xl p-5 bg-white dark:bg-secondary-900 border border-secondary-400 dark:border-white/50 hover:border-primary-500/40 hover:-translate-y-0.5 transition-all flex gap-4">
      <div className="h-11 w-11 rounded-xl bg-primary-500/10 text-primary-600 flex items-center justify-center shrink-0 group-hover:bg-primary-500 group-hover:text-white transition-all">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-black tracking-tight mb-1">{name}</p>
        <p className="text-xs text-secondary-600 dark:text-secondary-400 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

type JourneyItem = { title: string; description: string; icon: IconType };

function JourneyStep({ step, index, total }: { step: JourneyItem; index: number; total: number }) {
  const Icon = step.icon;
  return (
    <div className="relative rounded-[2rem] p-7 bg-white dark:bg-secondary-900 border border-secondary-400 dark:border-white/50 hover:border-primary-500/40 transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className="h-12 w-12 rounded-2xl bg-primary-500 text-white flex items-center justify-center shadow-lg shadow-primary-500/20">
          <Icon className="h-6 w-6" />
        </div>
        <span className="text-[10px] font-mono font-bold text-secondary-400 uppercase tracking-widest">Step {index + 1} / {total}</span>
      </div>
      <h3 className="text-base font-black font-display tracking-tight mb-2">{step.title}</h3>
      <p className="text-sm text-secondary-600 dark:text-secondary-400 leading-relaxed">{step.description}</p>
    </div>
  );
}

function SecurityCard({ title, description, icon: Icon }: FeatureItem) {
  return (
    <div className="rounded-[2rem] p-7 bg-white/5 backdrop-blur border border-secondary-400 dark:border-white/50 hover:border-primary-500/40 transition-all">
      <div className="h-14 w-14 rounded-2xl bg-primary-500/15 text-primary-300 flex items-center justify-center mb-5">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-black font-display tracking-tight mb-2 text-white">{title}</h3>
      <p className="text-sm text-secondary-300 leading-relaxed">{description}</p>
    </div>
  );
}

function DecorOrbs() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div className="absolute -top-32 -right-32 w-[36rem] h-[36rem] rounded-full bg-primary-500/15 blur-3xl float-slow" />
      <div className="absolute top-1/2 -left-32 w-[28rem] h-[28rem] rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06]" style={{ backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
    </div>
  );
}

function HeroIllustration() {
  return (
    <div className="relative aspect-[4/5] max-w-md mx-auto">
      <div className="absolute inset-0 rounded-[3rem] bg-gradient-to-br from-primary-500/20 via-emerald-500/10 to-transparent blur-2xl" />
      <div className="relative h-full w-full rounded-[2.5rem] overflow-hidden bg-slate-900 text-white shadow-2xl border border-white/10">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-primary-500/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl" />
        <div className="relative p-7 space-y-5">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span className="ml-3 text-[9px] font-mono font-bold text-white/40 uppercase tracking-widest">carepoint · clinical dashboard</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[{ k: "47", v: "Waiting" }, { k: "12", v: "Serving" }, { k: "189", v: "Today" }].map((s, i) => (
              <div key={i} className="rounded-2xl bg-white/5 border border-white/10 p-3">
                <p className="text-2xl font-black tracking-tight">{s.k}</p>
                <p className="text-[8px] font-bold uppercase tracking-widest text-white/40 mt-0.5">{s.v}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-display font-black tracking-tight">A-014</span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[8px] font-bold uppercase tracking-widest border border-emerald-500/30">Serving</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-[10px] font-black">JS</div>
              <div>
                <p className="text-xs font-bold">John Smith</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 mt-0.5">Consultation Bay 4</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {["Vitals", "SOAP", "Rx"].map((p) => (
                <div key={p} className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-center text-[9px] font-bold uppercase tracking-widest text-white/60">{p}</div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-3">Visit Volume · 7d</p>
            <svg viewBox="0 0 200 60" className="w-full h-16">
              <defs>
                <linearGradient id="chartGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgb(16,185,129)" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="rgb(16,185,129)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0,45 L25,38 L50,42 L75,28 L100,32 L125,18 L150,22 L175,12 L200,16 L200,60 L0,60 Z" fill="url(#chartGrad)" />
              <path d="M0,45 L25,38 L50,42 L75,28 L100,32 L125,18 L150,22 L175,12 L200,16" fill="none" stroke="rgb(16,185,129)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
  { title: "SaaS or Dedicated", description: "Run on the multi-tenant platform (database-per-hospital, custom domains, subscriptions) or as a dedicated single-hospital install on an annual licence — same product, one codebase.", icon: Globe, tone: "primary" },
  { title: "OPD & Patient Flow", description: "Streamlined registration, hospital-number generation, queue routing, vitals capture, and visit lifecycle orchestration across service points.", icon: Users, tone: "emerald" },
  { title: "Clinical Workflows", description: "Doctor calendars, SOAP-based consultations, ICD-10 diagnoses, clinical templates, e-prescriptions and adherence tracking.", icon: Stethoscope, tone: "rose" },
  { title: "Inpatient & Surgery", description: "Real-time bed boards, admission and discharge workflows, theatre scheduling, and ambulance fleet dispatch coordination.", icon: Bed, tone: "amber" },
  { title: "LIS & RIS", description: "Lab order management with sample tracking and result publication, plus radiology requests, modality scheduling, and reporting.", icon: FlaskConical, tone: "violet" },
  { title: "Pharmacy & Inventory", description: "Multi-store stock control, prescription verification, dispensing workflows, procurement, requisitions and goods receipt.", icon: Pill, tone: "primary" },
  { title: "Billing, Payments & Cash", description: "Charges captured at the point of care, consolidated invoices, cashier shifts with Z-reports, gateways, petty cash and bank reconciliation.", icon: CreditCard, tone: "emerald" },
  { title: "HMO & Insurance Suite", description: "Payer plans, negotiated tariffs and automatic HMO-vs-patient bill splitting; eligibility checks, pre-auth, claims batching, capitation and remittance reconciliation.", icon: ShieldCheck, tone: "primary" },
  { title: "Hospital-Grade Accounting", description: "A true double-entry back office: auto-posted ledger, cash flow and departmental P&L, maker-checker controls, and statutory remittances — PAYE, pension, NHF, WHT, VAT — with filing schedules.", icon: Landmark, tone: "amber" },
  { title: "HR & Payroll", description: "Staff profiles, digital contracts, leave workflows, shift rosters, timesheets, payslips, salary advances and approvals.", icon: Briefcase, tone: "amber" },
  { title: "Approvals Engine", description: "Configurable request types, multi-step approval flows and per-step decision rules that route payroll, procurement, leave and more.", icon: CheckSquare, tone: "slate" },
  { title: "Interoperability & Open APIs", description: "Consent-based patient-record exchange between hospitals, seamless intra-tenant referrals, partner integrations, and a self-service developer platform with scoped API keys.", icon: Network, tone: "violet" },
  { title: "Patient Portal", description: "A patient-facing self-service portal for appointments, medical records, secure messaging and online payments — extending care beyond the hospital walls.", icon: Smartphone, tone: "emerald" },
];

const FEATURE_CATALOG: CatalogGroupT[] = [
  {
    title: "Clinical & Patient Care",
    blurb: "The front line — from registration to the consulting room.",
    items: [
      { name: "Patients", description: "Patient registration, demographics and unified medical records.", icon: Users },
      { name: "Visits", description: "Full patient visit lifecycle across every service point.", icon: ClipboardList },
      { name: "Queues", description: "Live service-delivery-point queues with routing and now-serving control.", icon: Clock },
      { name: "Queue Analytics", description: "Wait times, throughput and no-show rates per service point.", icon: BarChart3 },
      { name: "Queue Display Board", description: "Full-screen waiting-room now-serving board for public screens.", icon: Monitor },
      { name: "Triage & Consultations", description: "Triage, vitals capture, SOAP consultations and diagnosis.", icon: Stethoscope },
      { name: "Clinical Templates", description: "Reusable clinical documentation templates for faster charting.", icon: FileText },
      { name: "Medication Adherence", description: "Dose schedules, alerts, refills and post-visit follow-ups.", icon: Timer },
      { name: "Patient ID Cards", description: "Issue and manage patient identification / membership cards.", icon: CreditCard },
      { name: "Loyalty Rewards", description: "Track and manage patient reward points.", icon: Gift },
      { name: "Patient Messages", description: "Secure messages sent in by patients from the portal.", icon: MessageSquare },
      { name: "Announcements", description: "Broadcast to one patient, a group, or every registered patient.", icon: Send },
      { name: "Appointments", description: "Appointment scheduling with automated reminders.", icon: Calendar },
      { name: "Doctor Calendar", description: "Doctor slots, workload balancing and time off.", icon: UserRound },
    ],
  },
  {
    title: "Diagnostics & Pharmacy",
    blurb: "Labs, imaging and medicines, end to end.",
    items: [
      { name: "Laboratory (LIS)", description: "Lab order management, sample tracking and result publication.", icon: FlaskConical },
      { name: "Radiology (RIS)", description: "Imaging requests, modality scheduling and structured reporting.", icon: Activity },
      { name: "Pharmacy", description: "Prescription verification, dispensing workflows and counselling.", icon: Pill },
      { name: "Drug Formulary", description: "Manage the drug formulary and drug categories.", icon: Boxes },
    ],
  },
  {
    title: "Inpatient, Surgery & Emergency",
    blurb: "Wards, theatres and the fleet.",
    items: [
      { name: "Admissions", description: "Ward, bed, admission and discharge workflows.", icon: Bed },
      { name: "Wards", description: "Ward configuration with live bed occupancy.", icon: Hospital },
      { name: "Beds", description: "Bed inventory across every ward.", icon: Bed },
      { name: "Surgery Worklist", description: "Theatre schedule and live surgical case tracking.", icon: Scissors },
      { name: "Theatres", description: "Operating theatres and their availability.", icon: Building2 },
      { name: "Procedure Catalog", description: "Surgical procedure catalog and pricing.", icon: ClipboardList },
      { name: "Instrument Sets", description: "Instrument sets, sterilization and assignment.", icon: Boxes },
      { name: "Ambulance", description: "Fleet management, driver certifications and readiness.", icon: Ambulance },
    ],
  },
  {
    title: "Billing, Payments & Cash",
    blurb: "Every naira in and out, captured where care happens.",
    items: [
      { name: "Billing & Invoices", description: "Charges auto-captured per visit from every service point, consolidated into invoices.", icon: Receipt },
      { name: "Payments & Receipts", description: "Cash, transfer, gateway and membership-card payments with numbered receipts.", icon: CreditCard },
      { name: "Payment Gateways", description: "Configure direct patient payment integrations.", icon: CreditCard },
      { name: "Cashier Shifts", description: "Open with a float, take payments, close with counted cash — over/short posts automatically with a Z-report.", icon: Coins },
      { name: "Petty Cash", description: "Imprest floats, expense vouchers with approvals, and one-click retirement postings.", icon: Wallet },
      { name: "Banking & Reconciliation", description: "Bank accounts with live ledger balances, deposits, transfers, CSV statement import and auto-matched reconciliations.", icon: Landmark },
      { name: "Credit Notes & Refunds", description: "Invoice adjustments, refunds from bank or petty cash, and bad-debt write-offs — every action posted.", icon: Receipt },
      { name: "Card Funding Approvals", description: "Confirm patient-submitted manual card wallet top-ups.", icon: Banknote },
      { name: "Billable Services", description: "Service catalogue with rates and the ledger account each service posts to.", icon: Banknote },
    ],
  },
  {
    title: "HMO & Health Insurance",
    blurb: "The module most HMS products get wrong — done right.",
    items: [
      { name: "Payers & Benefit Plans", description: "HMO, NHIA, state-scheme and corporate payers with per-plan coverage %, co-pays, exclusions and limits.", icon: ShieldCheck },
      { name: "Negotiated Tariffs", description: "Import each HMO's price list from their spreadsheet; insured visits price from it automatically.", icon: Percent },
      { name: "Automatic Bill Splitting", description: "Every charge on an insured visit splits HMO-vs-patient at the point of care — co-pays invoiced, covered amounts claimed.", icon: Layers },
      { name: "Enrollees & Eligibility", description: "Front-desk enrollee lookup, verification with auth codes, plan linking and expiry alerts.", icon: Users },
      { name: "Pre-Authorizations", description: "Services that need HMO approval are flagged at ordering until the auth code is captured.", icon: Lock },
      { name: "Claims Lifecycle", description: "Auto-generated claims, monthly batching with submission workbooks, adjudication, appeals and resubmission.", icon: FileText },
      { name: "Capitation", description: "Contracts, monthly enrollee snapshots, HMO-list variance, receipts and per-payer loss-ratio reporting.", icon: HeartPulse },
      { name: "Remittances & Payer Statements", description: "Allocate bulk HMO payments across claims and capitation; a live statement of what every payer owes.", icon: Banknote },
      { name: "Disallowance Write-Offs", description: "Short-payments written off explicitly with reason codes — nothing disappears silently.", icon: Scale },
      { name: "Insurance Analytics", description: "Outstanding by payer, claim aging, rejection reasons and settlement speed on one dashboard.", icon: BarChart3 },
    ],
  },
  {
    title: "Accounting & Statutory Compliance",
    blurb: "Everything a standalone accounting package does — inside your HMS.",
    items: [
      { name: "Double-Entry Ledger", description: "Every money event sweeps into balanced journals automatically and idempotently.", icon: Layers },
      { name: "Chart of Accounts", description: "Hierarchical CoA with a Nigerian-hospital default, opening balances and a repointable posting map.", icon: Database },
      { name: "Maker-Checker Controls", description: "Manual journals above your threshold need a second approver; posted entries change only by reversal.", icon: CheckSquare },
      { name: "Financial Statements", description: "Trial balance, P&L, balance sheet, cash flow and AR/AP aging — always in balance.", icon: BarChart3 },
      { name: "General Ledger & Exports", description: "Full GL with drill-down and XLSX export for auditors.", icon: FileText },
      { name: "Cost Centers", description: "Departmental P&L — see which units make or lose money, generated from your departments in one click.", icon: Building2 },
      { name: "Budgets & Fixed Assets", description: "Budget-vs-actual per account, asset register with automated depreciation runs.", icon: Boxes },
      { name: "Accounts Payable & WHT", description: "Vendor bills and payment runs — withholding tax deducted at source and registered per payee.", icon: Wallet },
      { name: "Statutory Remittances", description: "PAYE, pension, NHF, WHT and VAT: accrued vs remitted vs outstanding, straight from the ledger.", icon: Landmark },
      { name: "Filing Schedules", description: "Per-staff PAYE, pension (with PFA & PIN) and NHF schedules, plus the WHT register — ready-to-file workbooks.", icon: ClipboardList },
      { name: "Tax Management", description: "Tax types, rates, rules, exemptions and VAT posting.", icon: Percent },
      { name: "Audit Trail & Period Close", description: "Every privileged action logged; a pre-close checklist gates each accounting period.", icon: ShieldCheck },
    ],
  },
  {
    title: "Human Resources",
    blurb: "People, rosters, time and pay.",
    items: [
      { name: "HR Overview", description: "Staff profiles, onboarding, roster, attendance and leave.", icon: Briefcase },
      { name: "Staff Directory", description: "Hospital personnel management and records.", icon: UserRound },
      { name: "Staff Invitations", description: "Invite and onboard new staff members.", icon: Mail },
      { name: "Duty Roster", description: "Shift definitions and weekly duty roster by department or unit.", icon: CalendarClock },
      { name: "Attendance", description: "Staff clock-in / clock-out and attendance tracking.", icon: Fingerprint },
      { name: "Timesheets", description: "Log hours day by day and route them for approval.", icon: Timer },
      { name: "Leave Management", description: "Staff leave applications, balances and approvals.", icon: Calendar },
      { name: "Staff Finance", description: "Salary advances and reimbursements.", icon: Wallet },
    ],
  },
  {
    title: "Administration & Operations",
    blurb: "Run the whole organisation from one console.",
    items: [
      { name: "Dashboard", description: "Tenant-wide operational overview at a glance.", icon: LayoutDashboard },
      { name: "Branches", description: "Manage hospital branches, clinics and service sites.", icon: Hospital },
      { name: "Service Points", description: "Configure service delivery points and queue prefixes.", icon: Building2 },
      { name: "Stores & Inventory", description: "Stores, stock, items and low-stock alerts.", icon: Package },
      { name: "Procurement", description: "Requisitions and purchase orders.", icon: ShoppingCart },
      { name: "Requests", description: "Requests, approvals, decisions and audit trail.", icon: CheckSquare },
      { name: "Approval Flows", description: "Configure request types, flows and steps — with Excel bulk upload.", icon: CheckSquare },
      { name: "Reports", description: "Operational and management reports.", icon: BarChart3 },
      { name: "Notifications", description: "System notification inbox and delivery log.", icon: Bell },
      { name: "Email Setup", description: "Configure system-wide SMTP and email notifications.", icon: Mail },
      { name: "Background Jobs", description: "Automated tasks and maintenance schedules.", icon: Clock },
      { name: "Roles & Permissions", description: "Access-control roles and the permission matrix.", icon: Lock },
      { name: "Compliance", description: "Audit records and certifications.", icon: ShieldCheck },
      { name: "Backups", description: "System recovery points and restore.", icon: Database },
      { name: "Plan & Billing", description: "Subscription plan, upgrades and invoices.", icon: CreditCard },
      { name: "Settings", description: "Tenant-wide configuration.", icon: SettingsIcon },
    ],
  },
  {
    title: "Interoperability & Integrations",
    blurb: "Connect hospitals, partners, patients and developers.",
    items: [
      { name: "Hospital Interoperability", description: "Consent-based exchange of patient records between hospitals on the platform.", icon: Network },
      { name: "Patient Referrals", description: "Refer patients seamlessly between facilities in a tenancy and across hospitals.", icon: Share2 },
      { name: "Partner Integrations", description: "Connect third-party hospital applications for secure two-way data exchange.", icon: Plug },
      { name: "API Keys", description: "Issue, scope and rotate API keys for connected partner systems.", icon: KeyRound },
      { name: "Developer Platform", description: "Self-service developer registration and scoped API keys for patient history and diagnostics.", icon: Code2 },
      { name: "Patient Portal", description: "Patient self-service: records, appointments, messages and online payments.", icon: Smartphone },
    ],
  },
  {
    title: "Platform & Multi-Tenancy",
    blurb: "The SaaS control plane for operators.",
    items: [
      { name: "Platform Overview", description: "Global performance metrics and tenant analytics.", icon: LayoutDashboard },
      { name: "Tenant Management", description: "Provision and manage hospital tenants.", icon: Globe },
      { name: "Custom Domains", description: "White-label domains and SSL management.", icon: Network },
      { name: "Subscriptions", description: "Manage platform subscriptions and invoices.", icon: CreditCard },
      { name: "Payment Confirmations", description: "Confirm manual tenant subscription payments.", icon: Banknote },
      { name: "Payment Lookup", description: "Search and review confirmed tenant payments.", icon: Receipt },
      { name: "Support Access", description: "Grant temporary platform access to support staff.", icon: ShieldCheck },
      { name: "System Health", description: "Monitor platform connectivity and global uptime.", icon: Activity },
      { name: "Module Management", description: "Toggle modules on or off per tenant.", icon: Layers },
      { name: "Dedicated Deployments", description: "Single-hospital installs on one database with an annual licence — no subscriptions, same codebase, every module included.", icon: Hospital },
      { name: "Licence Management", description: "Renewal notices, grace periods and clear in-app messaging for dedicated clients.", icon: KeyRound },
    ],
  },
];

const journey: JourneyItem[] = [
  { title: "Registration & Check-In", description: "Front-desk registration creates or verifies the patient and initiates a new visit with a unique hospital number.", icon: ClipboardList },
  { title: "Upfront Billing (Optional)", description: "For fee-for-service models, the patient settles the consultation fee at the cashier desk before triage.", icon: Wallet },
  { title: "Triage & Vitals", description: "The nursing station captures BP, temperature, weight, and brief triage notes that flow to the doctor.", icon: HeartPulse },
  { title: "Consultation", description: "The doctor sees the patient, records SOAP notes and ICD-10 diagnoses, and raises labs, imaging and prescriptions.", icon: Stethoscope },
  { title: "Investigations", description: "Lab samples and imaging studies are processed, and results stream straight back to the doctor's dashboard.", icon: FlaskConical },
  { title: "Pharmacy", description: "Pharmacists verify the e-prescription against stock, dispense, and counsel the patient at the counter.", icon: Pill },
  { title: "Final Billing & Discharge", description: "Outstanding balances are settled and the visit is officially closed — ready for analytics and follow-up.", icon: CheckCircle2 },
  { title: "Follow-Up & Adherence", description: "Reminders, refill alerts and the patient portal keep care continuous after discharge.", icon: Calendar },
];

const securityFeatures: FeatureItem[] = [
  { title: "Tenant Isolation", description: "Schema-per-tenant or database-per-tenant architecture ensures one customer's data can never leak into another's.", icon: Database, tone: "primary" },
  { title: "RBAC", description: "Fine-grained, customisable role hierarchies — every permission, scoped to the right person at the right service point.", icon: Lock, tone: "primary" },
  { title: "Two-Factor Auth", description: "Email or SMS OTP enforcement plus session policies that protect every privileged login.", icon: ShieldCheck, tone: "primary" },
  { title: "Audit Logs", description: "Every PHI access and sensitive change is logged with actor, timestamp and diff — replayable for compliance.", icon: FileText, tone: "primary" },
  { title: "Edge Sync", description: "Offline-first boundary boxes let remote clinics keep operating during outages, then journal-sync when online.", icon: Network, tone: "primary" },
  { title: "Compliance-Ready", description: "Encryption at rest, TLS in transit, and structured event streams designed to fit healthcare compliance regimes.", icon: Shield, tone: "primary" },
];
