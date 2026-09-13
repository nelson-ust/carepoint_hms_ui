import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ShieldCheck, Ban, Check, X, Building2, Code2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/feedback/ToastProvider";
import { developerAdminApi, type DevGrant, type DevAccount } from "../api/developer.api";

function fmt(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString(undefined,
    { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function statusVariant(s: string) {
  return s === "APPROVED" ? "success" : s === "PENDING" ? "warning" : s === "REVOKED" || s === "DENIED" ? "destructive" : "secondary";
}

export function DeveloperAccessPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"grants" | "accounts">("grants");

  const grants = useQuery({ queryKey: ["admin-dev-grants"], queryFn: () => developerAdminApi.listGrants() });
  const accounts = useQuery({ queryKey: ["admin-dev-accounts"], queryFn: () => developerAdminApi.listAccounts(), enabled: tab === "accounts" });

  const [decideFor, setDecideFor] = useState<{ grant: DevGrant; approve: boolean } | null>(null);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [note, setNote] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-dev-grants"] });

  const decide = useMutation({
    mutationFn: () => developerAdminApi.decide(decideFor!.grant.id, {
      approve: decideFor!.approve,
      approved_scopes: decideFor!.approve ? selectedScopes : undefined,
      note: note || undefined,
    }),
    onSuccess: () => { invalidate(); setDecideFor(null); setNote(""); toast.success("Decision recorded"); },
    onError: (e: any) => toast.error("Couldn't record decision", e?.response?.data?.detail || ""),
  });

  const revoke = useMutation({
    mutationFn: (id: number) => developerAdminApi.revoke(id),
    onSuccess: () => { invalidate(); toast.success("Grant revoked"); },
    onError: (e: any) => toast.error("Couldn't revoke", e?.response?.data?.detail || ""),
  });

  const setAcctStatus = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => developerAdminApi.setAccountStatus(id, active),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-dev-accounts"] }); toast.success("Account updated"); },
    onError: (e: any) => toast.error("Couldn't update account", e?.response?.data?.detail || ""),
  });

  const openDecide = (grant: DevGrant, approve: boolean) => {
    setDecideFor({ grant, approve });
    setSelectedScopes(grant.requested_scopes);
    setNote("");
  };

  const pending = (grants.data ?? []).filter((g) => g.status === "PENDING");

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader title="Developer Access" description="Approve which third-party developers may read your hospital's patient data, and with what scope." />
        <button onClick={() => { grants.refetch(); accounts.refetch(); }} className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-400" title="Refresh">
          <RefreshCw className={`h-4 w-4 ${grants.isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab("grants")} className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === "grants" ? "bg-primary-600 text-white" : "bg-secondary-100 text-secondary-600"}`}>
          Data Grants{pending.length ? ` (${pending.length})` : ""}
        </button>
        <button onClick={() => setTab("accounts")} className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === "accounts" ? "bg-primary-600 text-white" : "bg-secondary-100 text-secondary-600"}`}>
          Developer Accounts
        </button>
      </div>

      {tab === "grants" ? (
        grants.isLoading ? <Skeleton className="h-32 w-full" /> : (grants.data ?? []).length === 0 ? (
          <Card className="p-10 text-center text-secondary-500">
            <Code2 className="h-8 w-8 mx-auto mb-3 opacity-40" />
            No developer has requested access to your data yet.
          </Card>
        ) : (
          <div className="space-y-4">
            {(grants.data ?? []).map((g) => (
              <Card key={g.id} className="p-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{g.developer?.organization_name || `Developer #${g.developer_account_id}`}</p>
                      <Badge variant={statusVariant(g.status)}>{g.status}</Badge>
                      {g.app_environment && <Badge variant="secondary">{g.app_environment}</Badge>}
                    </div>
                    <p className="text-sm text-secondary-500">
                      App: {g.app_name || "—"} · Contact: {g.developer?.email || "—"}
                    </p>
                    <p className="text-xs text-secondary-500">
                      Requested: {g.requested_scopes.join(", ") || "—"}
                      {g.approved_scopes.length ? ` · Approved: ${g.approved_scopes.join(", ")}` : ""} · {fmt(g.requested_at)}
                    </p>
                    {g.justification && <p className="text-xs italic text-secondary-500 mt-1">“{g.justification}”</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {g.status === "PENDING" && (
                      <>
                        <Button size="sm" leftIcon={<Check className="h-3.5 w-3.5" />} onClick={() => openDecide(g, true)}>Approve</Button>
                        <Button size="sm" variant="danger" leftIcon={<X className="h-3.5 w-3.5" />} onClick={() => openDecide(g, false)}>Deny</Button>
                      </>
                    )}
                    {g.status === "APPROVED" && (
                      <Button size="sm" variant="danger" leftIcon={<Ban className="h-3.5 w-3.5" />} onClick={() => revoke.mutate(g.id)}>Revoke</Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : (
        accounts.isLoading ? <Skeleton className="h-32 w-full" /> : (accounts.data ?? []).length === 0 ? (
          <Card className="p-10 text-center text-secondary-500">No developer accounts registered.</Card>
        ) : (
          <Card className="divide-y divide-secondary-100">
            {(accounts.data ?? []).map((a: DevAccount) => (
              <div key={a.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{a.organization_name}</p>
                    <Badge variant={a.status === "ACTIVE" ? "success" : a.status === "SUSPENDED" ? "destructive" : "warning"}>{a.status}</Badge>
                  </div>
                  <p className="text-xs text-secondary-500">{a.contact_name} · {a.email} · registered {fmt(a.created_at)}</p>
                </div>
                {a.status === "ACTIVE" ? (
                  <Button size="sm" variant="danger" leftIcon={<Ban className="h-3.5 w-3.5" />} onClick={() => setAcctStatus.mutate({ id: a.id, active: false })}>Suspend</Button>
                ) : (
                  <Button size="sm" variant="secondary" leftIcon={<ShieldCheck className="h-3.5 w-3.5" />} onClick={() => setAcctStatus.mutate({ id: a.id, active: true })}>Reactivate</Button>
                )}
              </div>
            ))}
          </Card>
        )
      )}

      {/* Decision modal */}
      <Modal isOpen={!!decideFor} onClose={() => setDecideFor(null)} title={decideFor?.approve ? "Approve data access" : "Deny data access"}>
        <div className="space-y-4">
          {decideFor?.approve && (
            <div>
              <p className="text-sm font-medium mb-2 flex items-center gap-2"><Building2 className="h-4 w-4" /> Scopes to approve</p>
              <div className="space-y-2">
                {decideFor.grant.requested_scopes.map((sc) => (
                  <label key={sc} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={selectedScopes.includes(sc)}
                      onChange={() => setSelectedScopes((s) => s.includes(sc) ? s.filter((x) => x !== sc) : [...s, sc])} />
                    <code className="text-xs">{sc}</code>
                  </label>
                ))}
              </div>
            </div>
          )}
          <Textarea label="Note (optional)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-3">
            <Button isLoading={decide.isPending} variant={decideFor?.approve ? "primary" : "danger"}
              onClick={() => { if (decideFor?.approve && selectedScopes.length === 0) { toast.error("Select at least one scope"); return; } decide.mutate(); }}>
              {decideFor?.approve ? "Approve access" : "Deny request"}
            </Button>
            <Button variant="secondary" onClick={() => setDecideFor(null)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
