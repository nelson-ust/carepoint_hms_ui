import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban, CheckCircle2, CircleDashed, Cloud, Database, Loader2, PlayCircle,
  RefreshCw, ShieldCheck, Sprout, XCircle,
} from "lucide-react";
import {
  DxBadge,
  DxButton,
  DxPopup,
  DxProps,
  DxSkeleton,
  DxStatusBadge,
  type DxBadgeTone,
} from "@/components/dx";
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
  return Number.isNaN(d.getTime())
    ? v
    : d.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function StepIcon({ status }: { status: string }) {
  const s = (status || "").toUpperCase();
  const base = "flex h-7 w-7 items-center justify-center rounded-full";
  if (s === "COMPLETED")
    return <span className={base} style={{ background: "var(--dx-success-soft)", color: "var(--dx-success)" }}><CheckCircle2 className="h-4 w-4" /></span>;
  if (s === "IN_PROGRESS")
    return <span className={base} style={{ background: "var(--dx-warning-soft)", color: "var(--dx-warning)" }}><Loader2 className="h-4 w-4 animate-spin" /></span>;
  if (s === "FAILED")
    return <span className={base} style={{ background: "var(--dx-danger-soft)", color: "var(--dx-danger)" }}><XCircle className="h-4 w-4" /></span>;
  return <span className={base} style={{ background: "var(--dx-neutral-soft)", color: "var(--dx-text-muted)" }}><CircleDashed className="h-4 w-4" /></span>;
}

