import { PageHeader } from "@/components/layout/PageHeader";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  Crown,
  Database,
  FileText,
  Globe,
  Hash,
  Layers,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import {
  approveTenant,
  getTenant,
  TENANT_STATUSES,
  updateTenantStatus,
} from "../api/tenants.api";
import type { Tenant } from "../api/tenants.api";
import { TenantModulesManager } from "@/features/tenant-modules/components/TenantModulesManager";

const statusStyles: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-600 border-amber-100",
  TRIAL: "bg-primary-50 text-primary-600 border-primary-100",
  ACTIVE: "bg-emerald-50 text-emerald-600 border-emerald-100",
  SUSPENDED: "bg-rose-50 text-rose-600 border-rose-100",
  TERMINATED: "bg-secondary-100 text-secondary-500 border-secondary-200",
};

function formatDateTime(value?: string) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

type ActionKind = "approve" | "status" | null;

export function TenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<
    { tone: "success" | "error"; message: string } | null
  >(null);

  const [actionKind, setActionKind] = useState<ActionKind>(null);
  const [statusForm, setStatusForm] = useState<string>("ACTIVE");
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const showFeedback = (tone: "success" | "error", message: string) => {
    setFeedback({ tone, message });
    window.setTimeout(() => setFeedback(null), 3500);
  };

  const load = async () => {
    if (!tenantId) {
      setError("Invalid tenant identifier.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await getTenant(tenantId);
      setTenant(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Unable to load tenant.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  // ----- Actions -----
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

  const closeAction = () => {
    if (actionPending) return;
    setActionKind(null);
    setActionError(null);
  };

  const handleApprove = async () => {
    if (!tenant) return;
    setActionPending(true);
    setActionError(null);
    try {
      await approveTenant(tenant.id);
      setTenant({ ...tenant, status: "ACTIVE" });
      showFeedback("success", "Tenant approved.");
      setActionKind(null);
    } catch (err: any) {
      setActionError(err?.response?.data?.message || "Failed to approve tenant.");
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
      showFeedback("success", `Status updated → ${statusForm}.`);
      setActionKind(null);
    } catch (err: any) {
      setActionError(err?.response?.data?.message || "Failed to update status.");
    } finally {
      setActionPending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="h-16 w-16 border-4 border-primary-500 border-t-transparent rounded-[2rem] animate-spin" />
        <p className="text-sm font-black text-secondary-400 uppercase tracking-[0.3em] animate-pulse">
          Loading Tenant...
        </p>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center space-y-8 animate-fade-in">
        <div className="h-24 w-24 bg-rose-50 rounded-[2.5rem] flex items-center justify-center mx-auto">
          <AlertCircle className="h-12 w-12 text-rose-500" />
        </div>
        <div>
          <h3 className="text-3xl font-black text-secondary-900 tracking-tight">
            Tenant Not Resolved
          </h3>
          <p className="text-secondary-500 mt-4 leading-relaxed max-w-md mx-auto">
            {error ?? "We couldn't locate this tenant."}
          </p>
        </div>
        <button onClick={() => navigate("/tenants")} className="btn-secondary px-8 py-4">
          Back to Tenants
        </button>
      </div>
    );
  }

  const statusKey = (tenant.status || "PENDING").toUpperCase();
  const statusClass = statusStyles[statusKey] ?? statusStyles.PENDING;

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-3">
          <button
            onClick={() => navigate("/tenants")}
            className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.25em] text-secondary-400 hover:text-secondary-700 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Tenants
          </button>
          <PageHeader
            title={tenant.name}
            description="Full SaaS workspace profile, subscription, and feature toggles."
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-400"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          {statusKey === "PENDING" && (
            <button
              onClick={openApprove}
              className="btn-primary gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20"
            >
              <ShieldCheck className="h-4 w-4" />
              <span className="text-sm font-bold">Approve</span>
            </button>
          )}
          <button
            onClick={openStatus}
            className="btn-primary gap-2 px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/20"
          >
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-bold">Update Status</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`px-6 py-4 rounded-2xl border flex items-center gap-3 shadow-lg animate-fade-in ${feedback.tone === "success"
              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
              : "bg-rose-50 text-rose-700 border-rose-100"
            }`}
        >
          {feedback.tone === "success" ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          <span className="text-sm font-bold">{feedback.message}</span>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-12">
        {/* LEFT: Identity + Billing */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass-card rounded-[2.5rem] p-8 bg-white/60 backdrop-blur-xl">
            <div className="flex items-center justify-center mb-5">
              <div className="h-20 w-20 rounded-[1.75rem] bg-slate-900 text-white flex items-center justify-center shadow-2xl">
                <Building2 className="h-10 w-10" />
              </div>
            </div>
            <h2 className="text-xl font-black font-display text-center tracking-tight">
              {tenant.name}
            </h2>
            <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 bg-secondary-100 text-secondary-600 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold">
                <Hash className="h-2.5 w-2.5" />
                {tenant.code}
              </span>
              <span
                className={`inline-flex px-3 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-widest ${statusClass}`}
              >
                {statusKey}
              </span>
            </div>

            <div className="mt-6 space-y-3">
              {tenant.custom_domain && (
                <DetailRow icon={Crown} label="Custom Domain" value={tenant.custom_domain} mono tone="amber" />
              )}
              {tenant.domain_url && (
                <DetailRow icon={Globe} label="Domain" value={tenant.domain_url} mono />
              )}
              {tenant.db_connection_string && (
                <DetailRow
                  icon={Database}
                  label="DB Connection"
                  value={tenant.db_connection_string.length > 30
                    ? `${tenant.db_connection_string.slice(0, 30)}…`
                    : tenant.db_connection_string}
                  mono
                />
              )}
            </div>
          </div>

          {/* Billing */}
          <div className="glass-card rounded-[2.5rem] p-8 bg-white/60 backdrop-blur-xl">
            <h3 className="text-sm font-black flex items-center gap-2 mb-5">
              <FileText className="h-4 w-4 text-secondary-500" />
              Billing
            </h3>
            <div className="space-y-3">
              {tenant.billing_contact_name && (
                <DetailRow icon={Building2} label="Contact" value={tenant.billing_contact_name} />
              )}
              {tenant.billing_email && (
                <DetailRow icon={Mail} label="Email" value={tenant.billing_email} />
              )}
              {tenant.billing_phone && (
                <DetailRow icon={Phone} label="Phone" value={tenant.billing_phone} />
              )}
              {tenant.billing_address && (
                <DetailRow icon={MapPin} label="Address" value={tenant.billing_address} />
              )}
              {tenant.tax_id && (
                <DetailRow icon={FileText} label="Tax ID" value={tenant.tax_id} mono />
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Subscriptions + Modules */}
        <div className="lg:col-span-8 space-y-6">
          {/* Subscriptions */}
          <div className="glass-card rounded-[2.5rem] p-8 bg-white/80 shadow-premium">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-secondary-500" />
                Subscriptions
              </h3>
              <span className="px-2.5 py-1 rounded-lg bg-secondary-100 text-secondary-600 text-[10px] font-bold uppercase tracking-widest">
                {tenant.subscriptions?.length ?? 0}
              </span>
            </div>
            {!tenant.subscriptions || tenant.subscriptions.length === 0 ? (
              <div className="py-10 text-center">
                <Sparkles className="h-10 w-10 mx-auto text-secondary-200 mb-3" />
                <p className="text-sm text-secondary-500 font-bold">
                  No active subscription on this tenant.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {tenant.subscriptions.map((s) => (
                  <div
                    key={s.id}
                    className="p-5 rounded-2xl bg-white border border-secondary-400 hover:border-primary-200 transition-all"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                      <div>
                        <p className="text-base font-black text-secondary-900">
                          {s.plan?.name ?? s.plan?.code ?? `Plan #${s.plan_id}`}
                        </p>
                        {s.plan?.code && (
                          <span className="inline-flex items-center gap-1 mt-1 bg-secondary-100 text-secondary-500 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold">
                            <Hash className="h-2.5 w-2.5" />
                            {s.plan.code}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-widest ${statusStyles[s.status?.toUpperCase()] ?? statusStyles.PENDING
                            }`}
                        >
                          {s.status}
                        </span>
                        {s.auto_renew && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-bold uppercase tracking-widest">
                            <CheckCircle2 className="h-3 w-3" />
                            Auto-Renew
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <DetailMicro
                        label="Start"
                        value={formatDateTime(s.start_date)}
                        icon={Clock}
                      />
                      <DetailMicro
                        label="End"
                        value={formatDateTime(s.end_date)}
                        icon={Clock}
                      />
                      {s.trial_end_date && (
                        <DetailMicro
                          label="Trial Ends"
                          value={formatDateTime(s.trial_end_date)}
                          icon={Clock}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modules manager */}
          <div className="glass-card rounded-[2.5rem] p-8 bg-white/80 shadow-premium">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-black flex items-center gap-2">
                  <Layers className="h-5 w-5 text-secondary-500" />
                  Module Access
                </h3>
                <p className="text-secondary-400 font-bold text-[10px] uppercase tracking-[0.25em] mt-1">
                  Toggle Features Per Subscription Tier
                </p>
              </div>
              <Link
                to="/tenant-modules"
                className="text-[11px] font-bold uppercase tracking-widest text-primary-600 hover:text-primary-700"
              >
                Open Manager →
              </Link>
            </div>
            <TenantModulesManager tenantId={tenant.id} showHeader={false} />
          </div>
        </div>
      </div>

      {/* Modals */}
      {actionKind === "approve" && (
        <ModalShell
          title="Approve Tenant"
          subtitle="Activate The Workspace"
          onClose={closeAction}
          icon={ShieldCheck}
          tone="emerald"
        >
          {actionError && <ErrorBanner message={actionError} />}
          <div className="mb-6 p-5 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
            <p className="text-sm text-emerald-700 font-bold leading-relaxed">
              Approving <strong>{tenant.name}</strong> will activate their workspace and
              notify the admin user. This is irreversible — use the Status update modal to
              suspend later if needed.
            </p>
          </div>
          <ModalActions
            onClose={closeAction}
            onSubmit={handleApprove}
            pending={actionPending}
            submitLabel="Approve Tenant"
            submitIcon={ShieldCheck}
            tone="emerald"
          />
        </ModalShell>
      )}

      {actionKind === "status" && (
        <ModalShell
          title="Update Tenant Status"
          subtitle="Move The Workspace Through Its Lifecycle"
          onClose={closeAction}
          icon={Sparkles}
          tone="amber"
        >
          {actionError && <ErrorBanner message={actionError} />}
          <div className="space-y-2 mb-6">
            <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
              New Status *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TENANT_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusForm(s)}
                  className={`p-3 rounded-xl border-2 text-[10px] font-bold uppercase tracking-widest transition-all ${statusForm === s
                      ? "bg-primary-500 text-white border-primary-500 shadow-md"
                      : "bg-white border-secondary-400 text-secondary-600 hover:border-primary-300"
                    }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <ModalActions
            onClose={closeAction}
            onSubmit={handleStatus}
            pending={actionPending}
            submitLabel="Update Status"
            submitIcon={Save}
            tone="amber"
          />
        </ModalShell>
      )}
    </div>
  );
}

