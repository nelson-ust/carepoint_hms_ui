import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban, CheckCircle2, CircleDashed, Cloud, Database, Loader2, PlayCircle,
  RefreshCw, ShieldCheck, Sprout, XCircle,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/feedback/ToastProvider";
import {
  approveTenant,
  getProvisioningStatus,
  provisionTenantS3,
  syncTenantDefaults,
  syncTenantSchema,
  updateTenantStatus,
  type ProvisioningStep,
  type Tenant,
} from "../api/tenants.api";

function fmt(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString(undefined,
    { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString(undefined,
    { day: "2-digit", month: "short", year: "numeric" });
}

function StepIcon({ status }: { status: string }) {
  const s = (status || "").toUpperCase();
  if (s === "COMPLETED")
    return <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500"><CheckCircle2 className="h-4 w-4" /></span>;
  if (s === "IN_PROGRESS")
    return <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/15 text-amber-500"><Loader2 className="h-4 w-4 animate-spin" /></span>;
  if (s === "FAILED")
    return <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-500/15 text-rose-500"><XCircle className="h-4 w-4" /></span>;
  return <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary-400/15 text-secondary-400"><CircleDashed className="h-4 w-4" /></span>;
}

function stepBadge(status: string): { variant: any; label: string } {
  const s = (status || "").toUpperCase();
  if (s === "COMPLETED") return { variant: "soft-success", label: "COMPLETED" };
  if (s === "IN_PROGRESS") return { variant: "soft-warning", label: "IN PROGRESS" };
  if (s === "FAILED") return { variant: "soft-danger", label: "FAILED" };
  return { variant: "secondary", label: s || "PENDING" };
}

export function TenantProvisioningModal({
  tenant,
  onClose,
  onChanged,
}: {
  tenant: Tenant | null;
  onClose: () => void;
  onChanged: (t: Partial<Tenant> & { id: number }) => void;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const pollRef = useRef<number | null>(null);
  const [polling, setPolling] = useState(false);

  const ps = useQuery({
    queryKey: ["tenant-provisioning", tenant?.id],
    queryFn: () => getProvisioningStatus(tenant!.id),
    enabled: !!tenant,
    refetchInterval: polling ? 2500 : false,
  });

  const status = (ps.data?.status ?? tenant?.status ?? "").toUpperCase();
  const provisioned = ps.data?.is_provisioned ?? tenant?.is_provisioned ?? false;
  const s3ok = !!(ps.data?.aws_s3_bucket_name ?? tenant?.aws_s3_bucket_name);
  const steps: ProvisioningStep[] = ps.data?.steps ?? [];

  // Stop polling once provisioning settles.
  useEffect(() => {
    if (!polling) return;
    if (provisioned || ps.data?.provisioning_error) {
      setPolling(false);
      if (tenant) onChanged({ id: tenant.id, status: ps.data?.status, is_provisioned: ps.data?.is_provisioned, provisioning_error: ps.data?.provisioning_error ?? null });
      if (provisioned) toast.success("Provisioning complete", `${tenant?.name} is live.`);
      else if (ps.data?.provisioning_error) toast.error("Provisioning failed", ps.data.provisioning_error);
    }
  }, [polling, provisioned, ps.data?.provisioning_error]);

  useEffect(() => () => { if (pollRef.current) window.clearInterval(pollRef.current); }, []);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["tenant-provisioning", tenant?.id] });

  const approve = useMutation({
    mutationFn: () => approveTenant(tenant!.id),
    onSuccess: () => {
      toast.success("Approved", "Provisioning is running in the background.");
      setPolling(true);
      invalidate();
      if (tenant) onChanged({ id: tenant.id, status: "PROVISIONING" });
    },
    onError: (e: any) => toast.error("Couldn't approve", e?.response?.data?.message || e?.response?.data?.detail || "Please try again."),
  });

  const setStatus = useMutation({
    mutationFn: (next: string) => updateTenantStatus(tenant!.id, next),
    onSuccess: (updated) => {
      toast.success("Status updated", `${tenant?.name} is now ${updated.status}.`);
      invalidate();
      if (tenant) onChanged({ id: tenant.id, status: updated.status });
    },
    onError: (e: any) => toast.error("Couldn't update status", e?.response?.data?.message || e?.response?.data?.detail || "Please try again."),
  });

  const repair = useMutation({
    mutationFn: async (kind: "s3" | "schema" | "defaults") => {
      if (kind === "s3") return provisionTenantS3(tenant!.id).then((r) => r.message);
      if (kind === "schema") return syncTenantSchema(tenant!.id).then((r) => r.message);
      return syncTenantDefaults(tenant!.id).then((r) => r.message);
    },
    onSuccess: (message) => { toast.success("Repair complete", message || "Done."); invalidate(); },
    onError: (e: any) => toast.error("Repair failed", e?.response?.data?.message || e?.response?.data?.detail || "Please try again."),
  });

  if (!tenant) return null;

  const isPending = status === "PENDING";
  const isSuspended = status === "SUSPENDED";
  const canApprove = isPending && !provisioned;
  const busy = approve.isPending || setStatus.isPending || repair.isPending;

  // Newest first, like the mockup.
  const orderedSteps = [...steps].reverse();

  return (
    <Modal isOpen={!!tenant} onClose={onClose} title={tenant.name} size="xl">
      <div className="space-y-6">
        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="data-mono rounded-lg bg-secondary-100 px-2.5 py-1 text-xs font-bold dark:bg-white/10">{tenant.code?.toLowerCase()}</span>
          <Badge variant={provisioned ? "soft-success" : "soft-warning"}>{provisioned ? "APPROVED" : "AWAITING APPROVAL"}</Badge>
          <Badge variant={status === "ACTIVE" ? "soft-success" : isSuspended ? "soft-danger" : "soft-warning"}>{status || "—"}</Badge>
          <Badge variant={s3ok ? "outline" : "secondary"}>
            <Cloud className="mr-1 inline h-3 w-3" /> S3 {s3ok ? "✓" : "—"}
          </Badge>
          <span className="ml-auto text-xs text-secondary-400 font-medium">
            Registered {fmtDate(ps.data?.registered_at)}
          </span>
        </div>

        {/* Company info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 rounded-2xl border border-secondary-200 bg-secondary-50/60 p-5 dark:border-white/10 dark:bg-white/5">
          <Info label="Company email" value={ps.data?.company_email || tenant.billing_email} />
          <Info label="Contact person" value={ps.data?.contact_person || tenant.billing_contact_name} />
          <Info label="Industry" value={ps.data?.industry} />
          <Info label="Tenant code" value={tenant.code} mono />
        </div>

        {/* Provisioning status */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-black tracking-tight">Provisioning status</h4>
            <button
              onClick={() => ps.refetch()}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-600 hover:text-primary-700"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${ps.isFetching ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto rounded-2xl border border-secondary-200 dark:border-white/10">
            {ps.isLoading ? (
              <div className="space-y-3 p-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
            ) : orderedSteps.length === 0 ? (
              <p className="p-6 text-center text-sm text-secondary-400">
                {canApprove
                  ? "No provisioning has run yet — approve this tenant to start."
                  : "No step log recorded for this tenant (provisioned before step tracking was added)."}
              </p>
            ) : (
              orderedSteps.map((st, i) => {
                const b = stepBadge(st.status);
                return (
                  <div key={i} className="flex items-start justify-between gap-3 border-b border-secondary-100 px-4 py-3 last:border-0 dark:border-white/5">
                    <div className="flex items-start gap-3 min-w-0">
                      <StepIcon status={st.status} />
                      <div className="min-w-0">
                        <p className="text-sm font-bold">{st.step}</p>
                        {st.detail ? <p className="truncate text-xs text-secondary-400">{st.detail}</p> : null}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge variant={b.variant}>{b.label}</Badge>
                      <p className="mt-1 text-[10px] text-secondary-400">{fmt(st.at)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {ps.data?.provisioning_error ? (
            <p className="mt-2 text-xs font-bold text-rose-500">Last error: {ps.data.provisioning_error}</p>
          ) : null}
        </div>

        {/* Infrastructure repair */}
        {provisioned ? (
          <div className="rounded-2xl border border-secondary-200 p-5 dark:border-white/10">
            <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400">Infrastructure repair</p>
            <p className="mt-1 text-xs text-secondary-500">Targeted, idempotent fixes — no full re-provisioning required.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" leftIcon={<Cloud className="h-3.5 w-3.5" />} disabled={busy}
                onClick={() => repair.mutate("s3")}>Repair S3 bucket</Button>
              <Button size="sm" variant="secondary" leftIcon={<Database className="h-3.5 w-3.5" />} disabled={busy}
                onClick={() => repair.mutate("schema")}>Sync DB schema</Button>
              <Button size="sm" variant="secondary" leftIcon={<Sprout className="h-3.5 w-3.5" />} disabled={busy}
                onClick={() => repair.mutate("defaults")}>Sync defaults</Button>
            </div>
          </div>
        ) : null}

        {/* Footer actions */}
        <div className="flex flex-wrap justify-end gap-3 border-t border-secondary-100 pt-4 dark:border-white/10">
          {canApprove ? (
            <Button isLoading={approve.isPending} leftIcon={<ShieldCheck className="h-4 w-4" />}
              onClick={() => approve.mutate()}>
              Approve & provision
            </Button>
          ) : (
            <Button variant="secondary" isLoading={approve.isPending} leftIcon={<PlayCircle className="h-4 w-4" />}
              disabled={provisioned || busy}
              title={provisioned ? "Already provisioned — use the targeted repair actions instead." : undefined}
              onClick={() => approve.mutate()}>
              Re-run provisioning
            </Button>
          )}
          {isSuspended ? (
            <Button variant="secondary" isLoading={setStatus.isPending} leftIcon={<CheckCircle2 className="h-4 w-4" />}
              onClick={() => setStatus.mutate("ACTIVE")}>Reactivate</Button>
          ) : (
            <Button variant="danger" isLoading={setStatus.isPending} leftIcon={<Ban className="h-4 w-4" />}
              disabled={isPending}
              onClick={() => setStatus.mutate("SUSPENDED")}>Suspend</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Info({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400">{label}</p>
      <p className={`mt-0.5 text-sm font-bold ${mono ? "data-mono" : ""}`}>{value || "—"}</p>
    </div>
  );
}
