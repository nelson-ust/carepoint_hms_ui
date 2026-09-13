import { apiClient } from "@/lib/api/api-client";

export type SalaryAdvanceStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "PAID" | "CANCELLED";
export type ReimbursementStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "PAID";

export type SalaryAdvance = {
  id: number;
  staff_profile_id: number;
  amount: number | string;
  reason?: string | null;
  repayment_month: string;
  status: SalaryAdvanceStatus;
  submitted_at?: string | null;
  approved_at?: string | null;
  paid_at?: string | null;
  approval_request_id?: number | null;
  account_id?: number | null;
  account_code?: string | null;
  account_name?: string | null;
};

export type Reimbursement = {
  id: number;
  staff_profile_id: number;
  expense_date: string;
  /** Serialized Decimal — may arrive as a string. Use Number() before math. */
  amount: number | string;
  category: string;
  description: string;
  receipt_url?: string | null;
  status: ReimbursementStatus;
  submitted_at?: string | null;
  decided_at?: string | null;
  decision_note?: string | null;
  approval_request_id?: number | null;
  /** Presigned, time-limited URL for viewing the stored receipt. */
  receipt_display_url?: string | null;
  account_id?: number | null;
  account_code?: string | null;
  account_name?: string | null;
};

export type CreateAdvancePayload = {
  amount: number;
  repayment_month: string; // YYYY-MM-DD (first of month)
  reason?: string;
  account_id: number;
};

export type CreateReimbursementPayload = {
  expense_date: string;
  amount: number;
  category: string;
  description: string;
  receipt_url?: string;
  account_id: number;
};

type SubmitPayload = { title: string; flow_id?: number | null; assigned_approver_user_id?: number };

type ListEnvelope<T> = { success: boolean; items: T[]; count?: number; total?: number };

export const staffFinanceApi = {
  // ── Salary advances (self-service) ────────────────────────────────
  listMyAdvances: (params: { skip?: number; limit?: number } = {}) =>
    apiClient
      .get<ListEnvelope<SalaryAdvance>>("/salary-advances/me", { params })
      .then((res) => ({ items: res.data.items ?? [], total: res.data.count ?? res.data.total ?? 0 })),

  createMyAdvance: (payload: CreateAdvancePayload) =>
    apiClient
      .post<{ salary_advance: SalaryAdvance }>("/salary-advances/me", payload)
      .then((res) => res.data.salary_advance),

  submitMyAdvance: (id: number, payload: SubmitPayload) =>
    apiClient
      .post<{ salary_advance: SalaryAdvance }>(`/salary-advances/me/${id}/submit`, {
        title: payload.title,
        flow_id: payload.flow_id ?? null,
        assigned_approver_user_id: payload.assigned_approver_user_id,
        submit_now: true,
      })
      .then((res) => res.data.salary_advance),

  removeMyAdvance: (id: number) =>
    apiClient.delete(`/salary-advances/me/${id}`).then((res) => res.data),

  // ── Expense claims / reimbursements (self-service) ────────────────
  // ---- Admin: all advances + disbursement ----
  listAllAdvances: (params: { skip?: number; limit?: number } = {}) =>
    apiClient
      .get<ListEnvelope<SalaryAdvance>>("/salary-advances", { params: { limit: 100, ...params } })
      .then((res) => res.data),

  disburseAdvance: (id: number) =>
    apiClient
      .post<{ salary_advance: SalaryAdvance }>(`/salary-advances/${id}/disburse`, {})
      .then((res) => res.data),

  listMyReimbursements: (params: { skip?: number; limit?: number } = {}) =>
    apiClient
      .get<ListEnvelope<Reimbursement>>("/reimbursements/me", { params })
      .then((res) => ({ items: res.data.items ?? [], total: res.data.total ?? res.data.count ?? 0 })),

  createMyReimbursement: (payload: CreateReimbursementPayload) =>
    apiClient
      .post<{ reimbursement: Reimbursement }>("/reimbursements/me", payload)
      .then((res) => res.data.reimbursement),

  submitMyReimbursement: (id: number, payload: SubmitPayload) =>
    apiClient
      .post<{ reimbursement: Reimbursement }>(`/reimbursements/me/${id}/submit`, {
        title: payload.title,
        flow_id: payload.flow_id ?? null,
        assigned_approver_user_id: payload.assigned_approver_user_id,
        submit_now: true,
      })
      .then((res) => res.data.reimbursement),

  removeMyReimbursement: (id: number) =>
    apiClient.delete(`/reimbursements/me/${id}`).then((res) => res.data),

  /** Upload a receipt (image/PDF) to the tenant's S3 bucket; returns its permanent URL. */
  uploadMyReceipt: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiClient
      .post<{ success: boolean; receipt_url: string }>("/reimbursements/me/receipt", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((res) => res.data.receipt_url);
  },
};
