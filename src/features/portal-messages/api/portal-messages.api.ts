import { apiClient } from "@/lib/api/api-client";

// ====================================================================
// Staff-facing patient message inbox
// (app/api/v1/endpoints/staff_portal_message_routes.py)
// ====================================================================

export type PatientMessage = {
  id: number;
  patient_id?: number | null;
  patient_name?: string | null;
  hospital_number?: string | null;
  subject?: string | null;
  body: string;
  is_read: boolean;
  sent_at?: string | null;
  created_at?: string | null;
};

type ListMeta = {
  total?: number;
  current_page?: number;
  page_size?: number;
  total_pages?: number;
  has_next?: boolean;
};

type ListEnvelope = {
  success?: boolean;
  message?: string;
  items?: PatientMessage[];
  count?: number;
  meta?: ListMeta;
};

export type PatientMessageList = {
  items: PatientMessage[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
};

export type ListPatientMessagesParams = {
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
};

function normalizeList(
  envelope: ListEnvelope,
  page: number,
  pageSize: number,
): PatientMessageList {
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
    pageSize: typeof meta.page_size === "number" ? meta.page_size : pageSize,
    totalPages,
    hasNext: typeof meta.has_next === "boolean" ? meta.has_next : page < totalPages,
  };
}

/** GET /portal-messages — paginated patient message inbox. */
export async function listPatientMessages(
  params: ListPatientMessagesParams = {},
): Promise<PatientMessageList> {
  const { page = 1, pageSize = 20, unreadOnly = false } = params;
  const response = await apiClient.get<ListEnvelope>("/portal-messages", {
    params: {
      skip: (page - 1) * pageSize,
      limit: pageSize,
      unread_only: unreadOnly,
    },
  });
  return normalizeList(response.data, page, pageSize);
}

/** GET /portal-messages/unread-count — number of unread patient messages. */
export async function getUnreadPatientMessageCount(): Promise<number> {
  const response = await apiClient.get<{ success?: boolean; count?: number }>(
    "/portal-messages/unread-count",
  );
  return response.data?.count ?? 0;
}

/** POST /portal-messages/{id}/read — mark a patient message as read. */
export async function markPatientMessageRead(messageId: number): Promise<PatientMessage> {
  const response = await apiClient.post<PatientMessage>(
    `/portal-messages/${messageId}/read`,
  );
  return response.data;
}
