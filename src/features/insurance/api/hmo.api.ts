import { apiClient } from "@/lib/api/api-client";

// ---------- types ----------

export type HmoProvider = {
  id: number; name: string; code?: string | null;
  provider_type?: string | null; nhia_accreditation_no?: string | null;
  contact_person?: string | null; phone_number?: string | null;
  email?: string | null; address?: string | null; notes?: string | null;
  default_payment_terms_days?: number | null;
  capitation_supported: boolean; fee_for_service_supported: boolean;
  is_active: boolean; plan_count: number; active_enrollee_count: number;
};

export type HmoPlan = {
  id: number; insurance_provider_id: number; provider_name?: string | null;
  name: string; code?: string | null; plan_tier?: string | null;
  coverage_type: string;
  default_coverage_percent: string; default_copay_percent: string;
  default_copay_flat: string;
  annual_limit?: string | null; per_visit_limit?: string | null;
  requires_referral: boolean; is_active: boolean; notes?: string | null;
  benefit_count: number; tariff_count: number;
  benefits?: HmoBenefit[];
};

export type HmoBenefit = {
  id: number; hmo_plan_id: number; category?: string | null;
  billable_service_id?: number | null; billable_service_name?: string | null;
  drug_id?: number | null;
  coverage_percent?: string | null; copay_flat?: string | null;
  limit_amount?: string | null; limit_period?: string | null;
  requires_preauth: boolean; is_excluded: boolean; notes?: string | null;
};

export type HmoTariff = {
  id: number; hmo_plan_id: number;
  billable_service_id?: number | null; billable_service_name?: string | null;
  drug_id?: number | null; service_code?: string | null;
  agreed_price: string; effective_from?: string | null; effective_to?: string | null;
};

export type Enrollee = {
  id: number; patient_id: number; patient_name?: string | null;
  policy_number: string; member_id?: string | null;
  plan_id?: number | null; plan_name?: string | null;
  policy_status: string; verification_status: string;
  valid_to?: string | null; is_primary: boolean;
};

export type CapitationContract = {
  id: number; insurance_provider_id: number; provider_name?: string | null;
  hmo_plan_id?: number | null; plan_name?: string | null;
  rate_per_enrollee: string; effective_from: string; effective_to?: string | null;
  payment_day?: number | null; status: string; notes?: string | null;
};

export type CapitationLine = {
  id: number; contract_id: number; period_code: string;
  enrollee_count: number; rate_per_enrollee: string;
  expected_amount: string; received_amount: string; outstanding: string;
  status: string; confirmed_at?: string | null; has_hmo_list: boolean;
  variance?: { hmo_count: number; our_count: number; missing_from_hmo: number;
               unknown_to_us: number; disputed_value: string } | null;
};

export type Remittance = {
  id: number; insurance_provider_id: number; provider_name?: string | null;
  reference: string; received_at: string;
  total_amount: string; allocated_amount: string; unallocated_amount: string;
  status: string; notes?: string | null;
  lines: { id: number; claim_id?: number | null;
           capitation_schedule_line_id?: number | null; amount: string }[];
};

export type PayerBalance = {
  provider_id: number; provider_name: string;
  claims_outstanding: string; capitation_outstanding: string; total_outstanding: string;
};

export type StatementRow = {
  date: string; type: string; ref: string; detail?: string;
  debit: string; credit: string; balance: string;
};

// ---------- client ----------

const g = <T,>(url: string, params?: object) =>
  apiClient.get(url, { params }).then((r) => r.data as T);
const p = <T,>(url: string, body?: object) =>
  apiClient.post(url, body ?? {}).then((r) => r.data as T);
const put = <T,>(url: string, body?: object) =>
  apiClient.put(url, body ??  {}).then((r) => r.data as T);

