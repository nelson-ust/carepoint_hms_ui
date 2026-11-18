import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Banknote,
  CreditCard,
  Eye,
  Plus,
  RotateCcw,
  ScanLine,
  Search,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { format, isValid } from "date-fns";
import {
  DxPage, DxPageHeader, DxPanel, DxBadge, DxButton, DxInput, DxSelect, DxMessage,
  type DxBadgeTone,
} from "@/components/dx";
import { apiErrorMessage } from "@/lib/api/api-error";
import {
  membershipApi,
  fundingRequestsApi,
  formatCardMoney,
  type MembershipCard,
} from "../api/membership.api";
import { IssueCardModal } from "../components/IssueCardModal";
import { useNavigate } from "react-router-dom";
import { routes } from "@/config/routes";
import { CardDetailModal } from "../components/CardDetailModal";
import { FundingRequestsModal } from "../components/FundingRequestsModal";
import { VerifyCardModal } from "../components/VerifyCardModal";

const STATUS_FILTERS = ["", "ACTIVE", "SUSPENDED", "INACTIVE", "EXPIRED", "LOST"];

function safeDate(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return isValid(d) ? format(d, "MMM d, yyyy") : "—";
}

function statusTone(status: string): DxBadgeTone {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "SUSPENDED":
    case "INACTIVE":
      return "warning";
    default:
      return "danger";
  }
}

