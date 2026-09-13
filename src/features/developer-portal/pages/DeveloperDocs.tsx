import { useState } from "react";
import {
  BookOpen, Copy, Check, KeyRound, ShieldCheck, GitBranch, Terminal,
  AlertTriangle, Building2, ListChecks, Lock,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { env } from "@/config/env";

const API_BASE = env.apiBaseUrl.replace(/\/$/, "");
const DATA_BASE = `${API_BASE}/developer/api/v1`;

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="rounded-xl overflow-hidden border border-secondary-800 bg-secondary-900 my-3">
      <div className="flex items-center justify-between px-3 py-1.5 bg-black/30">
        <span className="text-[10px] uppercase tracking-widest font-bold text-secondary-400">{label ?? "shell"}</span>
        <button
          type="button"
          onClick={() => { navigator.clipboard?.writeText(code); setDone(true); setTimeout(() => setDone(false), 1400); }}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-secondary-300 hover:text-white"
        >
          {done ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {done ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="text-[11.5px] leading-relaxed text-secondary-100 p-3 overflow-x-auto"><code>{code}</code></pre>
    </div>
  );
}

function Endpoint({ method, path, auth }: { method: string; path: string; auth: string }) {
  const color = method === "GET" ? "success" : method === "POST" ? "info" : "warning";
  return (
    <div className="flex flex-wrap items-center gap-2 mt-4 mb-1">
      <Badge variant={color as any}>{method}</Badge>
      <code className="text-xs font-semibold break-all">{path}</code>
      <Badge variant="secondary">{auth}</Badge>
    </div>
  );
}

const SECTIONS = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "how-it-works", label: "How it works", icon: GitBranch },
  { id: "getting-started", label: "Getting started", icon: ListChecks },
  { id: "auth", label: "Authentication", icon: Lock },
  { id: "scopes", label: "Scopes", icon: ShieldCheck },
  { id: "grants", label: "Hospital grants", icon: Building2 },
  { id: "public-api", label: "Registration API", icon: Terminal },
  { id: "portal-api", label: "Management API", icon: KeyRound },
  { id: "data-api", label: "Data API", icon: Terminal },
  { id: "errors", label: "Errors", icon: AlertTriangle },
  { id: "best-practices", label: "Best practices", icon: ShieldCheck },
];

