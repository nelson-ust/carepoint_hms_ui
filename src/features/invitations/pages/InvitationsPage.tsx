import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Copy,
  Mail,
  Plus,
  RefreshCw,
  Send,
  Timer,
  XCircle,
} from "lucide-react";
import { format, formatDistanceToNow, isValid } from "date-fns";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { MetricCard } from "@/components/charts/MetricCard";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { SearchInput } from "@/components/forms/SearchInput";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import {
  useCancelInvitation,
  useInvitations,
  useResendInvitation,
  useSweepInvitations,
} from "../hooks/use-invitations";
import { buildAcceptUrl, invitationName, invitationRecipient } from "../api/invitations.api";
import type { Invitation, InvitationStatus } from "../api/invitations.api";
import { SendInvitationModal } from "../components/SendInvitationModal";

const STATUS_BADGE: Record<InvitationStatus, "soft-warning" | "soft-success" | "secondary" | "soft-danger"> = {
  PENDING: "soft-warning",
  ACCEPTED: "soft-success",
  EXPIRED: "secondary",
  CANCELLED: "soft-danger",
};

function safeDate(value: string | null | undefined, pattern: string, fallback = "—"): string {
  if (!value) return fallback;
  const d = new Date(value);
  return isValid(d) ? format(d, pattern) : fallback;
}