export function MembershipCardsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showIssue, setShowIssue] = useState(false);
  const [showFundingRequests, setShowFundingRequests] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const navigate = useNavigate();
  const [detailCard, setDetailCard] = useState<MembershipCard | null>(null);

  const pendingFundingQuery = useQuery({
    queryKey: ["funding-requests", "PENDING"],
    queryFn: () => fundingRequestsApi.list("PENDING"),
  });
  const pendingFundingCount = pendingFundingQuery.data?.length ?? 0;

  const cardsQuery = useQuery({
    queryKey: ["membership-cards", "list", search, statusFilter],
    queryFn: () =>
      membershipApi.list({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        limit: 200,
      }),
  });
  const statsQuery = useQuery({
    queryKey: ["membership-cards", "stats"],
    queryFn: membershipApi.stats,
  });

  const cards = cardsQuery.data ?? [];
  const stats = statsQuery.data;
  const loadError = cardsQuery.error
    ? apiErrorMessage(cardsQuery.error, "Unable to load membership cards. Please retry.")
    : null;

  const refresh = () => {
    cardsQuery.refetch();
    statsQuery.refetch();
  };

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Patients" }, { label: "Membership Cards" }]}
        title="Membership Cards"
        subtitle="Issue and manage prepaid patient identification & wallet cards."
        actions={
          <>
            <DxButton icon title="Refresh" onClick={refresh} isLoading={cardsQuery.isFetching}><RotateCcw /></DxButton>
            <DxButton leftIcon={<ScanLine className="h-4 w-4" />} onClick={() => setShowVerify(true)}>Scan &amp; verify</DxButton>
            <div className="relative">
              <DxButton leftIcon={<Banknote className="h-4 w-4" />} onClick={() => setShowFundingRequests(true)}>Funding requests</DxButton>
              {pendingFundingCount > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white" style={{ background: "var(--dx-danger)" }}>
                  {pendingFundingCount}
                </span>
              ) : null}
            </div>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowIssue(true)}>Issue new card</DxButton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Summary */}
        <div className="lg:col-span-1">
          <DxPanel title="Card Registry" icon={<ShieldCheck className="h-4 w-4" />}>
            <p className="mb-5 text-[12px] leading-relaxed text-[var(--dx-text-muted)]">
              Prepaid wallet cards patients can fund and use across your service points.
            </p>
            <div className="space-y-3">
              {[
                { label: "Total cards", value: statsQuery.isLoading ? "…" : stats?.total ?? 0, color: "var(--dx-text)" },
                { label: "Active", value: statsQuery.isLoading ? "…" : stats?.active ?? 0, color: "var(--dx-success)" },
                { label: "Suspended / expired", value: statsQuery.isLoading ? "…" : (stats?.suspended ?? 0) + (stats?.expired ?? 0), color: "var(--dx-danger)" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] px-3 py-2">
                  <span className="text-[13px] font-medium text-[var(--dx-text-muted)]">{row.label}</span>
                  <span className="text-[18px] font-bold" style={{ color: row.color }}>{row.value}</span>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-md border border-[var(--dx-accent)] bg-[var(--dx-accent-soft)] px-3 py-2.5">
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--dx-text)]">
                  <Wallet className="h-4 w-4 text-[var(--dx-accent)]" /> Wallet total
                </span>
                <span className="text-[15px] font-bold text-[var(--dx-accent)]">
                  {statsQuery.isLoading ? "…" : formatCardMoney(stats?.total_balance ?? 0)}
                </span>
              </div>
            </div>
          </DxPanel>
        </div>

        {/* Registry */}
        <div className="space-y-4 lg:col-span-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full max-w-sm">
              <DxInput leftIcon={<Search className="h-3.5 w-3.5" />} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by card number or patient name…" />
            </div>
            <div className="w-full sm:w-52">
              <DxSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status"
                options={STATUS_FILTERS.map((s) => ({ value: s, label: s || "All statuses" }))} />
            </div>
          </div>

          {loadError ? (
            <DxMessage tone="danger" action={<DxButton size="sm" onClick={() => cardsQuery.refetch()}>Retry</DxButton>}>{loadError}</DxMessage>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {cardsQuery.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <div key={i} className="dx-skeleton h-44 w-full" />)
            ) : cards.length === 0 && !loadError ? (
              <DxPanel className="col-span-full">
                <div className="py-14 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--dx-surface-sunken)]"><CreditCard className="h-8 w-8 text-[var(--dx-text-faint)]" /></div>
                  <h4 className="text-[16px] font-bold text-[var(--dx-text)]">{search || statusFilter ? "No matching cards" : "No cards issued"}</h4>
                  <p className="mx-auto mt-1 max-w-sm text-[13px] text-[var(--dx-text-muted)]">{search || statusFilter ? "Try a different search or status filter." : "Start issuing identification cards to patients."}</p>
                  {!search && !statusFilter ? (
                    <DxButton className="mx-auto mt-4" variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowIssue(true)}>Issue new card</DxButton>
                  ) : null}
                </div>
              </DxPanel>
            ) : (
              cards.map((card) => (
                <div key={card.id} className="flex flex-col rounded-lg border border-[var(--dx-border)] bg-[var(--dx-surface)] p-5 transition-colors hover:border-[var(--dx-border-strong)]">
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--dx-accent-soft)] text-[var(--dx-accent)]"><CreditCard className="h-5 w-5" /></div>
                      <div className="min-w-0">
                        <h4 className="dx-mono text-[13px] font-bold uppercase tracking-wider text-[var(--dx-text)]">{card.card_number}</h4>
                        <p className="mt-0.5 truncate text-[11px] font-medium text-[var(--dx-text-muted)]">{card.patient_name || `Patient #${card.patient_id}`}</p>
                      </div>
                    </div>
                    <DxBadge tone={statusTone(card.status)}>{card.status}</DxBadge>
                  </div>
                  <div className="mt-auto flex items-end justify-between gap-3 border-t border-[var(--dx-border)] pt-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">Wallet</span>
                      <span className="text-[14px] font-bold text-[var(--dx-accent)]">{formatCardMoney(card.balance)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">Valid thru</span>
                      <span className="text-[12px] font-semibold text-[var(--dx-text)]">{safeDate(card.expiry_date)}</span>
                    </div>
                    <div className="flex gap-2"><DxButton size="sm" variant="default" onClick={() => navigate(routes.cardUsageLog.replace(":cardId", String(card.id)))}>Usage log</DxButton><DxButton size="sm" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={() => setDetailCard(card)}>Manage</DxButton></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <IssueCardModal isOpen={showIssue} onClose={() => setShowIssue(false)} onIssued={refresh} />
      <CardDetailModal card={detailCard} onClose={() => setDetailCard(null)} onChanged={refresh} />
      <FundingRequestsModal
        isOpen={showFundingRequests}
        onClose={() => setShowFundingRequests(false)}
        onChanged={() => {
          refresh();
          pendingFundingQuery.refetch();
        }}
      />
      <VerifyCardModal isOpen={showVerify} onClose={() => setShowVerify(false)} />
    </DxPage>
  );
}
