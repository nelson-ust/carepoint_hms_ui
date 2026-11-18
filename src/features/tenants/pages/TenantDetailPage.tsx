import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Crown,
  Gift,
  FileText,
  Hash,
  KeyRound,
  Layers,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  DxBadge,
  DxButton,
  DxChoice,
  DxInput,
  DxMessage,
  DxPage,
  DxPageHeader,
  DxPageLoading,
  DxPanel,
  DxPopup,
  DxProps,
  DxSegmented,
  DxStatusBadge,
  apiErrorMessage,
  formatDateTime,
  type DxPropsItem,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { routes } from "@/config/routes";
import { SubscriptionIncentives } from "../components/SubscriptionIncentives";
import { TenantModulesManager } from "@/features/tenant-modules/components/TenantModulesManager";
import {
  approveTenant,
  grantFreeSubscription,
  grantRenewalAccess,
  revokeRenewalAccess,
  changeTenantPlan,
  getTenant,
  listSubscriptionPlans,
  TENANT_STATUSES,
  updateTenantStatus,
  dropTenant,
} from "../api/tenants.api";
import type { SubscriptionPlan, Tenant } from "../api/tenants.api";

const DEPLOYMENT_LABELS: Record<string, string> = {
  ON_PREMISE: "On-premise",
  CLOUD_DEDICATED: "Cloud – Dedicated",
  CLOUD_PLATFORM: "Cloud – Platform",
};
const deploymentLabel = (model?: string | null): string =>
  !model ? "Cloud – Platform" : DEPLOYMENT_LABELS[model] ?? model;

type ActionKind = "approve" | "status" | "plan" | "drop" | null;

