import { apiClient } from "@/lib/api/api-client";

export type JournalStatus = "DRAFT" | "POSTED" | "REVERSED";

export type JournalLine = {
  id?: number;
  account_id: number;
  account_code?: string | null;
  account_name?: string | null;
  description?: string | null;
  debit: string | number;
  credit: string | number;
};

export type JournalEntry = {
  id: number;
  entry_no: string;
  entry_date: string;
  memo?: string | null;
  status: JournalStatus;
  source_type: string;
  source_ref?: string | null;
  total_debit: string;
  total_credit: string;
  posted_at?: string | null;
  reversal_of_id?: number | null;
  period_code?: string | null;
  lines?: JournalLine[];
};

export type AccountingPeriod = {
  id: number; code: string; name: string;
  start_date: string; end_date: string;
  status: "OPEN" | "CLOSED"; closed_at?: string | null;
};

export type LedgerRow = {
  entry_id: number; entry_no: string; entry_date: string;
  memo?: string | null; description?: string | null;
  debit: string; credit: string; running_balance: string;
};

export type TrialBalanceRow = { account_id: number; code: string; name: string; type: string; debit: string; credit: string };
export type StatementLine = { code: string; name: string; amount: string };

function errMsg(e: any, fallback: string) {
  return e?.response?.data?.detail || e?.response?.data?.message || fallback;
}

export const accountingApi = {
  errMsg,

  listEntries: (params: { status?: string; source?: string; date_from?: string; date_to?: string; page?: number; page_size?: number }) =>
    apiClient.get("/accounting/journal-entries", { params }).then((r) => r.data as { total: number; page: number; page_size: number; items: JournalEntry[] }),

  getEntry: (id: number) =>
    apiClient.get(`/accounting/journal-entries/${id}`).then((r) => r.data?.entry as JournalEntry),

  createEntry: (payload: { entry_date: string; memo?: string; auto_post?: boolean; lines: { account_id: number; debit: number; credit: number; description?: string }[] }) =>
    apiClient.post("/accounting/journal-entries", payload).then((r) => r.data?.entry as JournalEntry),

  postEntry: (id: number) =>
    apiClient.post(`/accounting/journal-entries/${id}/post`, {}).then((r) => r.data?.entry as JournalEntry),

  reverseEntry: (id: number, memo?: string) =>
    apiClient.post(`/accounting/journal-entries/${id}/reverse`, { memo }).then((r) => r.data?.entry as JournalEntry),

  deleteDraft: (id: number) =>
    apiClient.delete(`/accounting/journal-entries/${id}`).then((r) => r.data),

  autoPost: () =>
    apiClient.post("/accounting/auto-post", {}).then((r) => r.data as { created: number; skipped_existing: number }),

  listPeriods: () =>
    apiClient.get("/accounting/periods").then((r) => (r.data?.items ?? []) as AccountingPeriod[]),

  closePeriod: (id: number) =>
    apiClient.post(`/accounting/periods/${id}/close`, {}).then((r) => r.data?.period),

  reopenPeriod: (id: number) =>
    apiClient.post(`/accounting/periods/${id}/reopen`, {}).then((r) => r.data?.period),

  ledger: (accountId: number, params: { date_from?: string; date_to?: string }) =>
    apiClient.get(`/accounting/ledger/${accountId}`, { params }).then((r) => r.data as {
      account: { id: number; code: string; name: string; type: string };
      normal_balance: string; closing_balance: string; items: LedgerRow[];
    }),

  trialBalance: (params: { date_from?: string; date_to?: string }) =>
    apiClient.get("/accounting/reports/trial-balance", { params }).then((r) => r.data as {
      items: TrialBalanceRow[]; total_debit: string; total_credit: string; balanced: boolean;
    }),

  profitAndLoss: (params: { date_from: string; date_to: string }) =>
    apiClient.get("/accounting/reports/profit-and-loss", { params }).then((r) => r.data as {
      revenue: StatementLine[]; expenses: StatementLine[];
      total_revenue: string; total_expenses: string; net_income: string;
    }),

  balanceSheet: (params: { as_of: string }) =>
    apiClient.get("/accounting/reports/balance-sheet", { params }).then((r) => r.data as {
      assets: StatementLine[]; liabilities: StatementLine[]; equity: StatementLine[];
      total_assets: string; total_liabilities: string; total_equity: string; balanced: boolean;
    }),
};

