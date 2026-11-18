import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownCircle, ArrowUpCircle, FileDown, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { downloadPortalCardStatement, getPortalCardStatement, type PortalCardTransaction } from "../api/portal.api";

type TypeFilter = "ALL" | "CREDIT" | "DEBIT";

const money = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmt(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? v
    : d.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function isCredit(t: PortalCardTransaction): boolean {
  const ty = String(t.transaction_type).toUpperCase();
  return ty === "CREDIT" || ty === "REFUND";
}

/** Patient portal — card wallet usage log: every credit and debit, with the
 *  service each debit paid for. */
export function PortalCardUsagePage() {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [downloading, setDownloading] = useState(false);

  const downloadStatement = async () => {
    setDownloading(true);
    try {
      await downloadPortalCardStatement();
    } catch {
      /* browser surfaces the failure */
    } finally {
      setDownloading(false);
    }
  };

  const statementQuery = useQuery({
    queryKey: ["portal", "card", "statement"],
    queryFn: getPortalCardStatement,
    refetchInterval: 60_000,
  });
  const statement = statementQuery.data;

  const transactions = useMemo(
    () =>
      [...(statement?.transactions ?? [])].sort(
        (a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime(),
      ),
    [statement?.transactions],
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

  const hasCard = Boolean(statement?.card_number) || transactions.length > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Card &amp; Wallet</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            How your money is credited and spent — every top-up and every service it paid for.
          </p>
        </div>
        {hasCard ? (
          <Button size="sm" variant="secondary" onClick={downloadStatement} disabled={downloading}>
            <FileDown className="mr-1.5 h-4 w-4" />
            {downloading ? "Preparing…" : "Download statement"}
          </Button>
        ) : null}
      </header>

      {/* Wallet summary */}
      <div className="rounded-2xl bg-gradient-to-br from-sky-600 to-indigo-700 p-6 text-white shadow-sm">
        <div className="flex items-center gap-2 text-sky-100">
          <Wallet className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">Wallet balance</span>
        </div>
        {statementQuery.isLoading ? (
          <Skeleton className="mt-2 h-9 w-40 bg-white/20" />
        ) : (
          <p className="mt-1 text-3xl font-bold">₦{money.format(Number(statement?.balance ?? 0))}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-6 text-sm">
          <div>
            <p className="text-sky-100/80">Total credited</p>
            <p className="font-semibold">₦{money.format(totals.credited)}</p>
          </div>
          <div>
            <p className="text-sky-100/80">Total spent</p>
            <p className="font-semibold">₦{money.format(totals.debited)}</p>
          </div>
          {statement?.card_number ? (
            <div>
              <p className="text-sky-100/80">Card</p>
              <p className="font-mono font-semibold tracking-wider">{statement.card_number}</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        {(["ALL", "CREDIT", "DEBIT"] as TypeFilter[]).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={typeFilter === f ? "primary" : "secondary"}
            onClick={() => setTypeFilter(f)}
          >
            {f === "ALL" ? "All" : f === "CREDIT" ? "Credits" : "Debits"}
          </Button>
        ))}
      </div>

      {/* Transactions */}
      {statementQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : !hasCard ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-14 text-center dark:border-slate-700">
          <Wallet className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
          <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">No card wallet yet</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">
            Once the hospital issues you a card and you fund it, your credits and spending will appear here.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">No transactions match this filter.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((t) => {
            const credit = isCredit(t);
            const purpose = credit
              ? t.narration || t.payment_source || "Wallet top-up"
              : t.purpose || t.narration || "Service payment";
            return (
              <li
                key={t.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                    style={credit ? { background: "rgb(220 252 231)", color: "rgb(22 163 74)" } : { background: "rgb(254 226 226)", color: "rgb(220 38 38)" }}
                  >
                    {credit ? <ArrowUpCircle className="h-5 w-5" /> : <ArrowDownCircle className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{purpose}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <Badge variant={credit ? "soft-success" : "soft-danger"}>{credit ? "Credit" : "Debit"}</Badge>
                      <span>{fmt(t.transaction_date)}</span>
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold" style={{ color: credit ? "rgb(22 163 74)" : "rgb(220 38 38)" }}>
                    {credit ? "+" : "−"}₦{money.format(Number(t.amount) || 0)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">Bal ₦{money.format(Number(t.balance_after) || 0)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
