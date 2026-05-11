import { PageHeader } from "@/components/layout/PageHeader";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Eye,
  Globe,
  Hash,
  Layers,
  RefreshCw,
  Search,
} from "lucide-react";
import { listTenants } from "@/features/tenants/api/tenants.api";
import type { Tenant } from "@/features/tenants/api/tenants.api";
import { TenantModulesManager } from "../components/TenantModulesManager";

const statusStyles: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-600 border-amber-100",
  TRIAL: "bg-primary-50 text-primary-600 border-primary-100",
  ACTIVE: "bg-emerald-50 text-emerald-600 border-emerald-100",
  SUSPENDED: "bg-rose-50 text-rose-600 border-rose-100",
  TERMINATED: "bg-secondary-100 text-secondary-500 border-secondary-200",
};

export function TenantModulesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTenant = searchParams.get("tenant") ?? "";

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string>(initialTenant);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await listTenants({ page: 1, page_size: 200 });
      setTenants(res.tenants ?? []);
      // Auto-select the first tenant if none picked
      if (!activeTenantId && (res.tenants?.length ?? 0) > 0) {
        const first = res.tenants[0];
        setActiveTenantId(String(first.id));
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Unable to load tenants.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync activeTenantId to the URL so deep-links work
  useEffect(() => {
    if (activeTenantId) {
      setSearchParams({ tenant: activeTenantId }, { replace: true });
    } else {
      searchParams.delete("tenant");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenantId]);

  const filteredTenants = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter(
      (t) =>
        t.name?.toLowerCase().includes(q) ||
        t.code?.toLowerCase().includes(q) ||
        t.billing_email?.toLowerCase().includes(q),
    );
  }, [tenants, search]);

  const activeTenant = useMemo(
    () => tenants.find((t) => String(t.id) === activeTenantId) ?? null,
    [tenants, activeTenantId],
  );

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Tenant Modules"
          description="Toggle product modules per tenant — control what each hospital workspace sees."
        />
        <div className="flex items-center gap-3">
          <Link
            to="/tenants"
            className="btn-secondary gap-2 px-5 py-3 rounded-2xl bg-white/80 border-secondary-100"
          >
            <Building2 className="h-4 w-4" />
            <span className="text-sm font-bold">All Tenants</span>
          </Link>
          <button
            onClick={load}
            className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-100 hover:rotate-180 transition-transform duration-500"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Tenant picker */}
        <div className="lg:col-span-4 space-y-4">
          <div className="glass-card rounded-[2.5rem] p-6 bg-white/60 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-black flex items-center gap-2">
                <Building2 className="h-4 w-4 text-secondary-500" />
                Pick a Tenant
              </h3>
              <span className="px-2.5 py-1 rounded-lg bg-secondary-100 text-secondary-600 text-[10px] font-bold uppercase tracking-widest">
                {tenants.length}
              </span>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tenants..."
                className="w-full bg-white/70 border border-secondary-100 rounded-xl pl-11 pr-4 py-3 text-sm focus:ring-2 focus:ring-primary-500/40 transition-all"
              />
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-2xl bg-secondary-100/40 animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-center">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                <p className="text-xs font-bold">{error}</p>
                <button onClick={load} className="text-xs font-bold underline mt-2">
                  Retry
                </button>
              </div>
            ) : filteredTenants.length === 0 ? (
              <div className="py-8 text-center">
                <Building2 className="h-10 w-10 mx-auto text-secondary-200 mb-3" />
                <p className="text-xs text-secondary-500 font-bold">
                  {tenants.length === 0
                    ? "No tenants yet."
                    : "No tenants match your search."}
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                {filteredTenants.map((t) => {
                  const isActive = String(t.id) === activeTenantId;
                  const statusKey = (t.status || "PENDING").toUpperCase();
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTenantId(String(t.id))}
                      className={`w-full text-left p-4 rounded-2xl border transition-all ${
                        isActive
                          ? "bg-primary-500 text-white border-primary-500 shadow-md shadow-primary-500/20"
                          : "bg-white border-secondary-100 hover:border-primary-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5 gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-secondary-100 text-secondary-500"
                          }`}
                        >
                          <Hash className="h-2.5 w-2.5" />
                          {t.code}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md border text-[9px] font-bold uppercase tracking-widest ${
                            isActive
                              ? "bg-white/20 text-white border-white/30"
                              : statusStyles[statusKey] ?? statusStyles.PENDING
                          }`}
                        >
                          {statusKey}
                        </span>
                      </div>
                      <p className="text-sm font-black truncate">{t.name}</p>
                      {t.custom_domain && (
                        <p
                          className={`text-[10px] font-mono mt-1 truncate inline-flex items-center gap-1 ${
                            isActive ? "text-white/70" : "text-secondary-500"
                          }`}
                        >
                          <Globe className="h-2.5 w-2.5" />
                          {t.custom_domain}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modules manager */}
        <div className="lg:col-span-8 space-y-6">
          {!activeTenant ? (
            <div className="glass-card rounded-[3rem] p-16 text-center bg-white/60">
              <div className="h-20 w-20 mx-auto bg-secondary-50 rounded-3xl flex items-center justify-center mb-4">
                <Layers className="h-10 w-10 text-secondary-200" />
              </div>
              <h3 className="text-xl font-bold text-secondary-900">
                Pick a Tenant to Manage Modules
              </h3>
              <p className="text-sm text-secondary-500 mt-2 max-w-md mx-auto">
                Select a tenant on the left to view and toggle the modules available in
                their workspace.
              </p>
            </div>
          ) : (
            <>
              {/* Tenant context strip */}
              <div className="glass-card rounded-[2.5rem] p-6 bg-white/80 shadow-premium flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-md">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-base font-black text-secondary-900">
                      {activeTenant.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="inline-flex items-center gap-1 bg-secondary-100 text-secondary-500 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold">
                        <Hash className="h-2.5 w-2.5" />
                        {activeTenant.code}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-widest ${
                          statusStyles[(activeTenant.status || "PENDING").toUpperCase()] ??
                          statusStyles.PENDING
                        }`}
                      >
                        {activeTenant.status}
                      </span>
                      {activeTenant.subscriptions?.[0]?.plan?.name && (
                        <span className="inline-flex px-2 py-0.5 rounded-md bg-primary-50 text-primary-600 border border-primary-100 text-[10px] font-bold uppercase tracking-widest">
                          {activeTenant.subscriptions[0].plan.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Link
                  to={`/tenants/${activeTenant.id}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary-50 hover:bg-secondary-100 text-secondary-700 text-[10px] font-bold uppercase tracking-widest transition-all"
                >
                  <Eye className="h-3 w-3" />
                  View Tenant
                </Link>
              </div>

              {/* The reusable manager */}
              <div className="glass-card rounded-[2.5rem] p-8 bg-white/80 shadow-premium">
                <TenantModulesManager tenantId={activeTenant.id} showHeader />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Suppress unused-import lint
void ArrowLeft;
void CheckCircle2;
