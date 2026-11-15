import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  CheckCircle2,
  Clock,
  Crown,
  Database,
  Eye,
  Gift,
  Globe,
  Hash,
  Layers,
  Mail,
  Phone,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import {
  DxBadge,
  DxButton,
  DxGrid,
  DxInput,
  DxKpi,
  DxMessage,
  DxPage,
  DxPageHeader,
  DxPopup,
  DxProps,
  DxSearchBox,
  DxSegmented,
  DxSelect,
  DxStatusBadge,
  DxToolbar,
  DxToolbarSeparator,
  DxToolbarSpacer,
  apiErrorMessage,
  type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { routes } from "@/config/routes";
import { TenantProvisioningModal } from "../components/TenantProvisioningModal";
import { TenantModulesManager } from "@/features/tenant-modules/components/TenantModulesManager";
import {
  approveTenant,
  getProvisioningStatus,
  grantFreeSubscription,
  listTenants,
  provisionTenantS3,
  TENANT_STATUSES,
  updateTenantStatus,
} from "../api/tenants.api";
import type { Tenant } from "../api/tenants.api";

const deploymentLabel = (m?: string | null) =>
  m === "ON_PREMISE"
    ? "On-premise"
    : m === "CLOUD_DEDICATED"
      ? "Cloud · Dedicated"
      : "Cloud · Platform";

const STATUS_FILTERS = [
  { value: "", label: "All statuses" },
  ...TENANT_STATUSES.map((s) => ({ value: s, label: s })),
];

type ActionKind = "approve" | "status" | null;

export function TenantListPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [actionKind, setActionKind] = useState<ActionKind>(null);
  const [manageTenant, setManageTenant] = useState<Tenant | null>(null);
  const [modulesTenant, setModulesTenant] = useState<Tenant | null>(null);
  const [freeTenant, setFreeTenant] = useState<Tenant | null>(null);
  const [freeReason, setFreeReason] = useState("");
  const [freePending, setFreePending] = useState(false);
  const [actionTarget, setActionTarget] = useState<Tenant | null>(null);
  const [statusForm, setStatusForm] = useState<string>("ACTIVE");
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [provisioningS3Id, setProvisioningS3Id] = useState<number | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await listTenants({ page: 1, page_size: 100 });
      setTenants(res.tenants ?? []);
      setTotalCount(res.total_count ?? res.tenants?.length ?? 0);
    } catch (err) {
      setError(apiErrorMessage(err) || "Unable to load tenants.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const replaceTenant = (updated: Tenant) => {
    setTenants((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
  };

  const filteredTenants = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tenants.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        t.name?.toLowerCase().includes(q) ||
        t.code?.toLowerCase().includes(q) ||
        t.billing_email?.toLowerCase().includes(q) ||
        t.billing_contact_name?.toLowerCase().includes(q) ||
        t.domain_url?.toLowerCase().includes(q) ||
        t.custom_domain?.toLowerCase().includes(q)
      );
    });
  }, [tenants, search, statusFilter]);

  const stats = useMemo(() => {
    const total = tenants.length;
    const active = tenants.filter((t) => t.status === "ACTIVE").length;
    const pending = tenants.filter((t) => t.status === "PENDING").length;
    const suspended = tenants.filter((t) => t.status === "SUSPENDED").length;
    return { total: totalCount || total, active, pending, suspended };
  }, [tenants, totalCount]);

  const handleProvisionS3 = async (t: Tenant) => {
    setProvisioningS3Id(t.id);
    try {
      const res = await provisionTenantS3(t.id);
      replaceTenant({ ...t, aws_s3_bucket_name: res.bucket_name });
      toast.success(
        res.already_provisioned
          ? `${t.name} already has bucket ${res.bucket_name}.`
          : `S3 bucket ${res.bucket_name} provisioned for ${t.name}.`,
      );
    } catch (err) {
      toast.error(apiErrorMessage(err) || `Failed to provision S3 for ${t.name}.`);
    } finally {
      setProvisioningS3Id(null);
    }
  };

  const handleGrantFreeMonth = async () => {
    if (!freeTenant) return;
    setFreePending(true);
    try {
      await grantFreeSubscription(freeTenant.id, { months: 1, reason: freeReason || undefined });
      toast.success(`${freeTenant.name} granted 1 free month.`);
      setFreeTenant(null);
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err) || "Failed to grant free month.");
    } finally {
      setFreePending(false);
    }
  };

  // ----- Action dialogs -----
  const openApprove = (t: Tenant) => {
    setActionKind("approve");
    setActionTarget(t);
    setActionError(null);
  };

  const openStatus = (t: Tenant) => {
    setActionKind("status");
    setActionTarget(t);
    setStatusForm(
      t.status === "ACTIVE" ? "SUSPENDED" : t.status === "SUSPENDED" ? "ACTIVE" : "ACTIVE",
    );
    setActionError(null);
  };

  const closeAction = () => {
    if (actionPending) return;
    setActionKind(null);
    setActionTarget(null);
    setActionError(null);
  };

  /**
   * Approve + follow the async provisioning to completion. The backend returns
   * immediately with status=PROVISIONING and builds the database on a worker
   * thread, so we poll /provisioning-status until the tenant is provisioned
   * (→ ACTIVE) or a failure is recorded (→ reverted to PENDING).
   */
  const handleApprove = async () => {
    if (!actionTarget) return;
    const target = actionTarget;
    setActionPending(true);
    setActionError(null);
    try {
      await approveTenant(target.id);
      replaceTenant({ ...target, status: "PROVISIONING" });
      toast.success(`${target.name} approved — provisioning database…`);
      setActionKind(null);
      setActionTarget(null);

      let attempts = 0;
      const timer = window.setInterval(async () => {
        attempts += 1;
        try {
          const ps = await getProvisioningStatus(target.id);
          if (ps.is_provisioned) {
            window.clearInterval(timer);
            replaceTenant({ ...target, status: ps.status, is_provisioned: true, provisioning_error: null });
            toast.success(`${target.name} is provisioned and ACTIVE.`);
          } else if (ps.provisioning_error) {
            window.clearInterval(timer);
            replaceTenant({ ...target, status: ps.status, provisioning_error: ps.provisioning_error });
            toast.error(`Provisioning failed for ${target.name}: ${ps.provisioning_error}`);
          } else if (attempts >= 60) {
            window.clearInterval(timer);
            toast.warning(`${target.name} is still provisioning — check back shortly.`);
          }
        } catch {
          if (attempts >= 60) window.clearInterval(timer);
        }
      }, 3000);
    } catch (err) {
      setActionError(apiErrorMessage(err) || "Failed to approve tenant.");
    } finally {
      setActionPending(false);
    }
  };

  const handleStatus = async () => {
    if (!actionTarget) return;
    setActionPending(true);
    setActionError(null);
    try {
      const updated = await updateTenantStatus(actionTarget.id, statusForm);
      replaceTenant(updated);
      toast.success(`${actionTarget.name} → ${statusForm}.`);
      setActionKind(null);
      setActionTarget(null);
    } catch (err) {
      setActionError(apiErrorMessage(err) || "Failed to update status.");
    } finally {
      setActionPending(false);
    }
  };

  const goDetail = (t: Tenant) =>
    navigate(routes.tenantDetail.replace(":tenantId", String(t.id)));

  const columns: DxGridColumn<Tenant>[] = [
    {
      key: "name",
      header: "Tenant",
      minWidth: 240,
      accessor: (t) => t.name,
      render: (t) => (
        <div>
          <button
            onClick={() => goDetail(t)}
            className="text-left font-semibold text-[var(--dx-text)] hover:text-[var(--dx-accent)]"
          >
            {t.name}
          </button>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <span className="inline-flex items-center gap-1 text-[var(--dx-text-muted)] font-mono text-[11px]">
              <Hash className="h-2.5 w-2.5" />
              {t.code}
            </span>
            <DxBadge tone="outline">{deploymentLabel(t.deployment_model)}</DxBadge>
          </div>
        </div>
      ),
    },
    {
      key: "domain",
      header: "Domain",
      minWidth: 180,
      render: (t) => (
        <div className="space-y-1">
          {t.custom_domain && (
            <p className="inline-flex items-center gap-1.5 font-mono text-[12px] text-[var(--dx-text)]">
              <Crown className="h-3 w-3 text-[var(--dx-warning)]" />
              {t.custom_domain}
            </p>
          )}
          {t.domain_url && (
            <p className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--dx-text-muted)] truncate max-w-[220px]">
              <Globe className="h-2.5 w-2.5" />
              {t.domain_url}
            </p>
          )}
          {!t.custom_domain && !t.domain_url && (
            <span className="text-[var(--dx-text-muted)]">—</span>
          )}
        </div>
      ),
    },
    {
      key: "billing",
      header: "Billing",
      minWidth: 180,
      render: (t) => (
        <div className="space-y-0.5">
          {t.billing_contact_name && (
            <p className="font-medium text-[var(--dx-text)]">{t.billing_contact_name}</p>
          )}
          {t.billing_email && (
            <p className="inline-flex items-center gap-1 text-[11px] text-[var(--dx-text-muted)]">
              <Mail className="h-2.5 w-2.5" />
              {t.billing_email}
            </p>
          )}
          {t.billing_phone && (
            <p className="inline-flex items-center gap-1 text-[11px] text-[var(--dx-text-muted)]">
              <Phone className="h-2.5 w-2.5" />
              {t.billing_phone}
            </p>
          )}
          {!t.billing_contact_name && !t.billing_email && !t.billing_phone && (
            <span className="text-[var(--dx-text-muted)]">—</span>
          )}
        </div>
      ),
    },
    {
      key: "subscription",
      header: "Subscription",
      minWidth: 150,
      render: (t) => {
        const sub = t.subscriptions?.[0];
        if (!sub) return <span className="text-[var(--dx-text-muted)]">No plan</span>;
        return (
          <div className="space-y-1">
            <DxBadge tone="accent">
              {sub.plan?.name ?? sub.plan?.code ?? `Plan #${sub.plan_id}`}
            </DxBadge>
            <p className="text-[11px] text-[var(--dx-text-muted)]">{sub.status}</p>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      width: 130,
      accessor: (t) => t.status,
      filter: { options: TENANT_STATUSES.map((s) => ({ value: s, label: s })) },
      render: (t) => <DxStatusBadge status={t.status} />,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      width: 360,
      render: (t) => {
        const statusKey = (t.status || "PENDING").toUpperCase();
        return (
          <div className="flex items-center justify-end gap-1.5">
            <DxButton size="sm" leftIcon={<Eye className="h-3 w-3" />} onClick={() => goDetail(t)}>
              View
            </DxButton>
            {statusKey === "PENDING" && (
              <DxButton
                size="sm"
                variant="primary"
                leftIcon={<ShieldCheck className="h-3 w-3" />}
                onClick={() => openApprove(t)}
              >
                Approve
              </DxButton>
            )}
            {t.is_provisioned && !t.aws_s3_bucket_name && (
              <DxButton
                size="sm"
                leftIcon={<Database className="h-3 w-3" />}
                isLoading={provisioningS3Id === t.id}
                onClick={() => handleProvisionS3(t)}
                title="Workspace exists but no S3 bucket yet — create the tenant's own bucket."
              >
                Provision S3
              </DxButton>
            )}
            <DxButton
              size="sm"
              leftIcon={<Wrench className="h-3 w-3" />}
              onClick={() => setManageTenant(t)}
              title="Approval, provisioning steps and infrastructure repair"
            >
              Manage
            </DxButton>
            <DxButton
              size="sm"
              variant="accent-text"
              leftIcon={<Layers className="h-3 w-3" />}
              onClick={() => setModulesTenant(t)}
              title="Enable or disable modules for this tenant (loyalty benefits)"
            >
              Modules
            </DxButton>
            <DxButton
              size="sm"
              variant="accent-text"
              leftIcon={<Gift className="h-3 w-3" />}
              onClick={() => {
                setFreeTenant(t);
                setFreeReason("");
              }}
              title="Grant this tenant one free month of subscription"
            >
              Free month
            </DxButton>
            <DxButton
              size="sm"
              leftIcon={<Sparkles className="h-3 w-3" />}
              onClick={() => openStatus(t)}
              title="Move the workspace through its lifecycle"
            >
              Status
            </DxButton>
          </div>
        );
      },
    },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "SaaS admin" }, { label: "Tenants" }]}
        title="Tenants"
        subtitle="Every hospital workspace, with subscription and onboarding status."
        actions={
          <>
            <DxButton leftIcon={<RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />} onClick={load}>
              Refresh
            </DxButton>
            <DxButton
              variant="primary"
              leftIcon={<Building2 className="h-4 w-4" />}
              onClick={() => navigate(routes.tenantRegister)}
            >
              Register tenant
            </DxButton>
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DxKpi label="Total tenants" value={stats.total} icon={Globe} tone="accent" isLoading={isLoading} />
        <DxKpi label="Active" value={stats.active} icon={CheckCircle2} tone="success" isLoading={isLoading} />
        <DxKpi label="Pending" value={stats.pending} icon={Clock} tone="warning" isLoading={isLoading} />
        <DxKpi label="Suspended" value={stats.suspended} icon={ShieldAlert} tone="danger" isLoading={isLoading} />
      </div>

      <DxToolbar attached>
        <DxSearchBox
          onSearch={setSearch}
          placeholder="Search name, code, billing contact, domain…"
          className="w-80"
        />
        <DxToolbarSeparator />
        <DxSelect
          editorSize="sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={STATUS_FILTERS}
          className="w-44"
        />
        <DxToolbarSpacer />
        <DxButton
          variant="primary"
          size="sm"
          leftIcon={<Building2 className="h-3.5 w-3.5" />}
          onClick={() => navigate(routes.tenantRegister)}
        >
          Register tenant
        </DxButton>
      </DxToolbar>

      <DxGrid
        attached
        columns={columns}
        data={filteredTenants}
        rowKey={(t) => t.id}
        isLoading={isLoading}
        error={error}
        onRetry={load}
        filterRow
        empty={{
          icon: Building2,
          title: "No tenants",
          description:
            tenants.length === 0
              ? "No hospitals have registered yet. Share your registration link to onboard the first tenant."
              : "No tenants match your current search or status filter.",
        }}
      />

      {/* Infrastructure / provisioning manager (own component) */}
      <TenantProvisioningModal
        tenant={manageTenant}
        onClose={() => setManageTenant(null)}
        onChanged={(patch) => {
          const current = tenants.find((x) => x.id === patch.id);
          if (current) replaceTenant({ ...current, ...patch });
        }}
      />

      {/* Loyalty module grants */}
      <DxPopup
        isOpen={!!modulesTenant}
        onClose={() => setModulesTenant(null)}
        title={modulesTenant ? `Modules — ${modulesTenant.name}` : "Modules"}
        size="xl"
      >
        {modulesTenant && <TenantModulesManager tenantId={modulesTenant.id} showHeader={false} />}
      </DxPopup>

      {/* Grant one free month */}
      <DxPopup
        isOpen={!!freeTenant}
        onClose={() => {
          if (!freePending) setFreeTenant(null);
        }}
        title="Grant one free month"
        size="md"
        footer={
          <>
            <DxButton onClick={() => setFreeTenant(null)} disabled={freePending}>
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
        {freeTenant && (
          <div className="space-y-3">
            <DxMessage tone="success" title={freeTenant.name}>
              Gives {freeTenant.name} one month of active, unbilled access. The first invoice
              is deferred until the free month ends.
            </DxMessage>
            <DxInput
              label="Reason (optional)"
              value={freeReason}
              onChange={(e) => setFreeReason(e.target.value)}
              placeholder="e.g. loyalty benefit"
            />
          </div>
        )}
      </DxPopup>

      {/* Approve */}
      <DxPopup
        isOpen={actionKind === "approve" && !!actionTarget}
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
        {actionTarget && (
          <DxMessage tone="success" title={`${actionTarget.name} (${actionTarget.code})`}>
            Approval provisions the tenant database and notifies the admin user that their
            workspace is live.
          </DxMessage>
        )}
      </DxPopup>

      {/* Status */}
      <DxPopup
        isOpen={actionKind === "status" && !!actionTarget}
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
        {actionTarget && (
          <div className="space-y-4">
            <DxProps
              items={[
                { label: "Tenant", value: actionTarget.name },
                { label: "Code", value: actionTarget.code },
                { label: "Current status", value: <DxStatusBadge status={actionTarget.status} /> },
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
        )}
      </DxPopup>
    </DxPage>
  );
}
