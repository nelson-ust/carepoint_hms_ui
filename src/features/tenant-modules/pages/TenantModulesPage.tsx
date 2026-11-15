import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Building2, Eye, Globe, Hash, Layers, RefreshCw } from "lucide-react";
import { listTenants } from "@/features/tenants/api/tenants.api";
import type { Tenant } from "@/features/tenants/api/tenants.api";
import {
  DxBadge,
  DxButton,
  DxMessage,
  DxPage,
  DxPageHeader,
  DxPanel,
  DxSearchBox,
  DxStatusBadge,
  apiErrorMessage,
} from "@/components/dx";
import { routes } from "@/config/routes";
import { TenantModulesManager } from "../components/TenantModulesManager";

export function TenantModulesPage() {
  const navigate = useNavigate();
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
      if (!activeTenantId && (res.tenants?.length ?? 0) > 0) {
        setActiveTenantId(String(res.tenants[0].id));
      }
    } catch (err) {
      setError(apiErrorMessage(err) || "Unable to load tenants.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "SaaS admin" }, { label: "Tenant modules" }]}
        title="Tenant modules"
        subtitle="Toggle product modules per tenant — control what each hospital workspace sees."
        actions={
          <>
            <DxButton leftIcon={<Building2 className="h-4 w-4" />} onClick={() => navigate(routes.tenants)}>
              All tenants
            </DxButton>
            <DxButton leftIcon={<RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />} onClick={load}>
              Refresh
            </DxButton>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-12">
        <DxPanel
          className="lg:col-span-4"
          title="Pick a tenant"
          icon={<Building2 className="h-4 w-4" />}
          actions={<DxBadge tone="neutral">{tenants.length}</DxBadge>}
        >
          <DxSearchBox onSearch={setSearch} placeholder="Search tenants…" className="w-full mb-3" size="sm" />
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 rounded-[var(--dx-radius)] bg-[var(--dx-surface-alt)] animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <DxMessage tone="danger" action={<DxButton onClick={load}>Retry</DxButton>}>
              {error}
            </DxMessage>
          ) : filteredTenants.length === 0 ? (
            <p className="py-6 text-center text-[var(--dx-text-muted)]">
              {tenants.length === 0 ? "No tenants yet." : "No tenants match your search."}
            </p>
          ) : (
            <div className="space-y-1.5 max-h-[560px] overflow-y-auto pr-1">
              {filteredTenants.map((t) => {
                const isActive = String(t.id) === activeTenantId;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTenantId(String(t.id))}
                    className={`w-full text-left p-3 rounded-[var(--dx-radius)] border transition-colors ${
                      isActive
                        ? "border-[var(--dx-accent)] bg-[var(--dx-accent-soft)]"
                        : "border-[var(--dx-border)] bg-[var(--dx-surface)] hover:border-[var(--dx-border-strong)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--dx-text-muted)]">
                        <Hash className="h-2.5 w-2.5" />
                        {t.code}
                      </span>
                      <DxStatusBadge status={t.status} />
                    </div>
                    <p className="font-semibold text-[var(--dx-text)] truncate">{t.name}</p>
                    {t.custom_domain && (
                      <p className="text-[11px] font-mono mt-0.5 truncate inline-flex items-center gap-1 text-[var(--dx-text-muted)]">
                        <Globe className="h-2.5 w-2.5" />
                        {t.custom_domain}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </DxPanel>

        <div className="lg:col-span-8">
          {!activeTenant ? (
            <DxPanel>
              <div className="py-12 text-center">
                <Layers className="h-10 w-10 mx-auto text-[var(--dx-text-muted)] mb-3" />
                <h3 className="font-semibold text-[var(--dx-text)]">Pick a tenant to manage modules</h3>
                <p className="text-[var(--dx-text-muted)] mt-1 max-w-md mx-auto">
                  Select a tenant on the left to view and toggle the modules available in their workspace.
                </p>
              </div>
            </DxPanel>
          ) : (
            <DxPanel
              title={
                <span className="inline-flex items-center gap-2">
                  {activeTenant.name}
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--dx-text-muted)]">
                    <Hash className="h-2.5 w-2.5" />
                    {activeTenant.code}
                  </span>
                  <DxStatusBadge status={activeTenant.status} />
                  {activeTenant.subscriptions?.[0]?.plan?.name && (
                    <DxBadge tone="accent">{activeTenant.subscriptions[0].plan.name}</DxBadge>
                  )}
                </span>
              }
              icon={<Building2 className="h-4 w-4" />}
              actions={
                <DxButton
                  size="sm"
                  variant="text"
                  leftIcon={<Eye className="h-3.5 w-3.5" />}
                  onClick={() => navigate(routes.tenantDetail.replace(":tenantId", String(activeTenant.id)))}
                >
                  View tenant
                </DxButton>
              }
            >
              <TenantModulesManager tenantId={activeTenant.id} showHeader />
            </DxPanel>
          )}
        </div>
      </div>
    </DxPage>
  );
}
