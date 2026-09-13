import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Check, Search, User, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/feedback/ToastProvider";
import { searchPatients, type Patient } from "@/features/patients/api/patients.api";
import { getVisits, type Visit } from "@/features/visits/api/visits.api";
import { formatMoney, getVisitBillingSummary, toNumber } from "../api/billing.api";
import { useFinalizeVisitBilling } from "../hooks/use-billing";

const INACTIVE_VISIT_STATUSES = ["COMPLETED", "CANCELLED"];

function patientLabel(p: Patient): string {
  return [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || `Patient #${p.id}`;
}

function formatVisitDate(value?: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function CreateInvoiceModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (invoiceId: number) => void;
}) {
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [visitId, setVisitId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Debounce the patient search so we don't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const patientsQuery = useQuery({
    queryKey: ["patient-search", debounced],
    queryFn: () => searchPatients(debounced, 10),
    enabled: !selectedPatient && debounced.length >= 2,
  });
  const results = patientsQuery.data?.items ?? [];

  // Active visits for the selected patient.
  const visitsQuery = useQuery({
    queryKey: ["patient-active-visits", selectedPatient?.id],
    queryFn: () => getVisits({ patient_id: selectedPatient!.id, limit: 50 }),
    enabled: !!selectedPatient,
  });
  const activeVisits = useMemo<Visit[]>(
    () =>
      (visitsQuery.data?.items ?? []).filter(
        (v) => !INACTIVE_VISIT_STATUSES.includes((v.status || "").toUpperCase()),
      ),
    [visitsQuery.data],
  );

  // Auto-select when the patient has exactly one active visit.
  useEffect(() => {
    if (activeVisits.length === 1) {
      setVisitId((prev) => (prev ? prev : String(activeVisits[0].id)));
    }
  }, [activeVisits]);

  const visitIdNum = visitId ? Number(visitId) : undefined;

  // Charge lines = billable services already rendered during the visit.
  const summaryQuery = useQuery({
    queryKey: ["visit-billing-summary", "invoice-modal", visitIdNum],
    queryFn: () => getVisitBillingSummary(visitIdNum as number),
    enabled: !!visitIdNum,
  });
  const items = useMemo(() => summaryQuery.data?.items ?? [], [summaryQuery.data]);
  const total = useMemo(
    () => items.reduce((sum, i) => sum + toNumber(i.line_total), 0),
    [items],
  );
  const existingInvoice = summaryQuery.data?.invoice ?? null;

  const finalize = useFinalizeVisitBilling(visitIdNum ?? 0);

  const reset = () => {
    setSearch("");
    setDebounced("");
    setSelectedPatient(null);
    setVisitId("");
    setDueDate("");
    setNotes("");
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSelectPatient = (p: Patient) => {
    setSelectedPatient(p);
    setSearch("");
    setDebounced("");
    setVisitId("");
    setError(null);
  };

  const handleChangePatient = () => {
    setSelectedPatient(null);
    setVisitId("");
    setError(null);
  };

  const noActiveVisits = !!selectedPatient && !visitsQuery.isLoading && activeVisits.length === 0;
  const visitHasNoCharges = !!visitIdNum && !summaryQuery.isLoading && items.length === 0;
  const canIssue = !!selectedPatient && !!visitIdNum && items.length > 0 && !existingInvoice;

  const handleSubmit = () => {
    if (!selectedPatient) {
      setError("Search and select a patient first.");
      return;
    }
    if (!visitIdNum) {
      setError("Select an active visit to invoice.");
      return;
    }
    if (items.length === 0) {
      setError("This visit has no billable services to invoice yet.");
      return;
    }
    setError(null);
    finalize.mutate(
      {
        due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
        note: notes.trim() || undefined,
      },
      {
        onSuccess: (res) => {
          toast.success("Invoice issued", `Invoice ${res.invoice_no} created.`);
          handleClose();
          onCreated?.(res.invoice_id);
        },
        onError: (err: any) => {
          toast.error(
            "Failed to create invoice",
            err?.response?.data?.detail?.toString?.() ??
              err?.response?.data?.message ??
              err?.message,
          );
        },
      },
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create Invoice"
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="data-mono text-sm font-bold text-secondary-500">
            Invoice total: {formatMoney(total)}
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} isLoading={finalize.isPending} disabled={!canIssue}>
              Issue Invoice
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* ---- Patient selection ---- */}
        <div>
          <p className="mb-2 block text-xs font-bold uppercase tracking-widest text-secondary-500">
            Patient
          </p>

          {selectedPatient ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-secondary-200 bg-secondary-50 p-3 dark:border-white/10 dark:bg-white/5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-black text-white">
                  {(selectedPatient.first_name?.[0] ?? "") + (selectedPatient.last_name?.[0] ?? "")}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-secondary-900">
                    {patientLabel(selectedPatient)}
                  </p>
                  <p className="truncate text-xs text-secondary-400">
                    {selectedPatient.hospital_number}
                    {selectedPatient.phone_number ? ` • ${selectedPatient.phone_number}` : ""}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleChangePatient}>
                Change
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Input
                aria-label="Search patient"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, hospital number, phone, or ID…"
                leftIcon={<Search className="h-4 w-4" />}
              />
              {debounced.length >= 2 ? (
                <div className="mt-2 max-h-56 overflow-y-auto rounded-2xl border border-secondary-200 dark:border-white/10">
                  {patientsQuery.isLoading ? (
                    <div className="space-y-2 p-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                      ))}
                    </div>
                  ) : results.length === 0 ? (
                    <p className="p-4 text-center text-xs font-semibold text-secondary-400">
                      No patients match “{debounced}”.
                    </p>
                  ) : (
                    <ul className="divide-y divide-secondary-100 dark:divide-white/5">
                      {results.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => handleSelectPatient(p)}
                            className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-secondary-50 dark:hover:bg-white/5"
                          >
                            <User className="h-4 w-4 shrink-0 text-secondary-400" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-bold text-secondary-900">
                                {patientLabel(p)}
                              </span>
                              <span className="block truncate text-xs text-secondary-400">
                                {p.hospital_number}
                                {p.phone_number ? ` • ${p.phone_number}` : ""}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* ---- Visit selection ---- */}
        {selectedPatient ? (
          <div>
            <p className="mb-2 block text-xs font-bold uppercase tracking-widest text-secondary-500">
              Active Visit
            </p>
            {visitsQuery.isLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : noActiveVisits ? (
              <div className="flex items-center gap-2 rounded-2xl bg-amber-500/10 px-4 py-3 text-xs font-bold text-amber-600">
                <AlertCircle className="h-4 w-4" />
                This patient has no active visits. An invoice can only be raised against an active
                visit.
              </div>
            ) : (
              <Select
                aria-label="Active visit"
                value={visitId}
                onChange={(e) => setVisitId(e.target.value)}
                options={[
                  { value: "", label: "Select a visit…" },
                  ...activeVisits.map((v) => ({
                    value: String(v.id),
                    label: `${v.visit_code || `Visit #${v.id}`} — ${v.status}${
                      v.visit_date ? ` • ${formatVisitDate(v.visit_date)}` : ""
                    }`,
                  })),
                ]}
              />
            )}
          </div>
        ) : null}

        {/* ---- Charge lines (auto-populated from rendered services) ---- */}
        {visitIdNum ? (
          <div>
            <p className="mb-2 block text-xs font-bold uppercase tracking-widest text-secondary-500">
              Charge Lines
            </p>
            {summaryQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : visitHasNoCharges ? (
              <div className="flex items-center gap-2 rounded-2xl bg-amber-500/10 px-4 py-3 text-xs font-bold text-amber-600">
                <AlertCircle className="h-4 w-4" />
                No billable services have been recorded for this visit yet.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-secondary-200 dark:border-white/10">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-secondary-50 text-[10px] font-black uppercase tracking-widest text-secondary-400 dark:bg-white/5">
                      <th className="px-3 py-2">Service</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Unit price</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary-100 dark:divide-white/5">
                    {items.map((i) => (
                      <tr key={i.id}>
                        <td className="px-3 py-2">
                          <span className="font-bold text-secondary-900">{i.service_name}</span>
                          {i.service_code ? (
                            <span className="ml-1 text-xs text-secondary-400">{i.service_code}</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          {i.category ? (
                            <Badge variant="secondary">{i.category}</Badge>
                          ) : (
                            <span className="text-secondary-300">—</span>
                          )}
                        </td>
                        <td className="data-mono px-3 py-2 text-right">{toNumber(i.quantity)}</td>
                        <td className="data-mono px-3 py-2 text-right">
                          {formatMoney(toNumber(i.unit_price))}
                        </td>
                        <td className="data-mono px-3 py-2 text-right font-bold text-secondary-900">
                          {formatMoney(toNumber(i.line_total))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-secondary-200 bg-secondary-50 dark:border-white/10 dark:bg-white/5">
                      <td
                        className="px-3 py-2 text-xs font-black uppercase tracking-widest text-secondary-400"
                        colSpan={4}
                      >
                        Total
                      </td>
                      <td className="data-mono px-3 py-2 text-right text-base font-black text-secondary-900">
                        {formatMoney(total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {existingInvoice ? (
              <div className="mt-2 flex items-center gap-2 rounded-2xl bg-primary-500/10 px-4 py-3 text-xs font-bold text-primary-600">
                <Check className="h-4 w-4" />
                This visit was already invoiced ({existingInvoice.invoice_no}).
              </div>
            ) : null}
          </div>
        ) : null}

        {/* ---- Due date + notes ---- */}
        {visitIdNum ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Due Date (optional)"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        ) : null}

        {visitIdNum ? (
          <Textarea
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Internal note attached to the invoice"
            rows={2}
          />
        ) : null}

        {error ? (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-500">
            <X className="h-3.5 w-3.5" /> {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
