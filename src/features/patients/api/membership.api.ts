import axios from "axios";
import { apiClient } from "@/lib/api/api-client";
import { env } from "@/config/env";

export type MembershipCardStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "EXPIRED" | "LOST";

export type MembershipCard = {
  id: number;
  patient_id: number;
  patient_name?: string | null;
  patient_phone?: string | null;
  global_patient_id?: string | null;
  card_number: string;
  balance: string | number;
  status: MembershipCardStatus;
  issuing_facility_id: number;
  issued_by_id: number;
  date_issued: string;
  expiry_date?: string | null;
};

export type MembershipCardTransaction = {
  id: number;
  membership_card_id: number;
  amount: string | number;
  transaction_type: string;
  payment_source?: string | null;
  balance_before: string | number;
  balance_after: string | number;
  transaction_date: string;
  narration?: string | null;
};

export type MembershipCardDetail = MembershipCard & {
  transactions: MembershipCardTransaction[];
};

export type MembershipCardStats = {
  total: number;
  active: number;
  inactive: number;
  suspended: number;
  expired: number;
  lost: number;
  total_balance: string | number;
};

export type IssueCardPayload = {
  patient_id: number;
  initial_balance?: number;
  expiry_date?: string | null;
};

export type FundCardPayload = {
  amount: number;
  payment_source: string;
  payment_reference?: string;
  narration?: string;
};

// The backend returns a bare array; tolerate an envelope too.
function asArray<T>(data: any): T[] {
  if (Array.isArray(data)) return data as T[];
  if (Array.isArray(data?.items)) return data.items as T[];
  if (Array.isArray(data?.data)) return data.data as T[];
  return [];
}

export const membershipApi = {
  list: (params: { skip?: number; limit?: number; search?: string; status?: string } = {}) =>
    apiClient
      .get<MembershipCard[]>("/membership-cards", { params })
      .then((res) => asArray<MembershipCard>(res.data)),

  stats: () =>
    apiClient.get<MembershipCardStats>("/membership-cards/stats").then((res) => res.data),

  get: (id: number) =>
    apiClient.get<MembershipCardDetail>(`/membership-cards/${id}`).then((res) => res.data),

  /** All membership cards issued to a specific patient (for payment selection). */
  forPatient: (patientId: number) =>
    apiClient
      .get<MembershipCard[]>(`/membership-cards/patient/${patientId}`)
      .then((res) => asArray<MembershipCard>(res.data)),

  transactions: (id: number) =>
    apiClient
      .get<MembershipCardTransaction[]>(`/membership-cards/${id}/transactions`)
      .then((res) => asArray<MembershipCardTransaction>(res.data)),

  issue: (payload: IssueCardPayload) =>
    apiClient.post<MembershipCard>("/membership-cards", payload).then((res) => res.data),

  updateStatus: (id: number, status: MembershipCardStatus) =>
    apiClient.patch<MembershipCard>(`/membership-cards/${id}`, { status }).then((res) => res.data),

  fund: (id: number, facilityId: number, payload: FundCardPayload) =>
    apiClient
      .post(`/membership-cards/${id}/fund`, payload, { params: { facility_id: facilityId } })
      .then((res) => res.data),

  /** Fetch the printable card PDF (auth-protected) as an object URL. */
  cardPdfObjectUrl: (id: number) =>
    apiClient
      .get(`/membership-cards/${id}/card-pdf`, { responseType: "blob" })
      .then((res) => URL.createObjectURL(res.data as Blob)),

  /** Scannable QR PNG (object URL) linking to the card's verification page. */
  cardQrObjectUrl: (id: number, base?: string) =>
    apiClient
      .get(`/membership-cards/${id}/qr`, { responseType: "blob", params: base ? { base } : {} })
      .then((res) => URL.createObjectURL(res.data as Blob)),

  /** Verify a scanned QR payload (or typed card number). */
  verify: (code: string) =>
    apiClient
      .get<CardVerifyResult>("/membership-cards/verify", { params: { code } })
      .then((res) => res.data),

  // Public QR verification — no auth/tenant header; hospital comes from the URL.
  publicVerify: (code: string, hospital?: string) => {
    const client = axios.create({ baseURL: env.apiBaseUrl, headers: { "Content-Type": "application/json" } });
    return client
      .get("/membership-cards/public/verify", { params: { code, ...(hospital ? { h: hospital } : {}) } })
      .then((res) => res.data as CardVerifyResult & { success?: boolean });
  },
};

export type CardVerifyResult = {
  valid: boolean;
  usable?: boolean;
  expired?: boolean;
  message: string;
  card_id?: number;
  card_number?: string;
  status?: string;
  balance?: string | number;
  expiry_date?: string | null;
  date_issued?: string | null;
  patient_id?: number;
  patient_name?: string | null;
  patient_mrn?: string | null;
  issuing_facility_id?: number | null;
  hospital_name?: string | null;
};

// =====================================================================
// Manual funding requests (patient-submitted → staff review)
// =====================================================================

export type FundingRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export type CardFundingRequest = {
  id: number;
  patient_id: number;
  membership_card_id: number;
  amount: string | number;
  payment_method: string;
  payment_reference?: string | null;
  depositor_name?: string | null;
  note?: string | null;
  evidence_file_name?: string | null;
  evidence_file_url?: string | null;
  evidence_content_type?: string | null;
  status: FundingRequestStatus;
  reviewed_by_id?: number | null;
  reviewed_at?: string | null;
  review_note?: string | null;
  transaction_id?: number | null;
  date_created: string;
  card_number?: string | null;
  patient_name?: string | null;
};

export const fundingRequestsApi = {
  list: (status?: FundingRequestStatus | "") =>
    apiClient
      .get<CardFundingRequest[]>("/membership-cards/funding-requests", {
        params: status ? { status } : {},
      })
      .then((res) => asArray<CardFundingRequest>(res.data)),

  approve: (id: number, note?: string) =>
    apiClient
      .post<CardFundingRequest>(`/membership-cards/funding-requests/${id}/approve`, {
        note: note || null,
      })
      .then((res) => res.data),

  reject: (id: number, note?: string) =>
    apiClient
      .post<CardFundingRequest>(`/membership-cards/funding-requests/${id}/reject`, {
        note: note || null,
      })
      .then((res) => res.data),

  /** Fetch the evidence file (auth-protected) as an object URL for preview/download. */
  evidenceObjectUrl: (id: number) =>
    apiClient
      .get(`/membership-cards/funding-requests/${id}/evidence`, { responseType: "blob" })
      .then((res) => URL.createObjectURL(res.data as Blob)),
};

export function formatCardMoney(v: string | number | null | undefined, currency = "NGN"): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(n);
}
