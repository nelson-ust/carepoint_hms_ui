import { apiClient } from "@/lib/api/api-client";

// Mirrors the tenant self-service endpoints in
// app/api/v1/endpoints/subscription_billing_routes.py

export type BillingInterval = "MONTHLY" | "YEARLY";

export type PlanCatalogEntry = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  price: string | number;
  /** Effective yearly price (explicit annual price, or 12x monthly). */
  annual_price?: string | number;
  /** Amount saved per year by paying annually vs. monthly. */
  annual_savings?: string | number;
  currency: string;
  interval: string;
  trial_days: number;
  max_facilities?: number | null;
  max_branches?: number | null;
  max_users?: number | null;
  max_patients?: number | null;
  /** module code → included on this plan */
  modules: Record<string, boolean>;
};

export type MySubscription = {
  plan?: PlanCatalogEntry | null;
  status?: string | null;
  billing_interval?: BillingInterval | string | null;
  start_date?: string | null;
  end_date?: string | null;
  trial_end_date?: string | null;
  current_period_end?: string | null;
  auto_renew?: boolean | null;
  // Billing state so the UI can show paid / due / under-review.
  current_period_paid?: boolean | null;
  amount_due?: number | string | null;
  has_pending_payment?: boolean | null;
  latest_invoice_status?: string | null;
  currency?: string | null;
};

export type ChangePlanResponse = {
  success: boolean;
  message: string;
  plan_code: string;
  status: string;
  start_date?: string | null;
};

export type StartTrialResponse = {
  success: boolean;
  message: string;
  plan_code: string;
  status: string;
  trial_end_date?: string | null;
  trial_days: number;
};

export type FlutterwaveCheckoutResponse = {
  success: boolean;
  message: string;
  payment_link?: string | null;
  tx_ref?: string;
  invoice_id?: number;
  amount?: number;
  currency?: string;
};

/** Response from the gateway-agnostic subscription checkout. */
export type CheckoutResponse = {
  success: boolean;
  message: string;
  gateway?: "flutterwave" | "paystack" | string;
  payment_link?: string | null;
  reference?: string;
  invoice_id?: number;
  amount?: number;
  currency?: string;
};

/** The platform-configured subscription payment gateway. */
export type SubscriptionPaymentConfig = {
  gateway: "flutterwave" | "paystack" | string;
  configured: boolean;
  public_key?: string | null;
  manual_enabled: boolean;
};

export type SubscriptionPayment = {
  id: number;
  invoice_id: number;
  tenant_id: number;
  tenant_name?: string | null;
  amount: string | number;
  currency: string;
  payment_method: string;
  provider?: string | null;
  status: string;
  transaction_reference?: string | null;
  payer_bank_name?: string | null;
  payer_account_name?: string | null;
  payer_reference?: string | null;
  proof_file_name?: string | null;
  has_proof: boolean;
  notes?: string | null;
  rejected_reason?: string | null;
  confirmed_at?: string | null;
  paid_at?: string | null;
  receipt_number?: string | null;
};

