import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  getCurrentUserId,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  retryFailedNotifications,
  type ListNotificationsParams,
} from "../api/notifications.api";

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (params: ListNotificationsParams) => [...notificationKeys.all, "list", params] as const,
  unreadCount: (userId?: number) =>
    [...notificationKeys.all, "unread-count", userId ?? "any"] as const,
};

/** Paginated notification list (keeps previous page while fetching). */
export function useNotifications(
  params: ListNotificationsParams = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: () => listNotifications(params),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

/** Unread badge count, polled every 60s for the topbar bell. */
export function useUnreadNotificationCount(
  userId: number | undefined = getCurrentUserId(),
  options: { enabled?: boolean } = {},
) {
  const enabled = options.enabled ?? true;
  return useQuery({
    queryKey: notificationKeys.unreadCount(userId),
    queryFn: () => getUnreadNotificationCount(userId),
    refetchInterval: enabled ? 120_000 : false,
    staleTime: 30_000,
    enabled,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: number) => markNotificationRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId?: number) => markAllNotificationsRead(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

/** Bulk-retry FAILED notification deliveries (email/SMS/etc.). */
export function useRetryFailedNotifications() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (limit?: number) => retryFailedNotifications(limit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
