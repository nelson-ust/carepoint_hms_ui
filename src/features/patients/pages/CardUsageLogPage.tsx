import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownCircle, ArrowLeft, ArrowUpCircle, CreditCard, FileDown, RotateCcw } from "lucide-react";
import {
  DxPage,
  DxPageHeader,
  DxPanel,
  DxSelect,
  DxBadge,
  DxButton,
  DxMessage,
  DxInput,
  DxPopup,
  DxForm,
} from "@/components/dx";
import { routes } from "@/config/routes";
import { membershipApi, formatCardMoney, type MembershipCardTransaction } from "../api/membership.api";

type TypeFilter = "ALL" | "CREDIT" | "DEBIT";

function safeDate(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function isCredit(t: MembershipCardTransaction): boolean {
  const ty = String(t.transaction_type).toUpperCase();
  return ty === "CREDIT" || ty === "REFUND";
}

export function CardUsageLogPage() {
  const navigate = useNavigate();
  const params = useParams<{ cardId: string }>();
  const cardId = Number(params.cardId);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [downloading, setDownloading] = useState(false);
  const [stmtOpen, setStmtOpen] = useState(false);
  const [stmtFrom, setStmtFrom] = useState("");
  const [stmtTo, setStmtTo] = useState("");

  const generateStatement = async () => {
    setDownloading(true);
    try {
      const params: { date_from?: string; date_to?: string } = {};
      if (stmtFrom) params.date_from = stmtFrom;
      if (stmtTo) params.date_to = stmtTo;
      await membershipApi.downloadStatement(cardId, params);
      setStmtOpen(false);
    } catch {
      /* surfaced by the browser; keep the page usable */
    } finally {
      setDownloading(false);
    }
  };

  const cardQuery = useQuery({
    queryKey: ["membership-card", cardId, "detail"],
    queryFn: () => membershipApi.get(cardId),
    enabled: Number.isFinite(cardId),
  });

  const card = cardQuery.data;
  const transactions = useMemo(
    () =>
      [...(card?.transactions ?? [])].sort(
        (a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime(),
      ),
    [card?.transactions],
  );

  const totals = useMemo(() => {
    let credited = 0;
    let debited = 0;
    for (const t of transactions) {
      const amt = Number(t.amount) || 0;
      if (isCredit(t)) credited += amt;
      else debited += amt;
    }
    return { credited, debited };
  }, [transactions]);

  const rows = useMemo(
    () =>
      transactions.filter((t) => {
        if (typeFilter === "ALL") return true;
        return typeFilter === "CREDIT" ? isCredit(t) : !isCredit(t);
      }),
    [transactions, typeFilter],
  );

  return (
    <DxPage className="max-w-6xl">
      <DxPageHeader
        title="Card Usage Log"
        subtitle="Every credit (funding) and debit (payment) on the patient's card wallet."
        crumbs={[
          { label: "Patients", to: routes.patients },
          { label: "Membership Cards", to: routes.membershipCards },
          { label: "Usage log" },
        ]}
        actions={
          <>
            <DxButton variant="primary" leftIcon={<FileDown className="h-4 w-4" />} disabled={!card} onClick={() => setStmtOpen(true)}>
              Generate statement
            </DxButton>
            <DxButton variant="default" leftIcon={<RotateCcw className="h-4 w-4" />} isLoading={cardQuery.isFetching} onClick={() => cardQuery.refetch()}>
              Refresh
            </DxButton>
            <DxButton variant="default" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate(routes.membershipCards)}>
              Back to cards
            </DxButton>
          </>
        }
      />

      {cardQuery.isError ? (
        <DxMessage tone="danger" action={<DxButton size="sm" onClick={() => cardQuery.refetch()}>Retry</DxButton>}>
          Could not load this card. It may not exist or you may not have access.
        </DxMessage>
      ) : null}

      {/* Card summary + wallet KPIs */}
      <DxPanel>
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--dx-accent-soft)] text-[var(--dx-accent)]">
              <CreditCard className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="dx-mono text-[13px] font-bold uppercase tracking-wider text-[var(--dx-text)]">{card?.card_number ?? "—"}</p>
              <p className="mt-0.5 truncate text-[12px] text-[var(--dx-text-muted)]">
                {card?.patient_name || (card ? `Patient #${card.patient_id}` : "Loading…")}
                {card?.status ? <> · <DxBadge tone={String(card.status).toUpperCase() === "ACTIVE" ? "success" : "neutral"}>{card.status}</DxBadge></> : null}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">Wallet balance</p>
              <p className="text-[20px] font-bold text-[var(--dx-accent)]">{formatCardMoney(card?.balance ?? 0)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">Total credited</p>
              <p className="text-[20px] font-bold" style={{ color: "var(--dx-success)" }}>{formatCardMoney(totals.credited)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">Total debited</p>
              <p className="text-[20px] font-bold" style={{ color: "var(--dx-danger)" }}>{formatCardMoney(totals.debited)}</p>
            </div>
          </div>
        </div>
      </DxPanel>

      {/* Ledger */}
      <DxPanel
        title="Transactions"
        actions={
          <DxSelect
            editorSize="sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            aria-label="Filter by type"
            options={[
              { value: "ALL", label: "All transactions" },
              { value: "CREDIT", label: "Credits only" },
              { value: "DEBIT", label: "Debits only" },
            ]}
          />
        }
        flush
      >
        {cardQuery.isLoading ? (
          <div className="p-6">
            <div className="dx-skeleton h-8 w-full" />
            <div className="dx-skeleton mt-2 h-8 w-full" />
            <div className="dx-skeleton mt-2 h-8 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <p className="p-10 text-center text-[13px] text-[var(--dx-text-muted)]">
            {transactions.length === 0 ? "No transactions on this card yet." : "No transactions match this filter."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[var(--dx-border)] text-left text-[11px] uppercase tracking-wide text-[var(--dx-text-muted)]">
                  <th className="px-4 py-2.5 font-semibold">Date</th>
                  <th className="px-4 py-2.5 font-semibold">Type</th>
                  <th className="px-4 py-2.5 font-semibold">Purpose / Service</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Balance after</th>
                  <th className="px-4 py-2.5 font-semibold">Reference</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const credit = isCredit(t);
                  const purpose = credit
                    ? t.narration || t.payment_source || "Wallet funding"
                    : t.purpose || t.narration || "Service payment";
                  return (
                    <tr key={t.id} className="border-b border-[var(--dx-border)] last:border-0 hover:bg-[var(--dx-surface-sunken)]">
                      <td className="whitespace-nowrap px-4 py-3 text-[var(--dx-text-muted)]">{safeDate(t.transaction_date)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: credit ? "var(--dx-success)" : "var(--dx-danger)" }}>
                          {credit ? <ArrowUpCircle className="h-4 w-4" /> : <ArrowDownCircle className="h-4 w-4" />}
                          {credit ? "Credit" : "Debit"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--dx-text)]">{purpose}</p>
                        {!credit && t.narration && t.narration !== purpose ? (
                          <p className="text-[11px] text-[var(--dx-text-muted)]">{t.narration}</p>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right dx-mono font-bold" style={{ color: credit ? "var(--dx-success)" : "var(--dx-danger)" }}>
                        {credit ? "+" : "−"}
                        {formatCardMoney(t.amount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right dx-mono text-[var(--dx-text-muted)]">{formatCardMoney(t.balance_after)}</td>
                      <td className="px-4 py-3 text-[12px] text-[var(--dx-text-muted)]">{t.payment_reference || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DxPanel>

      <DxPopup
        isOpen={stmtOpen}
        onClose={() => setStmtOpen(false)}
        title="Generate card statement"
        locked={downloading}
        footer={
          <>
            <DxButton onClick={() => setStmtOpen(false)} disabled={downloading}>Cancel</DxButton>
            <DxButton variant="primary" leftIcon={<FileDown className="h-4 w-4" />} isLoading={downloading} onClick={generateStatement}>
              Download PDF
            </DxButton>
          </>
        }
      >
        <DxMessage tone="info" className="mb-3">
          Choose an optional date range. Leave both blank for the full history.
        </DxMessage>
        <DxForm cols={2}>
          <DxInput type="date" label="From" value={stmtFrom} max={stmtTo || undefined} onChange={(e) => setStmtFrom(e.target.value)} />
          <DxInput type="date" label="To" value={stmtTo} min={stmtFrom || undefined} onChange={(e) => setStmtTo(e.target.value)} />
        </DxForm>
      </DxPopup>
    </DxPage>
  );
}
