import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RotateCcw, KeyRound, Trash2, RotateCw, Send, Copy, Check, Plug } from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxGrid, DxBadge, DxButton, DxInput, DxSelect, DxTextarea, DxPopup, DxMessage,
  type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { env } from "@/config/env";
import { integrationsApi, type IntegrationPartner, type OutboundResult } from "../api/integrations.api";

const INBOUND_BASE = `${env.apiBaseUrl.replace(/\/$/, "")}/integration/v1`;

function fmt(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function IntegrationsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["integration-partners"], queryFn: () => integrationsApi.list() });
  const partners = list.data ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [revealKey, setRevealKey] = useState<{ name: string; key: string } | null>(null);
  const [testPartner, setTestPartner] = useState<IntegrationPartner | null>(null);
  const [toRevoke, setToRevoke] = useState<IntegrationPartner | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["integration-partners"] });

  const rotate = useMutation({
    mutationFn: (id: number) => integrationsApi.rotate(id),
    onSuccess: (res) => { invalidate(); setRevealKey({ name: res.partner.name, key: res.api_key }); },
    onError: () => toast.error("Couldn't rotate", "Please try again."),
  });
  const revoke = useMutation({
    mutationFn: (id: number) => integrationsApi.revoke(id),
    onSuccess: () => { invalidate(); toast.success("Connection revoked"); setToRevoke(null); },
    onError: () => toast.error("Couldn't revoke", "Please try again."),
  });

  const columns: DxGridColumn<IntegrationPartner>[] = [
    { key: "partner", header: "Partner", render: (p) => <div><p className="text-[13px] font-semibold text-[var(--dx-text)]">{p.name}</p>{p.description ? <p className="text-[11px] text-[var(--dx-text-muted)]">{p.description}</p> : null}</div> },
    { key: "prefix", header: "Key prefix", render: (p) => <span className="dx-mono text-[12px] text-[var(--dx-text-muted)]">{p.key_prefix}…</span> },
    { key: "scopes", header: "Scopes", render: (p) => <div className="flex gap-1">{p.scopes.split(",").map((sc) => <DxBadge key={sc} tone="neutral">{sc}</DxBadge>)}</div> },
    { key: "outbound", header: "Outbound", render: (p) => p.base_url ? <span className="dx-mono text-[12px] text-[var(--dx-text-muted)]">{p.base_url}</span> : <span className="text-[12px] text-[var(--dx-text-faint)]">—</span> },
    { key: "last", header: "Last used", render: (p) => <span className="text-[12px] text-[var(--dx-text-muted)]">{fmt(p.last_used_at)}</span> },
    { key: "status", header: "Status", render: (p) => <DxBadge tone={p.is_active ? "success" : "danger"}>{p.is_active ? "Active" : "Revoked"}</DxBadge> },
    {
      key: "actions", header: "", align: "right",
      render: (p) => (
        <div className="flex items-center justify-end gap-2">
          {p.base_url ? <DxButton size="sm" variant="text" leftIcon={<Send className="h-3.5 w-3.5" />} onClick={() => setTestPartner(p)}>Test</DxButton> : null}
          <DxButton size="sm" variant="text" leftIcon={<RotateCw className="h-3.5 w-3.5" />} onClick={() => rotate.mutate(p.id)} isLoading={rotate.isPending && rotate.variables === p.id}>Rotate</DxButton>
          {p.is_active ? <DxButton icon size="sm" variant="outline-danger" title="Revoke" onClick={() => setToRevoke(p)}><Trash2 /></DxButton> : null}
        </div>
      ),
    },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Settings" }, { label: "Integrations" }]}
        title="Integrations & API Keys"
        subtitle="Connect third-party hospital applications for two-way data exchange."
        actions={
          <>
            <DxButton icon title="Refresh" onClick={() => list.refetch()} isLoading={list.isFetching}><RotateCcw /></DxButton>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>New connection</DxButton>
          </>
        }
      />

      <div className="space-y-1 rounded-md border border-[var(--dx-accent)] bg-[var(--dx-accent-soft)] px-5 py-4 text-[13px] text-[var(--dx-text-muted)]">
        <p className="font-semibold text-[var(--dx-text)]">How partners connect</p>
        <p>Partners call your API at <span className="dx-mono text-[var(--dx-text)]">{INBOUND_BASE}</span> and authenticate with the header <span className="dx-mono text-[var(--dx-text)]">X-API-Key: &lt;their key&gt;</span>.</p>
        <p>Endpoints: <span className="dx-mono">GET /ping</span>, <span className="dx-mono">GET /patients</span>, <span className="dx-mono">GET /patients/&#123;global_id&#125;/record</span>, <span className="dx-mono">POST /patients</span>, <span className="dx-mono">POST /data-push</span>. You can also call their endpoint via <b>Test</b>.</p>
      </div>

      <DxPanel title="Connections" icon={<Plug className="h-4 w-4" />} flush>
        <DxGrid
          columns={columns}
          data={partners}
          rowKey={(p) => p.id}
          isLoading={list.isLoading}
          empty={{ icon: Plug, title: "No connections yet", description: "Create a connection to issue an API key to a partner application." }}
        />
      </DxPanel>

      <CreateModal isOpen={createOpen} onClose={() => setCreateOpen(false)} onCreated={(name, key) => { invalidate(); setRevealKey({ name, key }); }} />
      <KeyRevealModal reveal={revealKey} onClose={() => setRevealKey(null)} />
      <TestModal partner={testPartner} onClose={() => setTestPartner(null)} />

      <DxPopup
        isOpen={toRevoke !== null}
        onClose={() => setToRevoke(null)}
        title="Revoke connection?"
        size="sm"
        locked={revoke.isPending}
        footer={<><DxButton onClick={() => setToRevoke(null)} disabled={revoke.isPending}>Cancel</DxButton><DxButton variant="danger" isLoading={revoke.isPending} onClick={() => { if (toRevoke) revoke.mutate(toRevoke.id); }}>Revoke</DxButton></>}
      >
        <DxMessage tone="danger">{toRevoke ? `"${toRevoke.name}"'s API key will stop working immediately.` : ""}</DxMessage>
      </DxPopup>
    </DxPage>
  );
}

