import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Crown,
  Minus,
  ReceiptText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { format, isValid } from "date-fns";
import {
  DxPage,
  DxPageHeader,
  DxPanel,
  DxBadge,
  DxButton,
  DxGrid,
  DxSegmented,
  DxPopup,
  DxMessage,
  type DxGridColumn,
  type DxBadgeTone,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { useMySaaSInvoices } from "../hooks/use-saas-billing";
import type { SaaSInvoice } from "../api/saas-billing.api";
import {
  annualSavings,
  formatPlanPrice,
  formatSavings,
  planAmount,
  subscriptionPlanApi,
  type BillingInterval,
  type PlanCatalogEntry,
} from "../api/subscription-plan.api";
import { PaySubscriptionModal } from "../components/PaySubscriptionModal";

const MODULE_LABELS: Record<string, string> = {
  clinical: "Clinical & Consultations",
  inpatient: "Inpatient & Admissions",
  laboratory: "Laboratory",
  pharmacy: "Pharmacy",
  radiology: "Radiology",
  billing: "Billing & Payments",
  insurance: "Insurance Claims",
  inventory: "Inventory & Procurement",
  hr: "HR & Payroll",
  appointments: "Appointments & Calendar",
  ambulance: "Ambulance Fleet",
  compliance: "Compliance",
  reporting: "Advanced Reporting",
  dietary: "Dietary & Meals",
  surgical: "Surgical Theatre",
  patient_portal: "Patient Portal",
};

function money(v: string | number | null | undefined, currency = "NGN"): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

function safeDate(v: string | null | undefined, pattern = "MMM d, yyyy"): string {
  if (!v) return "—";
  const d = new Date(v);
  return isValid(d) ? format(d, pattern) : "—";
}

function formatMoney(value: number | string | null | undefined, currency?: string | null): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency || "NGN"} ${n.toLocaleString()}`;
  }
}

function invoiceTone(status: string): DxBadgeTone {
  if (status === "PAID") return "success";
  if (status === "OVERDUE") return "danger";
  return "warning";
}

export function PlanBillingPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [upgradeTarget, setUpgradeTarget] = useState<PlanCatalogEntry | null>(null);
  const [payTarget, setPayTarget] = useState<PlanCatalogEntry | null>(null);
  // Billing cycle the tenant is choosing for a new/changed subscription.
  const [interval, setBillingInterval] = useState<BillingInterval>("MONTHLY");

  const plansQuery = useQuery({
    queryKey: ["subscription", "plans"],
    queryFn: subscriptionPlanApi.listPlans,
    staleTime: 10 * 60 * 1000,
  });
  const subQuery = useQuery({
    queryKey: ["subscription", "me"],
    queryFn: subscriptionPlanApi.getMySubscription,
  });
  const invoicesQuery = useMySaaSInvoices();

  const refreshSub = () => {
    queryClient.invalidateQueries({ queryKey: ["subscription"] });
    queryClient.invalidateQueries({ queryKey: ["tenant-modules", "me"] });
  };

  const changePlan = useMutation({
    mutationFn: (vars: { code: string; interval: BillingInterval }) =>
      subscriptionPlanApi.changeMyPlan(vars.code, vars.interval),
    onSuccess: (res) => {
      if (res.direction === "downgrade") {
        toast.success("Downgrade scheduled", res.message);
      } else if (res.direction === "upgrade") {
        const amt = Number(res.amount_due ?? 0);
        toast.success(
          "Plan upgraded",
          amt > 0
            ? `${res.message} Amount due now: ${res.currency || "NGN"} ${amt.toLocaleString()}.`
            : res.message,
        );
      } else {
        toast.success("Plan updated", res.message);
      }
      setUpgradeTarget(null);
      refreshSub();
    },
    onError: (err: any) => {
      toast.error("Plan change failed", err?.response?.data?.message || "Please try again.");
    },
  });

  const startTrial = useMutation({
    mutationFn: (vars: { code: string; interval: BillingInterval }) =>
      subscriptionPlanApi.startTrial(vars.code, vars.interval),
    onSuccess: (res) => {
      toast.success("Trial started", res.message);
      refreshSub();
    },
    onError: (err: any) => {
      toast.error("Couldn't start trial", err?.response?.data?.message || "You may have already used this trial.");
    },
  });

  const plans = plansQuery.data ?? [];
  const currentPlan = subQuery.data?.plan ?? null;
  const currentPrice = currentPlan ? Number(currentPlan.price) : -1;
  const currentInterval = (String(subQuery.data?.billing_interval || "MONTHLY").toUpperCase() === "YEARLY"
    ? "YEARLY"
    : "MONTHLY") as BillingInterval;
  const subStatus = String(subQuery.data?.status ?? "").toUpperCase();
  const isTrialing = subStatus === "TRIALING";
  const trialEnds = subQuery.data?.trial_end_date ?? subQuery.data?.current_period_end;
  const currentPeriodEnd = subQuery.data?.current_period_end;

  // Effective (interval-aware) prices decide whether a pick is an upgrade or
  // a downgrade, so the confirm dialog explains the right billing behaviour.
  const currentEffective = currentPlan ? planAmount(currentPlan, currentInterval) : -1;
  const targetEffective = upgradeTarget ? planAmount(upgradeTarget, interval) : 0;
  const changeIsDowngrade = !!upgradeTarget && currentEffective >= 0 && targetEffective < currentEffective;
  const changeIsUpgrade = !!upgradeTarget && targetEffective > currentEffective;

  // Billing state derived from the enriched /me/subscription payload.
  const amountDue = Number(subQuery.data?.amount_due ?? 0);
  const hasPendingPayment = !!subQuery.data?.has_pending_payment;
  const currentPeriodPaid = !!subQuery.data?.current_period_paid;
  // Something to pay when a positive balance is owed and nothing is under review.
  const paymentDue = !isTrialing && amountDue > 0 && !hasPendingPayment;
  // Show a settled state once paid (and not trialing / not awaiting review).
  const isSettled = !isTrialing && !hasPendingPayment && currentPeriodPaid && amountDue <= 0;

  const allModuleCodes = useMemo(() => {
    const set = new Set<string>();
    plans.forEach((p) => Object.keys(p.modules ?? {}).forEach((c) => set.add(c)));
    return [...set].filter((c) => MODULE_LABELS[c]).sort((a, b) => MODULE_LABELS[a].localeCompare(MODULE_LABELS[b]));
  }, [plans]);

  const invoiceColumns: DxGridColumn<SaaSInvoice>[] = [
    {
      key: "number",
      header: "Invoice",
      render: (inv) => <span className="dx-mono text-[12px]">{(inv as any).invoice_number || `INV-${inv.id}`}</span>,
    },
    {
      key: "period",
      header: "Period",
      render: (inv) => (
        <span className="text-[12px] font-medium text-[var(--dx-text-muted)]">
          {safeDate((inv as any).period_start)} — {safeDate((inv as any).period_end)}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (inv) => <span className="dx-mono text-[12px]">{money((inv as any).total_amount ?? (inv as any).amount)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (inv) => {
        const st = String((inv as any).status || "").toUpperCase();
        return <DxBadge tone={invoiceTone(st)} dot>{st || "—"}</DxBadge>;
      },
    },
    {
      key: "due",
      header: "Due",
      render: (inv) => <span className="text-[12px] text-[var(--dx-text-muted)]">{safeDate((inv as any).due_date)}</span>,
    },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Settings" }, { label: "Plan & Billing" }]}
        title="Plan & Billing"
        subtitle="Your hospital's subscription, module access and invoices — upgrade any time."
      />

      {/* Current subscription */}
      <DxPanel>
        {subQuery.isLoading ? (
          <div className="space-y-3">
            <div className="dx-skeleton h-6 w-40" />
            <div className="dx-skeleton h-4 w-72" />
          </div>
        ) : currentPlan ? (
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[var(--dx-accent-soft)] text-[var(--dx-accent)]">
                <Crown className="h-7 w-7" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-[22px] font-bold text-[var(--dx-text)]">{currentPlan.name}</h3>
                  {hasPendingPayment ? (
                    <DxBadge tone="info" dot>Payment under review</DxBadge>
                  ) : paymentDue ? (
                    <DxBadge tone="danger" dot>Payment due</DxBadge>
                  ) : isSettled ? (
                    <DxBadge tone="success" dot>Paid</DxBadge>
                  ) : (
                    <DxBadge tone={isTrialing ? "info" : "success"} dot>{subStatus || "ACTIVE"}</DxBadge>
                  )}
                </div>
                <p className="mt-1 text-[13px] font-medium text-[var(--dx-text-muted)]">
                  {formatPlanPrice(currentPlan, currentInterval)} ·{" "}
                  <span className="font-bold text-[var(--dx-text)]">{currentInterval === "YEARLY" ? "Annual" : "Monthly"}</span> ·
                  since {safeDate(subQuery.data?.start_date)} ·{" "}
                  {Object.values(currentPlan.modules ?? {}).filter(Boolean).length} modules included
                </p>
                {isTrialing ? (
                  <p className="mt-1.5 text-[12px] font-semibold" style={{ color: "var(--dx-info)" }}>
                    Free trial — ends {safeDate(trialEnds, "MMM d, yyyy")}. Pay before it ends to keep access.
                  </p>
                ) : hasPendingPayment ? (
                  <p className="mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--dx-info)" }}>
                    <Clock className="h-3.5 w-3.5" />
                    Payment received — awaiting confirmation from the platform team.
                  </p>
                ) : paymentDue ? (
                  <p className="mt-1.5 text-[12px] font-semibold" style={{ color: "var(--dx-danger)" }}>
                    {formatMoney(amountDue, subQuery.data?.currency)} due for the current period.
                  </p>
                ) : isSettled ? (
                  <p className="mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--dx-success)" }}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Current period paid{subQuery.data?.current_period_end ? ` — active through ${safeDate(subQuery.data.current_period_end, "MMM d, yyyy")}` : ""}.
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {hasPendingPayment ? (
                <DxBadge tone="info" dot>Under review</DxBadge>
              ) : currentPrice > 0 && (paymentDue || isTrialing) ? (
                <DxButton variant="primary" size="sm" onClick={() => setPayTarget(currentPlan)} leftIcon={<CreditCard className="h-4 w-4" />}>
                  {isTrialing ? "Pay & activate" : "Pay now"}
                </DxButton>
              ) : isSettled ? (
                <DxBadge tone="success" dot>Paid</DxBadge>
              ) : null}
              <div className="hidden items-center gap-2 text-[12px] font-semibold text-[var(--dx-text-muted)] sm:flex">
                <ShieldCheck className="h-4 w-4 text-[var(--dx-accent)]" />
                Changes apply immediately.
              </div>
            </div>
          </div>
        ) : (
          <p className="text-[13px] font-medium text-[var(--dx-text-muted)]">
            No active subscription found — choose a plan below to get started.
          </p>
        )}
      </DxPanel>

      {/* Plan catalog */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-[16px] font-bold text-[var(--dx-text)]">Available plans</h3>
            <p className="mt-0.5 text-[13px] text-[var(--dx-text-muted)]">
              Compare what each plan unlocks. Upgrading is instant; the new modules appear in your menu right away.
            </p>
          </div>
          {/* Billing cycle switch */}
          <DxSegmented<BillingInterval>
            ariaLabel="Billing cycle"
            className="shrink-0"
            items={[
              { key: "MONTHLY", label: "Monthly" },
              {
                key: "YEARLY",
                label: (
                  <span className="flex items-center gap-1.5">
                    Annual
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                      style={{ background: "var(--dx-success-soft)", color: "var(--dx-success)" }}
                    >
                      Save
                    </span>
                  </span>
                ),
              },
            ]}
            value={interval}
            onChange={setBillingInterval}
          />
        </div>
        {plansQuery.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="dx-skeleton h-64 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => {
              const isCurrent = currentPlan?.code === plan.code;
              const isUpgrade = Number(plan.price) > currentPrice;
              const includedCount = Object.values(plan.modules ?? {}).filter(Boolean).length;
              return (
                <div
                  key={plan.code}
                  className="flex flex-col rounded-lg border bg-[var(--dx-surface)] p-6"
                  style={{ borderColor: isCurrent ? "var(--dx-accent)" : "var(--dx-border)" }}
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <h4 className="text-[16px] font-bold text-[var(--dx-text)]">{plan.name}</h4>
                      <p className="mt-1 text-[22px] font-bold text-[var(--dx-accent)]">{formatPlanPrice(plan, interval)}</p>
                      {interval === "YEARLY" && Number(plan.price) > 0 && annualSavings(plan) > 0 ? (
                        <p className="mt-0.5 text-[11px] font-semibold" style={{ color: "var(--dx-success)" }}>
                          Save {formatSavings(plan)}/yr vs monthly
                        </p>
                      ) : null}
                    </div>
                    {isCurrent ? (
                      <DxBadge tone="accent"><BadgeCheck className="mr-1 h-3 w-3" />Current</DxBadge>
                    ) : isUpgrade ? (
                      <DxBadge tone="info"><Sparkles className="mr-1 h-3 w-3" />Upgrade</DxBadge>
                    ) : null}
                  </div>
                  {plan.description ? (
                    <p className="mb-3 text-[12px] font-medium leading-relaxed text-[var(--dx-text-muted)]">{plan.description}</p>
                  ) : null}
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">
                    {includedCount} modules · up to {plan.max_users ?? "∞"} users
                  </p>
                  <ul className="mb-6 flex-1 space-y-1.5">
                    {allModuleCodes.map((code) => {
                      const included = !!plan.modules?.[code];
                      return (
                        <li key={code} className="flex items-center gap-2 text-[12px]">
                          {included ? (
                            <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--dx-success)" }} />
                          ) : (
                            <Minus className="h-3.5 w-3.5 shrink-0 text-[var(--dx-text-faint)]" />
                          )}
                          <span className={included ? "font-semibold text-[var(--dx-text)]" : "text-[var(--dx-text-muted)]"}>
                            {MODULE_LABELS[code]}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  {(() => {
                    const isPaid = Number(plan.price) > 0;
                    if (isCurrent) {
                      return (
                        <DxButton size="sm" className="w-full" disabled leftIcon={<BadgeCheck className="h-4 w-4" />}>
                          Your plan
                        </DxButton>
                      );
                    }
                    if (!isPaid) {
                      // Free / trial plan — switch directly, no payment.
                      return (
                        <DxButton
                          size="sm"
                          className="w-full"
                          disabled={changePlan.isPending}
                          onClick={() => setUpgradeTarget(plan)}
                        >
                          Switch to {plan.name}
                        </DxButton>
                      );
                    }
                    return (
                      <div className="space-y-2">
                        <DxButton
                          variant={isUpgrade ? "primary" : "default"}
                          size="sm"
                          className="w-full"
                          onClick={() => setPayTarget(plan)}
                          leftIcon={<CreditCard className="h-4 w-4" />}
                        >
                          {isUpgrade ? `Subscribe to ${plan.name}` : `Switch to ${plan.name}`}
                        </DxButton>
                        <DxButton
                          variant="text"
                          size="sm"
                          className="w-full"
                          isLoading={startTrial.isPending && startTrial.variables?.code === plan.code}
                          onClick={() => startTrial.mutate({ code: plan.code, interval })}
                          leftIcon={<Sparkles className="h-4 w-4" />}
                        >
                          Start 14-day free trial
                        </DxButton>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Invoices */}
      <DxPanel
        flush
        title="Subscription invoices"
        description="Billing history for your hospital's subscription."
        icon={<ReceiptText className="h-5 w-5 text-[var(--dx-accent)]" />}
      >
        <DxGrid
          columns={invoiceColumns}
          data={(invoicesQuery.data as any)?.items ?? (Array.isArray(invoicesQuery.data) ? (invoicesQuery.data as any) : [])}
          rowKey={(inv) => inv.id}
          isLoading={invoicesQuery.isLoading}
          error={invoicesQuery.error ? "Unable to load invoices." : null}
          onRetry={() => invoicesQuery.refetch()}
          borderless
          empty={{
            icon: CreditCard,
            title: "No invoices yet",
            description: "Invoices appear here as your billing periods close.",
          }}
        />
      </DxPanel>

      {/* Plan change confirm */}
      <DxPopup
        isOpen={!!upgradeTarget}
        onClose={() => setUpgradeTarget(null)}
        title={
          changeIsDowngrade
            ? `Downgrade to ${upgradeTarget?.name}?`
            : changeIsUpgrade
              ? `Upgrade to ${upgradeTarget?.name}?`
              : `Switch to ${upgradeTarget?.name}?`
        }
        size="md"
        locked={changePlan.isPending}
        footer={
          <>
            <DxButton onClick={() => setUpgradeTarget(null)} disabled={changePlan.isPending}>
              Cancel
            </DxButton>
            <DxButton
              variant="primary"
              isLoading={changePlan.isPending}
              onClick={async () => {
                if (!upgradeTarget) return;
                await changePlan.mutateAsync({ code: upgradeTarget.code, interval });
              }}
            >
              {changeIsDowngrade ? "Schedule downgrade" : changeIsUpgrade ? "Upgrade now" : "Switch plan"}
            </DxButton>
          </>
        }
      >
        <DxMessage tone={changeIsDowngrade ? "warning" : "info"}>
          {upgradeTarget
            ? changeIsDowngrade
              ? `Your hospital keeps the current ${currentPlan?.name ?? "plan"} and all its features until the current period ends${currentPeriodEnd ? ` on ${safeDate(currentPeriodEnd)}` : ""}. The ${upgradeTarget.name} plan (${formatPlanPrice(upgradeTarget, interval)}) then takes effect automatically at the next renewal — nothing is charged now.`
              : changeIsUpgrade
                ? `Your hospital moves to the ${upgradeTarget.name} plan (${formatPlanPrice(upgradeTarget, interval)}, billed ${interval === "YEARLY" ? "annually" : "monthly"}) immediately, and newly included modules appear right away. A prorated invoice for the price difference over the days left in your current period is issued now — settle it below to complete the upgrade.`
                : `Your hospital switches to the ${upgradeTarget.name} plan (${formatPlanPrice(upgradeTarget, interval)}, billed ${interval === "YEARLY" ? "annually" : "monthly"}) immediately.`
            : null}
        </DxMessage>
      </DxPopup>

      <PaySubscriptionModal
        isOpen={!!payTarget}
        onClose={() => setPayTarget(null)}
        plan={payTarget}
        interval={payTarget?.code === currentPlan?.code ? currentInterval : interval}
      />
    </DxPage>
  );
}
