import { apiClient } from "@/lib/api/api-client";

// ---------- types ----------

export type BankAccount = {
  id: number; name: string; bank_name?: string | null;
  account_number_masked?: string | null; account_id: number;
  ledger_code?: string | null; is_default: boolean; is_active: boolean;
  balance?: string; notes?: string | null;
};

export type Reconciliation = {
  id: number; bank_account_id: number; bank_account_name?: string;
  period_from: string; period_to: string; status: string;
  book_closing_balance?: string; statement_closing_balance?: string | null;
  difference?: string | null;
  unmatched_statement_lines?: { id: number; date: string; description?: string | null;
    reference?: string | null; debit: string; credit: string }[];
  unmatched_book_lines?: { journal_line_id: number; entry_no: string; date: string;
    memo?: string | null; debit: string; credit: string }[];
  outstanding_statement_total?: string; outstanding_book_total?: string;
  completed_at?: string | null; auto_matched?: number;
};

export type PettyFloat = {
  id: number; name: string; custodian_user_id?: number | null;
  float_amount: string; unretired_spend: string; cash_at_hand: string; is_active: boolean;
};

export type PettyVoucher = {
  id: number; float_id: number; voucher_no: string;
  expense_account_id: number; expense_account?: string | null;
  amount: string; description: string; status: string; spent_at?: string | null;
};

export type CashierSession = {
  id: number; cashier_user_id: number; status: string;
  opened_at?: string | null; closed_at?: string | null;
  opening_float: string; payments_count: number;
  takings_by_method: Record<string, string>; takings_total: string;
  expected_cash: string; counted_cash?: string | null; variance?: string | null;
};

export type CostCenter = {
  id: number; code: string; name: string;
  department_id?: number | null; facility_id?: number | null; is_active: boolean;
};

export type AccountNode = {
  id: number; code: string; name: string; account_type: string;
  parent_account_id?: number | null; is_postable: boolean; is_system: boolean;
  cash_flow_category?: string | null; is_active: boolean; children: AccountNode[];
};

export type SystemMapping = {
  key: string; account_id: number; account_code: string; account_name: string;
  account_type: string; default_code: string;
};

export type CreditNote = {
  id: number; credit_note_no: string; invoice_id: number; invoice_no?: string | null;
  reason?: string | null; total_amount: string; applied_amount: string;
  status: string; issued_at?: string | null;
};

export type Refund = {
  id: number; refund_no: string; amount: string; status: string;
  patient_id?: number | null; invoice_id?: number | null; reason?: string | null;
  paid_at?: string | null;
};

const g = <T,>(url: string, params?: object) =>
  apiClient.get(url, { params }).then((r) => r.data as T);
const p = <T,>(url: string, body?: object) =>
  apiClient.post(url, body ?? {}).then((r) => r.data as T);
const put = <T,>(url: string, body?: object) =>
  apiClient.put(url, body ?? {}).then((r) => r.data as T);