// ===================== Accounts payable =====================

export type Vendor = {
  id: number; name: string; contact_person?: string | null; email?: string | null;
  phone?: string | null; tax_id?: string | null; address?: string | null; is_active: boolean;
};

export type VendorBill = {
  id: number; bill_no: string; vendor_id: number; vendor_name?: string | null;
  bill_date: string; due_date?: string | null; description?: string | null;
  expense_account_id: number; expense_account?: string | null;
  total_amount: string; amount_paid: string; balance_due: string;
  status: "OPEN" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
};

export type AgingReport = {
  as_of: string;
  buckets: { current: string; d1_30: string; d31_60: string; d61_90: string; d90_plus: string };
  total_outstanding: string;
  items: { bill_no?: string; invoice_no?: string; vendor?: string | null; due_date: string; days_overdue: number; balance: string; bucket: string }[];
};

export type FixedAsset = {
  id: number; code: string; name: string; category?: string | null;
  acquisition_date: string; cost: string; salvage_value: string;
  useful_life_months: number; accumulated_depreciation: string; net_book_value: string;
  last_depreciated_period?: string | null; status: string;
};

export type BudgetVsActualRow = {
  account_id: number; code: string; name: string; type: string;
  budget: string; actual: string; variance: string;
};

export const financeApi = {
  listVendors: (search?: string) =>
    apiClient.get("/accounting/vendors", { params: search ? { search } : {} }).then((r) => (r.data?.items ?? []) as Vendor[]),
  createVendor: (payload: Partial<Vendor> & { name: string }) =>
    apiClient.post("/accounting/vendors", payload).then((r) => r.data?.vendor as Vendor),

  listBills: (status?: string) =>
    apiClient.get("/accounting/vendor-bills", { params: status ? { status } : {} }).then((r) => (r.data?.items ?? []) as VendorBill[]),
  createBill: (payload: { vendor_id: number; bill_date: string; due_date?: string; total_amount: number; expense_account_id: number; description?: string }) =>
    apiClient.post("/accounting/vendor-bills", payload).then((r) => r.data?.bill as VendorBill),
  payBill: (billId: number, payload: { amount: number; paid_at: string; payment_method?: string; reference?: string }) =>
    apiClient.post(`/accounting/vendor-bills/${billId}/pay`, payload).then((r) => r.data?.bill as VendorBill),

  apAging: (asOf?: string) =>
    apiClient.get("/accounting/reports/ap-aging", { params: asOf ? { as_of: asOf } : {} }).then((r) => r.data as AgingReport),
  arAging: (asOf?: string) =>
    apiClient.get("/accounting/reports/ar-aging", { params: asOf ? { as_of: asOf } : {} }).then((r) => r.data as AgingReport),

  listAssets: () =>
    apiClient.get("/accounting/fixed-assets").then((r) => (r.data?.items ?? []) as FixedAsset[]),
  createAsset: (payload: { name: string; category?: string; acquisition_date: string; cost: number; salvage_value?: number; useful_life_months: number }) =>
    apiClient.post("/accounting/fixed-assets", payload).then((r) => r.data?.asset as FixedAsset),
  runDepreciation: (periodCode?: string) =>
    apiClient.post("/accounting/fixed-assets/run-depreciation", { period_code: periodCode || undefined }).then((r) => r.data as { period: string; posted: number; skipped_current: number }),

  upsertBudget: (payload: { account_id: number; period_code: string; amount: number }) =>
    apiClient.post("/accounting/budgets", payload).then((r) => r.data?.budget),
  budgetVsActual: (params: { date_from: string; date_to: string }) =>
    apiClient.get("/accounting/reports/budget-vs-actual", { params }).then((r) => r.data as { items: BudgetVsActualRow[]; periods: string[] }),

  closeYear: (year: number) =>
    apiClient.post("/accounting/close-year", { year }).then((r) => r.data as { year: number; net_income: string }),
};