function CreateModal({ isOpen, onClose, onCreated }: { isOpen: boolean; onClose: () => void; onCreated: (name: string, key: string) => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [read, setRead] = useState(true);
  const [write, setWrite] = useState(false);
  const [expiry, setExpiry] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [authHeader, setAuthHeader] = useState("X-API-Key");
  const [authSecret, setAuthSecret] = useState("");

  const reset = () => { setName(""); setDescription(""); setRead(true); setWrite(false); setExpiry(""); setBaseUrl(""); setAuthHeader("X-API-Key"); setAuthSecret(""); };
  const create = useMutation({
    mutationFn: () => integrationsApi.create({
      name: name.trim(), description: description.trim() || undefined,
      scopes: [...(read ? ["READ"] : []), ...(write ? ["WRITE"] : [])],
      expiry_days: expiry ? Number(expiry) : undefined,
      base_url: baseUrl.trim() || undefined, auth_header: authHeader.trim() || undefined,
      auth_secret: authSecret.trim() || undefined,
    }),
    onSuccess: (res) => { onCreated(res.partner.name, res.api_key); onClose(); reset(); },
    onError: (e: any) => toast.error("Couldn't create", e?.response?.data?.detail || e?.response?.data?.message || "Check the fields and try again."),
  });
  function submit() {
    if (!name.trim()) return toast.error("Missing name", "Give the connection a name.");
    if (!read && !write) return toast.error("Select a scope", "Choose READ and/or WRITE.");
    create.mutate();
  }
  const scopeBox = "flex items-center gap-2 rounded-md border border-[var(--dx-border)] px-4 py-3 text-[13px] font-semibold text-[var(--dx-text)] cursor-pointer";
  return (
    <DxPopup
      isOpen={isOpen} onClose={onClose} title="New Integration Connection" size="md"
      locked={create.isPending}
      footer={<><DxButton onClick={onClose}>Cancel</DxButton><DxButton variant="primary" onClick={submit} isLoading={create.isPending}>Create &amp; issue key</DxButton></>}
    >
      <div className="space-y-4">
        <DxInput label="Partner name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme HMIS" />
        <DxInput label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div>
          <span className="dx-field-label">Scopes (what their key can do)</span>
          <div className="mt-1 grid grid-cols-2 gap-3">
            <label className={scopeBox}><input type="checkbox" checked={read} onChange={(e) => setRead(e.target.checked)} style={{ accentColor: "var(--dx-accent)" }} /> READ (pull data)</label>
            <label className={scopeBox}><input type="checkbox" checked={write} onChange={(e) => setWrite(e.target.checked)} style={{ accentColor: "var(--dx-accent)" }} /> WRITE (push data)</label>
          </div>
        </div>
        <DxInput label="Key expiry (days, optional)" type="number" min="1" value={expiry} onChange={(e) => setExpiry(e.target.value)} hint="Leave blank for no expiry. Enter 2 for a 2-day key." />
        <div className="space-y-4 border-t border-[var(--dx-border)] pt-4">
          <p className="dx-field-label">Outbound — how we call them (optional)</p>
          <DxInput label="Partner base URL" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://partner.example.com/api" />
          <div className="grid grid-cols-2 gap-4">
            <DxInput label="Auth header" value={authHeader} onChange={(e) => setAuthHeader(e.target.value)} />
            <DxInput label="Auth secret (their key)" value={authSecret} onChange={(e) => setAuthSecret(e.target.value)} type="password" />
          </div>
        </div>
      </div>
    </DxPopup>
  );
}

function KeyRevealModal({ reveal, onClose }: { reveal: { name: string; key: string } | null; onClose: () => void }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  function copy() {
    if (!reveal) return;
    navigator.clipboard?.writeText(reveal.key).then(() => { setCopied(true); toast.success("Copied"); window.setTimeout(() => setCopied(false), 1500); });
  }
  return (
    <DxPopup
      isOpen={reveal !== null} onClose={onClose} title="API Key Issued" size="md"
      footer={<DxButton variant="primary" onClick={onClose}>Done</DxButton>}
    >
      {reveal ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-md border px-4 py-3 text-[13px] font-semibold" style={{ borderColor: "var(--dx-warning)", background: "var(--dx-warning-soft)", color: "var(--dx-warning)" }}>
            <KeyRound className="h-5 w-5 shrink-0" /> Copy this key now — it won't be shown again.
          </div>
          <p className="text-[13px] text-[var(--dx-text-muted)]">Key for <b className="text-[var(--dx-text)]">{reveal.name}</b>:</p>
          <div className="flex items-center gap-2 rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] px-4 py-3">
            <span className="dx-mono flex-1 break-all text-[12px] text-[var(--dx-text)]">{reveal.key}</span>
            <DxButton icon size="sm" variant="text" onClick={copy} title="Copy">{copied ? <Check style={{ color: "var(--dx-success)" }} /> : <Copy />}</DxButton>
          </div>
          <p className="text-[11px] text-[var(--dx-text-muted)]">Share it with the partner over a secure channel. They send it as the <span className="dx-mono">X-API-Key</span> header.</p>
        </div>
      ) : null}
    </DxPopup>
  );
}

