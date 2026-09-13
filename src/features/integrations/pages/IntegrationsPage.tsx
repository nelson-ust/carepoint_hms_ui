import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, KeyRound, Trash2, RotateCw, Send, Copy, Check, Plug } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
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
    onSuccess: () => { invalidate(); toast.success("Connection revoked"); },
    onError: () => toast.error("Couldn't revoke", "Please try again."),
  });

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader title="Integrations & API Keys" description="Connect third-party hospital applications for two-way data exchange." />
        <div className="flex gap-3">
          <button onClick={() => list.refetch()} className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-400" title="Refresh">
            <RefreshCw className={`h-4 w-4 ${list.isFetching ? "animate-spin" : ""}`} />
          </button>
          <Button leftIcon={<Plus className="h-5 w-5" />} onClick={() => setCreateOpen(true)}>New Connection</Button>
        </div>
      </div>

      <div className="rounded-2xl bg-primary-500/5 border border-primary-100 px-5 py-4 text-sm text-secondary-600 space-y-1">
        <p className="font-bold text-secondary-800">How partners connect</p>
        <p>Partners call your API at <span className="data-mono text-secondary-800">{INBOUND_BASE}</span> and authenticate with the header <span className="data-mono text-secondary-800">X-API-Key: &lt;their key&gt;</span>.</p>
        <p>Endpoints: <span className="data-mono">GET /ping</span>, <span className="data-mono">GET /patients</span>, <span className="data-mono">GET /patients/&#123;global_id&#125;/record</span>, <span className="data-mono">POST /patients</span>, <span className="data-mono">POST /data-push</span>. You can also call their endpoint via <b>Test</b>.</p>
      </div>

      <Card variant="panel" className="p-0 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-secondary-900/5 text-[10px] font-bold uppercase tracking-widest text-secondary-500">
              <th className="px-6 py-4">Partner</th><th className="px-6 py-4">Key prefix</th><th className="px-6 py-4">Scopes</th>
              <th className="px-6 py-4">Outbound</th><th className="px-6 py-4">Last used</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary-100/60">
            {list.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <tr key={i}><td colSpan={7} className="px-6 py-4"><Skeleton className="h-8 w-full" /></td></tr>)
            ) : partners.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-24 text-center">
                <Plug className="h-12 w-12 mx-auto text-secondary-200 mb-3" />
                <p className="font-bold text-secondary-900">No connections yet</p>
                <p className="text-sm text-secondary-400 mt-1">Create a connection to issue an API key to a partner application.</p>
              </td></tr>
            ) : (
              partners.map((p) => (
                <tr key={p.id} className="hover:bg-primary-50/20">
                  <td className="px-6 py-4"><p className="font-bold text-secondary-900">{p.name}</p>{p.description ? <p className="text-xs text-secondary-400">{p.description}</p> : null}</td>
                  <td className="px-6 py-4 font-mono text-secondary-600">{p.key_prefix}…</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1">{p.scopes.split(",").map((sc) => <Badge key={sc} variant="secondary">{sc}</Badge>)}</div>
                  </td>
                  <td className="px-6 py-4 text-secondary-500">{p.base_url ? <span className="data-mono text-xs">{p.base_url}</span> : <span className="text-xs text-secondary-300">—</span>}</td>
                  <td className="px-6 py-4 text-secondary-500 text-xs">{fmt(p.last_used_at)}</td>
                  <td className="px-6 py-4"><Badge variant={p.is_active ? "soft-success" : "soft-danger"}>{p.is_active ? "Active" : "Revoked"}</Badge></td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {p.base_url ? (
                        <Button size="sm" variant="ghost" leftIcon={<Send className="h-3.5 w-3.5" />} onClick={() => setTestPartner(p)}>Test</Button>
                      ) : null}
                      <Button size="sm" variant="ghost" leftIcon={<RotateCw className="h-3.5 w-3.5" />} onClick={() => rotate.mutate(p.id)} isLoading={rotate.isPending && rotate.variables === p.id}>Rotate</Button>
                      {p.is_active ? (
                        <button onClick={() => setToRevoke(p)} className="p-2 rounded-xl hover:bg-rose-50" title="Revoke"><Trash2 className="h-4 w-4 text-rose-400" /></button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <CreateModal isOpen={createOpen} onClose={() => setCreateOpen(false)}
        onCreated={(name, key) => { invalidate(); setRevealKey({ name, key }); }} />
      <KeyRevealModal reveal={revealKey} onClose={() => setRevealKey(null)} />
      <TestModal partner={testPartner} onClose={() => setTestPartner(null)} />
      <ConfirmDialog isOpen={toRevoke !== null} onClose={() => setToRevoke(null)}
        onConfirm={() => { if (toRevoke) revoke.mutate(toRevoke.id); }}
        title="Revoke connection?" description={toRevoke ? `"${toRevoke.name}"'s API key will stop working immediately.` : undefined}
        confirmLabel="Revoke" tone="danger" />
    </div>
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
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Integration Connection" size="md"
      footer={<div className="flex justify-end gap-3"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} isLoading={create.isPending}>Create &amp; issue key</Button></div>}>
      <div className="space-y-4">
        <Input label="Partner name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme HMIS" />
        <Input label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-secondary-500">Scopes (what their key can do)</label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 rounded-2xl border border-secondary-200 px-4 py-3 text-sm font-semibold cursor-pointer">
              <input type="checkbox" checked={read} onChange={(e) => setRead(e.target.checked)} /> READ (pull data)
            </label>
            <label className="flex items-center gap-2 rounded-2xl border border-secondary-200 px-4 py-3 text-sm font-semibold cursor-pointer">
              <input type="checkbox" checked={write} onChange={(e) => setWrite(e.target.checked)} /> WRITE (push data)
            </label>
          </div>
        </div>
        <Input label="Key expiry (days, optional)" type="number" min="1" value={expiry} onChange={(e) => setExpiry(e.target.value)} hint="Leave blank for no expiry. Enter 2 for a 2-day key." />
        <div className="border-t border-secondary-100 pt-4 space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-secondary-400">Outbound — how we call them (optional)</p>
          <Input label="Partner base URL" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://partner.example.com/api" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Auth header" value={authHeader} onChange={(e) => setAuthHeader(e.target.value)} />
            <Input label="Auth secret (their key)" value={authSecret} onChange={(e) => setAuthSecret(e.target.value)} type="password" />
          </div>
        </div>
      </div>
    </Modal>
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
    <Modal isOpen={reveal !== null} onClose={onClose} title="API Key Issued" size="md"
      footer={<div className="flex justify-end"><Button onClick={onClose}>Done</Button></div>}>
      {reveal ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm font-bold text-amber-700">
            <KeyRound className="h-5 w-5 shrink-0" /> Copy this key now — it won't be shown again.
          </div>
          <p className="text-sm text-secondary-600">Key for <b>{reveal.name}</b>:</p>
          <div className="flex items-center gap-2 rounded-2xl border border-secondary-200 bg-secondary-50 px-4 py-3">
            <span className="flex-1 break-all font-mono text-xs text-secondary-800">{reveal.key}</span>
            <button onClick={copy} className="rounded-xl p-2 hover:bg-white" title="Copy">
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-secondary-500" />}
            </button>
          </div>
          <p className="text-[11px] text-secondary-400">Share it with the partner over a secure channel. They send it as the <span className="data-mono">X-API-Key</span> header.</p>
        </div>
      ) : null}
    </Modal>
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
    <Modal isOpen={partner !== null} onClose={() => { setResult(null); onClose(); }} title={`Call ${partner?.name ?? "partner"}`} size="lg"
      footer={<div className="flex justify-end gap-3"><Button variant="secondary" onClick={() => { setResult(null); onClose(); }}>Close</Button><Button onClick={() => run.mutate()} isLoading={run.isPending} leftIcon={<Send className="h-4 w-4" />}>Send</Button></div>}>
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-3">
          <Select label="Method" value={method} onChange={(e) => setMethod(e.target.value)} options={["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => ({ value: m, label: m }))} />
          <div className="col-span-3"><Input label="Path" value={path} onChange={(e) => setPath(e.target.value)} placeholder="/patients" hint={partner?.base_url ? `Appended to ${partner.base_url}` : undefined} /></div>
        </div>
        <Textarea label="JSON body (optional)" rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder='{"key":"value"}' />
        {result ? (
          <div className="rounded-2xl border border-secondary-100 overflow-hidden">
            <div className={`px-4 py-2 text-xs font-bold ${result.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>HTTP {result.status_code} {result.ok ? "OK" : "Error"}</div>
            <pre className="max-h-72 overflow-auto bg-secondary-900 p-4 text-xs text-secondary-100">{JSON.stringify(result.data, null, 2)}</pre>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
