import { PageHeader } from "@/components/layout/PageHeader";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  Crown,
  Eye,
  Filter,
  Globe,
  Hash,
  ListChecks,
  Mail,
  Phone,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import {
  approveTenant,
  listTenants,
  TENANT_STATUSES,
  updateTenantStatus,
} from "../api/tenants.api";
import type { Tenant } from "../api/tenants.api";

const statusStyles: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-600 border-amber-100",
  TRIAL: "bg-primary-50 text-primary-600 border-primary-100",
  ACTIVE: "bg-emerald-50 text-emerald-600 border-emerald-100",
  SUSPENDED: "bg-rose-50 text-rose-600 border-rose-100",
  TERMINATED: "bg-secondary-100 text-secondary-500 border-secondary-200",
};

const STATUS_FILTERS = [
  { value: "", label: "All Statuses" },
  ...TENANT_STATUSES.map((s) => ({ value: s, label: s })),
];

type ActionKind = "approve" | "status" | null;

export function TenantListPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<
    { tone: "success" | "error"; message: string } | null
  >(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [actionKind, setActionKind] = useState<ActionKind>(null);
  const [actionTarget, setActionTarget] = useState<Tenant | null>(null);
  const [statusForm, setStatusForm] = useState<string>("ACTIVE");
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const showFeedback = (tone: "success" | "error", message: string) => {
    setFeedback({ tone, message });
    window.setTimeout(() => setFeedback(null), 3500);
  };

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await listTenants({ page: 1, page_size: 100 });
      setTenants(res.tenants ?? []);
      setTotalCount(res.total_count ?? res.tenants?.length ?? 0);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Unable to load tenants.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

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

  const replaceTenant = (updated: Tenant) => {
    setTenants((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
  };

  // ----- Actions -----
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

  const handleApprove = async () => {
    if (!actionTarget) return;
    setActionPending(true);
    setActionError(null);
    try {
      await approveTenant(actionTarget.id);
      // Optimistic update — backend may flip status to ACTIVE
      replaceTenant({ ...actionTarget, status: "ACTIVE" });
      showFeedback("success", `${actionTarget.name} approved.`);
      setActionKind(null);
      setActionTarget(null);
    } catch (err: any) {
      setActionError(err?.response?.data?.message || "Failed to approve tenant.");
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
      showFeedback("success", `${actionTarget.name} → ${statusForm}.`);
      setActionKind(null);
      setActionTarget(null);
    } catch (err: any) {
      setActionError(err?.response?.data?.message || "Failed to update status.");
    } finally {
      setActionPending(false);
    }
  };

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Tenants"
          description="SaaS administration: every hospital workspace, with subscription and onboarding status."
        />
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-100 hover:rotate-180 transition-transform duration-500"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <Link
            to="/register-hospital"
            className="btn-primary gap-3 py-3 px-7 shadow-xl shadow-primary-500/20"
          >
            <Building2 className="h-5 w-5" />
            <span className="font-bold">Register Tenant</span>
          </Link>
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

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={Globe} label="Total Tenants" value={stats.total} tone="primary" />
        <StatCard icon={CheckCircle2} label="Active" value={stats.active} tone="emerald" />
        <StatCard icon={Clock} label="Pending" value={stats.pending} tone="amber" />
        <StatCard icon={ShieldAlert} label="Suspended" value={stats.suspended} tone="rose" />
      </div>

      {/* Filters */}
      <div className="glass-card rounded-[2rem] p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center bg-white/40 backdrop-blur-md">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, code, billing contact, domain..."
            className="w-full bg-white/50 border-none rounded-2xl pl-14 pr-6 py-4 text-sm focus:ring-2 focus:ring-primary-500/50 transition-all font-medium"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400 pointer-events-none" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none bg-white/80 border border-secondary-100 rounded-2xl pl-11 pr-8 py-4 text-xs font-bold uppercase tracking-widest text-secondary-700 focus:ring-2 focus:ring-primary-500/40"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-[2.5rem] overflow-hidden border border-secondary-100/50 shadow-premium bg-white/40">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-secondary-900/5">
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Tenant</th>
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Domain</th>
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Billing</th>
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Subscription</th>
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Status</th>
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100/50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-8 py-6">
                      <div className="h-14 bg-secondary-100/30 rounded-2xl" />
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <AlertCircle className="h-12 w-12 mx-auto text-rose-500/50 mb-4" />
                    <p className="text-secondary-600 font-bold">{error}</p>
                    <button onClick={load} className="btn-primary mt-4 py-3 px-8">
                      Try Again
                    </button>
                  </td>
                </tr>
              ) : filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-32 text-center">
                    <div className="h-20 w-20 bg-secondary-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
                      <Building2 className="h-10 w-10 text-secondary-200" />
                    </div>
                    <h4 className="text-xl font-bold text-secondary-900">No Tenants</h4>
                    <p className="text-sm text-secondary-500 mt-2">
                      {tenants.length === 0
                        ? "No hospitals have registered yet. Share your registration link to onboard your first tenant."
                        : "No tenants match your filters."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredTenants.map((t) => {
                  const statusKey = (t.status || "PENDING").toUpperCase();
                  const statusClass = statusStyles[statusKey] ?? statusStyles.PENDING;
                  const sub = t.subscriptions?.[0];
                  return (
                    <tr key={t.id} className="hover:bg-primary-50/30 transition-all">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-md">
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-secondary-900">{t.name}</p>
                            <span className="inline-flex items-center gap-1 mt-1 bg-secondary-100 text-secondary-500 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold">
                              <Hash className="h-2.5 w-2.5" />
                              {t.code}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="space-y-1">
                          {t.custom_domain && (
                            <p className="text-xs font-bold text-secondary-700 inline-flex items-center gap-1.5">
                              <Crown className="h-3 w-3 text-amber-500" />
                              <span className="font-mono">{t.custom_domain}</span>
                            </p>
                          )}
                          {t.domain_url && (
                            <p className="text-[10px] font-mono font-bold text-secondary-500 truncate max-w-[200px] inline-flex items-center gap-1">
                              <Globe className="h-2.5 w-2.5" />
                              {t.domain_url}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="space-y-1">
                          {t.billing_contact_name && (
                            <p className="text-xs font-bold text-secondary-700">
                              {t.billing_contact_name}
                            </p>
                          )}
                          {t.billing_email && (
                            <p className="text-[10px] text-secondary-500 inline-flex items-center gap-1">
                              <Mail className="h-2.5 w-2.5" />
                              {t.billing_email}
                            </p>
                          )}
                          {t.billing_phone && (
                            <p className="text-[10px] text-secondary-500 inline-flex items-center gap-1">
                              <Phone className="h-2.5 w-2.5" />
                              {t.billing_phone}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        {sub ? (
                          <div className="space-y-1">
                            <span className="inline-flex px-2.5 py-1 rounded-lg bg-primary-50 text-primary-600 border border-primary-100 text-[10px] font-bold uppercase tracking-widest">
                              {sub.plan?.name ?? sub.plan?.code ?? `Plan #${sub.plan_id}`}
                            </span>
                            <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">
                              {sub.status}
                            </p>
                          </div>
                        ) : (
                          <span className="text-secondary-400 text-[11px] font-bold">No plan</span>
                        )}
                      </td>
                      <td className="px-8 py-6">
                        <span
                          className={`inline-flex px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest ${statusClass}`}
                        >
                          {statusKey}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/tenants/${t.id}`}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-black text-white text-[10px] font-bold uppercase tracking-widest shadow-md"
                          >
                            <Eye className="h-3 w-3" />
                            View
                          </Link>
                          {statusKey === "PENDING" && (
                            <button
                              onClick={() => openApprove(t)}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-widest shadow-md"
                            >
                              <ShieldCheck className="h-3 w-3" />
                              Approve
                            </button>
                          )}
                          <button
                            onClick={() => openStatus(t)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold uppercase tracking-widest shadow-md"
                          >
                            <Sparkles className="h-3 w-3" />
                            Status
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {actionKind === "approve" && actionTarget && (
        <ModalShell
          title="Approve Tenant"
          subtitle="Activate The Workspace For This Hospital"
          onClose={closeAction}
          icon={ShieldCheck}
          tone="emerald"
        >
          {actionError && <ErrorBanner message={actionError} />}
          <div className="mb-6 p-5 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-emerald-700">
                {actionTarget.name}{" "}
                <span className="font-mono text-emerald-600">({actionTarget.code})</span>
              </p>
              <p className="text-xs text-emerald-600 mt-1">
                Approval will provision the tenant database and notify the admin user that
                their workspace is live.
              </p>
            </div>
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

      {actionKind === "status" && actionTarget && (
        <ModalShell
          title="Update Tenant Status"
          subtitle="Move The Workspace Through Its Lifecycle"
          onClose={closeAction}
          icon={Sparkles}
          tone="amber"
        >
          {actionError && <ErrorBanner message={actionError} />}
          <div className="mb-6 p-4 rounded-2xl bg-secondary-50 border border-secondary-100 flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-sm font-bold text-secondary-900">{actionTarget.name}</p>
              <p className="text-[10px] font-mono font-bold text-secondary-400 uppercase mt-0.5">
                {actionTarget.code}
              </p>
            </div>
            <span
              className={`inline-flex px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest ${statusStyles[actionTarget.status] ?? statusStyles.PENDING
                }`}
            >
              Currently {actionTarget.status}
            </span>
          </div>
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
                      : "bg-white border-secondary-100 text-secondary-600 hover:border-primary-300"
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
      <div className="bg-white border rounded-[2.5rem] p-10 max-w-xl w-full shadow-2xl relative animate-slide-up max-h-[90vh] overflow-y-auto">
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

type StatTone = "primary" | "emerald" | "amber" | "rose";
const statToneStyles: Record<StatTone, string> = {
  primary: "bg-primary-50 text-primary-600 border-primary-100",
  emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
  amber: "bg-amber-50 text-amber-600 border-amber-100",
  rose: "bg-rose-50 text-rose-600 border-rose-100",
};
function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Building2;
  label: string;
  value: number;
  tone: StatTone;
}) {
  return (
    <div
      className={`glass-card rounded-[2rem] p-6 border ${statToneStyles[tone]} bg-white/60 backdrop-blur-md`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{label}</span>
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-3xl font-black tracking-tight">{value}</div>
    </div>
  );
}

// Suppress unused-import for the icon library tree-shaking hints
void ListChecks;