export function DeveloperDocs() {
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="grid lg:grid-cols-[220px_1fr] gap-8">
      {/* Sticky ToC */}
      <nav className="hidden lg:block">
        <div className="sticky top-6 space-y-1">
          <p className="text-[10px] uppercase tracking-widest font-bold text-secondary-400 px-3 mb-2">Contents</p>
          {SECTIONS.map((s) => (
            <button key={s.id} onClick={() => jump(s.id)}
              className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg text-sm text-secondary-600 hover:bg-secondary-100 hover:text-secondary-900 transition-colors">
              <s.icon className="h-3.5 w-3.5 opacity-70" /> {s.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="max-w-3xl space-y-10">
        {/* Overview */}
        <section id="overview" className="scroll-mt-6">
          <h2 className="text-2xl font-bold mb-3 flex items-center gap-2"><BookOpen className="h-6 w-6 text-primary-600" /> Integration overview</h2>
          <p className="text-secondary-600 leading-relaxed">
            The CarePoint Developer Platform lets your application exchange clinical data with any hospital on
            CarePoint — securely and with the hospital's explicit consent. You register once, create an API key
            per application, and request access to each hospital whose data you need. Once a hospital approves,
            your key can read that hospital's patient records within the scopes they granted.
          </p>
          <Card className="p-4 mt-4 bg-primary-50/60 border border-primary-100">
            <p className="text-sm text-primary-800">
              <strong>Consent-first by design.</strong> An API key alone returns no patient data. Data flows only
              after a hospital approves your app for a specific set of scopes — and they can revoke that access at
              any time.
            </p>
          </Card>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-6">
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2"><GitBranch className="h-5 w-5 text-primary-600" /> How it works</h2>
          <ol className="space-y-3">
            {[
              ["Register", "Create a developer account with your organization details and verify your email."],
              ["Create an app", "Each app gets its own API key and a set of requested scopes."],
              ["Request hospital access", "Ask a hospital (by its public code) to grant your app the scopes it needs."],
              ["Hospital approves", "A hospital administrator approves — possibly a subset of what you asked for."],
              ["Exchange data", "Call the Data API with your key; the response is scoped to what was approved."],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="flex-none h-6 w-6 rounded-full bg-primary-600 text-white text-xs grid place-items-center font-bold">{i + 1}</span>
                <div><p className="font-semibold text-sm">{t}</p><p className="text-sm text-secondary-600">{d}</p></div>
              </li>
            ))}
          </ol>
          <p className="text-sm text-secondary-500 mt-4">
            Effective access is always the intersection: <code className="text-xs">requested ∩ app&nbsp;scopes ∩ hospital-approved scopes</code>.
          </p>
        </section>

        {/* Getting started */}
        <section id="getting-started" className="scroll-mt-6">
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2"><ListChecks className="h-5 w-5 text-primary-600" /> Getting started</h2>
          <p className="text-secondary-600">Register and verify from this portal (the <strong>Home</strong> tab), or entirely over the API:</p>
          <CodeBlock label="1 · register" code={`curl -X POST ${API_BASE}/developer/public/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "organization_name": "Acme Health",
    "contact_name": "Ada Lovelace",
    "email": "dev@acme.com"
  }'
# → { "account_id": 1, "verification_token": "cpv_...", "expires_in_hours": 48 }`} />
          <CodeBlock label="2 · verify email → dashboard token" code={`curl -X POST ${API_BASE}/developer/public/verify \\
  -H "Content-Type: application/json" \\
  -d '{ "email": "dev@acme.com", "token": "cpv_..." }'
# → { "account": { "dashboard_token": "cpm_...", ... } }`} />
          <p className="text-sm text-secondary-500">
            Store the <code className="text-xs">cpm_…</code> dashboard token — it is shown once and authenticates all app-management calls.
          </p>
        </section>

        {/* Auth */}
        <section id="auth" className="scroll-mt-6">
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2"><Lock className="h-5 w-5 text-primary-600" /> Authentication</h2>
          <p className="text-secondary-600 mb-3">Two distinct credentials, deliberately separated so a leaked data key cannot mint new keys:</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <Card className="p-4">
              <p className="font-semibold text-sm flex items-center gap-2"><KeyRound className="h-4 w-4" /> Dashboard token</p>
              <code className="text-xs text-primary-700">cpm_…</code>
              <p className="text-sm text-secondary-600 mt-2">Manages apps, keys and grant requests. Send as <code className="text-xs">X-Developer-Token</code> (or <code className="text-xs">Authorization: Bearer</code>).</p>
            </Card>
            <Card className="p-4">
              <p className="font-semibold text-sm flex items-center gap-2"><Terminal className="h-4 w-4" /> App API key</p>
              <code className="text-xs text-primary-700">cpk_…</code>
              <p className="text-sm text-secondary-600 mt-2">Reads hospital data only. Send as <code className="text-xs">X-API-Key</code> (or <code className="text-xs">Authorization: Bearer</code>).</p>
            </Card>
          </div>
          <p className="text-sm text-secondary-500 mt-3">Keys are stored only as hashes — copy them at creation. Rotate a key any time; the old one stops working immediately.</p>
          <p className="text-sm text-secondary-600 mt-3"><strong>Base URLs</strong></p>
          <CodeBlock label="base urls" code={`Registration & management:  ${API_BASE}/developer
Data API:                   ${DATA_BASE}`} />
        </section>

        {/* Scopes */}
        <section id="scopes" className="scroll-mt-6">
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary-600" /> Scopes</h2>
          <p className="text-secondary-600 mb-3">Request only what you need. Each scope maps to a specific read-only capability:</p>
          <div className="space-y-2">
            {[
              ["patient:search", "Search patients by name or identifier (minimal demographics)."],
              ["patient:history:read", "Read a patient's medical history — diagnoses, consultations, medications, procedures, admissions."],
              ["diagnostics:read", "Read a patient's baseline diagnostics — vital signs, laboratory results and radiology."],
            ].map(([c, d]) => (
              <Card key={c} className="p-3">
                <code className="text-xs font-bold text-primary-700">{c}</code>
                <p className="text-sm text-secondary-600 mt-1">{d}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Grants */}
        <section id="grants" className="scroll-mt-6">
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2"><Building2 className="h-5 w-5 text-primary-600" /> Requesting hospital access</h2>
          <p className="text-secondary-600 mb-2">
            Ask a hospital for access by its public <strong>hospital code</strong> (the hospital shares this with you).
            The request inherits your app's scopes; the hospital may approve a subset.
          </p>
          <CodeBlock label="request a grant" code={`curl -X POST ${API_BASE}/developer/portal/grants \\
  -H "X-Developer-Token: cpm_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "app_id": 12,
    "tenant_code": "STNICH",
    "requested_scopes": ["patient:search", "patient:history:read"],
    "justification": "Care-coordination for shared patients"
  }'`} />
          <p className="text-sm text-secondary-500">
            Track status with <code className="text-xs">GET /developer/portal/grants</code> — it moves
            <Badge variant="warning" className="mx-1">PENDING</Badge>→
            <Badge variant="success" className="mx-1">APPROVED</Badge> (or DENIED/REVOKED). Data calls succeed only while a grant is APPROVED.
          </p>
        </section>

        {/* Public API */}
        <section id="public-api" className="scroll-mt-6">
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2"><Terminal className="h-5 w-5 text-primary-600" /> Registration API <span className="text-xs font-normal text-secondary-400">(no auth)</span></h2>

          <Endpoint method="GET" path="/developer/public/scopes" auth="Public" />
          <p className="text-sm text-secondary-600">List the scope catalog.</p>

          <Endpoint method="POST" path="/developer/public/register" auth="Public" />
          <p className="text-sm text-secondary-600">Body: <code className="text-xs">organization_name, contact_name, email, website?, description?</code>. Returns a verification token.</p>

          <Endpoint method="POST" path="/developer/public/verify" auth="Public" />
          <p className="text-sm text-secondary-600">Body: <code className="text-xs">email, token</code>. Activates the account and returns the one-time dashboard token.</p>

          <Endpoint method="POST" path="/developer/public/resend-verification" auth="Public" />
          <p className="text-sm text-secondary-600">Body: <code className="text-xs">email</code>. Issues a fresh verification token.</p>
        </section>

        {/* Portal API */}
        <section id="portal-api" className="scroll-mt-6">
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary-600" /> Management API <span className="text-xs font-normal text-secondary-400">(dashboard token)</span></h2>

          <Endpoint method="GET" path="/developer/portal/me" auth="X-Developer-Token" />
          <p className="text-sm text-secondary-600">Your account profile and apps.</p>

          <Endpoint method="POST" path="/developer/portal/apps" auth="X-Developer-Token" />
          <p className="text-sm text-secondary-600">Create an app and generate its API key.</p>
          <CodeBlock label="create app" code={`curl -X POST ${API_BASE}/developer/portal/apps \\
  -H "X-Developer-Token: cpm_..." \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "Acme PHR", "environment": "LIVE",
        "scopes": ["patient:search", "diagnostics:read"] }'
# → { "app": { "id": 12, "key_prefix": "cpk_...", "api_key": "cpk_...(shown once)" } }`} />

          <Endpoint method="GET" path="/developer/portal/apps" auth="X-Developer-Token" />
          <Endpoint method="PATCH" path="/developer/portal/apps/{app_id}/scopes" auth="X-Developer-Token" />
          <Endpoint method="POST" path="/developer/portal/apps/{app_id}/rotate-key" auth="X-Developer-Token" />
          <Endpoint method="POST" path="/developer/portal/apps/{app_id}/revoke" auth="X-Developer-Token" />
          <Endpoint method="GET" path="/developer/portal/grants" auth="X-Developer-Token" />
          <Endpoint method="POST" path="/developer/portal/grants" auth="X-Developer-Token" />
        </section>

        {/* Data API */}
        <section id="data-api" className="scroll-mt-6">
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2"><Terminal className="h-5 w-5 text-primary-600" /> Data API <span className="text-xs font-normal text-secondary-400">(API key)</span></h2>
          <p className="text-secondary-600">All data endpoints are keyed by the hospital's <code className="text-xs">{"{tenant_code}"}</code> and require an APPROVED grant covering the relevant scope.</p>

          <Endpoint method="GET" path="/developer/api/v1/ping" auth="X-API-Key" />
          <p className="text-sm text-secondary-600">Verify a key and see its environment + scopes.</p>
          <CodeBlock label="ping" code={`curl -H "X-API-Key: cpk_..." ${DATA_BASE}/ping`} />

          <Endpoint method="GET" path="/developer/api/v1/hospitals/{tenant_code}/patients" auth="patient:search" />
          <p className="text-sm text-secondary-600">Query: <code className="text-xs">search</code>, <code className="text-xs">limit</code> (1–100).</p>
          <CodeBlock label="search patients" code={`curl -H "X-API-Key: cpk_..." \\
  "${DATA_BASE}/hospitals/STNICH/patients?search=Ada&limit=25"
# → { "tenant": "St Nicholas", "count": 2, "items": [ { "global_patient_id": "GPID-...", "first_name": "Ada", ... } ] }`} />

          <Endpoint method="GET" path="/developer/api/v1/hospitals/{tenant_code}/patients/{global_patient_id}/medical-history" auth="patient:history:read" />
          <CodeBlock label="medical history" code={`curl -H "X-API-Key: cpk_..." \\
  ${DATA_BASE}/hospitals/STNICH/patients/GPID-ABC123/medical-history
# → { "record": { "kind": "MEDICAL_HISTORY", "patient": {...},
#       "sections": { "Diagnosis": [...], "Consultation": [...], "Prescription": [...] },
#       "counts": { "Diagnosis": 4, ... } } }`} />

          <Endpoint method="GET" path="/developer/api/v1/hospitals/{tenant_code}/patients/{global_patient_id}/baseline-diagnostics" auth="diagnostics:read" />
          <CodeBlock label="baseline diagnostics" code={`curl -H "X-API-Key: cpk_..." \\
  ${DATA_BASE}/hospitals/STNICH/patients/GPID-ABC123/baseline-diagnostics
# → { "record": { "kind": "BASELINE_DIAGNOSTICS",
#       "sections": { "LabResult": [...], "VitalSigns": [...], "RadiologyOrder": [...] } } }`} />
        </section>

        {/* Errors */}
        <section id="errors" className="scroll-mt-6">
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /> Errors</h2>
          <p className="text-secondary-600 mb-2">Errors return a JSON body with a <code className="text-xs">detail</code> message.</p>
          <div className="overflow-hidden rounded-xl border border-secondary-200">
            <table className="w-full text-sm">
              <thead className="bg-secondary-50 text-secondary-500 text-xs uppercase tracking-wide">
                <tr><th className="text-left px-4 py-2">Status</th><th className="text-left px-4 py-2">Meaning</th></tr>
              </thead>
              <tbody className="divide-y divide-secondary-100">
                {[
                  ["400", "Malformed request or key, or invalid scopes."],
                  ["401", "Missing / invalid API key or dashboard token."],
                  ["403", "Key revoked, or the hospital hasn't approved this scope for your app."],
                  ["404", "Hospital code or patient not found."],
                ].map(([c, d]) => (
                  <tr key={c}><td className="px-4 py-2 font-mono">{c}</td><td className="px-4 py-2 text-secondary-600">{d}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Best practices */}
        <section id="best-practices" className="scroll-mt-6">
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary-600" /> Best practices</h2>
          <ul className="space-y-2 text-sm text-secondary-600 list-disc pl-5">
            <li>Store keys server-side only — never ship <code className="text-xs">cpk_…</code> in a browser or mobile bundle.</li>
            <li>Use a separate SANDBOX app while building; switch to a LIVE app for production traffic.</li>
            <li>Request the narrowest scopes that satisfy your use case — hospitals approve minimal-scope requests faster.</li>
            <li>Rotate keys on a schedule and immediately if one is exposed; revoke apps you no longer use.</li>
            <li>Handle 403 gracefully — a hospital can revoke a grant at any time, and your integration should degrade cleanly.</li>
            <li>Cache the global patient ID you resolve from search; it is stable across a hospital's records.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
