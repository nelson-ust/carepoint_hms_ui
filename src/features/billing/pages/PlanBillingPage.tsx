import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpCircle,
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
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
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
      toast.success("Plan updated", res.message);
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

  const invoiceColumns: DataTableColumn<SaaSInvoice>[] = [
    {
      key: "number",
      header: "Invoice",
      render: (inv) => <span className="data-mono text-xs">{(inv as any).invoice_number || `INV-${inv.id}`}</span>,
    },
    {
      key: "period",
      header: "Period",
      render: (inv) => (
        <span className="text-xs font-medium text-secondary-500">
          {safeDate((inv as any).period_start)} — {safeDate((inv as any).period_end)}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (inv) => <span className="data-mono text-xs">{money((inv as any).total_amount ?? (inv as any).amount)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (inv) => {
        const st = String((inv as any).status || "").toUpperCase();
        const variant = st === "PAID" ? "soft-success" : st === "OVERDUE" ? "soft-danger" : "soft-warning";
        return <Badge variant={variant as any}>{st || "—"}</Badge>;
      },
    },
    { key: "due", header: "Due", render: (inv) => <span className="text-xs text-secondary-500">{safeDate((inv as any).due_date)}</span> },
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <PageHeader
        title="Plan & Billing"
        description="Your hospital's subscription, module access and invoices — upgrade any time."
      />

      {/* Current subscription */}
      <Card variant="panel">
        {subQuery.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-72" />
          </div>
        ) : currentPlan ? (
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-primary-500/10 text-primary-500 shadow-glow-sm">
                <Crown className="h-7 w-7" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="font-display text-2xl font-bold text-secondary-900">{currentPlan.name}</h3>
                  {hasPendingPayment ? (
                    <Badge variant="soft-info">Payment under review</Badge>
                  ) : paymentDue ? (
                    <Badge variant="soft-danger">Payment due</Badge>
                  ) : isSettled ? (
                    <Badge variant="soft-success">Paid</Badge>
                  ) : (
                    <Badge variant={isTrialing ? "soft-info" : "soft-success"}>{subStatus || "ACTIVE"}</Badge>
                  )}
                </div>
                <p className="mt-1 text-sm font-medium text-secondary-500">
                  {formatPlanPrice(currentPlan, currentInterval)} ·{" "}
                  <span className="font-bold text-secondary-600">{currentInterval === "YEARLY" ? "Annual" : "Monthly"}</span> ·
                  since {safeDate(subQuery.data?.start_date)} ·{" "}
                  {Object.values(currentPlan.modules ?? {}).filter(Boolean).length} modules included
                </p>
                {isTrialing ? (
                  <p className="mt-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-300">
                    Free trial — ends {safeDate(trialEnds, "MMM d, yyyy")}. Pay before it ends to keep access.
                  </p>
                ) : hasPendingPayment ? (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-300">
                    <Clock className="h-3.5 w-3.5" />
                    Payment received — awaiting confirmation from the platform team.
                  </p>
                ) : paymentDue ? (
                  <p className="mt-1.5 text-xs font-bold text-rose-600 dark:text-rose-300">
                    {formatMoney(amountDue, subQuery.data?.currency)} due for the current period.
                  </p>
                ) : isSettled ? (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Current period paid{subQuery.data?.current_period_end ? ` — active through ${safeDate(subQuery.data.current_period_end, "MMM d, yyyy")}` : ""}.
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {hasPendingPayment ? (
                <span className="inline-flex items-center gap-2 rounded-xl bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-600 dark:text-cyan-300">
                  <Clock className="h-4 w-4" /> Under review
                </span>
              ) : currentPrice > 0 && (paymentDue || isTrialing) ? (
                <Button size="sm" onClick={() => setPayTarget(currentPlan)} leftIcon={<CreditCard className="h-4 w-4" />}>
                  {isTrialing ? "Pay & activate" : "Pay now"}
                </Button>
              ) : isSettled ? (
                <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" /> Paid
                </span>
              ) : null}
              <div className="hidden items-center gap-2 text-xs font-bold text-secondary-400 sm:flex">
                <ShieldCheck className="h-4 w-4 text-primary-500" />
                Changes apply immediately.
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm font-medium text-secondary-500">
            No active subscription found — choose a plan below to get started.
          </p>
        )}
      </Card>

      {/* Plan catalog */}
      <div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <CardHeader
            title="Available plans"
            description="Compare what each plan unlocks. Upgrading is instant; the new modules appear in your menu right away."
          />
          {/* Billing cycle switch */}
          <div className="inline-flex shrink-0 items-center gap-1 rounded-2xl bg-secondary-100 p-1 dark:bg-white/5">
            <button
              type="button"
              onClick={() => setBillingInterval("MONTHLY")}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                interval === "MONTHLY"
                  ? "bg-white text-primary-600 shadow-sm dark:bg-secondary-900 dark:text-primary-300"
                  : "text-secondary-500"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingInterval("YEARLY")}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                interval === "YEARLY"
                  ? "bg-white text-primary-600 shadow-sm dark:bg-secondary-900 dark:text-primary-300"
                  : "text-secondary-500"
              }`}
            >
              Annual
              <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-600">
                Save
              </span>
            </button>
          </div>
        </div>
        {plansQuery.isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><Skeleton className="h-64 w-full" /></Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => {
              const isCurrent = currentPlan?.code === plan.code;
              const isUpgrade = Number(plan.price) > currentPrice;
              const includedCount = Object.values(plan.modules ?? {}).filter(Boolean).length;
              return (
                <Card
                  key={plan.code}
                  variant="panel"
                  className={isCurrent ? "ring-2 ring-primary-500/40 shadow-glow-sm" : ""}
                >
                  <div className="flex h-full flex-col">
                    <div className="mb-4 flex items-start justify-between">
                      <div>
                        <h4 className="font-display text-lg font-bold text-secondary-900">{plan.name}</h4>
                        <p className="mt-1 font-display text-2xl font-bold text-gradient">{formatPlanPrice(plan, interval)}</p>
                        {interval === "YEARLY" && Number(plan.price) > 0 && annualSavings(plan) > 0 ? (
                          <p className="mt-0.5 text-[11px] font-bold text-emerald-600">Save {formatSavings(plan)}/yr vs monthly</p>
                        ) : null}
                      </div>
                      {isCurrent ? (
                        <Badge variant="default"><BadgeCheck className="mr-1 h-3 w-3" />Current</Badge>
                      ) : isUpgrade ? (
                        <Badge variant="soft-info"><Sparkles className="mr-1 h-3 w-3" />Upgrade</Badge>
                      ) : null}
                    </div>
                    {plan.description ? (
                      <p className="mb-3 text-xs font-medium leading-relaxed text-secondary-500">{plan.description}</p>
                    ) : null}
                    <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-secondary-400">
                      {includedCount} modules · up to {plan.max_users ?? "∞"} users
                    </p>
                    <ul className="mb-6 flex-1 space-y-1.5">
                      {allModuleCodes.map((code) => {
                        const included = !!plan.modules?.[code];
                        return (
                          <li key={code} className="flex items-center gap-2 text-xs">
                            {included ? (
                              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                            ) : (
                              <Minus className="h-3.5 w-3.5 shrink-0 text-secondary-300 dark:text-secondary-600" />
                            )}
                            <span className={included ? "font-semibold text-secondary-700" : "text-secondary-400"}>
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
                          <Button variant="secondary" size="sm" className="w-full" disabled leftIcon={<BadgeCheck className="h-4 w-4" />}>
                            Your plan
                          </Button>
                        );
                      }
                      if (!isPaid) {
                        // Free / trial plan — switch directly, no payment.
                        return (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            disabled={changePlan.isPending}
                            onClick={() => setUpgradeTarget(plan)}
                          >
                            Switch to {plan.name}
                          </Button>
                        );
                      }
                      return (
                        <div className="space-y-2">
                          <Button
                            variant={isUpgrade ? "primary" : "outline"}
                            size="sm"
                            className="w-full"
                            onClick={() => setPayTarget(plan)}
                            leftIcon={<CreditCard className="h-4 w-4" />}
                          >
                            {isUpgrade ? `Subscribe to ${plan.name}` : `Switch to ${plan.name}`}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full"
                            isLoading={startTrial.isPending && startTrial.variables?.code === plan.code}
                            onClick={() => startTrial.mutate({ code: plan.code, interval })}
                            leftIcon={<Sparkles className="h-4 w-4" />}
                          >
                            Start 14-day free trial
                          </Button>
                        </div>
                      );
                    })()}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Invoices */}
      <Card padding="none">
        <div className="flex items-center gap-3 px-6 pt-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-500">
            <ReceiptText className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-display font-bold text-secondary-900">Subscription invoices</h3>
            <p className="text-sm font-medium text-secondary-500">Billing history for your hospital's subscription.</p>
          </div>
        </div>
        <div className="mt-4">
          <DataTable
            columns={invoiceColumns}
            data={(invoicesQuery.data as any)?.items ?? (Array.isArray(invoicesQuery.data) ? (invoicesQuery.data as any) : [])}
            rowKey={(inv) => inv.id}
            isLoading={invoicesQuery.isLoading}
            error={invoicesQuery.error ? "Unable to load invoices." : null}
            onRetry={() => invoicesQuery.refetch()}
            empty={{
              icon: CreditCard,
              title: "No invoices yet",
              description: "Invoices appear here as your billing periods close.",
            }}
          />
        </div>
      </Card>

      <ConfirmDialog
        isOpen={!!upgradeTarget}
        onClose={() => setUpgradeTarget(null)}
        title={
          upgradeTarget && Number(upgradeTarget.price) >= currentPrice
            ? `Upgrade to ${upgradeTarget?.name}?`
            : `Switch to ${upgradeTarget?.name}?`
        }
        tone="primary"
        confirmLabel={upgradeTarget && Number(upgradeTarget.price) >= currentPrice ? "Upgrade now" : "Switch plan"}
        description={
          upgradeTarget
            ? `Your hospital moves to the ${upgradeTarget.name} plan (${formatPlanPrice(upgradeTarget, interval)}, billed ${interval === "YEARLY" ? "annually" : "monthly"}) immediately. ` +
              (Number(upgradeTarget.price) < currentPrice
                ? "Downgrading removes access to modules not included in the new plan — pages already open may show a locked screen."
                : "Newly included modules appear in your menu right away.") +
              " Billing for the new period is issued at the next invoice run."
            : undefined
        }
        onConfirm={async () => {
          if (!upgradeTarget) return;
          await changePlan.mutateAsync({ code: upgradeTarget.code, interval });
        }}
      />

      <PaySubscriptionModal
        isOpen={!!payTarget}
        onClose={() => setPayTarget(null)}
        plan={payTarget}
        interval={payTarget?.code === currentPlan?.code ? currentInterval : interval}
      />
    </div>
  );
}
