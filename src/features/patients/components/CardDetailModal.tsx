import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
import { DxPopup, DxButton, DxInput, DxSelect, DxBadge } from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import { routes } from "@/config/routes";
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
  const navigate = useNavigate();
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
    <DxPopup isOpen={!!card} onClose={onClose} title="Membership card" size="lg">
      <div className="space-y-6">
        {/* Card face — intentional dark "physical card" visual */}
        <div className="relative overflow-hidden rounded-xl p-6 text-white shadow-lg" style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)" }}>
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full" style={{ background: "rgba(56,130,246,0.18)", filter: "blur(36px)" }} />
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10">
                <CreditCard className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">Cardholder</p>
                <p className="text-[14px] font-semibold">{card.patient_name || `Patient #${card.patient_id}`}</p>
                {(detail?.global_patient_id || card.global_patient_id) ? (
                  <p className="mt-0.5 flex items-center gap-1 text-[9px] font-medium text-white/60">
                    <span className="font-semibold uppercase tracking-[0.15em] text-white/40">Global ID</span>
                    <span className="dx-mono tracking-wider">{detail?.global_patient_id || card.global_patient_id}</span>
                  </p>
                ) : null}
              </div>
            </div>
            <DxBadge tone={isActive ? "solid-accent" : "warning"}>{status}</DxBadge>
          </div>
          <p className="dx-mono mt-6 text-[20px] font-bold tracking-[0.25em]">{card.card_number}</p>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/50">Wallet balance</p>
              <p className="text-[24px] font-bold">{formatCardMoney(detail?.balance ?? card.balance)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/50">Valid thru</p>
              <p className="text-[14px] font-semibold">{safeDate(card.expiry_date)}</p>
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
        <div className="flex flex-wrap gap-2">
          {!funding ? (
            <DxButton size="sm" variant="primary" onClick={() => setFunding(true)} leftIcon={<Wallet className="h-4 w-4" />}>Fund wallet</DxButton>
          ) : null}
          {isActive ? (
            <DxButton size="sm" onClick={() => statusMut.mutate("SUSPENDED")} isLoading={statusMut.isPending} leftIcon={<Ban className="h-4 w-4" />}>Suspend card</DxButton>
          ) : (
            <DxButton size="sm" onClick={() => statusMut.mutate("ACTIVE")} isLoading={statusMut.isPending} leftIcon={<CheckCircle2 className="h-4 w-4" />}>Activate card</DxButton>
          )}
          <DxButton size="sm" onClick={printCard} isLoading={printing} leftIcon={<Printer className="h-4 w-4" />}>Print card</DxButton>
        </div>

        {/* Fund form */}
        {funding ? (
          <div className="space-y-4 rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <DxInput label="Amount" type="number" min={1} placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <DxSelect label="Payment source" value={source} onChange={(e) => setSource(e.target.value)} options={PAYMENT_SOURCES} />
            </div>
            <div className="flex justify-end gap-2">
              <DxButton variant="text" size="sm" onClick={() => setFunding(false)} disabled={fundMut.isPending}>Cancel</DxButton>
              <DxButton size="sm" variant="primary" onClick={() => fundMut.mutate()} isLoading={fundMut.isPending} disabled={!amount || Number(amount) <= 0}>Add funds</DxButton>
            </div>
          </div>
        ) : null}

        {/* Transactions */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">Transaction history</p>
            {card ? (
              <button type="button" className="text-[11px] font-semibold text-[var(--dx-accent)] hover:underline" onClick={() => navigate(routes.cardUsageLog.replace(":cardId", String(card.id)))}>
                Open full usage log →
              </button>
            ) : null}
          </div>
          <div className="max-h-64 overflow-y-auto rounded-md border border-[var(--dx-border)]">
            {detailQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 p-6 text-[12px] text-[var(--dx-text-muted)]">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : transactions.length === 0 ? (
              <p className="p-6 text-center text-[12px] font-medium text-[var(--dx-text-muted)]">No transactions yet.</p>
            ) : (
              transactions.map((t) => {
                const credit = String(t.transaction_type).toUpperCase() === "CREDIT";
                return (
                  <div key={t.id} className="flex items-center justify-between border-b border-[var(--dx-border)] px-4 py-3 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md" style={credit ? { background: "var(--dx-success-soft)", color: "var(--dx-success)" } : { background: "var(--dx-danger-soft)", color: "var(--dx-danger)" }}>
                        {credit ? <ArrowUpCircle className="h-4 w-4" /> : <ArrowDownCircle className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="text-[12px] font-semibold text-[var(--dx-text)]">{t.narration || t.transaction_type}</p>
                        <p className="text-[10px] text-[var(--dx-text-muted)]">{safeDate(t.transaction_date)} · {t.payment_source || "—"}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="dx-mono text-[12px] font-bold" style={{ color: credit ? "var(--dx-success)" : "var(--dx-danger)" }}>
                        {credit ? "+" : "−"}
                        {formatCardMoney(t.amount)}
                      </p>
                      <p className="text-[10px] text-[var(--dx-text-muted)]">Bal {formatCardMoney(t.balance_after)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </DxPopup>
  );
}
