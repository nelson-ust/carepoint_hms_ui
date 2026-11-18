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
import {
  DxPage,
  DxPageHeader,
  DxPanel,
  DxBadge,
  DxButton,
  DxSelect,
  DxTabs,
  DxPager,
  type DxBadgeTone,
  type DxTabItem,
} from "@/components/dx";
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

// Data-driven channel chip tints — dx tokens, theme-aware.
const channelChips: Record<string, { background: string; color: string }> = {
  IN_APP: { background: "var(--dx-accent-soft)", color: "var(--dx-accent)" },
  EMAIL: { background: "var(--dx-info-soft)", color: "var(--dx-info)" },
  SMS: { background: "var(--dx-warning-soft)", color: "var(--dx-warning)" },
  WHATSAPP: { background: "var(--dx-success-soft)", color: "var(--dx-success)" },
};

const defaultChip = { background: "var(--dx-surface-sunken)", color: "var(--dx-text-muted)" };

function statusTone(status: string): DxBadgeTone {
  switch (status) {
    case "PENDING":
      return "warning";
    case "SENT":
    case "DELIVERED":
      return "info";
    case "READ":
      return "success";
    case "FAILED":
      return "danger";
    default:
      return "neutral";
  }
}

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
        "flex w-full items-start gap-4 border-b border-[var(--dx-border)] px-6 py-5 text-left transition-colors last:border-b-0 hover:bg-[var(--dx-surface-sunken)]",
        unread && "bg-[var(--dx-accent-soft)]",
      )}
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
        style={channelChips[notification.channel] ?? defaultChip}
      >
        <ChannelIcon className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn("truncate text-[13px] text-[var(--dx-text)]", unread ? "font-bold" : "font-semibold")}>
            {notification.subject || "Notification"}
          </p>
          {unread ? (
            <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--dx-accent)]" aria-label="Unread" />
          ) : null}
        </div>
        <p className="mt-1 line-clamp-2 text-[13px] font-medium text-[var(--dx-text-muted)]">
          {notification.body}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <DxBadge tone={statusTone(notification.status)} dot>
            {notification.status}
          </DxBadge>
          <span className="text-[12px] font-medium text-[var(--dx-text-muted)]">
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

  const tabs: DxTabItem<InboxTab>[] = [
    { key: "all", label: "All" },
    { key: "unread", label: "Unread", count: unreadCount > 0 ? unreadCount : null },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Communication" }, { label: "Notifications" }]}
        title="Notifications"
        subtitle="In-app alerts, emails and messages dispatched across your hospital."
        actions={
          <>
            <DxButton
              leftIcon={<RotateCcw className="h-4 w-4" />}
              onClick={handleRetryFailed}
              isLoading={retryFailed.isPending}
            >
              Retry failed
            </DxButton>
            <DxButton
              variant="primary"
              leftIcon={<CheckCheck className="h-4 w-4" />}
              onClick={handleMarkAllRead}
              isLoading={markAllRead.isPending}
              disabled={unreadCount === 0 && !unreadCountQuery.isLoading}
            >
              Mark all read
            </DxButton>
          </>
        }
      />

      <DxPanel flush>
        <div className="px-4 pt-2">
          <DxTabs
            items={tabs}
            value={tab}
            onChange={switchTab}
            trailing={
              tab === "all" ? (
                <div className="w-44">
                  <DxSelect
                    aria-label="Filter by channel"
                    options={channelOptions}
                    value={channel}
                    editorSize="sm"
                    onChange={(e) => {
                      setChannel(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
              ) : null
            }
          />
        </div>

        {listQuery.isLoading ? (
          <div className="space-y-1 border-t border-[var(--dx-border)] px-6 py-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-4">
                <div className="dx-skeleton h-11 w-11 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="dx-skeleton h-4 w-1/3" />
                  <div className="dx-skeleton h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : listQuery.isError ? (
          <div className="flex flex-col items-center gap-3 border-t border-[var(--dx-border)] px-8 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--dx-danger-soft)]" style={{ color: "var(--dx-danger)" }}>
              <AlertCircle className="h-7 w-7" aria-hidden />
            </div>
            <p className="text-[13px] font-semibold text-[var(--dx-text)]">Could not load notifications.</p>
            <DxButton
              size="sm"
              onClick={() => listQuery.refetch()}
              leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
            >
              Retry
            </DxButton>
          </div>
        ) : !list || list.items.length === 0 ? (
          <div className="border-t border-[var(--dx-border)]">
            <div className="py-16 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--dx-surface-sunken)]">
                {tab === "unread" ? (
                  <BellRing className="h-8 w-8 text-[var(--dx-text-faint)]" />
                ) : (
                  <Inbox className="h-8 w-8 text-[var(--dx-text-faint)]" />
                )}
              </div>
              <h4 className="text-[16px] font-bold text-[var(--dx-text)]">
                {tab === "unread" ? "No unread notifications" : "No notifications yet"}
              </h4>
              <p className="mx-auto mt-1 max-w-sm text-[13px] text-[var(--dx-text-muted)]">
                {tab === "unread"
                  ? "You're all caught up. New alerts will land here first."
                  : "System alerts and dispatched messages will appear here."}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="border-t border-[var(--dx-border)]">
              {list.items.map((n) => (
                <NotificationRow
                  key={n.id}
                  notification={n}
                  onClick={handleRowClick}
                  isMarking={markRead.isPending && markRead.variables === n.id}
                />
              ))}
            </div>
            <DxPager
              page={page}
              totalPages={list.totalPages}
              totalItems={list.total}
              pageSize={list.pageSize}
              onPageChange={setPage}
            />
          </>
        )}
      </DxPanel>
    </DxPage>
  );
}
