import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  Check,
  Inbox,
  MailOpen,
  MessageSquare,
  RotateCcw,
  UserRound,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/data-table/Pagination";
import { useToast } from "@/components/feedback/ToastProvider";
import { cn } from "@/lib/utils/cn";
import type { PatientMessage } from "../api/portal-messages.api";
import {
  usePatientMessages,
  useMarkPatientMessageRead,
  useUnreadPatientMessageCount,
} from "../hooks/use-portal-messages";

const PAGE_SIZE = 20;

type InboxTab = "all" | "unread";

function relativeTime(iso?: string | null): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  return formatDistanceToNow(parsed, { addSuffix: true });
}

function MessageRow({
  message,
  onMarkRead,
  isMarking,
}: {
  message: PatientMessage;
  onMarkRead: (m: PatientMessage) => void;
  isMarking: boolean;
}) {
  const unread = !message.is_read;
  return (
    <div
      className={cn(
        "flex items-start gap-4 px-6 py-5 transition-colors",
        "border-b border-secondary-100 last:border-b-0 dark:border-white/5",
        unread && "bg-primary-500/[0.04]",
      )}
    >
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
          unread ? "bg-primary-500/10 text-primary-500" : "bg-secondary-500/10 text-secondary-500",
        )}
      >
        <MessageSquare className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-bold text-secondary-500">
            <UserRound className="h-3.5 w-3.5" aria-hidden />
            {message.patient_name || `Patient #${message.patient_id ?? "—"}`}
          </span>
          {message.hospital_number ? (
            <span className="data-mono text-[11px] text-secondary-400">
              {message.hospital_number}
            </span>
          ) : null}
          {unread ? (
            <Badge variant="soft-warning">New</Badge>
          ) : (
            <Badge variant="secondary">Read</Badge>
          )}
        </div>
        <p
          className={cn(
            "mt-1 truncate text-sm text-secondary-900",
            unread ? "font-black" : "font-bold",
          )}
        >
          {message.subject || "(no subject)"}
        </p>
        <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm font-medium text-secondary-500">
          {message.body}
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-semibold text-secondary-400">
            {relativeTime(message.sent_at || message.created_at)}
          </span>
          {unread ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMarkRead(message)}
              isLoading={isMarking}
              leftIcon={<Check className="h-4 w-4" />}
            >
              Mark as read
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Staff dashboard inbox for messages patients send through the portal. */
export function PatientMessagesPage() {
  const toast = useToast();
  const [tab, setTab] = useState<InboxTab>("all");
  const [page, setPage] = useState(1);

  const params = useMemo(
    () => ({ page, pageSize: PAGE_SIZE, unreadOnly: tab === "unread" }),
    [page, tab],
  );

  const listQuery = usePatientMessages(params);
  const unreadCountQuery = useUnreadPatientMessageCount();
  const markRead = useMarkPatientMessageRead();

  const list = listQuery.data;
  const unreadCount = unreadCountQuery.data ?? 0;

  const switchTab = (next: InboxTab) => {
    setTab(next);
    setPage(1);
  };

  const handleMarkRead = (m: PatientMessage) => {
    markRead.mutate(m.id, {
      onError: () => toast.error("Could not mark the message as read."),
    });
  };

  const tabs: { key: InboxTab; label: string; count?: number }[] = [
    { key: "all", label: "All" },
    { key: "unread", label: "Unread", count: unreadCount },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Patient Messages"
        description="Secure messages sent in by patients through the portal."
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
                    : "text-secondary-400 hover:text-secondary-600 dark:hover:text-secondary-200",
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
              Could not load patient messages.
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
              icon={tab === "unread" ? MailOpen : Inbox}
              title={tab === "unread" ? "No unread messages" : "No patient messages yet"}
              description={
                tab === "unread"
                  ? "You're all caught up. New patient messages will appear here."
                  : "Messages patients send from the portal will show up here."
              }
            />
          </div>
        ) : (
          <>
            <div className="border-t border-secondary-100 dark:border-white/5">
              {list.items.map((m) => (
                <MessageRow
                  key={m.id}
                  message={m}
                  onMarkRead={handleMarkRead}
                  isMarking={markRead.isPending && markRead.variables === m.id}
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
