import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Bell, BellRing, CheckCheck, Mail, MessageSquare, Smartphone } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDisclosure } from "@/hooks/useDisclosure";
import { cn } from "@/lib/utils/cn";
import { isSaaSAdmin } from "@/lib/auth/current-user";
import {
  getCurrentUserId,
  isUnreadNotification,
  type AppNotification,
} from "../api/notifications.api";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from "../hooks/use-notifications";

const channelIcons: Record<string, LucideIcon> = {
  IN_APP: Bell,
  EMAIL: Mail,
  SMS: Smartphone,
  WHATSAPP: MessageSquare,
};

function relativeTime(iso?: string | null): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  return formatDistanceToNow(parsed, { addSuffix: true });
}

/**
 * Self-contained topbar bell: unread badge (polled every 60s via
 * react-query refetchInterval) + glass dropdown with the 6 most recent
 * notifications. Mount anywhere inside the router tree.
 */
export function NotificationsBell({ className }: { className?: string }) {
  const userId = getCurrentUserId();
  const { isOpen, close, toggle } = useDisclosure();
  const containerRef = useRef<HTMLDivElement>(null);

  // Platform (SaaS) admins are not tenant users, so the tenant notifications
  // endpoint returns 403 for them. Skip polling entirely to avoid a stream of
  // forbidden requests on every SaaS page.
  const tenantScoped = !isSaaSAdmin();

  const unreadCountQuery = useUnreadNotificationCount(userId, { enabled: tenantScoped });
  const recentQuery = useNotifications(
    { page: 1, pageSize: 6, userId },
    { enabled: isOpen && tenantScoped }
  );
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = unreadCountQuery.data ?? 0;
  const recent = recentQuery.data?.items ?? [];

  // Close on outside click / Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (target && containerRef.current && !containerRef.current.contains(target)) {
        close();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, close]);

  const handleItemClick = (n: AppNotification) => {
    if (isUnreadNotification(n)) {
      markRead.mutate(n.id);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={toggle}
        aria-label={
          unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"
        }
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={cn(
          "relative flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-300",
          "text-secondary-500 hover:bg-primary-500/10 hover:text-primary-600",
          "dark:text-secondary-300 dark:hover:text-primary-300",
          isOpen && "bg-primary-500/10 text-primary-600 dark:text-primary-300"
        )}
      >
        {unreadCount > 0 ? (
          <BellRing className="h-5 w-5" aria-hidden />
        ) : (
          <Bell className="h-5 w-5" aria-hidden />
        )}
        {unreadCount > 0 ? (
          <span className="data-mono absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary-500 px-1 text-[10px] font-bold text-white shadow-glow-sm">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="glass-card absolute right-0 top-full z-50 mt-3 w-[22rem] overflow-hidden p-0 shadow-premium animate-fade-in sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-secondary-100 px-5 py-4 dark:border-white/5">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-secondary-400">
              Notifications
            </p>
            <button
              type="button"
              onClick={() => markAllRead.mutate(userId)}
              disabled={markAllRead.isPending || unreadCount === 0}
              className="flex items-center gap-1.5 text-[11px] font-bold text-primary-600 transition-colors hover:text-primary-500 disabled:opacity-40 dark:text-primary-300"
            >
              <CheckCheck className="h-3.5 w-3.5" aria-hidden />
              Mark all read
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {recentQuery.isLoading ? (
              <div className="space-y-1 px-5 py-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-3">
                    <Skeleton className="h-9 w-9 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentQuery.isError ? (
              <p className="px-5 py-8 text-center text-sm font-semibold text-secondary-500">
                Could not load notifications.
              </p>
            ) : recent.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-500">
                  <Bell className="h-5 w-5" aria-hidden />
                </div>
                <p className="text-sm font-bold text-secondary-900">All caught up</p>
                <p className="text-xs font-medium text-secondary-400">
                  New alerts will appear here.
                </p>
              </div>
            ) : (
              recent.map((n) => {
                const unread = isUnreadNotification(n);
                const ChannelIcon = channelIcons[n.channel] ?? Bell;
                return (
                  <button
                    key={n.id}
                    type="button"
                    role="menuitem"
                    onClick={() => handleItemClick(n)}
                    className={cn(
                      "flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors",
                      "border-b border-secondary-100 last:border-b-0 dark:border-white/5",
                      "hover:bg-primary-500/5",
                      unread && "bg-primary-500/[0.04]"
                    )}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-500/10 text-primary-500">
                      <ChannelIcon className="h-4 w-4" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p
                          className={cn(
                            "truncate text-sm text-secondary-900",
                            unread ? "font-black" : "font-semibold"
                          )}
                        >
                          {n.subject || "Notification"}
                        </p>
                        {unread ? (
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500"
                            aria-label="Unread"
                          />
                        ) : null}
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-xs font-medium text-secondary-500">
                        {n.body}
                      </p>
                      <p className="mt-1 text-[11px] font-semibold text-secondary-400">
                        {relativeTime(n.created_at)}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <Link
            to="/notifications"
            onClick={close}
            className="block border-t border-secondary-100 px-5 py-3.5 text-center text-xs font-black uppercase tracking-widest text-primary-600 transition-colors hover:bg-primary-500/5 dark:border-white/5 dark:text-primary-300"
          >
            View all notifications
          </Link>
        </div>
      ) : null}
    </div>
  );
}
