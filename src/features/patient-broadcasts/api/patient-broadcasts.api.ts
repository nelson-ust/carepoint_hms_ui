import { apiClient } from "@/lib/api/api-client";

// ====================================================================
// Hospital → patient outbound messaging ("broadcasts")
// (app/api/v1/endpoints/patient_broadcast_routes.py)
// ====================================================================

export type BroadcastAudience = "SINGLE" | "GROUP" | "ALL";
export type BroadcastChannel = "IN_APP" | "EMAIL" | "SMS";
export type BroadcastStatus = "SENT" | "PARTIAL" | "FAILED";

export type SendBroadcastPayload = {
  audience_type: BroadcastAudience;
  patient_ids: number[];
  subject?: string | null;
  body: string;
  channels: BroadcastChannel[];
};

export type Broadcast = {
  id: number;
  subject?: string | null;
  body: string;
  audience_type: BroadcastAudience;
  channels?: BroadcastChannel[] | null;
  recipient_count: number;
  read_count: number;
  email_sent_count: number;
  sms_sent_count: number;
  status: BroadcastStatus;
  sent_by_user_id?: number | null;
  sent_by_name?: string | null;
  sent_at?: string | null;
  created_at?: string | null;
};

type ListEnvelope = {
  success?: boolean;
  message?: string;
  items?: Broadcast[];
  count?: number;
  meta?: {
    total?: number;
    current_page?: number;
    total_pages?: number;
    has_next?: boolean;
  };
};

export type BroadcastList = {
  items: Broadcast[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
};

export type ListBroadcastsParams = { page?: number; pageSize?: number };

function normalizeList(
  envelope: ListEnvelope,
  page: number,
  pageSize: number,
): BroadcastList {
  const items = Array.isArray(envelope?.items) ? envelope.items : [];
  const meta = envelope?.meta ?? {};
  const total = typeof meta.total === "number" ? meta.total : items.length;
  const totalPages =
    typeof meta.total_pages === "number"
      ? meta.total_pages
      : Math.max(1, Math.ceil(total / pageSize));
  return {
    items,
    total,
    page: typeof meta.current_page === "number" ? meta.current_page : page,
    pageSize,
    totalPages,
    hasNext: typeof meta.has_next === "boolean" ? meta.has_next : page < totalPages,
  };
}

/** POST /patient-broadcasts — send a message to one, several, or all patients. */
export async function sendBroadcast(payload: SendBroadcastPayload): Promise<Broadcast> {
  const response = await apiClient.post<{ success: boolean; message: string; broadcast: Broadcast }>(
    "/patient-broadcasts",
    payload,
  );
  return response.data.broadcast;
}

/** GET /patient-broadcasts — paginated history of sent messages. */
export async function listBroadcasts(
  params: ListBroadcastsParams = {},
): Promise<BroadcastList> {
  const { page = 1, pageSize = 20 } = params;
  const response = await apiClient.get<ListEnvelope>("/patient-broadcasts", {
    params: { skip: (page - 1) * pageSize, limit: pageSize },
  });
  return normalizeList(response.data, page, pageSize);
}

/** POST /patient-broadcasts/audience-preview — count patients an audience reaches. */
export async function previewAudience(
  audience_type: BroadcastAudience,
  patient_ids: number[],
): Promise<number> {
  const response = await apiClient.post<{ audience_type: string; recipient_count: number }>(
    "/patient-broadcasts/audience-preview",
    { audience_type, patient_ids },
  );
  return response.data?.recipient_count ?? 0;
}
