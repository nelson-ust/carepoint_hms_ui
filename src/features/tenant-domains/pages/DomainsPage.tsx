import { useState, useMemo, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Link, useSearchParams } from "react-router-dom";
import {
  Globe,
  ShieldCheck,
  ShieldAlert,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  ExternalLink,
  MoreHorizontal,
  ChevronRight,
  Info,
  Lock,
  Loader2,
  Building2,
  Search,
  Hash,
  Eye,
} from "lucide-react";
import { useTenantDomains, useVerifyDomain, useAddDomain } from "../hooks/use-domains";
import { listTenants } from "@/features/tenants/api/tenants.api";
import type { Tenant } from "@/features/tenants/api/tenants.api";
import { format } from "date-fns";
import { Modal } from "@/components/ui/Modal";
import { localStorageService, storageKeys } from "@/lib/storage/local-storage";

const statusStyles: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-600 border-amber-100",
  TRIAL: "bg-primary-50 text-primary-600 border-primary-100",
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-100",
  SUSPENDED: "bg-rose-50 text-rose-700 border-rose-100",
  TERMINATED: "bg-secondary-100 text-secondary-500 border-secondary-200",
};

export function DomainsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTenant = searchParams.get("tenant") ?? "";

  // Get current user context
  const userJson = localStorageService.get(storageKeys.user);
  const user = userJson ? JSON.parse(userJson) : null;
  const isSaaSAdmin = !user?.tenant_id;

  // State for SaaS Admin view
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string>(
    isSaaSAdmin ? initialTenant : String(user?.tenant_id || ""),
  );
  const [isLoadingTenants, setIsLoadingTenants] = useState(isSaaSAdmin);
  const [tenantSearch, setTenantSearch] = useState("");

  const effectiveTenantId = Number(activeTenantId);

  // Queries & Mutations
  const { data: domains, isLoading, refetch } = useTenantDomains(effectiveTenantId);
  const verifyMutation = useVerifyDomain(effectiveTenantId);
  const addDomainMutation = useAddDomain(effectiveTenantId);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async (domainId: number) => {
    try {
      await verifyMutation.mutateAsync(domainId);
      setIsSuccessModalOpen(true);
    } catch (err: any) {
      console.error("Verification failed:", err);
    }
  };

  // Load tenants if SaaS Admin
  useEffect(() => {
    if (!isSaaSAdmin) return;
    const loadTenants = async () => {
      setIsLoadingTenants(true);
      try {
        const res = await listTenants({ page: 1, page_size: 200 });
        setTenants(res.tenants ?? []);
        if (!activeTenantId && res.tenants?.length > 0) {
          setActiveTenantId(String(res.tenants[0].id));
        }
      } catch (err) {
        console.error("Failed to load tenants:", err);
      } finally {
        setIsLoadingTenants(false);
      }
    };
    loadTenants();
  }, [isSaaSAdmin, activeTenantId]);

  // Sync URL
  useEffect(() => {
    if (isSaaSAdmin && activeTenantId) {
      setSearchParams({ tenant: activeTenantId }, { replace: true });
    }
  }, [isSaaSAdmin, activeTenantId, setSearchParams]);

  const filteredTenants = useMemo(() => {
    const q = tenantSearch.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter(
      (t) =>
        t.name?.toLowerCase().includes(q) ||
        t.code?.toLowerCase().includes(q) ||
        t.billing_email?.toLowerCase().includes(q),
    );
  }, [tenants, tenantSearch]);

  const activeTenant = useMemo(
    () => tenants.find((t) => String(t.id) === activeTenantId) ?? null,
    [tenants, activeTenantId],
  );

  const handleConnectDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!newDomain) return setError("Please enter a domain name");

    try {
      await addDomainMutation.mutateAsync(newDomain);
      setIsModalOpen(false);
      setNewDomain("");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to add domain. Please try again.");
    }
  };

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Domain Management"
          description="Configure custom white-label domains and SSL certificates for hospital portals."
        />
        {effectiveTenantId > 0 && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20"
          >
            <Plus className="h-5 w-5" />
            <span className="font-bold">Connect Domain</span>
          </button>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Tenant Picker Sidebar (SaaS Admins Only) */}
        {isSaaSAdmin && (
          <div className="lg:col-span-4 space-y-4">
            <div className="glass-card rounded-[2.5rem] p-6 bg-white/60 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-black flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-secondary-500" />
                  Pick a Tenant
                </h3>
              </div>

              <div className="relative mb-4">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />
                <input
                  type="text"
                  value={tenantSearch}
                  onChange={(e) => setTenantSearch(e.target.value)}
                  placeholder="Search tenants..."
                  className="w-full bg-white/70 border border-secondary-100 rounded-xl pl-11 pr-4 py-3 text-sm focus:ring-2 focus:ring-primary-500/40 transition-all"
                />
              </div>

              {isLoadingTenants ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-16 rounded-2xl bg-secondary-100/40 animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
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
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <div className={`${isSaaSAdmin ? "lg:col-span-8" : "lg:col-span-12"} space-y-6`}>
          {effectiveTenantId === 0 ? (
            <div className="glass-card rounded-[3rem] p-16 text-center bg-white/60 border border-secondary-100">
              <Building2 className="h-16 w-16 mx-auto text-secondary-100 mb-6" />
              <h4 className="text-xl font-bold text-secondary-900">No Tenant Selected</h4>
              <p className="text-secondary-500 mt-2 max-w-xs mx-auto">
                Please select a tenant from the list to manage their custom domains.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {/* Help/DNS Panel */}
              <div className="xl:col-span-1 space-y-6">
                <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-100/50 bg-white/40">
                  <h4 className="text-sm font-bold text-secondary-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary-500" />
                    DNS Config
                  </h4>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-secondary-400 uppercase tracking-tighter">
                        A Record (@)
                      </p>
                      <code className="block p-3 rounded-xl bg-secondary-900 text-secondary-100 text-[10px] font-mono break-all">
                        76.76.21.21
                      </code>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-secondary-400 uppercase tracking-tighter">
                        CNAME (www)
                      </p>
                      <code className="block p-3 rounded-xl bg-secondary-900 text-secondary-100 text-[10px] font-mono break-all">
                        cname.carepoint-hms.com
                      </code>
                    </div>
                  </div>
                </div>
              </div>

              {/* Domains List */}
              <div className="xl:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-secondary-900 flex items-center gap-2">
                    <Globe className="h-5 w-5 text-primary-500" />
                    Active Domains
                  </h3>
                  <button
                    onClick={() => refetch()}
                    className="p-2 hover:bg-secondary-100 rounded-xl transition-all"
                  >
                    <RefreshCw
                      className={`h-4 w-4 text-secondary-400 ${
                        isLoading ? "animate-spin" : ""
                      }`}
                    />
                  </button>
                </div>

                <div className="space-y-4">
                  {isLoading ? (
                    Array.from({ length: 2 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-32 bg-white/40 rounded-[2rem] animate-pulse"
                      />
                    ))
                  ) : domains && domains.length > 0 ? (
                    domains.map((domain) => (
                      <div
                        key={domain.id}
                        className="glass-card rounded-[2.5rem] p-8 border border-secondary-100/50 bg-white/40 hover:bg-white/60 transition-all group"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                          <div className="flex items-center gap-5">
                            <div
                              className={`h-14 w-14 rounded-2xl flex items-center justify-center shadow-lg ${
                                domain.is_verified
                                  ? "bg-secondary-900 text-white shadow-secondary-900/10"
                                  : "bg-secondary-100 text-secondary-400 shadow-none"
                              }`}
                            >
                              <Globe className="h-7 w-7" />
                            </div>
                            <div>
                              <div className="flex items-center gap-3">
                                <h4 className="text-lg font-black text-secondary-900">
                                  {domain.domain_name}
                                </h4>
                                {domain.is_primary && (
                                  <span className="px-2 py-0.5 rounded-lg bg-primary-500 text-white text-[10px] font-bold">
                                    PRIMARY
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 mt-2">
                                <span
                                  className={`flex items-center gap-1.5 text-[10px] font-bold ${
                                    domain.is_verified
                                      ? "text-emerald-600"
                                      : "text-amber-500"
                                  }`}
                                >
                                  {domain.is_verified ? (
                                    <ShieldCheck className="h-3 w-3" />
                                  ) : (
                                    <ShieldAlert className="h-3 w-3" />
                                  )}
                                  {domain.is_verified ? "Verified" : "Pending Verification"}
                                </span>
                                <span
                                  className={`flex items-center gap-1.5 text-[10px] font-bold ${
                                    domain.ssl_enabled
                                      ? "text-blue-600"
                                      : "text-secondary-400"
                                  }`}
                                >
                                  <Lock className="h-3 w-3" />
                                  {domain.ssl_enabled ? "SSL Active" : "No SSL"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {!domain.is_verified && (
                              <button
                                onClick={() => handleVerify(domain.id)}
                                disabled={verifyMutation.isPending}
                                className="btn-primary py-2 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest"
                              >
                                {verifyMutation.isPending ? "Verifying..." : "Verify Now"}
                              </button>
                            )}
                            <button className="p-3 hover:bg-secondary-100 rounded-2xl transition-all">
                              <MoreHorizontal className="h-5 w-5 text-secondary-400" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-24 text-center bg-white/20 rounded-[3rem] border-2 border-dashed border-secondary-100">
                      <Globe className="h-16 w-16 mx-auto text-secondary-100 mb-6" />
                      <h4 className="text-xl font-bold text-secondary-900">
                        No Custom Domains
                      </h4>
                      <p className="text-secondary-500 mt-2 max-w-xs mx-auto">
                        Link a custom domain to provide a seamless hospital portal experience.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Connect Domain Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setError(null);
          setNewDomain("");
        }}
        title="Connect New Domain"
      >
        <form onSubmit={handleConnectDomain} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-black text-secondary-400 uppercase tracking-widest ml-1">
              Domain Name
            </label>
            <div className="relative group">
              <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-300 group-focus-within:text-primary-500 transition-colors" />
              <input
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="portal.myhospital.com"
                className="w-full bg-secondary-50 border-none rounded-2xl pl-12 pr-4 py-4 text-sm focus:ring-2 focus:ring-primary-500/20 transition-all font-bold"
                required
              />
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold flex items-center gap-3">
              <ShieldAlert className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 btn-secondary py-4 rounded-2xl font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addDomainMutation.isPending}
              className="flex-1 btn-primary py-4 rounded-2xl font-bold flex items-center justify-center gap-2"
            >
              {addDomainMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Plus className="h-5 w-5" />
                  Connect
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Success Modal */}
      <Modal
        isOpen={isSuccessModalOpen}
        onClose={() => setIsSuccessModalOpen(false)}
        title="Verification Successful"
      >
        <div className="text-center py-6 space-y-6">
          <div className="h-24 w-24 rounded-[2rem] bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/20 animate-bounce-short">
            <CheckCircle2 className="h-12 w-12" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-secondary-900 tracking-tight">Domain Verified!</h3>
            <p className="text-sm text-secondary-500 font-medium px-4">
              Your custom domain has been successfully connected and verified. SSL propagation will begin automatically.
            </p>
          </div>
          <button
            onClick={() => setIsSuccessModalOpen(false)}
            className="w-full btn-primary py-4 rounded-2xl font-bold text-sm shadow-xl shadow-primary-500/10"
          >
            Complete
          </button>
        </div>
      </Modal>
    </div>
  );
}
