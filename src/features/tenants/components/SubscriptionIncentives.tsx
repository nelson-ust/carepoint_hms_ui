import { useEffect, useState } from "react";
import { Gift, Clock, CalendarPlus, History, Sparkles } from "lucide-react";
import {
  extendSubscription,
  grantFreeSubscription,
  listTenantIncentives,
  type SubscriptionPlan,
  type TenantSubscription,
  type TenantIncentive,
} from "../api/tenants.api";
import {
  DxButton,
  DxGroupBox,
  DxInput,
  DxMessage,
  DxPanel,
  DxSelect,
  apiErrorMessage,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";

function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

const TYPE_LABELS: Record<string, string> = {
  SUBSCRIPTION_EXTENSION: "Subscription extension",
  TRIAL_EXTENSION: "Trial extension",
  COMPLIMENTARY_SUBSCRIPTION: "Complimentary subscription",
};

export function SubscriptionIncentives({
  tenantId,
  subscription,
  plans,
  onChanged,
}: {
  tenantId: number | string;
  subscription?: TenantSubscription | null;
  plans: SubscriptionPlan[];
  onChanged: () => void;
}) {
  const toast = useToast();
  const [incentives, setIncentives] = useState<TenantIncentive[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<"extend" | "grant" | null>(null);

  const [extDays, setExtDays] = useState("");
  const [extMonths, setExtMonths] = useState("");
  const [extReason, setExtReason] = useState("");

  const [freeDays, setFreeDays] = useState("");
  const [freeMonths, setFreeMonths] = useState("");
  const [freePlan, setFreePlan] = useState("");
  const [freeReason, setFreeReason] = useState("");

  const loadIncentives = async () => {
    setLoading(true);
    try {
      setIncentives(await listTenantIncentives(tenantId));
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadIncentives();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const isTrial = (subscription?.status || "").toUpperCase() === "TRIALING";
  const isComp = !!subscription?.is_complimentary;
  const trialLeft = isTrial ? daysUntil(subscription?.trial_end_date) : null;
  const compLeft = isComp ? daysUntil(subscription?.current_period_end) : null;

  const submitExtend = async () => {
    const days = Number(extDays) || 0;
    const months = Number(extMonths) || 0;
    if (days <= 0 && months <= 0) return toast.error("Enter days and/or months to extend.");
    setBusy("extend");
    try {
      const r = await extendSubscription(tenantId, { days, months, reason: extReason || undefined });
      toast.success(r.message || "Subscription extended.");
      setExtDays("");
      setExtMonths("");
      setExtReason("");
      await loadIncentives();
      onChanged();
    } catch (e) {
      toast.error(apiErrorMessage(e) || "Failed to extend subscription.");
    } finally {
      setBusy(null);
    }
  };

  const submitGrant = async () => {
    const days = Number(freeDays) || 0;
    const months = Number(freeMonths) || 0;
    if (days <= 0 && months <= 0) return toast.error("Enter days and/or months of free access.");
    setBusy("grant");
    try {
      const r = await grantFreeSubscription(tenantId, {
        days,
        months,
        reason: freeReason || undefined,
        plan_code: freePlan || undefined,
      });
      toast.success(r.message || "Complimentary subscription granted.");
      setFreeDays("");
      setFreeMonths("");
      setFreePlan("");
      setFreeReason("");
      await loadIncentives();
      onChanged();
    } catch (e) {
      toast.error(apiErrorMessage(e) || "Failed to grant free subscription.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <DxPanel title="Subscription incentives" icon={<Gift className="h-4 w-4" />}>
      {(isTrial || isComp) && (
        <DxMessage
          tone={isComp ? "success" : "warning"}
          title={isComp ? "Complimentary access" : "Free trial (all features)"}
          className="mb-4"
        >
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            {isComp
              ? compLeft != null
                ? `${compLeft} day(s) of free access remaining`
                : "Free access active"
              : trialLeft != null
                ? `${trialLeft} day(s) of trial remaining`
                : "Trial active"}
          </span>
        </DxMessage>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <DxGroupBox caption="Extend subscription">
          <p className="text-[11px] text-[var(--dx-text-muted)] mb-3">
            Push the current subscription or trial forward, free of charge.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <DxInput label="Days" type="number" min={0} value={extDays} onChange={(e) => setExtDays(e.target.value)} placeholder="0" />
            <DxInput label="Months" type="number" min={0} value={extMonths} onChange={(e) => setExtMonths(e.target.value)} placeholder="0" />
          </div>
          <DxInput label="Reason (optional)" value={extReason} onChange={(e) => setExtReason(e.target.value)} className="mt-2" />
          <DxButton
            variant="primary"
            className="w-full mt-3"
            leftIcon={<CalendarPlus className="h-4 w-4" />}
            isLoading={busy === "extend"}
            onClick={submitExtend}
          >
            Extend
          </DxButton>
        </DxGroupBox>

        <DxGroupBox caption="Grant free subscription">
          <p className="text-[11px] text-[var(--dx-text-muted)] mb-3">
            Give active, unbilled access for a set period (billing resumes after).
          </p>
          <div className="grid grid-cols-2 gap-2">
            <DxInput label="Days" type="number" min={0} value={freeDays} onChange={(e) => setFreeDays(e.target.value)} placeholder="0" />
            <DxInput label="Months" type="number" min={0} value={freeMonths} onChange={(e) => setFreeMonths(e.target.value)} placeholder="0" />
          </div>
          <DxSelect
            label="Plan"
            className="mt-2"
            value={freePlan}
            onChange={(e) => setFreePlan(e.target.value)}
            options={[
              { value: "", label: "Keep current plan" },
              ...plans.map((p) => ({ value: p.code, label: `${p.name} (${p.code})` })),
            ]}
          />
          <DxInput label="Reason (optional)" value={freeReason} onChange={(e) => setFreeReason(e.target.value)} className="mt-2" />
          <DxButton
            variant="primary"
            className="w-full mt-3"
            leftIcon={<Gift className="h-4 w-4" />}
            isLoading={busy === "grant"}
            onClick={submitGrant}
          >
            Grant free access
          </DxButton>
        </DxGroupBox>
      </div>

      <div className="mt-5">
        <p className="dx-field-label inline-flex items-center gap-1.5 mb-2">
          <History className="h-3.5 w-3.5" /> Incentive history
        </p>
        {loading ? (
          <p className="text-[var(--dx-text-muted)]">Loading…</p>
        ) : incentives.length === 0 ? (
          <p className="text-[var(--dx-text-muted)]">No incentives granted yet.</p>
        ) : (
          <div className="space-y-1.5">
            {incentives.map((i) => (
              <div
                key={i.id}
                className="rounded-[var(--dx-radius)] border border-[var(--dx-border)] bg-[var(--dx-surface-alt)] px-4 py-2.5"
              >
                <p className="font-medium text-[var(--dx-text)]">
                  {TYPE_LABELS[i.incentive_type] ?? i.incentive_type}
                  <span className="ml-2 font-mono text-[11px] text-[var(--dx-text-muted)]">
                    {[i.months ? `${i.months}mo` : "", i.days ? `${i.days}d` : ""].filter(Boolean).join(" ")}
                    {i.plan_code ? ` · ${i.plan_code}` : ""}
                  </span>
                </p>
                {i.reason && <p className="text-[11px] text-[var(--dx-text-muted)] mt-0.5">{i.reason}</p>}
                <p className="text-[11px] text-[var(--dx-text-muted)] mt-0.5 inline-flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  {i.granted_by ? `${i.granted_by} · ` : ""}
                  {i.effective_until ? `until ${new Date(i.effective_until).toLocaleDateString()}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </DxPanel>
  );
}
