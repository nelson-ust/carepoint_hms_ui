import { Check, Crown, Lock } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { POINTS_TIERS, tierForBalance } from "../loyalty-tiers";

interface TierBenefitsModalProps {
  isOpen: boolean;
  onClose: () => void;
  balance: number;
}

export function TierBenefitsModal({ isOpen, onClose, balance }: TierBenefitsModalProps) {
  const { tier: current, next } = tierForBalance(balance);
  const toNext = next ? Math.max(next.min - balance, 0) : 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Membership tiers & benefits" size="lg">
      <div className="space-y-5">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
          <p className="text-sm font-bold text-secondary-900 dark:text-white">
            Current tier: <span className="text-amber-600 dark:text-amber-300">{current.name}</span>
          </p>
          <p className="mt-1 text-xs text-secondary-500 dark:text-secondary-300">
            {next
              ? `${toNext.toLocaleString()} more points to reach ${next.name} (at ${next.min.toLocaleString()} pts).`
              : "Top tier reached — enjoy every benefit."}
          </p>
        </div>

        <div className="grid gap-3">
          {POINTS_TIERS.map((t) => {
            const isCurrent = t.name === current.name;
            const unlocked = balance >= t.min;
            return (
              <div
                key={t.name}
                className={`rounded-2xl border p-4 transition-colors ${
                  isCurrent
                    ? "border-amber-400 bg-amber-50/70 dark:border-amber-400/40 dark:bg-amber-500/10"
                    : "border-secondary-200 bg-white/50 dark:border-white/10 dark:bg-white/5"
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        unlocked ? "bg-amber-500 text-white" : "bg-secondary-200 text-secondary-400 dark:bg-white/10"
                      }`}
                    >
                      {unlocked ? <Crown className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    </span>
                    <div>
                      <p className="text-sm font-black text-secondary-900 dark:text-white">{t.name}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">
                        {t.min.toLocaleString()}+ points
                      </p>
                    </div>
                  </div>
                  {isCurrent ? (
                    <span className="rounded-full bg-amber-500 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                      Current
                    </span>
                  ) : null}
                </div>
                <ul className="space-y-1.5 pl-1">
                  {t.perks.map((perk) => (
                    <li
                      key={perk}
                      className="flex items-center gap-2 text-xs text-secondary-600 dark:text-secondary-300"
                    >
                      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      {perk}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