export const subscriptionPlanApi = {
  listPlans: () =>
    apiClient
      .get<PlanCatalogEntry[]>("/subscription-billing/plans")
      .then((res) => (Array.isArray(res.data) ? res.data : [])),

  getMySubscription: () =>
    apiClient
      .get<MySubscription>("/subscription-billing/me/subscription")
      .then((res) => res.data ?? {}),

  changeMyPlan: (planCode: string, billingInterval: BillingInterval = "MONTHLY") =>
    apiClient
      .post<ChangePlanResponse>("/subscription-billing/me/change-plan", {
        plan_code: planCode,
        billing_interval: billingInterval,
      })
      .then((res) => res.data),

  // ----- Trial -----
  startTrial: (planCode: string, billingInterval: BillingInterval = "MONTHLY") =>
    apiClient
      .post<StartTrialResponse>("/subscription-billing/me/start-trial", {
        plan_code: planCode,
        billing_interval: billingInterval,
      })
      .then((res) => res.data),

  // ----- Online checkout via the platform-configured gateway -----
  getPaymentConfig: () =>
    apiClient
      .get<SubscriptionPaymentConfig>("/subscription-billing/me/payment-config")
      .then((res) => res.data),

  /** Gateway-agnostic checkout — the backend picks flutterwave/paystack. */
  startCheckout: (planCode?: string, billingInterval: BillingInterval = "MONTHLY") =>
    apiClient
      .post<CheckoutResponse>("/subscription-billing/me/checkout", {
        plan_code: planCode,
        billing_interval: billingInterval,
      })
      .then((res) => res.data),

  /** @deprecated Use startCheckout — kept for backward compatibility. */
  flutterwaveCheckout: (planCode?: string, billingInterval: BillingInterval = "MONTHLY") =>
    apiClient
      .post<FlutterwaveCheckoutResponse>("/subscription-billing/me/checkout/flutterwave", {
        plan_code: planCode,
        billing_interval: billingInterval,
      })
      .then((res) => res.data),

  verifyCheckout: (params: {
    tx_ref?: string;
    transaction_id?: string;
    reference?: string;
    gateway?: string;
    invoice_id?: number;
  }) =>
    apiClient
      .get<{ success: boolean; message: string; status?: string; payment_id?: number }>(
        "/subscription-billing/me/checkout/verify",
        { params },
      )
      .then((res) => res.data),

  // ----- Manual bank payment with proof upload -----
  submitManualPayment: (form: FormData) =>
    apiClient
      .post<{ success: boolean; message: string; payment_id: number; invoice_id: number; status: string }>(
        "/subscription-billing/me/manual-payment",
        form,
        { headers: { "Content-Type": "multipart/form-data" } },
      )
      .then((res) => res.data),

  // ----- SaaS admin: review queue -----
  listPendingPayments: () =>
    apiClient
      .get<SubscriptionPayment[]>("/subscription-billing/payments/pending")
      .then((res) => (Array.isArray(res.data) ? res.data : [])),

  // ----- SaaS admin: payment lookup (defaults to confirmed/SUCCEEDED) -----
  listPayments: (params: { payment_status?: string; search?: string; limit?: number } = {}) =>
    apiClient
      .get<SubscriptionPayment[]>("/subscription-billing/payments", { params })
      .then((res) => (Array.isArray(res.data) ? res.data : [])),

  confirmPayment: (paymentId: number) =>
    apiClient
      .post<{ success: boolean; message: string }>(`/subscription-billing/payments/${paymentId}/confirm`)
      .then((res) => res.data),

  rejectPayment: (paymentId: number, reason?: string) =>
    apiClient
      .post<{ success: boolean; message: string }>(`/subscription-billing/payments/${paymentId}/reject`, {
        reason,
      })
      .then((res) => res.data),

  proofDownloadUrl: (paymentId: number) =>
    `${apiClient.defaults.baseURL}/subscription-billing/payments/${paymentId}/proof`,
};

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: currency || "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Price for a plan at a given billing cycle, e.g. "₦50,000/mo" or "₦540,000/yr". */
export function formatPlanPrice(
  plan: PlanCatalogEntry,
  interval: BillingInterval = "MONTHLY",
): string {
  const amount = interval === "YEARLY" ? annualAmount(plan) : Number(plan.price);
  if (!Number.isFinite(amount)) return String(plan.price);
  if (amount === 0) return "Free";
  return `${formatMoney(amount, plan.currency)}/${interval === "YEARLY" ? "yr" : "mo"}`;
}

/** The amount charged for one billing period at the given cycle. */
export function planAmount(plan: PlanCatalogEntry, interval: BillingInterval): number {
  return interval === "YEARLY" ? annualAmount(plan) : Number(plan.price) || 0;
}

/** Effective annual amount: explicit annual_price, or 12x monthly. */
export function annualAmount(plan: PlanCatalogEntry): number {
  const explicit = Number(plan.annual_price);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  return (Number(plan.price) || 0) * 12;
}

/** How much a tenant saves per year by paying annually (0 if none). */
export function annualSavings(plan: PlanCatalogEntry): number {
  const declared = Number(plan.annual_savings);
  if (Number.isFinite(declared) && declared > 0) return declared;
  const saved = (Number(plan.price) || 0) * 12 - annualAmount(plan);
  return saved > 0 ? saved : 0;
}

export function formatSavings(plan: PlanCatalogEntry): string {
  return formatMoney(annualSavings(plan), plan.currency);
}
