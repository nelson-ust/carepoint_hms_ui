import { useEffect, useMemo, useState } from "react";
import { Crown, Gift, Hash, Megaphone, RefreshCw, RotateCcw, Users } from "lucide-react";
import {
  DxBadge,
  DxButton,
  DxCheckbox,
  DxForm,
  DxInput,
  DxKpi,
  DxMessage,
  DxPage,
  DxPageHeader,
  DxPanel,
  DxPopup,
  DxSearchBox,
  DxSegmented,
  DxSelect,
  DxTextarea,
  apiErrorMessage,
  formatDate,
  type DxBadgeTone,
  DxGrid,
  type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import {
  listPlanCampaigns,
  createPlanCampaign,
  revertPlanCampaign,
  type PlanCampaign,
} from "../api/plan-campaigns.api";
import { listPlansAdmin } from "../api/subscription-plans.api";
import type { SubscriptionPlan } from "../api/subscription-plans.api";
import { listTenants } from "@/features/tenants/api/tenants.api";
import type { Tenant } from "@/features/tenants/api/tenants.api";

const STATUS_TONE: Record<string, DxBadgeTone> = {
  ACTIVE: "success",
  REVERTED: "neutral",
  CANCELLED: "danger",
};

type Mode = "tenants" | "plan";

export function PlanCampaignsPage() {
  const toast = useToast();

  const [campaigns, setCampaigns] = useState<PlanCampaign[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revertingId, setRevertingId] = useState<number | null>(null);

  // Launch form
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [targetPlan, setTargetPlan] = useState("");
  const [mode, setMode] = useState<Mode>("tenants");
  const [fromPlan, setFromPlan] = useState("");
  const [tenantIds, setTenantIds] = useState<number[]>([]);
  const [tenantSearch, setTenantSearch] = useState("");
  const [days, setDays] = useState("0");
  const [months, setMonths] = useState("1");
  const [message, setMessage] = useState("");

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [camps, planList] = await Promise.all([listPlanCampaigns(), listPlansAdmin(false)]);
      setCampaigns(camps);
      setPlans(planList);
    } catch (err) {
      setError(apiErrorMessage(err) || "Unable to load campaigns.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openLaunch = async () => {
    setName("");
    setTargetPlan("");
    setMode("tenants");
    setFromPlan("");
    setTenantIds([]);
    setTenantSearch("");
    setDays("0");
    setMonths("1");
    setMessage("");
    setFormError(null);
    setOpen(true);
    if (tenants.length === 0) {
      try {
        const res = await listTenants({ page: 1, page_size: 200 });
        setTenants(res.tenants ?? []);
      } catch {
        /* non-fatal; the from-plan mode still works */
      }
    }
  };

  const activePlans = useMemo(() => plans.filter((p) => p.is_active), [plans]);

  const filteredTenants = useMemo(() => {
    const q = tenantSearch.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter(
      (t) => t.name?.toLowerCase().includes(q) || t.code?.toLowerCase().includes(q),
    );
  }, [tenants, tenantSearch]);

  const toggleTenant = (id: number) =>
    setTenantIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = async () => {
    setFormError(null);
    if (!name.trim()) return setFormError("Give the campaign a name.");
    if (!targetPlan) return setFormError("Choose the target (higher) plan.");
    const d = Number(days) || 0;
    const m = Number(months) || 0;
    if (d <= 0 && m <= 0) return setFormError("Set a promo window (days and/or months).");
    if (mode === "tenants" && tenantIds.length === 0)
      return setFormError("Select at least one tenant.");
    if (mode === "plan" && !fromPlan) return setFormError("Choose the plan to move tenants from.");
    if (mode === "plan" && fromPlan === targetPlan)
      return setFormError("The source and target plans must differ.");

    setSaving(true);
    try {
      const res = await createPlanCampaign({
        name: name.trim(),
        target_plan_code: targetPlan,
        days: d,
        months: m,
        message: message.trim() || undefined,
        tenant_ids: mode === "tenants" ? tenantIds : undefined,
        from_plan_code: mode === "plan" ? fromPlan : undefined,
      });
      toast.success(res.message || "Campaign launched.");
      setOpen(false);
      await load();
    } catch (err) {
      setFormError(apiErrorMessage(err) || "Failed to launch the campaign.");
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = async (c: PlanCampaign) => {
    setRevertingId(c.id);
    try {
      await revertPlanCampaign(c.id);
      toast.success(`${c.name} reverted — tenants restored to their original plans.`);
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err) || "Failed to revert campaign.");
    } finally {
      setRevertingId(null);
    }
  };

  const stats = useMemo(() => {
    const active = campaigns.filter((c) => c.status === "ACTIVE");
    const upgraded = active.reduce((s, c) => s + (c.tenant_count || 0), 0);
    return { active: active.length, upgraded, total: campaigns.length };
  }, [campaigns]);

  const columns: DxGridColumn<PlanCampaign>[] = [
    {
      key: "name",
      header: "Campaign",
      minWidth: 200,
      render: (c) => (
        <div>
          <p className="font-medium text-[var(--dx-text)]">{c.name}</p>
          {c.created_by && <p className="text-[11px] text-[var(--dx-text-muted)]">by {c.created_by}</p>}
        </div>
      ),
    },
    {
      key: "target",
      header: "Upgraded to",
      width: 160,
      render: (c) => (
        <DxBadge tone="accent">
          <Crown className="h-3 w-3" />
          {c.target_plan_name ?? `Plan #${c.target_plan_id}`}
        </DxBadge>
      ),
    },
    {
      key: "tenants",
      header: "Tenants",
      width: 100,
      align: "right",
      accessor: (c) => c.tenant_count,
      render: (c) => <span className="font-mono text-[var(--dx-text)]">{c.tenant_count}</span>,
    },
    {
      key: "window",
      header: "Window",
      minWidth: 180,
      render: (c) => (
        <span className="text-[var(--dx-text-muted)]">
          {formatDate(c.starts_at)} → {formatDate(c.ends_at)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 120,
      accessor: (c) => c.status,
      render: (c) => (
        <DxBadge tone={STATUS_TONE[c.status] ?? "neutral"} dot>
          {c.status === "ACTIVE" ? "Active" : c.status === "REVERTED" ? "Reverted" : "Cancelled"}
        </DxBadge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      width: 130,
      render: (c) =>
        c.status === "ACTIVE" ? (
          <DxButton
            size="sm"
            variant="outline-danger"
            leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
            isLoading={revertingId === c.id}
            onClick={() => handleRevert(c)}
          >
            Revert
          </DxButton>
        ) : (
          <span className="text-[var(--dx-text-muted)]">—</span>
        ),
    },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "SaaS admin" }, { label: "Plan campaigns" }]}
        title="Plan campaigns"
        subtitle="Temporarily move tenants to a higher plan — a promotional open window. Tenants are notified and auto-revert when it ends."
        actions={
          <>
            <DxButton leftIcon={<RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />} onClick={load}>
              Refresh
            </DxButton>
            <DxButton variant="primary" leftIcon={<Megaphone className="h-4 w-4" />} onClick={openLaunch}>
              Launch campaign
            </DxButton>
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <DxKpi label="Active campaigns" value={stats.active} icon={Megaphone} tone="success" isLoading={isLoading} />
        <DxKpi label="Tenants upgraded" value={stats.upgraded} icon={Users} tone="accent" isLoading={isLoading} />
        <DxKpi label="Total campaigns" value={stats.total} icon={Gift} tone="info" isLoading={isLoading} />
      </div>

      <DxPanel title="Campaigns" icon={<Gift className="h-4 w-4" />} flush>
        <DxGrid
          borderless
          columns={columns}
          data={campaigns}
          rowKey={(c) => c.id}
          isLoading={isLoading}
          error={error}
          onRetry={load}
          empty={{
            icon: Megaphone,
            title: "No campaigns yet",
            description: "Launch a promotional open window to upgrade tenants to a higher plan.",
            action: (
              <DxButton variant="primary" leftIcon={<Megaphone className="h-4 w-4" />} onClick={openLaunch}>
                Launch campaign
              </DxButton>
            ),
          }}
        />
      </DxPanel>

      {/* Launch */}
      <DxPopup
        isOpen={open}
        onClose={() => !saving && setOpen(false)}
        title="Launch plan campaign"
        size="lg"
        footer={
          <>
            <DxButton onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </DxButton>
            <DxButton variant="primary" leftIcon={<Megaphone className="h-4 w-4" />} isLoading={saving} onClick={submit}>
              Launch & notify
            </DxButton>
          </>
        }
      >
        {formError && (
          <DxMessage tone="danger" className="mb-4">
            {formError}
          </DxMessage>
        )}

        <DxForm cols={2}>
          <DxInput
            label="Campaign name"
            required
            fieldClassName="dx-col-span-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Festive season upgrade"
          />
          <DxSelect
            label="Upgrade to plan"
            required
            value={targetPlan}
            onChange={(e) => setTargetPlan(e.target.value)}
            options={[
              { value: "", label: "Select target plan" },
              ...activePlans.map((p) => ({ value: p.code, label: `${p.name} (${p.code})` })),
            ]}
          />
          <div className="flex items-end">
            <div className="w-full">
              <p className="dx-field-label mb-1.5">Who to upgrade</p>
              <DxSegmented
                value={mode}
                onChange={(v) => setMode(v as Mode)}
                items={[
                  { key: "tenants", label: "Pick tenants" },
                  { key: "plan", label: "All on a plan" },
                ]}
              />
            </div>
          </div>
          <DxInput
            label="Window — days"
            type="number"
            min={0}
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
          <DxInput
            label="Window — months"
            type="number"
            min={0}
            value={months}
            onChange={(e) => setMonths(e.target.value)}
          />
          <DxTextarea
            label="Announcement note (optional)"
            fieldClassName="dx-col-span-full"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Added to the email sent to each tenant."
          />
        </DxForm>

        {mode === "plan" ? (
          <div className="mt-2">
            <DxSelect
              label="Move everyone currently on"
              value={fromPlan}
              onChange={(e) => setFromPlan(e.target.value)}
              options={[
                { value: "", label: "Select source plan" },
                ...activePlans.map((p) => ({ value: p.code, label: `${p.name} (${p.code})` })),
              ]}
            />
          </div>
        ) : (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1.5">
              <p className="dx-field-label">Tenants ({tenantIds.length} selected)</p>
            </div>
            <DxSearchBox onSearch={setTenantSearch} placeholder="Search tenants…" className="w-full mb-2" size="sm" />
            <div className="max-h-56 overflow-y-auto rounded-[var(--dx-radius)] border border-[var(--dx-border)] divide-y divide-[var(--dx-border)]">
              {filteredTenants.length === 0 ? (
                <p className="p-3 text-center text-[var(--dx-text-muted)]">No tenants.</p>
              ) : (
                filteredTenants.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[var(--dx-surface-alt)]"
                  >
                    <DxCheckbox
                      label={
                        <span className="inline-flex items-center gap-2">
                          {t.name}
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--dx-text-muted)]">
                            <Hash className="h-2.5 w-2.5" />
                            {t.code}
                          </span>
                        </span>
                      }
                      checked={tenantIds.includes(t.id)}
                      onChange={() => toggleTenant(t.id)}
                    />
                  </label>
                ))
              )}
            </div>
          </div>
        )}
      </DxPopup>
    </DxPage>
  );
}