function TestModal({ partner, onClose }: { partner: IntegrationPartner | null; onClose: () => void }) {
  const toast = useToast();
  const [path, setPath] = useState("/");
  const [method, setMethod] = useState("GET");
  const [body, setBody] = useState("");
  const [result, setResult] = useState<OutboundResult | null>(null);
  const run = useMutation({
    mutationFn: () => {
      let payload: any = undefined;
      if (body.trim()) { try { payload = JSON.parse(body); } catch { throw new Error("Body must be valid JSON."); } }
      return integrationsApi.outboundRequest(partner!.id, { path, method, payload });
    },
    onSuccess: (res) => setResult(res),
    onError: (e: any) => toast.error("Request failed", e?.message || e?.response?.data?.detail || "Please try again."),
  });
  return (
    <DxPopup
      isOpen={partner !== null} onClose={() => { setResult(null); onClose(); }} title={`Call ${partner?.name ?? "partner"}`} size="lg"
      footer={<><DxButton onClick={() => { setResult(null); onClose(); }}>Close</DxButton><DxButton variant="primary" onClick={() => run.mutate()} isLoading={run.isPending} leftIcon={<Send className="h-4 w-4" />}>Send</DxButton></>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-3">
          <DxSelect label="Method" value={method} onChange={(e) => setMethod(e.target.value)} options={["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => ({ value: m, label: m }))} />
          <div className="col-span-3"><DxInput label="Path" value={path} onChange={(e) => setPath(e.target.value)} placeholder="/patients" hint={partner?.base_url ? `Appended to ${partner.base_url}` : undefined} /></div>
        </div>
        <DxTextarea label="JSON body (optional)" rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder='{"key":"value"}' />
        {result ? (
          <div className="overflow-hidden rounded-md border border-[var(--dx-border)]">
            <div className="px-4 py-2 text-[12px] font-semibold" style={result.ok ? { background: "var(--dx-success-soft)", color: "var(--dx-success)" } : { background: "var(--dx-danger-soft)", color: "var(--dx-danger)" }}>HTTP {result.status_code} {result.ok ? "OK" : "Error"}</div>
            <pre className="max-h-72 overflow-auto p-4 text-[12px]" style={{ background: "#0f172a", color: "#e2e8f0" }}>{JSON.stringify(result.data, null, 2)}</pre>
          </div>
        ) : null}
      </div>
    </DxPopup>
  );
}