export const financeExtApi = {
  // ---- banking ----
  listBankAccounts: () => g<{ items: BankAccount[] }>("/banking/accounts").then((d) => d.items),
  createBankAccount: (body: object) =>
    p<{ account: BankAccount }>("/banking/accounts", body).then((d) => d.account),
  recordDeposit: (body: { bank_account_id: number; amount: number; deposit_date: string;
                          reference?: string }) => p("/banking/deposits", body),
  recordTransfer: (body: { from_bank_account_id: number; to_bank_account_id: number;
                           amount: number; transfer_date: string; reference?: string }) =>
    p("/banking/transfers", body),
  importStatement: (bankAccountId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiClient.post(`/banking/accounts/${bankAccountId}/statements/import`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data as { import_id: number; lines: number; errors: object[] });
  },
  listReconciliations: (bank_account_id?: number) =>
    g<{ items: Reconciliation[] }>("/banking/reconciliations", { bank_account_id }).then((d) => d.items),
  startReconciliation: (body: { bank_account_id: number; period_from: string;
                                period_to: string; statement_closing_balance?: number }) =>
    p<Reconciliation>("/banking/reconciliations", body),
  reconciliationReport: (id: number) => g<Reconciliation>(`/banking/reconciliations/${id}`),
  autoMatch: (id: number) => p(`/banking/reconciliations/${id}/auto-match`),
  manualMatch: (id: number, body: { statement_line_id: number; journal_line_id?: number | null }) =>
    p(`/banking/reconciliations/${id}/match`, body),
  addAdjustment: (id: number, body: { kind: string; amount: number; adj_date?: string;
                                      description?: string }) =>
    p(`/banking/reconciliations/${id}/adjustments`, body),
  completeReconciliation: (id: number) => p<Reconciliation>(`/banking/reconciliations/${id}/complete`),

  // ---- petty cash ----
  listFloats: () => g<{ items: PettyFloat[] }>("/banking/petty-cash/floats").then((d) => d.items),
  createFloat: (body: { name: string }) => p("/banking/petty-cash/floats", body),
  topUpFloat: (id: number, body: { amount: number; bank_account_id?: number }) =>
    p(`/banking/petty-cash/floats/${id}/top-up`, body),
  listVouchers: (float_id?: number) =>
    g<{ items: PettyVoucher[] }>("/banking/petty-cash/vouchers", { float_id }).then((d) => d.items),
  createVoucher: (floatId: number, body: { amount: number; description: string;
                  expense_account_id?: number; cost_center_id?: number; spent_at?: string }) =>
    p(`/banking/petty-cash/floats/${floatId}/vouchers`, body),
  decideVoucher: (id: number, approve: boolean) =>
    p(`/banking/petty-cash/vouchers/${id}/decide`, { approve }),
  retireFloat: (id: number) => p(`/banking/petty-cash/floats/${id}/retire`),

  // ---- cashier sessions ----
  listSessions: (params?: { status?: string; day?: string }) =>
    g<{ items: CashierSession[] }>("/banking/cashier-sessions", params).then((d) => d.items),
  mySession: () => g<{ session: CashierSession | null }>("/banking/cashier-sessions/mine").then((d) => d.session),
  openSession: (body: { opening_float: number; service_delivery_point_id?: number }) =>
    p<{ session: CashierSession }>("/banking/cashier-sessions/open", body).then((d) => d.session),
  closeSession: (id: number, body: { counted_cash: number; notes?: string }) =>
    p<{ session: CashierSession }>(`/banking/cashier-sessions/${id}/close`, body).then((d) => d.session),
  dailySummary: (day?: string) =>
    g<{ date: string; sessions: CashierSession[]; takings_total: string;
        takings_by_method: Record<string, string>; total_variance: string }>(
      "/banking/cashier-sessions/daily-summary", { day }),

  // ---- CoA / config / cost centers ----
  accountTree: () => g<{ tree: AccountNode[] }>("/accounting-ext/accounts/tree").then((d) => d.tree),
  updateAccount: (id: number, body: object) => put(`/accounting-ext/accounts/${id}`, body),
  systemMappings: () =>
    g<{ items: SystemMapping[] }>("/accounting-ext/system-accounts").then((d) => d.items),
  setMapping: (body: { key: string; account_id: number }) =>
    put("/accounting-ext/system-accounts", body),
  getConfig: () => g<{ config: Record<string, any> }>("/accounting-ext/config").then((d) => d.config),
  updateConfig: (body: object) =>
    put<{ config: Record<string, any> }>("/accounting-ext/config", body).then((d) => d.config),
  seedDefaultCoa: () => p<{ created: number }>("/accounting-ext/seed-default-coa"),
  seedDemoHmos: () => p("/accounting-ext/seed-demo-hmos"),
  openingBalances: (body: { as_of: string; balances: { account_id: number; debit: number;
                            credit: number }[] }) =>
    p("/accounting-ext/opening-balances", body),
  listCostCenters: () =>
    g<{ items: CostCenter[] }>("/accounting-ext/cost-centers").then((d) => d.items),
  createCostCenter: (body: { code: string; name: string; department_id?: number }) =>
    p("/accounting-ext/cost-centers", body),
  generateCostCenters: () => p<{ created: number }>("/accounting-ext/cost-centers/generate-from-departments"),

  // ---- reports ----
  cashFlow: (date_from: string, date_to: string) =>
    g<Record<string, any>>("/accounting-ext/reports/cash-flow", { date_from, date_to }),
  generalLedger: (params: { date_from: string; date_to: string; account_id?: number;
                            cost_center_id?: number }) =>
    g<{ rows: Record<string, string | number | null>[]; total_debit: string;
        total_credit: string }>("/accounting-ext/reports/general-ledger", params),
  generalLedgerXlsx: (params: { date_from: string; date_to: string; account_id?: number }) =>
    apiClient.get("/accounting-ext/reports/general-ledger.xlsx",
      { params, responseType: "blob" }).then((r) => r.data as Blob),
  departmentalPnl: (date_from: string, date_to: string) =>
    g<{ columns: { cost_center: string; revenue: string; expense: string; surplus: string }[];
        total_revenue: string; total_expense: string }>(
      "/accounting-ext/reports/departmental-pnl", { date_from, date_to }),
  arSegments: () =>
    g<{ patient_self_pay: string; hmo_fee_for_service: string; capitation: string;
        total: string }>("/accounting-ext/reports/ar-segments"),
  preCloseChecklist: (periodId: number) =>
    g<{ period: string; ready: boolean;
        checklist: { item: string; count: number; ok: boolean }[] }>(
      `/accounting-ext/periods/${periodId}/pre-close-checklist`),
  postingStatus: () =>
    g<{ sources: { source: string; total: number; swept: number; pending: number }[] }>(
      "/accounting-ext/posting-status"),
  auditLog: (params?: { entity_type?: string; entity_id?: number }) =>
    g<{ items: Record<string, any>[] }>("/accounting-ext/audit-log", params).then((d) => d.items),

  // ---- AR/AP documents ----
  listCreditNotes: (invoice_id?: number) =>
    g<{ items: CreditNote[] }>("/accounting-ext/credit-notes", { invoice_id }).then((d) => d.items),
  createCreditNote: (body: { invoice_id: number; reason?: string;
                             items: { invoice_item_id?: number; description?: string;
                                      amount: number }[] }) =>
    p<{ credit_note: CreditNote }>("/accounting-ext/credit-notes", body).then((d) => d.credit_note),
  issueCreditNote: (id: number) =>
    p<{ credit_note: CreditNote }>(`/accounting-ext/credit-notes/${id}/issue`).then((d) => d.credit_note),
  listRefunds: () => g<{ items: Refund[] }>("/accounting-ext/refunds").then((d) => d.items),
  createRefund: (body: object) => p<{ refund: Refund }>("/accounting-ext/refunds", body).then((d) => d.refund),
  payRefund: (id: number) => p<{ refund: Refund }>(`/accounting-ext/refunds/${id}/pay`).then((d) => d.refund),
  writeOffInvoice: (invoiceId: number, body: { amount?: number; reason?: string }) =>
    p(`/accounting-ext/invoices/${invoiceId}/write-off`, body),
  patientStatement: (patientId: number, params?: { date_from?: string; date_to?: string }) =>
    g<{ patient_name: string; closing_balance: string;
        rows: Record<string, string>[] }>(`/accounting-ext/patients/${patientId}/statement`, params),
  vendorStatement: (vendorId: number) =>
    g<{ vendor_name: string; closing_balance: string; rows: Record<string, string>[] }>(
      `/accounting-ext/vendors/${vendorId}/statement`),
  createVendorCreditNote: (body: { vendor_id: number; amount: number;
                                   vendor_bill_id?: number; reason?: string }) =>
    p("/accounting-ext/vendor-credit-notes", body),
  paymentRun: (body: { bill_ids: number[]; bank_account_id: number; paid_at?: string }) =>
    p<{ results: { bill_id: number; paid?: string; error?: string }[] }>(
      "/accounting-ext/payment-runs", body),
};

export function fmtNaira(v?: string | number | null): string {
  const n = typeof v === "string" ? parseFloat(v) : (v ?? 0);
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN",
    maximumFractionDigits: 2 }).format(n);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
