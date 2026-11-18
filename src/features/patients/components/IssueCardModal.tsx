import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Loader2, Search, UserRound } from "lucide-react";
import { DxPopup, DxButton, DxInput } from "@/components/dx";
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
    <DxPopup
      isOpen={isOpen}
      onClose={close}
      title="Issue a membership card"
      size="md"
      locked={issue.isPending}
      footer={
        <>
          <DxButton onClick={close} disabled={issue.isPending}>Cancel</DxButton>
          <DxButton variant="primary" onClick={() => issue.mutate()} isLoading={issue.isPending} disabled={!selected} leftIcon={<CreditCard className="h-4 w-4" />}>
            Issue card
          </DxButton>
        </>
      }
    >
      <div className="space-y-5">
        {/* Patient picker */}
        {selected ? (
          <div className="flex items-center justify-between rounded-md border border-[var(--dx-accent)] bg-[var(--dx-accent-soft)] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--dx-surface)] text-[var(--dx-accent)]">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-[var(--dx-text)]">{selected.name}</p>
                {selected.hospital_number ? (
                  <p className="dx-mono text-[11px] text-[var(--dx-text-muted)]">{selected.hospital_number}</p>
                ) : null}
              </div>
            </div>
            <DxButton variant="text" size="sm" onClick={() => setSelected(null)}>Change</DxButton>
          </div>
        ) : (
          <div>
            <span className="dx-field-label">Patient</span>
            <div className="mt-1">
              <DxInput leftIcon={<Search className="h-3.5 w-3.5" />} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search patient by name…" />
            </div>
            {query.trim().length >= 2 ? (
              <div className="mt-2 max-h-52 overflow-y-auto rounded-md border border-[var(--dx-border)]">
                {searchQuery.isLoading ? (
                  <div className="flex items-center justify-center gap-2 p-4 text-[12px] text-[var(--dx-text-muted)]">
                    <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                  </div>
                ) : results.length === 0 ? (
                  <p className="p-4 text-center text-[12px] font-medium text-[var(--dx-text-muted)]">No patients found.</p>
                ) : (
                  results.slice(0, 10).map((p) => {
                    const name = `${p.first_name || ""} ${p.last_name || ""}`.trim() || `Patient #${p.id}`;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelected({ id: p.id, name, hospital_number: p.hospital_number })}
                        className="flex w-full items-center justify-between border-b border-[var(--dx-border)] px-4 py-2.5 text-left last:border-0 hover:bg-[var(--dx-surface-sunken)]"
                      >
                        <span className="text-[13px] font-semibold text-[var(--dx-text)]">{name}</span>
                        {p.hospital_number ? (
                          <span className="dx-mono text-[11px] text-[var(--dx-text-muted)]">{p.hospital_number}</span>
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
          <DxInput label="Initial balance (optional)" type="number" min={0} placeholder="0" value={initialBalance} onChange={(e) => setInitialBalance(e.target.value)} />
          <DxInput label="Expiry date (optional)" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
        </div>

        <p className="text-[12px] font-medium text-[var(--dx-text-muted)]">
          A unique card number is generated automatically and the card is linked to your primary facility.
        </p>
      </div>
    </DxPopup>
  );
}
