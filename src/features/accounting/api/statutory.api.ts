import { apiClient } from "@/lib/api/api-client";

export type StatutoryPosition = {
  type: string; default_authority: string; account: string; account_id: number;
  accrued: string; remitted: string; outstanding: string;
  last_remitted_at?: string | null;
  wht_pending_records?: number; wht_pending_value?: string;
};

export type StatutoryRemittance = {
  id: number; remittance_type: string; period_code: string;
  authority?: string | null; pension_provider_id?: number | null;
  amount: string; paid_at: string; bank_account_id?: number | null;
  reference?: string | null; receipt_url?: string | null; notes?: string | null;
};

export type WhtRecord = {
  id: number; payee_name: string; payee_tax_id?: string | null;
  payee_kind?: string | null; gross_amount: string; rate_percent: string;
  wht_amount: string; status: string;
  deducted_at?: string | null; remitted_at?: string | null;
  certificate_no?: string | null; notes?: string | null;
};

export type ScheduleRow = Record<string, string | number | null>;

const g = <T,>(url: string, params?: object) =>
  apiClient.get(url, { params }).then((r) => r.data as T);
const p = <T,>(url: string, body?: object) =>
  apiClient.post(url, body ?? {}).then((r) => r.data as T);

export const statutoryApi = {
  positions: () =>
    g<{ items: StatutoryPosition[] }>("/statutory/positions").then((d) => d.items),
  listRemittances: (params?: { type?: string; period_code?: string }) =>
    g<{ items: StatutoryRemittance[] }>("/statutory/remittances", params).then((d) => d.items),
  createRemittance: (body: {
    remittance_type: string; period_code: string; paid_at: string;
    amount?: number; bank_account_id?: number; authority?: string;
    pension_provider_id?: number; reference?: string; notes?: string;
    wht_record_ids?: number[];
  }) => p<{ remittance: StatutoryRemittance & { wht_records_marked?: number } }>(
    "/statutory/remittances", body).then((d) => d.remittance),
  whtRegister: (params?: { period_code?: string; status?: string }) =>
    g<{ items: WhtRecord[] }>("/statutory/wht/register", params).then((d) => d.items),
  recordWht: (body: { payee_name: string; gross_amount: number; rate_percent: number;
                      payee_tax_id?: string; payee_kind?: string; notes?: string }) =>
    p<{ record_id: number; wht_amount: string }>("/statutory/wht/records", body),
  attachCertificate: (recordId: number, body: { certificate_no?: string;
                       certificate_url?: string }) =>
    p(`/statutory/wht/${recordId}/certificate`, body),
  schedule: (kind: string, periodCode: string) =>
    g<{ rows: ScheduleRow[]; count: number; total: string }>(
      `/statutory/schedules/${kind}`, { period_code: periodCode }),
  scheduleXlsx: (kind: string, periodCode: string) =>
    apiClient.get(`/statutory/schedules/${kind}.xlsx`,
      { params: { period_code: periodCode }, responseType: "blob" })
      .then((r) => r.data as Blob),
};
