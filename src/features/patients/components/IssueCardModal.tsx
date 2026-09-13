import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Loader2, Search, UserRound } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import { searchPatients } from "../api/patients.api";
import { membershipApi } from "../api/membership.api";

type PickedPatient = { id: number; name: string; hospital_number?: string };

export function IssueCardModal({
  isOpen,
  onClose,
  onIssued,
}: {
  isOpen: boolean;
  onClose: () => void;
  onIssued: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PickedPatient | null>(null);
  const [initialBalance, setInitialBalance] = useState("");
  const [expiry, setExpiry] = useState("");

  const searchQuery = useQuery({
    queryKey: ["patient-search", query],
    queryFn: () => searchPatients(query),
    enabled: isOpen && query.trim().length >= 2 && !selected,
  });

  const results = ((searchQuery.data as any)?.items ??
    (Array.isArray(searchQuery.data) ? searchQuery.data : [])) as any[];

  const reset = () => {
    setQuery("");
    setSelected(null);
    setInitialBalance("");
    setExpiry("");
  };

  const close = () => {
    reset();
    onClose();
  };

  const issue = useMutation({
    mutationFn: () =>
      membershipApi.issue({
        patient_id: selected!.id,
        initial_balance: initialBalance ? Number(initialBalance) : 0,
        expiry_date: expiry || null,
      }),
    onSuccess: (card) => {
      toast.success("Card issued", `Card ${card.card_number} was issued to ${selected?.name}.`);
      queryClient.invalidateQueries({ queryKey: ["membership-cards"] });
      onIssued();
      close();
    },
    onError: (err) => toast.error("Couldn't issue card", apiErrorMessage(err, "Please try again.")),
  });

  return (
    <Modal isOpen={isOpen} onClose={close} title="Issue a membership card" size="md">
      <div className="space-y-5">
        {/* Patient picker */}
        {selected ? (
          <div className="flex items-center justify-between rounded-2xl border border-primary-200 bg-primary-500/5 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/10 text-primary-600">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-secondary-900">{selected.name}</p>
                {selected.hospital_number ? (
                  <p className="data-mono text-[11px] text-secondary-400">{selected.hospital_number}</p>
                ) : null}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              Change
            </Button>
          </div>
        ) : (
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-secondary-500">
              Patient
            </label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search patient by name…"
                className="w-full rounded-2xl border border-secondary-300 bg-white/60 py-3 pl-11 pr-4 text-sm outline-none focus:border-primary-500 dark:bg-white/5"
              />
            </div>
            {query.trim().length >= 2 ? (
              <div className="mt-2 max-h-52 overflow-y-auto rounded-2xl border border-secondary-200 dark:border-white/10">
                {searchQuery.isLoading ? (
                  <div className="flex items-center justify-center gap-2 p-4 text-xs text-secondary-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                  </div>
                ) : results.length === 0 ? (
                  <p className="p-4 text-center text-xs font-medium text-secondary-400">No patients found.</p>
                ) : (
                  results.slice(0, 10).map((p) => {
                    const name = `${p.first_name || ""} ${p.last_name || ""}`.trim() || `Patient #${p.id}`;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelected({ id: p.id, name, hospital_number: p.hospital_number })}
                        className="flex w-full items-center justify-between border-b border-secondary-100 px-4 py-2.5 text-left last:border-0 hover:bg-primary-500/5 dark:border-white/5"
                      >
                        <span className="text-sm font-semibold text-secondary-800 dark:text-secondary-100">{name}</span>
                        {p.hospital_number ? (
                          <span className="data-mono text-[11px] text-secondary-400">{p.hospital_number}</span>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            ) : null}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Initial balance (optional)"
            type="number"
            min={0}
            placeholder="0"
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
          />
          <Input
            label="Expiry date (optional)"
            type="date"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
          />
        </div>

        <p className="text-xs font-medium text-secondary-400">
          A unique card number is generated automatically and the card is linked to your primary facility.
        </p>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={close} disabled={issue.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => issue.mutate()}
            isLoading={issue.isPending}
            disabled={!selected}
            leftIcon={<CreditCard className="h-4 w-4" />}
          >
            Issue card
          </Button>
        </div>
      </div>
    </Modal>
  );
}
