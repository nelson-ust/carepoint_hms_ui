import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Building2,
  Globe,
  Hash,
  Info,
  Lock,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import {
  DxBadge,
  DxButton,
  DxGrid,
  DxInput,
  DxMessage,
  DxPage,
  DxPageHeader,
  DxPanel,
  DxPopup,
  DxSearchBox,
  DxStatusBadge,
  apiErrorMessage,
  formatDate,
  type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { useTenantDomains, useVerifyDomain, useAddDomain } from "../hooks/use-domains";
import type { TenantDomain } from "../api/domains.api";
import { listTenants } from "@/features/tenants/api/tenants.api";
import type { Tenant } from "@/features/tenants/api/tenants.api";
import { localStorageService, storageKeys } from "@/lib/storage/local-storage";

const DNS_RECORDS = [
  { label: "A record (@)", value: "76.76.21.21" },
  { label: "CNAME (www)", value: "cname.carepointhms.com" },
];

export function DomainsPage() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTenant = searchParams.get("tenant") ?? "";

  const userJson = localStorageService.get(storageKeys.user);
  const user = userJson ? JSON.parse(userJson) : null;
  const isSaaSAdmin = !user?.tenant_id;

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string>(
    isSaaSAdmin ? initialTenant : String(user?.tenant_id || ""),
  );
  const [isLoadingTenants, setIsLoadingTenants] = useState(isSaaSAdmin);
  const [tenantSearch, setTenantSearch] = useState("");

  const effectiveTenantId = Number(activeTenantId);

  const { data: domains, isLoading, refetch } = useTenantDomains(effectiveTenantId);
  const verifyMutation = useVerifyDomain(effectiveTenantId);
  const addDomainMutation = useAddDomain(effectiveTenantId);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async (domainId: number) => {
    try {
      await verifyMutation.mutateAsync(domainId);
      toast.success("Domain verified — SSL propagation will begin automatically.");
    } catch (err) {
      toast.error(apiErrorMessage(err) || "Verification failed.");
    }
  };

  useEffect(() => {
    if (!isSaaSAdmin) return;
    const loadTenants = async () => {
      setIsLoadingTenants(true);
      try {
        const res = await listTenants({ page: 1, page_size: 200 });
        setTenants(res.tenants ?? []);
        if (!activeTenantId && (res.tenants?.length ?? 0) > 0) {
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

  const handleConnectDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!newDomain) return setError("Please enter a domain name.");
    try {
      await addDomainMutation.mutateAsync(newDomain);
      toast.success(`${newDomain} connected — add the DNS records, then verify.`);
      setIsModalOpen(false);
      setNewDomain("");
    } catch (err) {
      setError(apiErrorMessage(err) || "Failed to add domain. Please try again.");
    }
  };

  const columns: DxGridColumn<TenantDomain>[] = [
    {
      key: "domain_name",
      header: "Domain",
      minWidth: 220,
      render: (d) => (
        <div className="flex items-center gap-2.5">
          <span
            className="h-8 w-8 rounded-[var(--dx-radius)] flex items-center justify-center shrink-0 border border-[var(--dx-border)]"
            style={{
              background: d.is_verified ? "var(--dx-success-soft)" : "var(--dx-surface-alt)",
              color: d.is_verified ? "var(--dx-success)" : "var(--dx-text-muted)",
            }}
          >
            <Globe className="h-4 w-4" />
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="font-medium text-[var(--dx-text)]">{d.domain_name}</span>
            {d.is_primary && <DxBadge tone="accent">Primary</DxBadge>}
          </span>
        </div>
      ),
    },
    {
      key: "is_verified",
      header: "Verification",
      width: 150,
      accessor: (d) => (d.is_verified ? "verified" : "pending"),
      render: (d) =>
        d.is_verified ? (
          <DxBadge tone="success" dot>
            <ShieldCheck className="h-3 w-3" />
            Verified
          </DxBadge>
        ) : (
          <DxBadge tone="warning" dot>
            <ShieldAlert className="h-3 w-3" />
            Pending
          </DxBadge>
        ),
    },
    {
      key: "ssl_enabled",
      header: "SSL",
      width: 120,
      accessor: (d) => (d.ssl_enabled ? "on" : "off"),
      render: (d) =>
        d.ssl_enabled ? (
          <DxBadge tone="info">
            <Lock className="h-3 w-3" />
            Active
          </DxBadge>
        ) : (
          <DxBadge tone="neutral">
            <Lock className="h-3 w-3" />
            No SSL
          </DxBadge>
        ),
    },
    {
      key: "created_at",
      header: "Added",
      width: 130,
      accessor: (d) => d.created_at,
      render: (d) => <span className="text-[var(--dx-text-muted)]">{formatDate(d.created_at)}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      width: 130,
      render: (d) =>
        d.is_verified ? (
          <span className="text-[var(--dx-text-muted)]">—</span>
        ) : (
          <DxButton
            size="sm"
            variant="primary"
            leftIcon={<ShieldCheck className="h-3.5 w-3.5" />}
            isLoading={verifyMutation.isPending}
            onClick={() => handleVerify(d.id)}
          >
            Verify
          </DxButton>
        ),
    },
  ];

  const domainsPanel = (
    <div className="space-y-4">
      <DxPanel title="DNS configuration" icon={<Info className="h-4 w-4" />}>
        <p className="text-[var(--dx-text-muted)] mb-3">
          Point the custom domain at CarePoint, then verify to issue SSL.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {DNS_RECORDS.map((r) => (
            <div key={r.label} className="rounded-[var(--dx-radius)] border border-[var(--dx-border)] bg-[var(--dx-surface-alt)] p-3">
              <p className="dx-field-label mb-1">{r.label}</p>
              <code className="block font-mono text-[12px] text-[var(--dx-text)] break-all">{r.value}</code>
            </div>
          ))}
        </div>
      </DxPanel>

      <DxPanel
        title="Custom domains"
        icon={<Globe className="h-4 w-4" />}
        flush
        actions={
          <DxButton
            size="sm"
            variant="text"
            leftIcon={<RefreshCw className={isLoading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />}
            onClick={() => refetch()}
          >
            Refresh
          </DxButton>
        }
      >
        <DxGrid
          borderless
          columns={columns}
          data={domains ?? []}
          rowKey={(d) => d.id}
          isLoading={isLoading}
          empty={{
            icon: Globe,
            title: "No custom domains",
            description: "Link a custom domain to give this hospital its own white-label portal.",
            action: (
              <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setIsModalOpen(true)}>
                Connect domain
              </DxButton>
            ),
          }}
        />
      </DxPanel>
    </div>
  );

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "SaaS admin" }, { label: "Domains" }]}
        title="Domain management"
        subtitle="Configure custom white-label domains and SSL for hospital portals."
        actions={
          effectiveTenantId > 0 ? (
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setIsModalOpen(true)}>
              Connect domain
            </DxButton>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-12">
        {isSaaSAdmin && (
          <DxPanel className="lg:col-span-4" title="Pick a tenant" icon={<Building2 className="h-4 w-4" />}>
            <DxSearchBox
              defaultValue={tenantSearch}
              onSearch={setTenantSearch}
              placeholder="Search tenants…"
              className="w-full mb-3"
              size="sm"
            />
            {isLoadingTenants ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 rounded-[var(--dx-radius)] bg-[var(--dx-surface-alt)] animate-pulse" />
                ))}
              </div>
            ) : filteredTenants.length === 0 ? (
              <p className="py-6 text-center text-[var(--dx-text-muted)]">No tenants match your search.</p>
            ) : (
              <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
                {filteredTenants.map((t) => {
                  const active = String(t.id) === activeTenantId;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTenantId(String(t.id))}
                      className={`w-full text-left p-3 rounded-[var(--dx-radius)] border transition-colors ${
                        active
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
                    </button>
                  );
                })}
              </div>
            )}
          </DxPanel>
        )}

        <div className={isSaaSAdmin ? "lg:col-span-8" : "lg:col-span-12"}>
          {effectiveTenantId === 0 ? (
            <DxPanel>
              <div className="py-12 text-center">
                <Building2 className="h-10 w-10 mx-auto text-[var(--dx-text-muted)] mb-3" />
                <h3 className="font-semibold text-[var(--dx-text)]">No tenant selected</h3>
                <p className="text-[var(--dx-text-muted)] mt-1 max-w-xs mx-auto">
                  Select a tenant on the left to manage their custom domains.
                </p>
              </div>
            </DxPanel>
          ) : (
            domainsPanel
          )}
        </div>
      </div>

      {/* Connect domain */}
      <DxPopup
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setError(null);
          setNewDomain("");
        }}
        title="Connect new domain"
        size="md"
        footer={
          <>
            <DxButton type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </DxButton>
            <DxButton
              type="submit"
              form="connect-domain-form"
              variant="primary"
              leftIcon={<Plus className="h-4 w-4" />}
              isLoading={addDomainMutation.isPending}
            >
              Connect
            </DxButton>
          </>
        }
      >
        <form id="connect-domain-form" onSubmit={handleConnectDomain}>
          <DxInput
            label="Domain name"
            required
            leftIcon={<Globe className="h-4 w-4" />}
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="portal.myhospital.com"
          />
          {error && (
            <DxMessage tone="danger" className="mt-3">
              {error}
            </DxMessage>
          )}
        </form>
      </DxPopup>
    </DxPage>
  );
}