export function InvitationsPage() {
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<InvitationStatus | "">("");
  const [search, setSearch] = useState("");
  const [sendOpen, setSendOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Invitation | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useInvitations(
    statusFilter ? { status: statusFilter } : {},
  );
  const resendMutation = useResendInvitation();
  const cancelMutation = useCancelInvitation();
  const sweepMutation = useSweepInvitations();

  const invitations = data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invitations;
    return invitations.filter((inv) =>
      [inv.email, inv.phone_number, inv.first_name, inv.last_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [invitations, search]);

  const counts = useMemo(() => {
    const by = (s: InvitationStatus) => invitations.filter((i) => i.status === s).length;
    return { pending: by("PENDING"), accepted: by("ACCEPTED"), expired: by("EXPIRED"), total: invitations.length };
  }, [invitations]);

  const handleResend = async (inv: Invitation) => {
    try {
      const res = await resendMutation.mutateAsync(inv.id);
      const link = buildAcceptUrl(res.token, res.accept_url);
      try {
        await navigator.clipboard.writeText(link);
        toast.success("Invitation resent", "A fresh accept link was copied to your clipboard.");
      } catch {
        toast.success("Invitation resent", "Token rotated — the new link is emailed when SMTP is configured.");
      }
    } catch (err: any) {
      toast.error("Resend failed", err?.response?.data?.message || "Please try again.");
    }
  };

  const columns: DataTableColumn<Invitation>[] = [
    {
      key: "recipient",
      header: "Recipient",
      render: (inv) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-500/10 text-primary-500">
            <Mail className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-secondary-900">{invitationRecipient(inv)}</p>
            <p className="text-[11px] font-medium text-secondary-400">
              {invitationName(inv) !== "—" ? invitationName(inv) : "Name pending"} · invited {safeDate(inv.date_created, "MMM d, yyyy")}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "roles",
      header: "Roles",
      render: (inv) => (
        <Badge variant="secondary">{inv.role_ids?.length ? `${inv.role_ids.length} role${inv.role_ids.length > 1 ? "s" : ""}` : "Defaults"}</Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (inv) => <Badge variant={STATUS_BADGE[inv.status]}>{inv.status}</Badge>,
    },
    {
      key: "sent",
      header: "Last sent",
      render: (inv) => (
        <span className="text-xs font-bold text-secondary-500">
          {inv.last_sent_at && isValid(new Date(inv.last_sent_at))
            ? formatDistanceToNow(new Date(inv.last_sent_at), { addSuffix: true })
            : "—"}
          {inv.resend_count > 0 ? (
            <span className="ml-1.5 text-[10px] font-medium text-secondary-400">×{inv.resend_count + 1}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: "expires",
      header: "Expires",
      render: (inv) => (
        <span className="data-mono text-xs text-secondary-500">{safeDate(inv.expires_at, "MMM d, HH:mm")}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (inv) =>
        inv.status === "PENDING" ? (
          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => handleResend(inv)}
              disabled={resendMutation.isPending}
              className="btn-ghost px-2.5 py-2 text-xs"
              title="Resend invitation (rotates the token)"
            >
              <Send className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleResend(inv)}
              disabled={resendMutation.isPending}
              className="btn-ghost px-2.5 py-2 text-xs"
              title="Copy a fresh accept link (rotates the token)"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCancelTarget(inv)}
              disabled={cancelMutation.isPending}
              className="btn-ghost px-2.5 py-2 text-xs text-rose-500 hover:text-rose-600"
              title="Cancel invitation"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <PageHeader
        title="Staff Invitations"
        description="Send and manage invitations for new hospital staff members."
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() => sweepMutation.mutate(undefined, {
                onSuccess: () => toast.info("Sweep complete", "Overdue invitations were marked EXPIRED."),
              })}
              isLoading={sweepMutation.isPending}
              leftIcon={<Timer className="h-4 w-4" />}
            >
              Expire overdue
            </Button>
            <Button onClick={() => setSendOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
              Send Invitation
            </Button>
          </>
        }
      />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Invitations" value={counts.total} icon={Mail} tone="primary" isLoading={isLoading} />
        <MetricCard label="Pending" value={counts.pending} icon={Clock} tone="amber" isLoading={isLoading} />
        <MetricCard label="Accepted" value={counts.accepted} icon={CheckCircle2} tone="cyan" isLoading={isLoading} />
        <MetricCard label="Expired" value={counts.expired} icon={XCircle} tone="slate" isLoading={isLoading} />
      </div>

      <Card padding="none">
        <div className="flex flex-wrap items-center gap-3 px-6 py-4">
          <SearchInput onSearch={setSearch} placeholder="Search by name, email or phone…" className="w-full sm:w-80" />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as InvitationStatus | "")}
            className="w-44 py-2.5"
            options={[
              { value: "", label: "All statuses" },
              { value: "PENDING", label: "Pending" },
              { value: "ACCEPTED", label: "Accepted" },
              { value: "EXPIRED", label: "Expired" },
              { value: "CANCELLED", label: "Cancelled" },
            ]}
          />
          <Button variant="ghost" size="sm" onClick={() => refetch()} leftIcon={<RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />}>
            Refresh
          </Button>
        </div>
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(inv) => inv.id}
          isLoading={isLoading}
          error={error ? (error as any)?.response?.data?.message || "Unable to load invitations." : null}
          onRetry={() => refetch()}
          empty={{
            icon: Mail,
            title: invitations.length === 0 ? "No invitations yet" : "No matches",
            description:
              invitations.length === 0
                ? "Invite your first team member — they'll receive a secure link to set up their account."
                : "No invitations match your current search or filter.",
            action:
              invitations.length === 0 ? (
                <Button size="sm" onClick={() => setSendOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
                  Send Invitation
                </Button>
              ) : undefined,
          }}
        />
      </Card>

      <SendInvitationModal isOpen={sendOpen} onClose={() => setSendOpen(false)} />

      <ConfirmDialog
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Cancel this invitation?"
        description={
          cancelTarget
            ? `${invitationRecipient(cancelTarget)} will no longer be able to use their invite link. This cannot be undone — you can always send a new invitation later.`
            : undefined
        }
        confirmLabel="Cancel Invitation"
        tone="danger"
        onConfirm={async () => {
          if (!cancelTarget) return;
          try {
            await cancelMutation.mutateAsync(cancelTarget.id);
            toast.success("Invitation cancelled");
          } catch (err: any) {
            toast.error("Cancel failed", err?.response?.data?.message || "Please try again.");
            throw err;
          }
        }}
      />
    </div>
  );
}