function stepBadgeTone(status: string): DxBadgeTone {
  const s = (status || "").toUpperCase();
  if (s === "COMPLETED") return "success";
  if (s === "IN_PROGRESS") return "warning";
  if (s === "FAILED") return "danger";
  return "neutral";
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

  useEffect(() => {
    if (!polling) return;
    if (provisioned || ps.data?.provisioning_error) {
      setPolling(false);
      if (tenant)
        onChanged({
          id: tenant.id,
          status: ps.data?.status,
          is_provisioned: ps.data?.is_provisioned,
          provisioning_error: ps.data?.provisioning_error ?? null,
        });
      if (provisioned) toast.success("Provisioning complete", `${tenant?.name} is live.`);
      else if (ps.data?.provisioning_error) toast.error("Provisioning failed", ps.data.provisioning_error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const orderedSteps = [...steps].reverse();

  const model = tenant.deployment_model || "CLOUD_PLATFORM";
  const depMeta: Record<string, { label: string; detail: string }> = {
    ON_PREMISE: { label: "On-premise", detail: "Dedicated full stack on the hospital's own servers – database, schema, admin and dedicated MinIO object storage are provisioned." },
    CLOUD_DEDICATED: { label: "Cloud – Dedicated", detail: "Isolated cloud stack for this hospital – dedicated database and a dedicated AWS S3 bucket are provisioned." },
    CLOUD_PLATFORM: { label: "Cloud – Platform", detail: "Shared platform infrastructure – only the tenant database is provisioned; AWS S3 storage is shared and namespaced by tenant code." },
  };
  const dep = depMeta[model] ?? depMeta.CLOUD_PLATFORM;

  return (
    <DxPopup
      isOpen={!!tenant}
      onClose={onClose}
      title={tenant.name}
      size="xl"
      footer={
        <>
          {canApprove ? (
            <DxButton variant="primary" isLoading={approve.isPending} leftIcon={<ShieldCheck className="h-4 w-4" />} onClick={() => approve.mutate()}>
              Approve & provision
            </DxButton>
          ) : (
            <DxButton
              isLoading={approve.isPending}
              leftIcon={<PlayCircle className="h-4 w-4" />}
              disabled={provisioned || busy}
              title={provisioned ? "Already provisioned — use the targeted repair actions instead." : undefined}
              onClick={() => approve.mutate()}
            >
              Re-run provisioning
            </DxButton>
          )}
          {isSuspended ? (
            <DxButton variant="primary" isLoading={setStatus.isPending} leftIcon={<CheckCircle2 className="h-4 w-4" />} onClick={() => setStatus.mutate("ACTIVE")}>
              Reactivate
            </DxButton>
          ) : (
            <DxButton variant="danger" isLoading={setStatus.isPending} leftIcon={<Ban className="h-4 w-4" />} disabled={isPending} onClick={() => setStatus.mutate("SUSPENDED")}>
              Suspend
            </DxButton>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[12px] rounded bg-[var(--dx-surface-alt)] border border-[var(--dx-border)] px-2 py-0.5">
            {tenant.code?.toLowerCase()}
          </span>
          <DxBadge tone={provisioned ? "success" : "warning"}>{provisioned ? "Approved" : "Awaiting approval"}</DxBadge>
          <DxStatusBadge status={status} />
          <DxBadge tone={s3ok ? "outline" : "neutral"}>
            <Cloud className="h-3 w-3" /> S3 {s3ok ? "✓" : "—"}
          </DxBadge>
          <span className="ml-auto text-[11px] text-[var(--dx-text-muted)]">Registered {fmtDate(ps.data?.registered_at)}</span>
        </div>

        <DxProps
          items={[
            { label: "Company email", value: ps.data?.company_email || tenant.billing_email || "—" },
            { label: "Contact person", value: ps.data?.contact_person || tenant.billing_contact_name || "—" },
            { label: "Industry", value: ps.data?.industry || "—" },
            { label: "Tenant code", value: <span className="font-mono">{tenant.code}</span> },
          ]}
        />

        <div className="rounded-[var(--dx-radius)] border border-[var(--dx-accent)]/30 bg-[var(--dx-accent-soft)] px-4 py-3">
          <p className="dx-field-label text-[var(--dx-accent)]">Deployment approach</p>
          <p className="mt-0.5 font-semibold text-[var(--dx-text)]">{dep.label}</p>
          <p className="mt-1 text-[12px] text-[var(--dx-text-muted)] leading-relaxed">{dep.detail}</p>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="font-semibold text-[var(--dx-text)]">Provisioning status</h4>
            <DxButton size="sm" variant="text" leftIcon={<RefreshCw className={ps.isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />} onClick={() => ps.refetch()}>
              Refresh
            </DxButton>
          </div>
          <div className="max-h-72 overflow-y-auto rounded-[var(--dx-radius)] border border-[var(--dx-border)]">
            {ps.isLoading ? (
              <div className="space-y-2 p-3">
                <DxSkeleton className="h-9 w-full" />
                <DxSkeleton className="h-9 w-full" />
              </div>
            ) : orderedSteps.length === 0 ? (
              <p className="p-5 text-center text-[var(--dx-text-muted)]">
                {canApprove
                  ? "No provisioning has run yet — approve this tenant to start."
                  : "No step log recorded for this tenant (provisioned before step tracking was added)."}
              </p>
            ) : (
              orderedSteps.map((st, i) => (
                <div key={i} className="flex items-start justify-between gap-3 border-b border-[var(--dx-border)] px-4 py-3 last:border-0">
                  <div className="flex items-start gap-3 min-w-0">
                    <StepIcon status={st.status} />
                    <div className="min-w-0">
                      <p className="font-medium text-[var(--dx-text)]">{st.step}</p>
                      {st.detail ? <p className="truncate text-[11px] text-[var(--dx-text-muted)]">{st.detail}</p> : null}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <DxBadge tone={stepBadgeTone(st.status)}>{(st.status || "PENDING").replace(/_/g, " ")}</DxBadge>
                    <p className="mt-1 text-[11px] text-[var(--dx-text-muted)]">{fmt(st.at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          {ps.data?.provisioning_error ? (
            <p className="mt-2 text-[12px] font-medium text-[var(--dx-danger)]">Last error: {ps.data.provisioning_error}</p>
          ) : null}
        </div>

        {provisioned ? (
          <div className="rounded-[var(--dx-radius)] border border-[var(--dx-border)] p-4">
            <p className="dx-field-label">Infrastructure repair</p>
            <p className="mt-1 text-[12px] text-[var(--dx-text-muted)]">Targeted, idempotent fixes — no full re-provisioning required.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <DxButton size="sm" leftIcon={<Cloud className="h-3.5 w-3.5" />} disabled={busy} onClick={() => repair.mutate("s3")}>
                Repair storage bucket
              </DxButton>
              <DxButton size="sm" leftIcon={<Database className="h-3.5 w-3.5" />} disabled={busy} onClick={() => repair.mutate("schema")}>
                Sync DB schema
              </DxButton>
              <DxButton size="sm" leftIcon={<Sprout className="h-3.5 w-3.5" />} disabled={busy} onClick={() => repair.mutate("defaults")}>
                Sync defaults
              </DxButton>
            </div>
          </div>
        ) : null}
      </div>
    </DxPopup>
  );
}
