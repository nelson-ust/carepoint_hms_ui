import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Banknote,
  CreditCard,
  Eye,
  Plus,
  RefreshCw,
  ScanLine,
  Search,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { format, isValid } from "date-fns";
import { PageHeader } from "@/components/layout/PageHeader";
import { apiErrorMessage } from "@/lib/api/api-error";
import {
  membershipApi,
  fundingRequestsApi,
  formatCardMoney,
  type MembershipCard,
} from "../api/membership.api";
import { IssueCardModal } from "../components/IssueCardModal";
import { CardDetailModal } from "../components/CardDetailModal";
import { FundingRequestsModal } from "../components/FundingRequestsModal";
import { VerifyCardModal } from "../components/VerifyCardModal";

const STATUS_FILTERS = ["", "ACTIVE", "SUSPENDED", "INACTIVE", "EXPIRED", "LOST"];

function safeDate(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return isValid(d) ? format(d, "MMM d, yyyy") : "—";
}

function statusClasses(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-50 text-emerald-600 border-emerald-100";
    case "SUSPENDED":
    case "INACTIVE":
      return "bg-amber-50 text-amber-600 border-amber-100";
    default:
      return "bg-rose-50 text-rose-600 border-rose-100";
  }
}

export function MembershipCardsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showIssue, setShowIssue] = useState(false);
  const [showFundingRequests, setShowFundingRequests] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
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
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <PageHeader
          title="Membership Cards"
          description="Issue and manage prepaid patient identification & wallet cards."
        />
        <div className="flex gap-3">
          <button
            onClick={refresh}
            className="btn-secondary rounded-2xl border-secondary-400 bg-white/80 p-4"
          >
            <RefreshCw className={`h-4 w-4 ${cardsQuery.isFetching ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setShowVerify(true)}
            className="btn-secondary gap-2 rounded-2xl border-secondary-400 bg-white/80 px-6 py-3"
          >
            <ScanLine className="h-5 w-5" />
            <span className="font-bold">Scan &amp; Verify</span>
          </button>
          <button
            onClick={() => setShowFundingRequests(true)}
            className="btn-secondary relative gap-2 rounded-2xl border-secondary-400 bg-white/80 px-6 py-3"
          >
            <Banknote className="h-5 w-5" />
            <span className="font-bold">Funding Requests</span>
            {pendingFundingCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-black text-white shadow-lg">
                {pendingFundingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowIssue(true)}
            className="btn-primary gap-3 px-8 py-3 shadow-xl shadow-primary-500/20"
          >
            <Plus className="h-5 w-5" />
            <span className="font-bold">Issue New Card</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-4">
        {/* Summary */}
        <div className="space-y-6 lg:col-span-1">
          <div className="glass-card rounded-[2.5rem] border border-secondary-400/50 bg-white/40 p-8 shadow-premium">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-900 text-white shadow-lg shadow-primary-900/20">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h4 className="mb-2 text-xl font-black text-secondary-900">Card Registry</h4>
            <p className="mb-8 text-xs leading-relaxed text-secondary-500">
              Prepaid wallet cards patients can fund and use across your service points.
            </p>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-secondary-700">Total Cards</span>
                <span className="text-xl font-black text-secondary-900">
                  {statsQuery.isLoading ? "…" : stats?.total ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-secondary-700">Active</span>
                <span className="text-xl font-black text-emerald-500">
                  {statsQuery.isLoading ? "…" : stats?.active ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-secondary-700">Suspended / Expired</span>
                <span className="text-xl font-black text-rose-500">
                  {statsQuery.isLoading ? "…" : (stats?.suspended ?? 0) + (stats?.expired ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-secondary-400/40 pt-4">
                <span className="flex items-center gap-1.5 text-sm font-bold text-secondary-700">
                  <Wallet className="h-4 w-4 text-primary-500" /> Wallet Total
                </span>
                <span className="text-lg font-black text-primary-600">
                  {statsQuery.isLoading ? "…" : formatCardMoney(stats?.total_balance ?? 0)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Registry */}
        <div className="space-y-6 lg:col-span-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="group relative w-full max-w-sm">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-400 transition-colors group-focus-within:text-primary-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by card number or patient name..."
                className="w-full rounded-2xl border border-secondary-400 bg-white/60 py-3 pl-12 pr-6 text-sm font-medium outline-none transition-all focus:border-primary-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-2xl border border-secondary-400 bg-white/80 px-4 py-3 text-xs font-bold uppercase tracking-widest text-secondary-700 outline-none focus:border-primary-500"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s || "all"} value={s}>
                  {s || "All statuses"}
                </option>
              ))}
            </select>
          </div>

          {loadError && (
            <div className="flex items-center justify-between gap-4 rounded-[2rem] border border-rose-100 bg-rose-50 p-6 text-rose-600">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-6 w-6" />
                <p className="text-sm font-bold">{loadError}</p>
              </div>
              <button onClick={() => cardsQuery.refetch()} className="btn-secondary px-5 py-2 text-xs">
                Retry
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {cardsQuery.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-48 animate-pulse rounded-[2.5rem] bg-white/40" />
              ))
            ) : cards.length === 0 && !loadError ? (
              <div className="col-span-2 rounded-[3rem] border-2 border-dashed border-secondary-400 bg-white/20 py-32 text-center">
                <CreditCard className="mx-auto mb-4 h-12 w-12 text-secondary-200" />
                <h4 className="text-lg font-bold text-secondary-900">
                  {search || statusFilter ? "No matching cards" : "No Cards Issued"}
                </h4>
                <p className="mt-2 text-sm text-secondary-400">
                  {search || statusFilter
                    ? "Try a different search or status filter."
                    : "Start issuing identification cards to patients."}
                </p>
              </div>
            ) : (
              cards.map((card) => (
                <div
                  key={card.id}
                  className="glass-card group relative overflow-hidden rounded-[2.5rem] border border-secondary-400/50 bg-white/40 p-8 transition-all hover:bg-white/60"
                >
                  <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary-500/5 blur-xl" />
                  <div className="mb-8 flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary-900 text-white shadow-lg transition-transform group-hover:scale-110">
                        <CreditCard className="h-6 w-6" />
                      </div>
                      <div>
                        <h4 className="data-mono text-sm font-black uppercase tracking-widest text-secondary-900">
                          {card.card_number}
                        </h4>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-400">
                          {card.patient_name || `Patient #${card.patient_id}`}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-[8px] font-black uppercase tracking-widest ${statusClasses(card.status)}`}
                    >
                      {card.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-secondary-400/50 pt-6">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">
                        Wallet
                      </span>
                      <span className="text-sm font-black text-primary-600">{formatCardMoney(card.balance)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">
                        Valid Thru
                      </span>
                      <span className="text-xs font-black text-secondary-900">{safeDate(card.expiry_date)}</span>
                    </div>
                    <button
                      onClick={() => setDetailCard(card)}
                      className="flex h-10 items-center gap-2 rounded-xl bg-secondary-900 px-4 text-xs font-bold text-white transition-all hover:bg-primary-600"
                    >
                      <Eye className="h-4 w-4" /> Manage
                    </button>
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
    </div>
  );
}
