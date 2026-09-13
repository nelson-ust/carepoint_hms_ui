import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isValid } from "date-fns";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Ban,
  CheckCircle2,
  CreditCard,
  Loader2,
  Printer,
  QrCode,
  Wallet,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import { membershipApi, formatCardMoney, type MembershipCard } from "../api/membership.api";

function safeDate(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return isValid(d) ? format(d, "MMM d, yyyy") : "—";
}

const PAYMENT_SOURCES = [
  { value: "CASH", label: "Cash" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "ONLINE", label: "Online" },
  { value: "POS", label: "POS / Card" },
];

export function CardDetailModal({
  card,
  onClose,
  onChanged,
}: {
  card: MembershipCard | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [funding, setFunding] = useState(false);
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("CASH");
  const [printing, setPrinting] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!card) {
      setQrUrl(null);
      return;
    }
    let revoked = false;
    let created: string | null = null;
    membershipApi
      .cardQrObjectUrl(card.id, window.location.origin)
      .then((url) => {
        if (revoked) {
          URL.revokeObjectURL(url);
        } else {
          created = url;
          setQrUrl(url);
        }
      })
      .catch(() => setQrUrl(null));
    return () => {
      revoked = true;
      if (created) URL.revokeObjectURL(created);
      setQrUrl(null);
    };
  }, [card?.id]);

  const printCard = async () => {
    if (!card) return;
    try {
      setPrinting(true);
      const url = await membershipApi.cardPdfObjectUrl(card.id);
      // Open the PDF in a new tab so the user can view / print / download it.
      window.open(url, "_blank", "noopener");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast.error("Couldn't generate card", apiErrorMessage(err, "Please try again."));
    } finally {
      setPrinting(false);
    }
  };

  const detailQuery = useQuery({
    queryKey: ["membership-cards", "detail", card?.id],
    queryFn: () => membershipApi.get(card!.id),
    enabled: !!card,
  });
  const detail = detailQuery.data;
  const transactions = detail?.transactions ?? [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["membership-cards"] });
    onChanged();
  };

  const fundMut = useMutation({
    mutationFn: () =>
      membershipApi.fund(card!.id, card!.issuing_facility_id, {
        amount: Number(amount),
        payment_source: source,
        narration: "Wallet top-up",
      }),
    onSuccess: () => {
      toast.success("Card funded", `${formatCardMoney(amount)} added to the wallet.`);
      setAmount("");
      setFunding(false);
      refresh();
    },
    onError: (err) => toast.error("Funding failed", apiErrorMessage(err, "Please try again.")),
  });

  const statusMut = useMutation({
    mutationFn: (status: MembershipCard["status"]) => membershipApi.updateStatus(card!.id, status),
    onSuccess: (updated) => {
      toast.success("Card updated", `Status set to ${updated.status}.`);
      refresh();
    },
    onError: (err) => toast.error("Update failed", apiErrorMessage(err, "Please try again.")),
  });

  if (!card) return null;
  const status = detail?.status ?? card.status;
  const isActive = status === "ACTIVE";

  return (
    <Modal isOpen={!!card} onClose={onClose} title="Membership card" size="lg">
      <div className="space-y-6">
        {/* Card face */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-secondary-900 to-secondary-800 p-6 text-white shadow-xl">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary-500/20 blur-2xl" />
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
                <CreditCard className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Cardholder</p>
                <p className="text-sm font-bold">{card.patient_name || `Patient #${card.patient_id}`}</p>
                {(detail?.global_patient_id || card.global_patient_id) ? (
                  <p className="mt-0.5 flex items-center gap-1 text-[9px] font-medium text-white/60">
                    <span className="font-bold uppercase tracking-[0.15em] text-white/40">Global ID</span>
                    <span className="data-mono tracking-wider">{detail?.global_patient_id || card.global_patient_id}</span>
                  </p>
                ) : null}
              </div>
            </div>
            <Badge variant={isActive ? "success" : "warning"}>{status}</Badge>
          </div>
          <p className="data-mono mt-6 text-xl font-bold tracking-[0.25em]">{card.card_number}</p>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Wallet balance</p>
              <p className="font-display text-2xl font-bold">{formatCardMoney(detail?.balance ?? card.balance)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Valid thru</p>
              <p className="text-sm font-bold">{safeDate(card.expiry_date)}</p>
            </div>
            {qrUrl ? (
              <div className="rounded-lg bg-white p-1.5 shadow-sm" title="Scan to verify this card">
                <img src={qrUrl} alt="Card verification QR code" className="h-14 w-14" />
              </div>
            ) : (
              <QrCode className="h-10 w-10 text-white/40" />
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          {!funding ? (
            <Button size="sm" onClick={() => setFunding(true)} leftIcon={<Wallet className="h-4 w-4" />}>
              Fund wallet
            </Button>
          ) : null}
          {isActive ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => statusMut.mutate("SUSPENDED")}
              isLoading={statusMut.isPending}
              leftIcon={<Ban className="h-4 w-4" />}
            >
              Suspend card
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => statusMut.mutate("ACTIVE")}
              isLoading={statusMut.isPending}
              leftIcon={<CheckCircle2 className="h-4 w-4" />}
            >
              Activate card
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={printCard}
            isLoading={printing}
            leftIcon={<Printer className="h-4 w-4" />}
          >
            Print card
          </Button>
        </div>

        {/* Fund form */}
        {funding ? (
          <div className="space-y-4 rounded-2xl border border-secondary-200 p-4 dark:border-white/10">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Amount"
                type="number"
                min={1}
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <Select
                label="Payment source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                options={PAYMENT_SOURCES}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" size="sm" onClick={() => setFunding(false)} disabled={fundMut.isPending}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => fundMut.mutate()}
                isLoading={fundMut.isPending}
                disabled={!amount || Number(amount) <= 0}
              >
                Add funds
              </Button>
            </div>
          </div>
        ) : null}

        {/* Transactions */}
        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-widest text-secondary-400">Transaction history</p>
          <div className="max-h-64 overflow-y-auto rounded-2xl border border-secondary-200 dark:border-white/10">
            {detailQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 p-6 text-xs text-secondary-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : transactions.length === 0 ? (
              <p className="p-6 text-center text-xs font-medium text-secondary-400">No transactions yet.</p>
            ) : (
              transactions.map((t) => {
                const credit = String(t.transaction_type).toUpperCase() === "CREDIT";
                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between border-b border-secondary-100 px-4 py-3 last:border-0 dark:border-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                          credit ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                        }`}
                      >
                        {credit ? <ArrowUpCircle className="h-4 w-4" /> : <ArrowDownCircle className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-secondary-800 dark:text-secondary-100">
                          {t.narration || t.transaction_type}
                        </p>
                        <p className="text-[10px] text-secondary-400">
                          {safeDate(t.transaction_date)} · {t.payment_source || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`data-mono text-xs font-bold ${credit ? "text-emerald-600" : "text-rose-600"}`}>
                        {credit ? "+" : "−"}
                        {formatCardMoney(t.amount)}
                      </p>
                      <p className="text-[10px] text-secondary-400">Bal {formatCardMoney(t.balance_after)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
