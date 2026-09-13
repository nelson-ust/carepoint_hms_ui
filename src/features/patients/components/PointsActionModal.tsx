import { useEffect, useState } from "react";
import { Gift, Star } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import { useEarnPoints, useRedeemPoints } from "../hooks/use-loyalty";

type Mode = "earn" | "redeem";

interface PointsActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: Mode;
  patientId: number;
  balance: number;
}

const COPY: Record<Mode, { title: string; verb: string; placeholder: string; icon: typeof Gift }> = {
  earn: {
    title: "Award Points",
    verb: "Award",
    placeholder: "e.g. Visit reward, referral bonus",
    icon: Star,
  },
  redeem: {
    title: "Redeem Points",
    verb: "Redeem",
    placeholder: "e.g. Pharmacy discount, service credit",
    icon: Gift,
  },
};

export function PointsActionModal({ isOpen, onClose, mode, patientId, balance }: PointsActionModalProps) {
  const toast = useToast();
  const earn = useEarnPoints();
  const redeem = useRedeemPoints();
  const mutation = mode === "earn" ? earn : redeem;
  const copy = COPY[mode];
  const Icon = copy.icon;

  const [points, setPoints] = useState<string>("");
  const [reason, setReason] = useState<string>("");

  // Reset the form whenever the modal opens or the mode changes.
  useEffect(() => {
    if (isOpen) {
      setPoints("");
      setReason("");
    }
  }, [isOpen, mode]);

  const amount = Number(points);
  const amountValid = Number.isFinite(amount) && amount > 0;
  const exceedsBalance = mode === "redeem" && amount > balance;
  const canSubmit = amountValid && !exceedsBalance && !mutation.isPending;

  const submit = () => {
    if (!canSubmit) return;
    mutation.mutate(
      { patient_id: patientId, points: Math.floor(amount), reason: reason.trim() },
      {
        onSuccess: (res) => {
          toast.success(
            `Points ${mode === "earn" ? "awarded" : "redeemed"}`,
            `New balance: ${Number(res?.balance ?? 0).toLocaleString()} points.`,
          );
          onClose();
        },
        onError: (err) =>
          toast.error(
            `Couldn't ${copy.verb.toLowerCase()} points`,
            apiErrorMessage(err, "Please try again."),
          ),
      },
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={copy.title} size="sm">
      <div className="space-y-5">
        <div className="flex items-center gap-4 rounded-2xl border border-secondary-200 bg-secondary-50/60 p-4 dark:border-white/10 dark:bg-white/5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-white">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">
              Available balance
            </p>
            <p className="text-lg font-black text-secondary-900 dark:text-white">
              {balance.toLocaleString()} pts
            </p>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-secondary-500">
            Points to {copy.verb.toLowerCase()}
          </label>
          <input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="0"
            className="w-full rounded-xl border border-secondary-300 bg-white/70 px-3 py-2.5 text-sm outline-none focus:border-primary-500 dark:border-white/10 dark:bg-white/5"
          />
          {exceedsBalance ? (
            <p className="mt-1.5 text-xs font-semibold text-rose-500">
              Cannot redeem more than the available balance.
            </p>
          ) : null}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-secondary-500">
            Reason <span className="text-secondary-300">(optional)</span>
          </label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={copy.placeholder}
            className="w-full rounded-xl border border-secondary-300 bg-white/70 px-3 py-2.5 text-sm outline-none focus:border-primary-500 dark:border-white/10 dark:bg-white/5"
          />
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!canSubmit}
            isLoading={mutation.isPending}
            leftIcon={<Icon className="h-4 w-4" />}
          >
            {copy.verb} Points
          </Button>
        </div>
      </div>
    </Modal>
  );
}
