import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  Bell,
  BellRing,
  CheckCheck,
  Inbox,
  Mail,
  MessageSquare,
  RotateCcw,
  Smartphone,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/data-table/Pagination";
import { useToast } from "@/components/feedback/ToastProvider";
import { cn } from "@/lib/utils/cn";
import {
  getCurrentUserId,
  isUnreadNotification,
  type AppNotification,
} from "../api/notifications.api";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useRetryFailedNotifications,
  useUnreadNotificationCount,
} from "../hooks/use-notifications";

const PAGE_SIZE = 20;

type InboxTab = "all" | "unread";

const channelIcons: Record<string, LucideIcon> = {
  IN_APP: Bell,
  EMAIL: Mail,
  SMS: Smartphone,
  WHATSAPP: MessageSquare,
};

const channelChipClasses: Record<string, string> = {
  IN_APP: "bg-primary-500/10 text-primary-500",
  EMAIL: "bg-cyan-500/10 text-cyan-500",
  SMS: "bg-violet-500/10 text-violet-500",
  WHATSAPP: "bg-emerald-500/10 text-emerald-500",
};

const statusVariants: Record<string, BadgeProps["variant"]> = {
  PENDING: "soft-warning",
  SENT: "soft-info",
  DELIVERED: "soft-info",
  READ: "soft-success",
  FAILED: "soft-danger",
};

const channelOptions = [
  { value: "", label: "All channels" },
  { value: "IN_APP", label: "In-app" },
  { value: "EMAIL", label: "Email" },
  { value: "SMS", label: "SMS" },
  { value: "WHATSAPP", label: "WhatsApp" },
];

export function relativeTime(iso?: string | null): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  return formatDistanceToNow(parsed, { addSuffix: true });
}

function NotificationRow({
  notification,
  onClick,
  isMarking,
}: {
  notification: AppNotification;
  onClick: (n: AppNotification) => void;
  isMarking: boolean;
}) {
  const unread = isUnreadNotification(notification);
  const ChannelIcon = channelIcons[notification.channel] ?? Bell;

  return (
    <button
      type="button"
      onClick={() => onClick(notification)}
      disabled={isMarking}
      className={cn(
        "flex w-full items-start gap-4 px-6 py-5 text-left transition-colors",
        "border-b border-secondary-100 last:border-b-0 dark:border-white/5",
        "hover:bg-primary-500/5",
        unread && "bg-primary-500/[0.04]"
      )}
    >
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
          channelChipClasses[notification.channel] ?? "bg-secondary-500/10 text-secondary-500"
        )}
      >
        <ChannelIcon className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p
            className={cn(
              "truncate text-sm text-secondary-900",
              unread ? "font-black" : "font-bold"
            )}
          >
            {notification.subject || "Notification"}
          </p>
          {unread ? (
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary-500 shadow-glow-sm" aria-label="Unread" />
          ) : null}
        </div>
        <p className="mt-1 line-clamp-2 text-sm font-medium text-secondary-500">
          {notification.body}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant={statusVariants[notification.status] ?? "secondary"}>
            {notification.status}
          </Badge>
          <span className="text-xs font-semibold text-secondary-400">
            {relativeTime(notification.created_at)}
          </span>
        </div>
      </div>
    </button>
  );
}

