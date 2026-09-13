import { apiClient } from "@/lib/api/api-client";
import { localStorageService, storageKeys } from "@/lib/storage/local-storage";

// ====================================================================
// Vocabulary (mirrors app/schemas/notification_schema.py)
// Lifecycle: PENDING -> SENT -> DELIVERED -> READ  (or -> FAILED)
// ====================================================================

export const NOTIFICATION_CHANNELS = ["IN_APP", "EMAIL", "SMS", "WHATSAPP"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_STATUSES = [
  "PENDING",
  "SENT",
  "DELIVERED",
  "READ",
  "FAILED",
] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

// ====================================================================
// Types
// ====================================================================

export type AppNotification = {
  id: number;
  user_id?: number | null;
  patient_id?: number | null;
  template_id?: number | null;
  channel: string;
  status: string;
  recipient_address?: string | null;
  subject?: string | null;
  body: string;
  payload_metadata?: Record<string, unknown> | null;
  scheduled_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

/** Backend paginate_response meta (app/utils/pagination.py). */
type ListMeta = {
  total?: number;
  skip?: number;
  limit?: number;
  current_page?: number;
  page_size?: number;
  total_pages?: number;
  has_next?: boolean;
  has_previous?: boolean;
};

type ListEnvelope<T> = {
  success?: boolean;
  message?: string;
  items?: T[];
  count?: number;
  meta?: ListMeta;
};

type NotificationActionEnvelope = {
  success?: boolean;
  message?: string;
  notification?: AppNotification;
};

/** Normalized, page-based list shape consumed by the UI. */
export type NotificationList = {
  items: AppNotification[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
};

export type ListNotificationsParams = {
  page?: number;
  pageSize?: number;
  /** Server-side unread filter (in-app rows are SENT until marked READ). */
  unreadOnly?: boolean;
  status?: string;
  channel?: string;
  userId?: number;
  patientId?: number;
};

// ====================================================================
// Helpers
// ====================================================================

/**
 * An IN_APP notification is unread until mark-read flips it to READ.
 * Only IN_APP rows count: the backend rejects mark-read for other
 * channels (EMAIL/SMS/WHATSAPP have no read receipt).
 */
export function isUnreadNotification(
  n: Pick<AppNotification, "status" | "channel">,
): boolean {
  return n.channel === "IN_APP" && (n.status === "SENT" || n.status === "DELIVERED");
}

/** Current logged-in user id from local storage (same pattern as other features). */
export function getCurrentUserId(): number | undefined {
  try {
    const raw = localStorageService.get(storageKeys.user);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { id?: number };
    return typeof parsed?.id === "number" ? parsed.id : undefined;
  } catch {
    return undefined;
  }
}

function normalizeList(
  envelope: ListEnvelope<AppNotification>,
  page: number,
  pageSize: number,
): NotificationList {
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

// ====================================================================
// Endpoints (app/api/v1/endpoints/notification_routes.py)
// NOTE: the backend exposes no delete endpoint for notification rows
// (only templates support soft-delete), so no delete function exists here.
// ====================================================================

/** GET /notifications — paginated list with optional filters. */
export async function listNotifications(
  params: ListNotificationsParams = {},
): Promise<NotificationList> {
  const { page = 1, pageSize = 20, unreadOnly, status, channel, userId, patientId } = params;
  const response = await apiClient.get<ListEnvelope<AppNotification>>("/notifications/", {
    params: {
      skip: (page - 1) * pageSize,
      limit: pageSize,
      // "Unread" maps to SENT: in-app deliveries land as SENT and stay
      // there until mark-read flips them to READ.
      status: unreadOnly ? "SENT" : status,
      channel: unreadOnly ? "IN_APP" : channel,
      user_id: userId,
      patient_id: patientId,
    },
  });
  return normalizeList(response.data, page, pageSize);
}

/** GET /notifications/{id} — bare resource. */
export async function getNotification(notificationId: number): Promise<AppNotification> {
  const response = await apiClient.get<AppNotification>(`/notifications/${notificationId}`);
  return response.data;
}

/**
 * Unread badge count: total of IN_APP notifications still in SENT.
 * Uses limit=1 and reads meta.total so the payload stays tiny.
 */
export async function getUnreadNotificationCount(userId?: number): Promise<number> {
  const response = await apiClient.get<ListEnvelope<AppNotification>>("/notifications/", {
    params: { skip: 0, limit: 1, status: "SENT", channel: "IN_APP", user_id: userId },
  });
  const meta = response.data?.meta;
  if (typeof meta?.total === "number") return meta.total;
  return Array.isArray(response.data?.items) ? response.data.items.length : 0;
}

/** POST /notifications/{id}/mark-read — returns the updated notification. */
export async function markNotificationRead(notificationId: number): Promise<AppNotification> {
  const response = await apiClient.post<NotificationActionEnvelope>(
    `/notifications/${notificationId}/mark-read`,
  );
  const n = response.data?.notification;
  if (n) return n;
  // Defensive fallback if the envelope shape ever changes.
  return { id: notificationId, channel: "IN_APP", status: "READ", body: "" };
}

/**
 * "Mark all read" — the backend has no bulk endpoint, so this fans out
 * per-row mark-read calls over the current unread set (capped at 200).
 */
export async function markAllNotificationsRead(
  userId?: number,
): Promise<{ marked: number; failed: number }> {
  const unread = await listNotifications({
    page: 1,
    pageSize: 200,
    unreadOnly: true,
    userId,
  });
  if (unread.items.length === 0) return { marked: 0, failed: 0 };

  const results = await Promise.allSettled(
    unread.items.map((n) => markNotificationRead(n.id)),
  );
  const marked = results.filter((r) => r.status === "fulfilled").length;
  return { marked, failed: results.length - marked };
}

/** POST /notifications/retry-failed — bulk retry FAILED notifications. */
export async function retryFailedNotifications(
  limit = 50,
): Promise<{ success: boolean; message: string; retried: number; failed: number; sent: number }> {
  const response = await apiClient.post<{
    success?: boolean;
    message?: string;
    retried?: number;
    failed?: number;
    sent?: number;
  }>("/notifications/retry-failed", undefined, { params: { limit } });
  const data = response.data ?? {};
  return {
    success: data.success ?? true,
    message: data.message ?? "Retry attempted.",
    retried: data.retried ?? 0,
    failed: data.failed ?? 0,
    sent: data.sent ?? 0,
  };
}
