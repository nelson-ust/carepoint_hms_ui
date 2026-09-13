import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  KeyRound, Copy, Check, Plus, RotateCw, Ban, LogOut, ShieldCheck,
  Building2, BookOpen, ArrowRight,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/feedback/ToastProvider";
import { env } from "@/config/env";
import {
  developerApi, developerToken, type DevApp, type DevGrant, type DevScope,
} from "../api/developer.api";
import { DeveloperDocs } from "./DeveloperDocs";

const DATA_BASE = `${env.apiBaseUrl.replace(/\/$/, "")}/developer/api/v1`;

function fmt(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString(undefined,
    { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard?.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); }}
      className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700"
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? "Copied" : "Copy"}
    </button>
  );
}

// ===========================================================================
// Unauthenticated: register / verify
// ===========================================================================
function OnboardingView({ onVerified }: { onVerified: () => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<"register" | "verify">("register");
  const [form, setForm] = useState({ organization_name: "", contact_name: "", email: "", website: "", description: "" });
  const [verify, setVerify] = useState({ email: "", token: "" });
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  // Seamless email link: /developers?email=...&token=... prefills verification.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const email = params.get("email");
    const token = params.get("token");
    if (email && token) {
      setVerify({ email: email.trim().toLowerCase(), token });
      setMode("verify");
    }
  }, []);

  const scopes = useQuery({ queryKey: ["dev-scopes"], queryFn: () => developerApi.scopes() });

  const register = useMutation({
    mutationFn: () => developerApi.register(form),
    onSuccess: (data: any) => {
      const sent = !!data?.email_sent;
      setEmailSent(sent);
      toast.success(
        "Registration received",
        sent
          ? `We've emailed a verification link to ${form.email.trim()}.`
          : "Use the verification token below to activate your account.",
      );
      setVerify({ email: form.email.trim().toLowerCase(), token: data?.verification_token || "" });
      setIssuedToken(data?.verification_token || null);
      setMode("verify");
    },
    onError: (e: any) => toast.error("Couldn't register", developerApi.errMsg(e, "Please review your details.")),
  });

  const doVerify = useMutation({
    mutationFn: () => developerApi.verify({ email: verify.email, token: verify.token }),
    onSuccess: (data: any) => {
      const t = data?.account?.dashboard_token;
      if (t) { developerToken.set(t); toast.success("Email verified", "Your developer dashboard is ready."); onVerified(); }
      else toast.error("Verification incomplete", "No dashboard token returned.");
    },
    onError: (e: any) => toast.error("Couldn't verify", developerApi.errMsg(e, "Invalid or expired token.")),
  });

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <Card className="lg:col-span-3 p-8 space-y-6">
        <div className="flex gap-2">
          <button onClick={() => setMode("register")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold ${mode === "register" ? "bg-primary-600 text-white" : "bg-secondary-100 text-secondary-600"}`}>
            1. Register
          </button>
          <button onClick={() => setMode("verify")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold ${mode === "verify" ? "bg-primary-600 text-white" : "bg-secondary-100 text-secondary-600"}`}>
            2. Verify email
          </button>
        </div>

        {mode === "register" ? (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); register.mutate(); }}>
            <Input label="Organization / product name" required value={form.organization_name}
              onChange={(e) => setForm({ ...form, organization_name: e.target.value })} placeholder="Acme Health Analytics" />
            <Input label="Contact name" required value={form.contact_name}
              onChange={(e) => setForm({ ...form, contact_name: e.target.value })} placeholder="Ada Lovelace" />
            <Input label="Email" type="email" required value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="dev@acme.com" />
            <Input label="Website (optional)" value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://acme.com" />
            <Textarea label="What are you building? (optional)" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            <Button type="submit" isLoading={register.isPending} leftIcon={<ShieldCheck className="h-4 w-4" />}>
              Create developer account
            </Button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); doVerify.mutate(); }}>
            {emailSent && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm">
                <p className="font-semibold text-emerald-800">Check your inbox</p>
                <p className="text-emerald-700 mt-1">
                  We've sent a verification email to <strong>{verify.email}</strong>. Click the link in
                  that email to verify automatically, or paste the token below.
                </p>
              </div>
            )}
            {issuedToken && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm">
                <p className="font-semibold text-amber-800">Verification token</p>
                <p className="text-amber-700 mt-1">Also sent to your email. Shown here once so you can complete verification right away:</p>
                <div className="mt-2 flex items-center justify-between gap-2 bg-white rounded-lg px-3 py-2 font-mono text-xs break-all">
                  <span>{issuedToken}</span><CopyButton value={issuedToken} />
                </div>
              </div>
            )}
            <Input label="Email" type="email" required value={verify.email}
              onChange={(e) => setVerify({ ...verify, email: e.target.value })} />
            <Input label="Verification token" required value={verify.token}
              onChange={(e) => setVerify({ ...verify, token: e.target.value })} placeholder="cpv_..." />
            <div className="flex gap-3">
              <Button type="submit" isLoading={doVerify.isPending} leftIcon={<Check className="h-4 w-4" />}>Verify & continue</Button>
              <Button type="button" variant="secondary"
                onClick={() => developerApi.resend(verify.email).then((d: any) => { setIssuedToken(d?.verification_token || null); setVerify((v) => ({ ...v, token: d?.verification_token || "" })); toast.success("New token issued"); }).catch((e) => toast.error("Couldn't resend", developerApi.errMsg(e, "")))}>
                Resend token
              </Button>
            </div>
          </form>
        )}
      </Card>

      <Card className="lg:col-span-2 p-6 space-y-3 bg-secondary-50/50">
        <h3 className="font-semibold flex items-center gap-2"><BookOpen className="h-4 w-4" /> Available API scopes</h3>
        <p className="text-sm text-secondary-500">Request only what you need. A hospital must approve each scope before any data is returned.</p>
        <div className="space-y-2">
          {(scopes.data ?? []).map((s: DevScope) => (
            <div key={s.code} className="rounded-lg bg-white p-3">
              <code className="text-xs font-bold text-primary-700">{s.code}</code>
              <p className="text-xs text-secondary-500 mt-1">{s.description}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ===========================================================================
// Authenticated dashboard
// ===========================================================================
function DashboardView({ onSignOut }: { onSignOut: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();

  const me = useQuery({ queryKey: ["dev-me"], queryFn: () => developerApi.me(), retry: false });
  const apps = useQuery({ queryKey: ["dev-apps"], queryFn: () => developerApi.listApps() });
  const grants = useQuery({ queryKey: ["dev-grants"], queryFn: () => developerApi.listGrants() });
  const scopes = useQuery({ queryKey: ["dev-scopes"], queryFn: () => developerApi.scopes() });

  const scopeCodes = useMemo(() => (scopes.data ?? []).map((s) => s.code), [scopes.data]);

  const [createOpen, setCreateOpen] = useState(false);
  const [reveal, setReveal] = useState<{ name: string; key: string } | null>(null);
  const [grantFor, setGrantFor] = useState<DevApp | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["dev-apps"] });
    qc.invalidateQueries({ queryKey: ["dev-grants"] });
    qc.invalidateQueries({ queryKey: ["dev-me"] });
  };

  const rotate = useMutation({
    mutationFn: (id: number) => developerApi.rotateKey(id),
    onSuccess: (app) => { invalidate(); if (app.api_key) setReveal({ name: app.name, key: app.api_key }); },
    onError: (e: any) => toast.error("Couldn't rotate", developerApi.errMsg(e, "")),
  });
  const revoke = useMutation({
    mutationFn: (id: number) => developerApi.revokeApp(id),
    onSuccess: () => { invalidate(); toast.success("App revoked"); },
    onError: (e: any) => toast.error("Couldn't revoke", developerApi.errMsg(e, "")),
  });

  // Session-expired handling for the dev token
  if (me.isError) {
    return (
      <Card className="p-8 text-center space-y-4">
        <p className="text-secondary-600">Your dashboard session has expired or is invalid.</p>
        <Button onClick={onSignOut}>Return to sign in</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-secondary-400 font-bold">Signed in as</p>
          {me.isLoading ? <Skeleton className="h-5 w-48 mt-1" /> : (
            <>
              <p className="text-lg font-semibold">{me.data?.organization_name}</p>
              <p className="text-sm text-secondary-500">{me.data?.contact_name} · {me.data?.email}</p>
            </>
          )}
        </div>
        <Button variant="secondary" leftIcon={<LogOut className="h-4 w-4" />} onClick={onSignOut}>Sign out</Button>
      </Card>

      {/* Apps */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2"><KeyRound className="h-5 w-5" /> Apps & API keys</h2>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>New app</Button>
      </div>

      {apps.isLoading ? <Skeleton className="h-24 w-full" /> : (apps.data ?? []).length === 0 ? (
        <Card className="p-8 text-center text-secondary-500">No apps yet. Create one to get an API key.</Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {(apps.data ?? []).map((app) => (
            <Card key={app.id} className="p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{app.name}</p>
                  <p className="text-xs font-mono text-secondary-500">{app.key_prefix}…</p>
                </div>
                <div className="flex gap-2">
                  <Badge variant={app.environment === "LIVE" ? "success" : "secondary"}>{app.environment}</Badge>
                  <Badge variant={app.status === "ACTIVE" ? "default" : "destructive"}>{app.status}</Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {app.scopes.map((s) => <code key={s} className="text-[10px] bg-secondary-100 rounded px-1.5 py-0.5">{s}</code>)}
              </div>
              <p className="text-xs text-secondary-400">Last used {fmt(app.last_used_at)}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="secondary" leftIcon={<Building2 className="h-3.5 w-3.5" />}
                  onClick={() => setGrantFor(app)} disabled={app.status !== "ACTIVE"}>Request hospital access</Button>
                <Button size="sm" variant="secondary" leftIcon={<RotateCw className="h-3.5 w-3.5" />}
                  onClick={() => rotate.mutate(app.id)} disabled={app.status !== "ACTIVE"}>Rotate key</Button>
                <Button size="sm" variant="danger" leftIcon={<Ban className="h-3.5 w-3.5" />}
                  onClick={() => revoke.mutate(app.id)} disabled={app.status !== "ACTIVE"}>Revoke</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Grants */}
      <h2 className="text-lg font-semibold flex items-center gap-2 pt-2"><Building2 className="h-5 w-5" /> Hospital data grants</h2>
      {grants.isLoading ? <Skeleton className="h-20 w-full" /> : (grants.data ?? []).length === 0 ? (
        <Card className="p-6 text-center text-secondary-500">No access requests yet. Use “Request hospital access” on an app.</Card>
      ) : (
        <Card className="divide-y divide-secondary-100">
          {(grants.data ?? []).map((g: DevGrant) => (
            <div key={g.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <p className="font-medium">{g.tenant_name || `Tenant #${g.tenant_id}`}</p>
                <p className="text-xs text-secondary-500">
                  Requested {g.requested_scopes.join(", ")} · asked {fmt(g.requested_at)}
                  {g.approved_scopes.length ? ` · approved ${g.approved_scopes.join(", ")}` : ""}
                </p>
              </div>
              <Badge variant={g.status === "APPROVED" ? "success" : g.status === "PENDING" ? "warning" : "destructive"}>{g.status}</Badge>
            </div>
          ))}
        </Card>
      )}

      {/* Quick start */}
      <Card className="p-6 space-y-2 bg-secondary-900 text-secondary-100">
        <h3 className="font-semibold flex items-center gap-2 text-white"><BookOpen className="h-4 w-4" /> Quick start</h3>
        <p className="text-sm text-secondary-300">Call the data API with your key in the <code>X-API-Key</code> header. Replace <code>&lt;HOSPITAL_CODE&gt;</code> with the code the hospital gives you.</p>
        <pre className="text-xs bg-black/40 rounded-lg p-3 overflow-x-auto">{`curl -H "X-API-Key: cpk_..." \\
  ${DATA_BASE}/hospitals/<HOSPITAL_CODE>/patients?search=Ada

# Medical history
curl -H "X-API-Key: cpk_..." \\
  ${DATA_BASE}/hospitals/<HOSPITAL_CODE>/patients/<GLOBAL_PATIENT_ID>/medical-history

# Baseline diagnostics
curl -H "X-API-Key: cpk_..." \\
  ${DATA_BASE}/hospitals/<HOSPITAL_CODE>/patients/<GLOBAL_PATIENT_ID>/baseline-diagnostics`}</pre>
      </Card>

      {/* Create app modal */}
      <CreateAppModal
        open={createOpen} onClose={() => setCreateOpen(false)} scopeCodes={scopeCodes}
        onCreated={(app) => { setCreateOpen(false); invalidate(); if (app.api_key) setReveal({ name: app.name, key: app.api_key }); }}
      />

      {/* Request grant modal */}
      <RequestGrantModal app={grantFor} onClose={() => setGrantFor(null)}
        onDone={() => { setGrantFor(null); invalidate(); }} />

      {/* Reveal key modal */}
      <Modal isOpen={!!reveal} onClose={() => setReveal(null)} title="Copy your API key now">
        <div className="space-y-4">
          <p className="text-sm text-secondary-600">This key for <strong>{reveal?.name}</strong> is shown only once. Store it securely.</p>
          <div className="flex items-center justify-between gap-2 bg-secondary-100 rounded-lg px-3 py-3 font-mono text-xs break-all">
            <span>{reveal?.key}</span>{reveal && <CopyButton value={reveal.key} />}
          </div>
          <Button onClick={() => setReveal(null)}>Done</Button>
        </div>
      </Modal>
    </div>
  );
}

function CreateAppModal({ open, onClose, scopeCodes, onCreated }:
  { open: boolean; onClose: () => void; scopeCodes: string[]; onCreated: (a: DevApp) => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState("SANDBOX");
  const [selected, setSelected] = useState<string[]>([]);

  const create = useMutation({
    mutationFn: () => developerApi.createApp({ name, environment, scopes: selected }),
    onSuccess: (app) => { setName(""); setSelected([]); onCreated(app); },
    onError: (e: any) => toast.error("Couldn't create app", developerApi.errMsg(e, "")),
  });

  const toggle = (c: string) => setSelected((s) => s.includes(c) ? s.filter((x) => x !== c) : [...s, c]);

  return (
    <Modal isOpen={open} onClose={onClose} title="New app">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!selected.length) { toast.error("Pick at least one scope"); return; } create.mutate(); }}>
        <Input label="App name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme PHR – production" />
        <Select label="Environment" value={environment} onChange={(e) => setEnvironment(e.target.value)}>
          <option value="SANDBOX">Sandbox</option>
          <option value="LIVE">Live</option>
        </Select>
        <div>
          <p className="text-sm font-medium mb-2">Scopes</p>
          <div className="space-y-2">
            {scopeCodes.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selected.includes(c)} onChange={() => toggle(c)} />
                <code className="text-xs">{c}</code>
              </label>
            ))}
          </div>
        </div>
        <Button type="submit" isLoading={create.isPending}>Create app & generate key</Button>
      </form>
    </Modal>
  );
}

function RequestGrantModal({ app, onClose, onDone }:
  { app: DevApp | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [tenantCode, setTenantCode] = useState("");
  const [justification, setJustification] = useState("");

  const request = useMutation({
    mutationFn: () => developerApi.requestGrant({ app_id: app!.id, tenant_code: tenantCode, justification }),
    onSuccess: () => { setTenantCode(""); setJustification(""); toast.success("Access requested", "The hospital must approve it."); onDone(); },
    onError: (e: any) => toast.error("Couldn't request access", developerApi.errMsg(e, "")),
  });

  return (
    <Modal isOpen={!!app} onClose={onClose} title={`Request hospital access — ${app?.name ?? ""}`}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); request.mutate(); }}>
        <p className="text-sm text-secondary-500">
          Enter the hospital's public code. Your request inherits this app's scopes ({app?.scopes.join(", ")});
          the hospital may approve a subset.
        </p>
        <Input label="Hospital code" required value={tenantCode} onChange={(e) => setTenantCode(e.target.value)} placeholder="e.g. STNICH" />
        <Textarea label="Why do you need access? (optional)" rows={3} value={justification} onChange={(e) => setJustification(e.target.value)} />
        <Button type="submit" isLoading={request.isPending} rightIcon={<ArrowRight className="h-4 w-4" />}>Send request</Button>
      </form>
    </Modal>
  );
}

// ===========================================================================
export function DeveloperPortalPage() {
  const [signedIn, setSignedIn] = useState<boolean>(!!developerToken.get());
  const [view, setView] = useState<"home" | "docs">("home");

  const signOut = () => { developerToken.clear(); setSignedIn(false); };

  return (
    <div className="min-h-screen bg-secondary-50/40">
      <header className="border-b border-secondary-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col md:flex-row md:items-center gap-4 md:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary-600 text-white grid place-items-center"><KeyRound className="h-5 w-5" /></div>
            <div>
              <h1 className="text-xl font-bold">CarePoint Developer Platform</h1>
              <p className="text-sm text-secondary-500">Register, get an API key, and exchange patient data with consenting hospitals.</p>
            </div>
          </div>
          <nav className="flex gap-2">
            <button onClick={() => setView("home")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${view === "home" ? "bg-primary-600 text-white" : "bg-secondary-100 text-secondary-600 hover:bg-secondary-200"}`}>
              Home
            </button>
            <button onClick={() => setView("docs")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors inline-flex items-center gap-1.5 ${view === "docs" ? "bg-primary-600 text-white" : "bg-secondary-100 text-secondary-600 hover:bg-secondary-200"}`}>
              <BookOpen className="h-4 w-4" /> Documentation
            </button>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        {view === "docs"
          ? <DeveloperDocs />
          : signedIn
            ? <DashboardView onSignOut={signOut} />
            : <OnboardingView onVerified={() => setSignedIn(true)} />}
      </main>
    </div>
  );
}