export function NotificationsPage() {
  const toast = useToast();
  const userId = getCurrentUserId();

  const [tab, setTab] = useState<InboxTab>("all");
  const [channel, setChannel] = useState<string>("");
  const [page, setPage] = useState(1);

  const listParams = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      unreadOnly: tab === "unread",
      channel: tab === "all" && channel ? channel : undefined,
      userId,
    }),
    [page, tab, channel, userId]
  );

  const listQuery = useNotifications(listParams);
  const unreadCountQuery = useUnreadNotificationCount(userId);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const retryFailed = useRetryFailedNotifications();

  const list = listQuery.data;
  const unreadCount = unreadCountQuery.data ?? 0;

  const switchTab = (next: InboxTab) => {
    setTab(next);
    setPage(1);
  };

  const handleRowClick = (n: AppNotification) => {
    if (!isUnreadNotification(n)) return;
    markRead.mutate(n.id, {
      onError: () => toast.error("Could not mark notification as read."),
    });
  };

  const handleRetryFailed = () => {
    retryFailed.mutate(50, {
      onSuccess: ({ sent, failed, retried }) => {
        if (retried === 0) {
          toast.info("No failed notifications to retry.");
        } else if (failed > 0) {
          toast.warning(`Retried ${retried}: ${sent} sent, ${failed} still failing.`);
        } else {
          toast.success(`Retried ${retried} notification${retried === 1 ? "" : "s"}; ${sent} sent.`);
        }
      },
      onError: () => toast.error("Could not retry failed notifications."),
    });
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate(userId, {
      onSuccess: ({ marked, failed }) => {
        if (failed > 0) {
          toast.warning(`Marked ${marked} read; ${failed} failed.`);
        } else if (marked === 0) {
          toast.info("You're all caught up.");
        } else {
          toast.success(`Marked ${marked} notification${marked === 1 ? "" : "s"} as read.`);
        }
      },
      onError: () => toast.error("Could not mark notifications as read."),
    });
  };

  const tabs: { key: InboxTab; label: string; count?: number }[] = [
    { key: "all", label: "All" },
    { key: "unread", label: "Unread", count: unreadCount },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Notifications"
        description="In-app alerts, emails and messages dispatched across your hospital."
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              leftIcon={<RotateCcw className="h-4 w-4" />}
              onClick={handleRetryFailed}
              isLoading={retryFailed.isPending}
            >
              Retry failed
            </Button>
            <Button
              variant="secondary"
              leftIcon={<CheckCheck className="h-4 w-4" />}
              onClick={handleMarkAllRead}
              isLoading={markAllRead.isPending}
              disabled={unreadCount === 0 && !unreadCountQuery.isLoading}
            >
              Mark all read
            </Button>
          </div>
        }
      />

      <Card padding="none">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-2 rounded-2xl bg-secondary-500/5 p-1 dark:bg-white/5">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => switchTab(t.key)}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest transition-all",
                  tab === t.key
                    ? "bg-primary-500/10 text-primary-600 shadow-glow-sm dark:text-primary-300"
                    : "text-secondary-400 hover:text-secondary-600 dark:hover:text-secondary-200"
                )}
              >
                {t.label}
                {typeof t.count === "number" && t.count > 0 ? (
                  <span className="data-mono rounded-full bg-primary-500/15 px-2 py-0.5 text-[10px] font-bold text-primary-600 dark:text-primary-300">
                    {t.count > 99 ? "99+" : t.count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          {tab === "all" ? (
            <div className="w-44">
              <Select
                aria-label="Filter by channel"
                options={channelOptions}
                value={channel}
                onChange={(e) => {
                  setChannel(e.target.value);
                  setPage(1);
                }}
                className="py-2.5"
              />
            </div>
          ) : null}
        </div>

        {listQuery.isLoading ? (
          <div className="space-y-1 border-t border-secondary-100 px-6 py-4 dark:border-white/5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-4">
                <Skeleton className="h-11 w-11 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : listQuery.isError ? (
          <div className="flex flex-col items-center gap-3 border-t border-secondary-100 px-8 py-14 text-center dark:border-white/5">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-rose-500/10 text-rose-500">
              <AlertCircle className="h-7 w-7" aria-hidden />
            </div>
            <p className="text-sm font-bold text-secondary-900">
              Could not load notifications.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => listQuery.refetch()}
              leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
            >
              Retry
            </Button>
          </div>
        ) : !list || list.items.length === 0 ? (
          <div className="border-t border-secondary-100 dark:border-white/5">
            <EmptyState
              icon={tab === "unread" ? BellRing : Inbox}
              title={tab === "unread" ? "No unread notifications" : "No notifications yet"}
              description={
                tab === "unread"
                  ? "You're all caught up. New alerts will land here first."
                  : "System alerts and dispatched messages will appear here."
              }
            />
          </div>
        ) : (
          <>
            <div className="border-t border-secondary-100 dark:border-white/5">
              {list.items.map((n) => (
                <NotificationRow
                  key={n.id}
                  notification={n}
                  onClick={handleRowClick}
                  isMarking={markRead.isPending && markRead.variables === n.id}
                />
              ))}
            </div>
            <Pagination
              page={page}
              totalPages={list.totalPages}
              totalItems={list.total}
              pageSize={list.pageSize}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
    </div>
  );
}