export const hmoApi = {
  // payers / plans
  listProviders: (search?: string) =>
    g<{ items: HmoProvider[] }>("/hmo/providers", { search }).then((d) => d.items),
  updateProvider: (id: number, body: Partial<HmoProvider> & { bank_account_details?: object }) =>
    put<{ provider: HmoProvider }>(`/hmo/providers/${id}`, body).then((d) => d.provider),
  listPlans: (provider_id?: number) =>
    g<{ items: HmoPlan[] }>("/hmo/plans", { provider_id, include_inactive: true }).then((d) => d.items),
  getPlan: (id: number) => g<{ plan: HmoPlan }>(`/hmo/plans/${id}`).then((d) => d.plan),
  createPlan: (body: object) => p<{ plan: HmoPlan }>("/hmo/plans", body).then((d) => d.plan),
  updatePlan: (id: number, body: object) =>
    put<{ plan: HmoPlan }>(`/hmo/plans/${id}`, body).then((d) => d.plan),
  createBenefit: (body: object) => p<{ benefit: HmoBenefit }>("/hmo/benefits", body).then((d) => d.benefit),
  updateBenefit: (id: number, body: object) =>
    put<{ benefit: HmoBenefit }>(`/hmo/benefits/${id}`, body).then((d) => d.benefit),
  deleteBenefit: (id: number) => apiClient.delete(`/hmo/benefits/${id}`).then((r) => r.data),
  listTariffs: (planId: number) =>
    g<{ items: HmoTariff[] }>(`/hmo/plans/${planId}/tariffs`).then((d) => d.items),
  createTariff: (body: object) => p<{ tariff: HmoTariff }>("/hmo/tariffs", body).then((d) => d.tariff),
  deleteTariff: (id: number) => apiClient.delete(`/hmo/tariffs/${id}`).then((r) => r.data),
  importTariffs: (planId: number, file: File, dryRun: boolean) => {
    const form = new FormData();
    form.append("file", file);
    return apiClient.post(`/hmo/plans/${planId}/tariffs/import?dry_run=${dryRun}`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data as { valid_rows: number; imported: number; errors: { row: number; error: string }[] });
  },

  // enrollees & eligibility
  listEnrollees: (params: { provider_id?: number; plan_id?: number; status?: string;
                            search?: string; page?: number; page_size?: number }) =>
    g<{ total: number; items: Enrollee[] }>("/hmo/enrollees", params),
  linkToPlan: (patientInsuranceId: number, hmoPlanId: number) =>
    p<{ plan_name: string }>(`/hmo/enrollees/${patientInsuranceId}/link-plan`,
      { hmo_plan_id: hmoPlanId }),
  recordEligibility: (body: { patient_insurance_id: number; result: string; method?: string;
                              visit_id?: number; authorization_code?: string; notes?: string }) =>
    p<{ check: object }>("/hmo/eligibility-checks", body),
  expiringPolicies: (days = 30) =>
    g<{ items: object[] }>("/hmo/enrollees/expiring", { days }).then((d) => d.items),

  // capitation
  listContracts: (provider_id?: number) =>
    g<{ items: CapitationContract[] }>("/hmo/capitation/contracts", { provider_id }).then((d) => d.items),
  createContract: (body: object) =>
    p<{ contract: CapitationContract }>("/hmo/capitation/contracts", body).then((d) => d.contract),
  runCapitation: (body: { contract_id: number; period_code: string }) =>
    p<{ schedule_line: CapitationLine }>("/hmo/capitation/run", body).then((d) => d.schedule_line),
  listSchedule: (params: { contract_id?: number; provider_id?: number; period_code?: string }) =>
    g<{ items: CapitationLine[] }>("/hmo/capitation/schedule", params).then((d) => d.items),
  confirmSchedule: (lineId: number) =>
    p<{ schedule_line: CapitationLine }>(`/hmo/capitation/schedule/${lineId}/confirm`),
  importHmoList: (lineId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiClient.post(`/hmo/capitation/schedule/${lineId}/import-hmo-list`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data);
  },
  recordCapitationPayment: (body: { line_id: number; amount: number; paid_at: string;
                                    reference?: string; bank_account_id?: number }) =>
    p("/hmo/capitation/payments", body),
  capitationUtilization: (params: { provider_id: number; period_from: string; period_to: string }) =>
    g<Record<string, unknown>>("/hmo/capitation/utilization", params),

  // remittances & payer ledger
  listRemittances: (provider_id?: number) =>
    g<{ items: Remittance[] }>("/hmo/remittances", { provider_id }).then((d) => d.items),
  createRemittance: (body: object) =>
    p<{ advice: Remittance }>("/hmo/remittances", body).then((d) => d.advice),
  remittanceSuggestions: (id: number) =>
    g<{ advice: Remittance;
        open_claims: { claim_id: number; claim_no: string; outstanding: string;
                       exact_amount_match: boolean }[];
        open_capitation: { capitation_schedule_line_id: number; period_code: string;
                           outstanding: string }[] }>(`/hmo/remittances/${id}/suggestions`),
  allocateRemittance: (id: number, allocations: { claim_id?: number;
                        capitation_schedule_line_id?: number; amount: number }[]) =>
    p<{ advice: Remittance }>(`/hmo/remittances/${id}/allocate`, { allocations }).then((d) => d.advice),
  payerBalances: () =>
    g<{ items: PayerBalance[] }>("/hmo/payers/balances").then((d) => d.items),
  payerStatement: (providerId: number, params?: { date_from?: string; date_to?: string }) =>
    g<{ provider_name: string; opening_balance: string; closing_balance: string;
        rows: StatementRow[] }>(`/hmo/payers/${providerId}/statement`, params),
  writeOffClaim: (claimId: number, body: { amount?: number; reason_code?: string; reason_text?: string }) =>
    p(`/hmo/claims/${claimId}/write-off`, body),
  pushPatientResponsibility: (claimId: number) =>
    p(`/hmo/claims/${claimId}/push-patient-responsibility`),

  // claims extensions & reports
  listRejectionReasons: () =>
    g<{ items: { id: number; code: string; description: string; is_active: boolean }[] }>(
      "/hmo/rejection-reasons").then((d) => d.items),
  createRejectionReason: (body: { code: string; description: string }) =>
    p("/hmo/rejection-reasons", body),
  resubmitClaim: (claimId: number) => p(`/hmo/claims/${claimId}/resubmit`),
  generateMonthlyBatch: (body: { provider_id: number; period_code: string }) =>
    p<{ batch_id: number; batch_no: string; claims: number }>("/hmo/batches/generate-monthly", body),
  batchExportUrl: (batchId: number) => `/hmo/batches/${batchId}/export.xlsx`,
  downloadBatchXlsx: (batchId: number) =>
    apiClient.get(`/hmo/batches/${batchId}/export.xlsx`, { responseType: "blob" }).then((r) => r.data as Blob),
  claimAging: (provider_id?: number) =>
    g<{ buckets: Record<string, string>; total: string;
        providers: Record<string, string | number>[] }>("/hmo/reports/claim-aging", { provider_id }),
  rejectionAnalysis: (params?: object) =>
    g<{ adjudications: number; with_rejections: number; rejection_rate_percent: string;
        rejected_value: string; top_reasons: { code: string; count: number; value: string }[] }>(
      "/hmo/reports/rejection-analysis", params),
  settlement: (provider_id?: number) =>
    g<{ paid_claims: number; avg_days_to_settlement: number | null }>(
      "/hmo/reports/settlement", { provider_id }),
  dashboard: () => g<Record<string, any>>("/hmo/dashboard"),
  coveragePreview: (body: { patient_id: number; unit_price: number; quantity?: number;
                            billable_service_id?: number; category?: string }) =>
    p<{ insured: boolean; decision: Record<string, any> }>("/hmo/coverage/preview", body),
};

export function fmtNaira(v?: string | number | null): string {
  const n = typeof v === "string" ? parseFloat(v) : (v ?? 0);
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN",
    maximumFractionDigits: 2 }).format(n);
}
