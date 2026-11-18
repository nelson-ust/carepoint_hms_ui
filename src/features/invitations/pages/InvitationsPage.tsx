import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Copy,
  Mail,
  Plus,
  RotateCcw,
  Search,
  Send,
  Timer,
  XCircle,
} from "lucide-react";
import { format, formatDistanceToNow, isValid } from "date-fns";
import {
  DxPage, DxPageHeader, DxPanel, DxKpi, DxGrid, DxBadge, DxButton, DxInput, DxSelect, DxPopup, DxMessage,
  type DxGridColumn, type DxBadgeTone,
} from "@/components/dx";
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

const STATUS_TONE: Record<InvitationStatus, DxBadgeTone> = {
  PENDING: "warning",
  ACCEPTED: "success",
  EXPIRED: "neutral",
  CANCELLED: "danger",
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

  const columns: DxGridColumn<Invitation>[] = [
    {
      key: "recipient", header: "Recipient",
      render: (inv) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--dx-accent-soft)] text-[var(--dx-accent)]">
            <Mail className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-[var(--dx-text)]">{invitationRecipient(inv)}</p>
            <p className="text-[11px] font-medium text-[var(--dx-text-muted)]">
              {invitationName(inv) !== "—" ? invitationName(inv) : "Name pending"} · invited {safeDate(inv.date_created, "MMM d, yyyy")}
            </p>
          </div>
        </div>
      ),
    },
    { key: "roles", header: "Roles", render: (inv) => <DxBadge tone="neutral">{inv.role_ids?.length ? `${inv.role_ids.length} role${inv.role_ids.length > 1 ? "s" : ""}` : "Defaults"}</DxBadge> },
    { key: "status", header: "Status", render: (inv) => <DxBadge tone={STATUS_TONE[inv.status]}>{inv.status}</DxBadge> },
    {
      key: "sent", header: "Last sent",
      render: (inv) => (
        <span className="text-[12px] font-semibold text-[var(--dx-text-muted)]">
          {inv.last_sent_at && isValid(new Date(inv.last_sent_at)) ? formatDistanceToNow(new Date(inv.last_sent_at), { addSuffix: true }) : "—"}
          {inv.resend_count > 0 ? <span className="ml-1.5 text-[10px] font-medium text-[var(--dx-text-faint)]">×{inv.resend_count + 1}</span> : null}
        </span>
      ),
    },
    { key: "expires", header: "Expires", render: (inv) => <span className="dx-mono text-[12px] text-[var(--dx-text-muted)]">{safeDate(inv.expires_at, "MMM d, HH:mm")}</span> },
    {
      key: "actions", header: "", align: "right",
      render: (inv) =>
        inv.status === "PENDING" ? (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <DxButton icon size="sm" variant="text" onClick={() => handleResend(inv)} disabled={resendMutation.isPending} title="Resend invitation (rotates the token)"><Send /></DxButton>
            <DxButton icon size="sm" variant="text" onClick={() => handleResend(inv)} disabled={resendMutation.isPending} title="Copy a fresh accept link (rotates the token)"><Copy /></DxButton>
            <DxButton icon size="sm" variant="outline-danger" onClick={() => setCancelTarget(inv)} disabled={cancelMutation.isPending} title="Cancel invitation"><XCircle /></DxButton>
          </div>
        ) : null,
    },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Administration" }, { label: "Invitations" }]}
        title="Staff Invitations"
        subtitle="Send and manage invitations for new hospital staff members."
        actions={
          <>
            <DxButton
              onClick={() => sweepMutation.mutate(undefined, { onSuccess: () => toast.info("Sweep complete", "Overdue invitations were marked EXPIRED.") })}
              isLoading={sweepMutation.isPending}
              leftIcon={<Timer className="h-4 w-4" />}
            >
              Expire overdue
            </DxButton>
            <DxButton variant="primary" onClick={() => setSendOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>Send invitation</DxButton>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DxKpi label="Total Invitations" value={counts.total} icon={Mail} tone="accent" isLoading={isLoading} />
        <DxKpi label="Pending" value={counts.pending} icon={Clock} tone="warning" isLoading={isLoading} />
        <DxKpi label="Accepted" value={counts.accepted} icon={CheckCircle2} tone="success" isLoading={isLoading} />
        <DxKpi label="Expired" value={counts.expired} icon={XCircle} tone="neutral" isLoading={isLoading} />
      </div>

      <DxPanel flush>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div className="w-full sm:w-80">
            <DxInput leftIcon={<Search className="h-3.5 w-3.5" />} placeholder="Search by name, email or phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-44">
            <DxSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as InvitationStatus | "")} editorSize="sm"
              options={[
                { value: "", label: "All statuses" },
                { value: "PENDING", label: "Pending" },
                { value: "ACCEPTED", label: "Accepted" },
                { value: "EXPIRED", label: "Expired" },
                { value: "CANCELLED", label: "Cancelled" },
              ]} />
          </div>
          <DxButton variant="text" size="sm" onClick={() => refetch()} leftIcon={<RotateCcw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />}>Refresh</DxButton>
        </div>
        <DxGrid
          columns={columns}
          data={filtered}
          rowKey={(inv) => inv.id}
          isLoading={isLoading}
          error={error ? (error as any)?.response?.data?.message || "Unable to load invitations." : null}
          onRetry={() => refetch()}
          empty={{
            icon: Mail,
            title: invitations.length === 0 ? "No invitations yet" : "No matches",
            description: invitations.length === 0 ? "Invite your first team member — they'll receive a secure link to set up their account." : "No invitations match your current search or filter.",
            action: invitations.length === 0 ? <DxButton size="sm" variant="primary" onClick={() => setSendOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>Send invitation</DxButton> : undefined,
          }}
        />
      </DxPanel>

      <SendInvitationModal isOpen={sendOpen} onClose={() => setSendOpen(false)} />

      <DxPopup
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Cancel this invitation?"
        size="sm"
        locked={cancelMutation.isPending}
        footer={
          <>
            <DxButton onClick={() => setCancelTarget(null)} disabled={cancelMutation.isPending}>Keep invitation</DxButton>
            <DxButton
              variant="danger"
              isLoading={cancelMutation.isPending}
              onClick={async () => {
                if (!cancelTarget) return;
                try {
                  await cancelMutation.mutateAsync(cancelTarget.id);
                  toast.success("Invitation cancelled");
                  setCancelTarget(null);
                } catch (err: any) {
                  toast.error("Cancel failed", err?.response?.data?.message || "Please try again.");
                }
              }}
            >
              Cancel Invitation
            </DxButton>
          </>
        }
      >
        <DxMessage tone="danger">
          {cancelTarget ? `${invitationRecipient(cancelTarget)} will no longer be able to use their invite link. This cannot be undone — you can always send a new invitation later.` : ""}
        </DxMessage>
      </DxPopup>
    </DxPage>
  );
}
