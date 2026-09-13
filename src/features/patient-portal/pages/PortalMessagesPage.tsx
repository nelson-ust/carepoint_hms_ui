import { useState } from "react";
import {
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  MailOpen,
  MessageSquare,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/feedback/ToastProvider";
import { cn } from "@/lib/utils/cn";
import {
  usePortalMessages,
  useMarkPortalMessageRead,
  useMarkAllPortalMessagesRead,
} from "../hooks/use-portal";
import { portalErrorMessage } from "../api/portal.api";

const PAGE_SIZE = 20;

type FeedFilter = "unread" | "all";

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Patient inbox for messages the hospital has sent.
 *
 * Unread messages show by default; opening (acknowledging) one clears it from
 * the unread feed. A filter switches to the full history and "Mark all as read"
 * clears the queue at once.
 */
export function PortalMessagesPage() {
  const toast = useToast();
  const [filter, setFilter] = useState<FeedFilter>("unread");
  const [page, setPage] = useState(1);

  const unreadOnly = filter === "unread";
  const skip = (page - 1) * PAGE_SIZE;
  const { data, isLoading, isError, refetch } = usePortalMessages(
    skip,
    PAGE_SIZE,
    unreadOnly,
  );

  const markRead = useMarkPortalMessageRead();
  const markAllRead = useMarkAllPortalMessagesRead();

  const messages = data ?? [];
  const hasNext = messages.length === PAGE_SIZE;
  const hasUnreadOnPage = messages.some((m) => !m.is_read);

  function changeFilter(next: FeedFilter) {
    if (next === filter) return;
    setFilter(next);
    setPage(1);
  }

  function handleMarkRead(id: number) {
    markRead.mutate(id, {
      onError: (err) =>
        toast.error("Couldn't mark as read", portalErrorMessage(err, "Please try again.")),
    });
  }

  function handleMarkAllRead() {
    markAllRead.mutate(undefined, {
      onSuccess: (res) => {
        if (res.updated > 0) {
          toast.success(
            "All caught up",
            `${res.updated} message${res.updated === 1 ? "" : "s"} marked as read.`,
          );
        } else {
          toast.info("Nothing to clear", "You have no unread messages.");
        }
      },
      onError: (err) =>
        toast.error("Couldn't clear messages", portalErrorMessage(err, "Please try again.")),
    });
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        eyebrow="Patient portal"
        title="Messages"
        description="Announcements and messages from your hospital."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Filter messages"
          className="inline-flex rounded-2xl border border-secondary-100 bg-white/60 p-1 dark:border-white/10 dark:bg-secondary-950/40"
        >
          {(["unread", "all"] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              onClick={() => changeFilter(key)}
              className={cn(
                "rounded-xl px-4 py-1.5 text-xs font-bold uppercase tracking-widest transition-all",
                filter === key
                  ? "bg-primary-500/10 text-primary-600 shadow-glow-sm dark:text-primary-300"
                  : "text-secondary-500 hover:text-secondary-900 dark:hover:text-secondary-100",
              )}
            >
              {key === "unread" ? "Unread" : "All"}
            </button>
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleMarkAllRead}
          isLoading={markAllRead.isPending}
          disabled={!hasUnreadOnPage && !markAllRead.isPending}
          leftIcon={<CheckCheck className="h-4 w-4" />}
        >
          Mark all as read
        </Button>
      </div>

      {isError ? (
        <Card>
          <EmptyState
            icon={MessageSquare}
            title="We couldn't load your messages"
            description="Please check your connection and try again."
            action={<Button onClick={() => refetch()}>Retry</Button>}
          />
        </Card>
      ) : isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <div className="space-y-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </Card>
          ))}
        </div>
      ) : messages.length === 0 ? (
        <Card>
          <EmptyState
            icon={MessageSquare}
            title={unreadOnly ? "You're all caught up" : "No messages yet"}
            description={
              unreadOnly
                ? "You have no unread messages. Switch to “All” to review your history."
                : "Messages from your hospital will appear here."
            }
          />
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {messages.map((m) => {
              const read = m.is_read;
              const isMarkingThis = markRead.isPending && markRead.variables === m.id;
              return (
                <Card
                  key={m.id}
                  variant="panel"
                  className={cn("p-5 transition-opacity sm:p-6", read && "opacity-70")}
                >
                  <div className="flex items-start gap-4">
                    <span
                      className={cn(
                        "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                        read
                          ? "bg-secondary-500/10 text-secondary-400"
                          : "bg-primary-500/10 text-primary-500",
                      )}
                    >
                      {read ? (
                        <MailOpen className="h-5 w-5" aria-hidden />
                      ) : (
                        <MessageSquare className="h-5 w-5" aria-hidden />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {!read ? (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-primary-500" aria-hidden />
                        ) : null}
                        {m.subject ? (
                          <h3
                            className={cn(
                              "text-sm text-secondary-900 dark:text-secondary-100",
                              read ? "font-semibold" : "font-bold",
                            )}
                          >
                            {m.subject}
                          </h3>
                        ) : null}
                        {read ? (
                          <Badge variant="secondary">Read</Badge>
                        ) : (
                          <Badge variant="soft-info">New</Badge>
                        )}
                      </div>
                      <p className="mt-1.5 whitespace-pre-line text-sm font-medium text-secondary-500">
                        {m.body}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-secondary-400">{formatDateTime(m.sent_at)}</p>
                        {!read ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMarkRead(m.id)}
                            isLoading={isMarkingThis}
                            disabled={markRead.isPending}
                            leftIcon={<Check className="h-4 w-4" />}
                          >
                            Mark as read
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {page > 1 || hasNext ? (
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                leftIcon={<ChevronLeft className="h-4 w-4" />}
              >
                Previous
              </Button>
              <span className="text-xs font-bold uppercase tracking-widest text-secondary-400">
                Page {page}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={!hasNext}
                onClick={() => setPage((p) => p + 1)}
                rightIcon={<ChevronRight className="h-4 w-4" />}
              >
                Next
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