// =====================================================================
// Sub-components
// =====================================================================

function DetailRow({
  icon: Icon,
  label,
  value,
  mono,
  tone,
}: {
  icon: typeof Globe;
  label: string;
  value: string;
  mono?: boolean;
  tone?: "amber";
}) {
  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-xl border ${tone === "amber"
          ? "bg-amber-50/50 border-amber-100"
          : "bg-secondary-50 border-secondary-400"
        }`}
    >
      <Icon
        className={`h-3.5 w-3.5 mt-0.5 ${tone === "amber" ? "text-amber-500" : "text-secondary-400"
          }`}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-bold uppercase tracking-widest text-secondary-400">
          {label}
        </p>
        <p
          className={`text-xs font-bold text-secondary-700 mt-0.5 truncate ${mono ? "font-mono" : ""
            }`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function DetailMicro({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div className="p-3 rounded-xl bg-secondary-50 border border-secondary-400">
      <p className="text-[9px] font-bold uppercase tracking-widest text-secondary-400 flex items-center gap-1">
        <Icon className="h-2.5 w-2.5" />
        {label}
      </p>
      <p className="text-xs font-bold text-secondary-700 mt-0.5 font-mono truncate">{value}</p>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-5 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3">
      <AlertCircle className="h-5 w-5" />
      <span className="text-sm font-bold">{message}</span>
    </div>
  );
}

function ModalActions({
  onClose,
  onSubmit,
  pending,
  submitLabel,
  submitIcon: Icon,
  tone = "primary",
}: {
  onClose: () => void;
  onSubmit: () => void;
  pending: boolean;
  submitLabel: string;
  submitIcon: typeof Save;
  tone?: "primary" | "emerald" | "amber" | "rose";
}) {
  const cls =
    tone === "rose"
      ? "bg-rose-500 hover:bg-rose-600 shadow-rose-500/20"
      : tone === "amber"
        ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20"
        : tone === "emerald"
          ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20"
          : "bg-primary-500 hover:bg-primary-600 shadow-primary-500/20";
  return (
    <div className="pt-2 flex gap-4">
      <button
        onClick={onClose}
        disabled={pending}
        className="flex-1 btn-secondary py-4 rounded-2xl font-bold disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        onClick={onSubmit}
        disabled={pending}
        className={`flex-[2] py-4 rounded-2xl text-white font-black tracking-tight shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 ${cls}`}
      >
        <Icon className="h-4 w-4" />
        {pending ? "Working..." : submitLabel}
      </button>
    </div>
  );
}

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  icon: Icon,
  tone = "primary",
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
  icon: typeof Save;
  tone?: "primary" | "emerald" | "amber" | "rose";
}) {
  const cls =
    tone === "rose"
      ? "bg-rose-500 shadow-rose-500/20"
      : tone === "amber"
        ? "bg-amber-500 shadow-amber-500/20"
        : tone === "emerald"
          ? "bg-emerald-500 shadow-emerald-500/20"
          : "bg-primary-600 shadow-primary-500/20";
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-6 animate-fade-in">
      <div className="bg-white rounded-[2.5rem] p-10 max-w-xl w-full shadow-2xl relative animate-slide-up max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-3 hover:bg-secondary-50 rounded-2xl transition-all"
        >
          <X className="h-5 w-5 text-secondary-400" />
        </button>
        <div className="flex items-center gap-5 mb-8">
          <div
            className={`h-14 w-14 rounded-2xl text-white flex items-center justify-center shadow-xl ${cls}`}
          >
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-black font-display tracking-tight">{title}</h3>
            <p className="text-secondary-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">
              {subtitle}
            </p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

// Suppress unused-import lint
void ShieldAlert;
