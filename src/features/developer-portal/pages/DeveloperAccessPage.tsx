import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, ShieldCheck, Ban, Check, X, Building2, Code2 } from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxTabs, DxBadge, DxButton, DxTextarea, DxPopup,
  type DxBadgeTone,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { developerAdminApi, type DevGrant, type DevAccount } from "../api/developer.api";

function fmt(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString(undefined,
    { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function grantTone(s: string): DxBadgeTone {
  return s === "APPROVED" ? "success" : s === "PENDING" ? "warning" : s === "REVOKED" || s === "DENIED" ? "danger" : "neutral";
}
function accountTone(s: string): DxBadgeTone {
  return s === "ACTIVE" ? "success" : s === "SUSPENDED" ? "danger" : "warning";
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
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Settings" }, { label: "Developer Access" }]}
        title="Developer Access"
        subtitle="Approve which third-party developers may read your hospital's patient data, and with what scope."
        actions={<DxButton icon title="Refresh" onClick={() => { grants.refetch(); accounts.refetch(); }} isLoading={grants.isFetching}><RotateCcw /></DxButton>}
      />

      <DxTabs
        items={[
          { key: "grants", label: `Data Grants${pending.length ? ` (${pending.length})` : ""}` },
          { key: "accounts", label: "Developer Accounts" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "grants" ? (
        grants.isLoading ? <div className="dx-skeleton h-32 w-full" /> : (grants.data ?? []).length === 0 ? (
          <DxPanel>
            <div className="py-12 text-center text-[var(--dx-text-muted)]">
              <Code2 className="mx-auto mb-3 h-8 w-8 text-[var(--dx-text-faint)]" />
              No developer has requested access to your data yet.
            </div>
          </DxPanel>
        ) : (
          <div className="space-y-4">
            {(grants.data ?? []).map((g) => (
              <div key={g.id} className="rounded-lg border border-[var(--dx-border)] bg-[var(--dx-surface)] p-5">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-semibold text-[var(--dx-text)]">{g.developer?.organization_name || `Developer #${g.developer_account_id}`}</p>
                      <DxBadge tone={grantTone(g.status)}>{g.status}</DxBadge>
                      {g.app_environment ? <DxBadge tone="neutral">{g.app_environment}</DxBadge> : null}
                    </div>
                    <p className="text-[13px] text-[var(--dx-text-muted)]">App: {g.app_name || "—"} · Contact: {g.developer?.email || "—"}</p>
                    <p className="text-[12px] text-[var(--dx-text-muted)]">
                      Requested: {g.requested_scopes.join(", ") || "—"}
                      {g.approved_scopes.length ? ` · Approved: ${g.approved_scopes.join(", ")}` : ""} · {fmt(g.requested_at)}
                    </p>
                    {g.justification ? <p className="mt-1 text-[12px] italic text-[var(--dx-text-muted)]">“{g.justification}”</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {g.status === "PENDING" ? (
                      <>
                        <DxButton size="sm" variant="primary" leftIcon={<Check className="h-3.5 w-3.5" />} onClick={() => openDecide(g, true)}>Approve</DxButton>
                        <DxButton size="sm" variant="danger" leftIcon={<X className="h-3.5 w-3.5" />} onClick={() => openDecide(g, false)}>Deny</DxButton>
                      </>
                    ) : null}
                    {g.status === "APPROVED" ? <DxButton size="sm" variant="danger" leftIcon={<Ban className="h-3.5 w-3.5" />} onClick={() => revoke.mutate(g.id)}>Revoke</DxButton> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        accounts.isLoading ? <div className="dx-skeleton h-32 w-full" /> : (accounts.data ?? []).length === 0 ? (
          <DxPanel><div className="py-12 text-center text-[var(--dx-text-muted)]">No developer accounts registered.</div></DxPanel>
        ) : (
          <DxPanel flush>
            <div className="divide-y divide-[var(--dx-border)]">
              {(accounts.data ?? []).map((a: DevAccount) => (
                <div key={a.id} className="flex flex-col justify-between gap-3 p-4 md:flex-row md:items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-semibold text-[var(--dx-text)]">{a.organization_name}</p>
                      <DxBadge tone={accountTone(a.status)}>{a.status}</DxBadge>
                    </div>
                    <p className="text-[12px] text-[var(--dx-text-muted)]">{a.contact_name} · {a.email} · registered {fmt(a.created_at)}</p>
                  </div>
                  {a.status === "ACTIVE" ? (
                    <DxButton size="sm" variant="danger" leftIcon={<Ban className="h-3.5 w-3.5" />} onClick={() => setAcctStatus.mutate({ id: a.id, active: false })}>Suspend</DxButton>
                  ) : (
                    <DxButton size="sm" leftIcon={<ShieldCheck className="h-3.5 w-3.5" />} onClick={() => setAcctStatus.mutate({ id: a.id, active: true })}>Reactivate</DxButton>
                  )}
                </div>
              ))}
            </div>
          </DxPanel>
        )
      )}

      {/* Decision modal */}
      <DxPopup
        isOpen={!!decideFor}
        onClose={() => setDecideFor(null)}
        title={decideFor?.approve ? "Approve data access" : "Deny data access"}
        size="md"
        locked={decide.isPending}
        footer={
          <>
            <DxButton onClick={() => setDecideFor(null)}>Cancel</DxButton>
            <DxButton isLoading={decide.isPending} variant={decideFor?.approve ? "primary" : "danger"}
              onClick={() => { if (decideFor?.approve && selectedScopes.length === 0) { toast.error("Select at least one scope"); return; } decide.mutate(); }}>
              {decideFor?.approve ? "Approve access" : "Deny request"}
            </DxButton>
          </>
        }
      >
        <div className="space-y-4">
          {decideFor?.approve ? (
            <div>
              <p className="mb-2 flex items-center gap-2 text-[13px] font-medium text-[var(--dx-text)]"><Building2 className="h-4 w-4" /> Scopes to approve</p>
              <div className="space-y-2">
                {decideFor.grant.requested_scopes.map((sc) => (
                  <label key={sc} className="flex items-center gap-2 text-[13px]">
                    <input type="checkbox" checked={selectedScopes.includes(sc)} className="h-4 w-4 rounded" style={{ accentColor: "var(--dx-accent)" }}
                      onChange={() => setSelectedScopes((s) => s.includes(sc) ? s.filter((x) => x !== sc) : [...s, sc])} />
                    <code className="dx-mono text-[12px] text-[var(--dx-text)]">{sc}</code>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <DxTextarea label="Note (optional)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </DxPopup>
    </DxPage>
  );
}
