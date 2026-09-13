import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import { searchPatients, type Patient } from "@/features/patients/api/patients.api";
import { useProcedures, useTheatres } from "../hooks/use-surgery";
import { bookCase, ASA_OPTIONS, ANAESTHESIA_OPTIONS, type SurgicalCase } from "../api/surgery.api";

function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function BookCaseModal({
  isOpen,
  onClose,
  onBooked,
  presetPatient,
  presetVisitId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onBooked: (c: SurgicalCase) => void;
  /** Pre-selected patient (e.g. booking from a visit). */
  presetPatient?: { id: number; label: string } | null;
  presetVisitId?: number | null;
}) {
  const toast = useToast();
  const proceduresQuery = useProcedures();
  const theatresQuery = useTheatres();

  const [patient, setPatient] = useState<{ id: number; label: string } | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);

  const [procedureId, setProcedureId] = useState("");
  const [theatreId, setTheatreId] = useState("");
  const [scheduledStart, setScheduledStart] = useState("");
  const [scheduledEnd, setScheduledEnd] = useState("");
  const [asa, setAsa] = useState("");
  const [anaesthesia, setAnaesthesia] = useState("");
  const [emergency, setEmergency] = useState(false);
  const [diagnosis, setDiagnosis] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPatient(presetPatient ?? null);
      setQuery("");
      setResults([]);
      setProcedureId("");
      setTheatreId("");
      setScheduledStart(toLocalInput(new Date(Date.now() + 60 * 60 * 1000)));
      setScheduledEnd("");
      setAsa("");
      setAnaesthesia("");
      setEmergency(false);
      setDiagnosis("");
    }
  }, [isOpen, presetPatient]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchPatients(query.trim());
        setResults((res as any).items ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const procedures = proceduresQuery.data?.items ?? [];
  const theatres = theatresQuery.data?.items ?? [];

  const selectedProcedure = useMemo(
    () => procedures.find((p) => String(p.id) === procedureId) ?? null,
    [procedures, procedureId],
  );

  // Auto-fill end time from typical duration when a procedure + start are chosen.
  useEffect(() => {
    if (selectedProcedure?.typical_duration_minutes && scheduledStart && !scheduledEnd) {
      const start = new Date(scheduledStart);
      if (!Number.isNaN(start.getTime())) {
        const end = new Date(start.getTime() + selectedProcedure.typical_duration_minutes * 60000);
        setScheduledEnd(toLocalInput(end));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProcedure]);

  const canSubmit = !!patient && !!procedureId && !submitting;

  const handleSubmit = async () => {
    if (!patient || !procedureId) {
      toast.error("Missing details", "Choose a patient and a procedure.");
      return;
    }
    setSubmitting(true);
    try {
      const c = await bookCase({
        patient_id: patient.id,
        procedure_catalog_id: Number(procedureId),
        visit_id: presetVisitId ?? undefined,
        operating_theatre_id: theatreId ? Number(theatreId) : undefined,
        is_emergency: emergency,
        asa_class: asa || undefined,
        anaesthesia_type: anaesthesia || undefined,
        scheduled_start_at: scheduledStart ? new Date(scheduledStart).toISOString() : undefined,
        scheduled_end_at: scheduledEnd ? new Date(scheduledEnd).toISOString() : undefined,
        diagnosis_text: diagnosis.trim() || undefined,
      });
      toast.success("Case booked", `${c.case_no} created.`);
      onBooked(c);
      onClose();
    } catch (err) {
      toast.error("Couldn't book case", apiErrorMessage(err, "Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Book Surgical Case"
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} isLoading={submitting} disabled={!canSubmit}>
            Book case
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Patient */}
        {patient ? (
          <div className="flex items-center justify-between rounded-2xl border border-secondary-200 bg-secondary-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400">Patient</p>
              <p className="text-sm font-black text-secondary-900 dark:text-secondary-100">{patient.label}</p>
            </div>
            {!presetPatient && (
              <button
                onClick={() => setPatient(null)}
                className="rounded-lg p-2 text-secondary-400 hover:bg-secondary-100 dark:hover:bg-white/10"
                title="Change patient"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-secondary-500">
              Patient
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-400" />
              <input
                className="input-field pl-10"
                placeholder="Search name, hospital number, phone…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>
            {(searching || results.length > 0) && (
              <div className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-2xl border border-secondary-200 p-1 dark:border-white/10">
                {searching ? (
                  <p className="px-3 py-3 text-xs text-secondary-400">Searching…</p>
                ) : (
                  results.map((p) => (
                    <button
                      key={p.id}
                      onClick={() =>
                        setPatient({
                          id: p.id,
                          label: `${p.first_name} ${p.last_name} · ${p.hospital_number}`,
                        })
                      }
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-secondary-50 dark:hover:bg-white/5"
                    >
                      <span className="font-bold text-secondary-900 dark:text-secondary-100">
                        {p.first_name} {p.last_name}
                      </span>
                      <span className="font-mono text-[11px] text-secondary-400">{p.hospital_number}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        <Select
          label="Procedure"
          value={procedureId}
          onChange={(e) => setProcedureId(e.target.value)}
          placeholder={proceduresQuery.isLoading ? "Loading…" : "Select a procedure"}
        >
          {procedures.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.code})
            </option>
          ))}
        </Select>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Operating theatre (optional)"
            value={theatreId}
            onChange={(e) => setTheatreId(e.target.value)}
          >
            <option value="">Unassigned</option>
            {theatres.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.code})
              </option>
            ))}
          </Select>
          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-secondary-200 px-4 py-3 dark:border-white/10">
              <input
                type="checkbox"
                className="h-5 w-5 rounded accent-rose-600"
                checked={emergency}
                onChange={(e) => setEmergency(e.target.checked)}
              />
              <span className="text-sm font-bold text-secondary-900 dark:text-secondary-100">
                Emergency case
              </span>
            </label>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Scheduled start"
            type="datetime-local"
            value={scheduledStart}
            onChange={(e) => setScheduledStart(e.target.value)}
          />
          <Input
            label="Scheduled end"
            type="datetime-local"
            value={scheduledEnd}
            onChange={(e) => setScheduledEnd(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="ASA class" value={asa} onChange={(e) => setAsa(e.target.value)}>
            <option value="">Not assessed</option>
            {ASA_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select
            label="Anaesthesia (planned)"
            value={anaesthesia}
            onChange={(e) => setAnaesthesia(e.target.value)}
          >
            <option value="">Not set</option>
            {ANAESTHESIA_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        <Textarea
          label="Pre-op diagnosis (optional)"
          rows={2}
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          placeholder="Working diagnosis / indication for surgery"
        />
      </div>
    </Modal>
  );
}
