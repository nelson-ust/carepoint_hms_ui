import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import {
  DxPopup, DxButton, DxInput, DxSelect, DxTextarea, DxCheckbox,
} from "@/components/dx";
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
    <DxPopup
      isOpen={isOpen}
      onClose={onClose}
      title="Book surgical case"
      size="lg"
      locked={submitting}
      footer={
        <>
          <DxButton onClick={onClose} disabled={submitting}>Cancel</DxButton>
          <DxButton variant="primary" onClick={handleSubmit} isLoading={submitting} disabled={!canSubmit}>Book case</DxButton>
        </>
      }
    >
      <div className="space-y-4">
        {/* Patient */}
        {patient ? (
          <div className="flex items-center justify-between rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] px-4 py-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">Patient</p>
              <p className="text-[13px] font-semibold text-[var(--dx-text)]">{patient.label}</p>
            </div>
            {!presetPatient ? (
              <DxButton icon size="sm" variant="text" title="Change patient" onClick={() => setPatient(null)}><X /></DxButton>
            ) : null}
          </div>
        ) : (
          <div className="dx-field">
            <label className="dx-field-label">Patient</label>
            <div className="dx-editor-wrap">
              <Search className="h-3.5 w-3.5" />
              <input className="dx-editor" placeholder="Search name, hospital number, phone…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
            </div>
            {searching || results.length > 0 ? (
              <div className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-md border border-[var(--dx-border)] p-1">
                {searching ? (
                  <p className="px-3 py-3 text-[12px] text-[var(--dx-text-muted)]">Searching…</p>
                ) : (
                  results.map((p) => (
                    <button key={p.id} onClick={() => setPatient({ id: p.id, label: `${p.first_name} ${p.last_name} · ${p.hospital_number}` })}
                      className="flex w-full items-center justify-between rounded px-3 py-2 text-left hover:bg-[var(--dx-surface-alt)]">
                      <span className="text-[13px] font-medium text-[var(--dx-text)]">{p.first_name} {p.last_name}</span>
                      <span className="dx-mono text-[11px] text-[var(--dx-text-muted)]">{p.hospital_number}</span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
        )}

        <DxSelect label="Procedure" value={procedureId} onChange={(e) => setProcedureId(e.target.value)}
          placeholder={proceduresQuery.isLoading ? "Loading…" : "Select a procedure"}
          options={procedures.map((p) => ({ value: String(p.id), label: `${p.name} (${p.code})` }))} />

        <div className="grid gap-4 sm:grid-cols-2">
          <DxSelect label="Operating theatre (optional)" value={theatreId} onChange={(e) => setTheatreId(e.target.value)}
            placeholder="Unassigned" options={theatres.map((t) => ({ value: String(t.id), label: `${t.name} (${t.code})` }))} />
          <div className="flex items-end pb-1">
            <DxCheckbox label="Emergency case" checked={emergency} onChange={(e) => setEmergency(e.target.checked)} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <DxInput label="Scheduled start" type="datetime-local" value={scheduledStart} onChange={(e) => setScheduledStart(e.target.value)} />
          <DxInput label="Scheduled end" type="datetime-local" value={scheduledEnd} onChange={(e) => setScheduledEnd(e.target.value)} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <DxSelect label="ASA class" value={asa} onChange={(e) => setAsa(e.target.value)}
            placeholder="Not assessed" options={ASA_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
          <DxSelect label="Anaesthesia (planned)" value={anaesthesia} onChange={(e) => setAnaesthesia(e.target.value)}
            placeholder="Not set" options={ANAESTHESIA_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
        </div>

        <DxTextarea label="Pre-op diagnosis (optional)" rows={2} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="Working diagnosis / indication for surgery" />
      </div>
    </DxPopup>
  );
}