export function TenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actionKind, setActionKind] = useState<ActionKind>(null);
  const [statusForm, setStatusForm] = useState<string>("ACTIVE");
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [renewalPending, setRenewalPending] = useState(false);
  const [freeOpen, setFreeOpen] = useState(false);
  const [freeReason, setFreeReason] = useState("");
  const [freePending, setFreePending] = useState(false);

  // Plan-change modal state
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [planForm, setPlanForm] = useState<string>("");
  const [intervalForm, setIntervalForm] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [dropConfirm, setDropConfirm] = useState("");

  const load = async () => {
    if (!tenantId) {
      setError("Invalid tenant identifier.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setTenant(await getTenant(tenantId));
    } catch (err) {
      setError(apiErrorMessage(err) || "Unable to load tenant.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  // Preload plans so the incentives panel's plan selector is populated.
  useEffect(() => {
    let active = true;
    listSubscriptionPlans()
      .then((p) => {
        if (active) setPlans(p);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- Action dialogs -----
  const openApprove = () => {
    setActionKind("approve");
    setActionError(null);
  };

  const openStatus = () => {
    if (!tenant) return;
    setActionKind("status");
    setStatusForm(
      tenant.status === "ACTIVE" ? "SUSPENDED" : tenant.status === "SUSPENDED" ? "ACTIVE" : "ACTIVE",
    );
    setActionError(null);
  };

  const openPlan = async () => {
    if (!tenant) return;
    setActionKind("plan");
    setActionError(null);
    const active = tenant.subscriptions?.find(
      (sub) =>
        (sub.status || "").toUpperCase() === "ACTIVE" ||
        (sub.status || "").toUpperCase() === "TRIALING",
    );
    setPlanForm(active?.plan?.code ?? "");
    setIntervalForm("MONTHLY");
    if (plans.length === 0) {
      setPlansLoading(true);
      try {
        setPlans(await listSubscriptionPlans());
      } catch {
        setActionError("Could not load subscription plans.");
      } finally {
        setPlansLoading(false);
      }
    }
  };

  const closeAction = () => {
    if (actionPending) return;
    setActionKind(null);
    setActionError(null);
  };

  const openDrop = () => {
    setDropConfirm("");
    setActionKind("drop");
    setActionError(null);
  };

  const handleDrop = async () => {
    if (!tenant) return;
    setActionPending(true);
    setActionError(null);
    try {
      const res = await dropTenant(tenant.id, dropConfirm.trim());
      toast.success(res.message || `Tenant ${tenant.code} dropped.`);
      setActionKind(null);
      navigate(routes.tenants);
    } catch (err) {
      setActionError(apiErrorMessage(err) || "Failed to drop tenant.");
    } finally {
      setActionPending(false);
    }
  };

  const handleApprove = async () => {
    if (!tenant) return;
    setActionPending(true);
    setActionError(null);
    try {
      await approveTenant(tenant.id);
      setTenant({ ...tenant, status: "ACTIVE" });
      toast.success("Tenant approved.");
      setActionKind(null);
    } catch (err) {
      setActionError(apiErrorMessage(err) || "Failed to approve tenant.");
    } finally {
      setActionPending(false);
    }
  };

  const handleStatus = async () => {
    if (!tenant) return;
    setActionPending(true);
    setActionError(null);
    try {
      const updated = await updateTenantStatus(tenant.id, statusForm);
      setTenant({ ...tenant, ...updated });
      toast.success(`Status updated → ${statusForm}.`);
      setActionKind(null);
    } catch (err) {
      setActionError(apiErrorMessage(err) || "Failed to update status.");
    } finally {
      setActionPending(false);
    }
  };

  const handleChangePlan = async () => {
    if (!tenant) return;
    if (!planForm) {
      setActionError("Please select a plan.");
      return;
    }
    setActionPending(true);
    setActionError(null);
    try {
      await changeTenantPlan(tenant.id, { plan_code: planForm, billing_interval: intervalForm });
      toast.success(`Plan changed to ${planForm} (${intervalForm.toLowerCase()}).`);
      setActionKind(null);
      await load();
    } catch (err) {
      setActionError(apiErrorMessage(err) || "Failed to change plan.");
    } finally {
      setActionPending(false);
    }
  };

  const handleGrantFreeMonth = async () => {
    if (!tenant) return;
    setFreePending(true);
    try {
      await grantFreeSubscription(tenant.id, { months: 1, reason: freeReason || undefined });
      toast.success(`${tenant.name} granted 1 free month.`);
      setFreeOpen(false);
      setFreeReason("");
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err) || "Failed to grant free month.");
    } finally {
      setFreePending(false);
    }
  };

  const renewalActive =
    !!tenant?.renewal_access_until && new Date(tenant.renewal_access_until) > new Date();

  const toggleRenewal = async () => {
    if (!tenant) return;
    setRenewalPending(true);
    try {
      if (renewalActive) {
        await revokeRenewalAccess(tenant.id);
        toast.success("Renewal login revoked.");
      } else {
        await grantRenewalAccess(tenant.id, 7);
        toast.success("Renewal login enabled for 7 days — the tenant admin can now sign in to renew.");
      }
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err) || "Could not update renewal access.");
    } finally {
      setRenewalPending(false);
    }
  };

  if (isLoading) return <DxPageLoading label="Loading tenant…" />;

  if (error || !tenant) {
    return (
      <DxPage>
        <DxPageHeader
          crumbs={[{ label: "SaaS admin" }, { label: "Tenants", to: routes.tenants }, { label: "Not found" }]}
          title="Tenant not resolved"
        />
        <DxMessage
          tone="danger"
          title="Tenant not resolved"
          action={
            <DxButton leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate(routes.tenants)}>
              Back to tenants
            </DxButton>
          }
        >
          {error ?? "We couldn't locate this tenant."}
        </DxMessage>
      </DxPage>
    );
  }

  const statusKey = (tenant.status || "PENDING").toUpperCase();

  const identityItems: DxPropsItem[] = [
    ...(tenant.custom_domain
      ? [{ label: "Custom domain", value: <span className="font-mono">{tenant.custom_domain}</span> }]
      : []),
    ...(tenant.domain_url
      ? [{ label: "Domain", value: <span className="font-mono">{tenant.domain_url}</span> }]
      : []),
    { label: "Deployment", value: deploymentLabel(tenant.deployment_model) },
    {
      label: "Database",
      value: tenant.is_provisioned ? (
        <DxBadge tone="success" dot>
          Provisioned
        </DxBadge>
      ) : (
        <DxBadge tone="warning" dot>
          Not provisioned
        </DxBadge>
      ),
    },
  ];

  const billingItems: DxPropsItem[] = [
    ...(tenant.billing_contact_name ? [{ label: "Contact", value: tenant.billing_contact_name }] : []),
    ...(tenant.billing_email ? [{ label: "Email", value: tenant.billing_email }] : []),
    ...(tenant.billing_phone ? [{ label: "Phone", value: tenant.billing_phone }] : []),
    ...(tenant.billing_address ? [{ label: "Address", value: tenant.billing_address }] : []),
    ...(tenant.tax_id ? [{ label: "Tax ID", value: <span className="font-mono">{tenant.tax_id}</span> }] : []),
  ];

  const activeSub =
    tenant.subscriptions?.find((s) =>
      ["ACTIVE", "TRIALING"].includes((s.status || "").toUpperCase()),
    ) ?? tenant.subscriptions?.[0];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[
          { label: "SaaS admin" },
          { label: "Tenants", to: routes.tenants },
          { label: tenant.name },
        ]}
        title={
          <span className="inline-flex items-center gap-2.5">
            {tenant.name}
            <DxStatusBadge status={tenant.status} />
          </span>
        }
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <Hash className="h-3 w-3" />
            <span className="font-mono">{tenant.code}</span>
            <span className="mx-1 text-[var(--dx-border-strong)]">·</span>
            {deploymentLabel(tenant.deployment_model)}
          </span>
        }
        actions={
          <>
            <DxButton leftIcon={<RefreshCw className="h-4 w-4" />} onClick={load}>
              Refresh
            </DxButton>
            {statusKey === "PENDING" && (
              <DxButton variant="primary" leftIcon={<ShieldCheck className="h-4 w-4" />} onClick={openApprove}>
                Approve
              </DxButton>
            )}
            <DxButton leftIcon={<Sparkles className="h-4 w-4" />} onClick={openStatus}>
              Update status
            </DxButton>
            <DxButton leftIcon={<Crown className="h-4 w-4" />} onClick={openPlan}>
              Change plan
            </DxButton>
            <DxButton leftIcon={<Gift className="h-4 w-4" />} onClick={() => setFreeOpen(true)}>
              Free month
            </DxButton>
            <DxButton
              variant={renewalActive ? "outline-danger" : "default"}
              leftIcon={<KeyRound className="h-4 w-4" />}
              isLoading={renewalPending}
              onClick={toggleRenewal}
              title={
                renewalActive
                  ? `Renewal login active until ${new Date(tenant.renewal_access_until as string).toLocaleString()}`
                  : "Let this tenant's admin sign in to pay and renew despite an expired subscription"
              }
            >
              {renewalActive ? "Revoke renewal login" : "Allow renewal login"}
            </DxButton>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-12">
        {/* LEFT: identity + billing */}
        <div className="lg:col-span-4 space-y-4">
          <DxPanel title="Identity" icon={<Building2 className="h-4 w-4" />}>
            <DxProps items={identityItems} />
            {tenant.provisioning_error && (
              <DxMessage tone="danger" title="Last provisioning error" className="mt-4">
                {tenant.provisioning_error}
                <span className="block mt-1 text-[var(--dx-text-muted)]">
                  The tenant was returned to PENDING — fix the cause and approve again to retry.
                </span>
              </DxMessage>
            )}
          </DxPanel>

          <DxPanel title="Billing" icon={<FileText className="h-4 w-4" />}>
            {billingItems.length ? (
              <DxProps items={billingItems} />
            ) : (
              <p className="text-[var(--dx-text-muted)]">No billing details on file.</p>
            )}
          </DxPanel>
        </div>

        {/* RIGHT: subscriptions + incentives + modules */}
        <div className="lg:col-span-8 space-y-4">
          <DxPanel
            title="Subscriptions"
            icon={<Sparkles className="h-4 w-4" />}
            actions={<DxBadge tone="neutral">{tenant.subscriptions?.length ?? 0}</DxBadge>}
          >
            {!tenant.subscriptions || tenant.subscriptions.length === 0 ? (
              <p className="py-6 text-center text-[var(--dx-text-muted)]">
                No active subscription on this tenant.
              </p>
            ) : (
              <div className="space-y-2.5">
                {tenant.subscriptions.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-[var(--dx-radius)] border border-[var(--dx-border)] bg-[var(--dx-surface-alt)] p-4"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                      <div>
                        <p className="font-semibold text-[var(--dx-text)]">
                          {s.plan?.name ?? s.plan?.code ?? `Plan #${s.plan_id}`}
                        </p>
                        {s.plan?.code && (
                          <span className="inline-flex items-center gap-1 mt-0.5 font-mono text-[11px] text-[var(--dx-text-muted)]">
                            <Hash className="h-2.5 w-2.5" />
                            {s.plan.code}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <DxStatusBadge status={s.status} />
                        {s.auto_renew && (
                          <DxBadge tone="success">
                            <CheckCircle2 className="h-3 w-3" />
                            Auto-renew
                          </DxBadge>
                        )}
                      </div>
                    </div>
                    <DxProps
                      tight
                      items={[
                        { label: "Start", value: formatDateTime(s.start_date) },
                        { label: "End", value: formatDateTime(s.end_date) },
                        ...(s.trial_end_date
                          ? [{ label: "Trial ends", value: formatDateTime(s.trial_end_date) }]
                          : []),
                      ]}
                    />
                  </div>
                ))}
              </div>
            )}
          </DxPanel>

          <SubscriptionIncentives
            tenantId={tenant.id}
            subscription={activeSub}
            plans={plans}
            onChanged={load}
          />

          <DxPanel
            title="Module access"
            icon={<Layers className="h-4 w-4" />}
            description="Toggle features per subscription tier, or grant loyalty modules."
            actions={
              <DxButton size="sm" variant="text" onClick={() => navigate(routes.tenantModules)}>
                Open manager →
              </DxButton>
            }
          >
            <TenantModulesManager tenantId={tenant.id} showHeader={false} />
          </DxPanel>
        </div>
      </div>

      {/* Danger zone */}
      <DxPanel
        title="Danger zone"
        icon={<Trash2 className="h-4 w-4" />}
        description="Irreversible platform actions."
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[var(--dx-text)]">Drop this tenant</p>
            <p className="mt-0.5 text-[12px] text-[var(--dx-text-muted)]">
              Permanently deletes the tenant's database, its object-storage bucket and all
              platform records. This cannot be undone.
            </p>
          </div>
          <DxButton variant="danger" leftIcon={<Trash2 className="h-4 w-4" />} onClick={openDrop}>
            Drop tenant
          </DxButton>
        </div>
      </DxPanel>

      {/* Grant one free month */}
      <DxPopup
        isOpen={freeOpen}
        onClose={() => {
          if (!freePending) setFreeOpen(false);
        }}
        title="Grant one free month"
        size="md"
        footer={
          <>
            <DxButton onClick={() => setFreeOpen(false)} disabled={freePending}>
              Cancel
            </DxButton>
            <DxButton
              variant="primary"
              leftIcon={<Gift className="h-4 w-4" />}
              isLoading={freePending}
              onClick={handleGrantFreeMonth}
            >
              Grant free month
            </DxButton>
          </>
        }
      >
        <div className="space-y-3">
          <DxMessage tone="success" title={tenant.name}>
            Gives {tenant.name} one month of active, unbilled access. The first invoice is
            deferred until the free month ends.
          </DxMessage>
          <DxInput
            label="Reason (optional)"
            value={freeReason}
            onChange={(e) => setFreeReason(e.target.value)}
            placeholder="e.g. loyalty benefit"
          />
        </div>
      </DxPopup>

      {/* Approve */}
      <DxPopup
        isOpen={actionKind === "approve"}
        onClose={closeAction}
        title="Approve tenant"
        size="md"
        footer={
          <>
            <DxButton onClick={closeAction} disabled={actionPending}>
              Cancel
            </DxButton>
            <DxButton
              variant="primary"
              leftIcon={<ShieldCheck className="h-4 w-4" />}
              isLoading={actionPending}
              onClick={handleApprove}
            >
              Approve tenant
            </DxButton>
          </>
        }
      >
        {actionError && (
          <DxMessage tone="danger" className="mb-4">
            {actionError}
          </DxMessage>
        )}
        <DxMessage tone="success" title={tenant.name}>
          Approving activates their workspace and notifies the admin user. Use the status
          dialog to suspend later if needed.
        </DxMessage>
      </DxPopup>

      {/* Status */}
      <DxPopup
        isOpen={actionKind === "status"}
        onClose={closeAction}
        title="Update tenant status"
        size="md"
        footer={
          <>
            <DxButton onClick={closeAction} disabled={actionPending}>
              Cancel
            </DxButton>
            <DxButton variant="primary" isLoading={actionPending} onClick={handleStatus}>
              Update status
            </DxButton>
          </>
        }
      >
        {actionError && (
          <DxMessage tone="danger" className="mb-4">
            {actionError}
          </DxMessage>
        )}
        <div className="space-y-3">
          <DxProps
            items={[
              { label: "Tenant", value: tenant.name },
              { label: "Current status", value: <DxStatusBadge status={tenant.status} /> },
            ]}
          />
          <div>
            <p className="dx-field-label mb-1.5">New status</p>
            <DxSegmented
              value={statusForm}
              onChange={setStatusForm}
              items={TENANT_STATUSES.map((s) => ({ key: s, label: s }))}
            />
          </div>
        </div>
      </DxPopup>

      {/* Change plan */}
      <DxPopup
        isOpen={actionKind === "plan"}
        onClose={closeAction}
        title="Change subscription plan"
        size="lg"
        footer={
          <>
            <DxButton onClick={closeAction} disabled={actionPending}>
              Cancel
            </DxButton>
            <DxButton
              variant="primary"
              leftIcon={<Crown className="h-4 w-4" />}
              isLoading={actionPending}
              onClick={handleChangePlan}
              disabled={plansLoading || plans.filter((p) => p.is_active).length === 0}
            >
              Change plan
            </DxButton>
          </>
        }
      >
        {actionError && (
          <DxMessage tone="danger" className="mb-4">
            {actionError}
          </DxMessage>
        )}
        {plansLoading ? (
          <p className="py-8 text-center text-[var(--dx-text-muted)]">Loading plans…</p>
        ) : plans.filter((p) => p.is_active).length === 0 ? (
          <DxMessage tone="warning">
            No active plans available. Create one in Subscription Plans first.
          </DxMessage>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="dx-field-label mb-1.5">Target plan</p>
              <div className="grid gap-2">
                {plans
                  .filter((p) => p.is_active)
                  .map((p) => (
                    <DxChoice
                      key={p.code}
                      selected={planForm === p.code}
                      onClick={() => setPlanForm(p.code)}
                      icon={<Crown className="h-4 w-4" />}
                      title={p.name}
                      subtitle={p.code}
                      trailing={
                        <span className="text-right">
                          <span className="block font-semibold text-[var(--dx-text)]">
                            {p.currency} {Number(p.price).toLocaleString()}
                          </span>
                          <span className="block text-[11px] text-[var(--dx-text-muted)]">
                            / {String(p.interval).toLowerCase()}
                          </span>
                        </span>
                      }
                    />
                  ))}
              </div>
            </div>
            <div>
              <p className="dx-field-label mb-1.5">Billing cycle</p>
              <DxSegmented
                value={intervalForm}
                onChange={(v) => setIntervalForm(v as "MONTHLY" | "YEARLY")}
                items={[
                  { key: "MONTHLY", label: "Monthly" },
                  { key: "YEARLY", label: "Yearly" },
                ]}
              />
            </div>
          </div>
        )}
      </DxPopup>

      {/* Drop tenant (danger) */}
      <DxPopup
        isOpen={actionKind === "drop"}
        onClose={closeAction}
        title="Drop tenant"
        size="md"
        footer={
          <>
            <DxButton onClick={closeAction} disabled={actionPending}>
              Cancel
            </DxButton>
            <DxButton
              variant="danger"
              leftIcon={<Trash2 className="h-4 w-4" />}
              isLoading={actionPending}
              disabled={dropConfirm.trim().toLowerCase() !== (tenant.code || "").toLowerCase()}
              onClick={handleDrop}
            >
              Permanently drop
            </DxButton>
          </>
        }
      >
        {actionError && (
          <DxMessage tone="danger" className="mb-4">
            {actionError}
          </DxMessage>
        )}
        <DxMessage tone="danger" title="This cannot be undone">
          Dropping <strong>{tenant.name}</strong> permanently deletes its database, its
          object-storage bucket
          {tenant.aws_s3_bucket_name ? (
            <> (<span className="dx-mono">{tenant.aws_s3_bucket_name}</span>)</>
          ) : null}{" "}
          and every platform record for this tenant.
        </DxMessage>
        <div className="mt-4">
          <p className="dx-field-label mb-1.5">
            Type the tenant code <span className="dx-mono font-semibold">{tenant.code}</span> to confirm
          </p>
          <DxInput
            value={dropConfirm}
            onChange={(e) => setDropConfirm(e.target.value)}
            placeholder={tenant.code}
          />
        </div>
      </DxPopup>
    </DxPage>
  );
}
