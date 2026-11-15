import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, Plus, RotateCcw, Stethoscope } from "lucide-react";
import {
  DxBadge,
  DxButton,
  DxForm,
  DxGrid,
  DxInput,
  DxMessage,
  DxPanel,
  DxPopup,
  DxSelect,
  DxTextarea,
  apiErrorMessage,
  formatDateTime,
  humanize,
  type DxBadgeTone,
  type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { createDiagnosis, DIAGNOSIS_TYPES, listDiagnosesForVisit, updateDiagnosis } from "../api/diagnoses.api";
import type { Diagnosis } from "../api/diagnoses.api";

type DiagnosesPanelProps = {
  visitId: number;
  /** Required for *adding* a new diagnosis — historical diagnoses (other consultations)
   *  will still render even when this is null, but the Add button will be disabled. */
  consultationId?: number | null;
  /** Read-only mode (e.g. when the active consultation is finalized/cancelled). */
  disabled?: boolean;
};

const TYPE_TONE: Record<string, DxBadgeTone> = {
  PRIMARY: "danger",
  SECONDARY: "warning",
  PROVISIONAL: "neutral",
  DIFFERENTIAL: "neutral",
  CONFIRMED: "success",
  FINAL: "success",
  RULED_OUT: "outline",
};

type FormState = {
  diagnosis_name: string;
  diagnosis_code: string;
  diagnosis_type: string;
  diagnosis_note: string;
};

const emptyForm: FormState = {
  diagnosis_name: "",
  diagnosis_code: "",
  diagnosis_type: "PRIMARY",
  diagnosis_note: "",
};

function formStateFrom(d: Diagnosis): FormState {
  return {
    diagnosis_name: d.diagnosis_name ?? "",
    diagnosis_code: d.diagnosis_code ?? "",
    diagnosis_type: d.diagnosis_type ?? "PRIMARY",
    diagnosis_note: d.diagnosis_note ?? "",
  };
}

const sortDiagnoses = (items: Diagnosis[]) =>
  [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

/**
 * Diagnoses recorded on the visit, grouped by consultation. Adding is gated by
 * an active consultation; editing is limited to diagnoses of that consultation.
 */
export function DiagnosesPanel({ visitId, consultationId, disabled }: DiagnosesPanelProps) {
  const toast = useToast();
  const qc = useQueryClient();
  const queryKey = ["diagnoses", "visit", visitId] as const;

  const [modal, setModal] = useState<{ open: boolean; editing: Diagnosis | null }>({ open: false, editing: null });
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const diagnosesQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await listDiagnosesForVisit(visitId);
      return sortDiagnoses(Array.isArray(res.items) ? res.items : []);
    },
    enabled: Number.isFinite(visitId),
  });
  const diagnoses = diagnosesQuery.data ?? [];

  const upsert = (saved: Diagnosis) =>
    qc.setQueryData<Diagnosis[]>(queryKey, (old) => sortDiagnoses([saved, ...(old ?? []).filter((d) => d.id !== saved.id)]));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        diagnosis_name: form.diagnosis_name.trim(),
        diagnosis_code: form.diagnosis_code.trim() || undefined,
        diagnosis_type: form.diagnosis_type || undefined,
        diagnosis_note: form.diagnosis_note.trim() || undefined,
      };
      if (modal.editing) return updateDiagnosis(modal.editing.id, payload);
      return createDiagnosis({ visit_id: visitId, consultation_id: consultationId as number, ...payload });
    },
    onSuccess: (res) => {
      upsert(res.diagnosis);
      setModal({ open: false, editing: null });
      toast.success(modal.editing ? "Diagnosis updated" : "Diagnosis recorded", res.message || undefined);
    },
    onError: (err) => setFormError(apiErrorMessage(err, "Failed to save diagnosis.")),
  });

  const canAdd = !disabled && !!consultationId;

  const openCreate = () => {
    setForm(emptyForm);
    setFormError(null);
    saveMutation.reset();
    setModal({ open: true, editing: null });
  };
  const openEdit = (d: Diagnosis) => {
    setForm(formStateFrom(d));
    setFormError(null);
    saveMutation.reset();
    setModal({ open: true, editing: d });
  };
  const handleSave = () => {
    if (!form.diagnosis_name.trim()) {
      setFormError("Diagnosis name is required.");
      return;
    }
    if (!modal.editing && !consultationId) {
      setFormError("A consultation is required to create a diagnosis.");
      return;
    }
    setFormError(null);
    saveMutation.mutate();
  };

  const groupLabel = (d: Diagnosis) =>
    consultationId != null && d.consultation_id === consultationId
      ? "This consultation"
      : !d.consultation_id
        ? "Unlinked"
        : `Consultation #${d.consultation_id}`;

  const columns: DxGridColumn<Diagnosis>[] = [
    {
      key: "diagnosis_name",
      header: "Diagnosis",
      sortable: true,
      wrap: true,
      render: (d) => (
        <div className="min-w-0">
          <div className={String(d.diagnosis_type).toUpperCase() === "RULED_OUT" ? "font-medium line-through dx-muted" : "font-medium"}>{d.diagnosis_name}</div>
          {d.diagnosis_note ? <div className="dx-muted text-[11.5px] whitespace-pre-wrap">{d.diagnosis_note}</div> : null}
        </div>
      ),
    },
    { key: "diagnosis_code", header: "Code", width: 90, sortable: true, render: (d) => (d.diagnosis_code ? <span className="dx-mono">{d.diagnosis_code}</span> : <span className="dx-faint">—</span>) },
    {
      key: "diagnosis_type",
      header: "Type",
      width: 120,
      sortable: true,
      filter: { options: DIAGNOSIS_TYPES.map((t) => ({ value: t, label: humanize(t) })) },
      render: (d) => {
        const key = (d.diagnosis_type || "").toUpperCase();
        return key ? <DxBadge tone={TYPE_TONE[key] ?? "neutral"}>{humanize(key)}</DxBadge> : <span className="dx-faint">—</span>;
      },
    },
    { key: "consultation_id", header: "Consultation", width: 140, sortable: true, accessor: (d) => groupLabel(d), render: (d) => <span className="dx-muted">{groupLabel(d)}</span> },
    { key: "created_at", header: "Recorded", width: 140, sortable: true, render: (d) => <span className="dx-mono">{formatDateTime(d.created_at)}</span> },
    {
      key: "actions",
      header: "",
      width: 44,
      align: "right",
      render: (d) => {
        const canEdit = !disabled && (consultationId == null || d.consultation_id === consultationId);
        return canEdit ? (
          <DxButton size="sm" variant="text" icon title="Edit diagnosis" onClick={() => openEdit(d)}>
            <Edit3 />
          </DxButton>
        ) : null;
      },
    },
  ];

  return (
    <DxPanel
      title="Diagnoses"
      icon={<Stethoscope />}
      description="Working and final clinical impressions on this visit."
      flush
      actions={
        <>
          <DxButton size="sm" variant="text" icon title="Refresh" onClick={() => diagnosesQuery.refetch()}>
            <RotateCcw className={diagnosesQuery.isFetching ? "animate-spin" : undefined} />
          </DxButton>
          {canAdd ? (
            <DxButton size="sm" variant="primary" leftIcon={<Plus />} onClick={openCreate}>
              Add diagnosis
            </DxButton>
          ) : null}
        </>
      }
    >
      <DxGrid
        columns={columns}
        data={diagnoses}
        rowKey={(d) => d.id}
        isLoading={diagnosesQuery.isLoading}
        error={diagnosesQuery.isError ? apiErrorMessage(diagnosesQuery.error, "Unable to load diagnoses for this visit.") : null}
        onRetry={() => diagnosesQuery.refetch()}
        borderless
        filterRow={diagnoses.length > 5}
        empty={{
          icon: Stethoscope,
          title: "No diagnoses recorded yet",
          description: canAdd ? undefined : !consultationId ? "Start a consultation to capture diagnoses." : undefined,
          action: canAdd ? (
            <DxButton size="sm" variant="primary" leftIcon={<Plus />} onClick={openCreate}>
              Add first diagnosis
            </DxButton>
          ) : undefined,
        }}
      />

      <DxPopup
        isOpen={modal.open}
        onClose={() => !saveMutation.isPending && setModal({ open: false, editing: null })}
        title={modal.editing ? "Edit diagnosis" : "Add diagnosis"}
        size="md"
        locked={saveMutation.isPending}
        footer={
          <>
            <span className="dx-faint mr-auto text-[11.5px]">
              Linked to consultation #{modal.editing?.consultation_id ?? consultationId ?? "—"} on visit #{visitId}
            </span>
            <DxButton onClick={() => setModal({ open: false, editing: null })} disabled={saveMutation.isPending}>
              Cancel
            </DxButton>
            <DxButton variant="primary" isLoading={saveMutation.isPending} onClick={handleSave}>
              {modal.editing ? "Save changes" : "Add diagnosis"}
            </DxButton>
          </>
        }
      >
        <div className="space-y-3">
          {formError ? <DxMessage tone="danger">{formError}</DxMessage> : null}
          <DxForm cols={2}>
            <DxInput
              label="Diagnosis name"
              required
              fieldClassName="dx-col-span-full"
              value={form.diagnosis_name}
              onChange={(e) => setForm({ ...form, diagnosis_name: e.target.value })}
              placeholder="e.g. Type 2 Diabetes Mellitus"
              autoFocus
            />
            <DxInput
              label="Code (e.g. ICD-10)"
              mono
              value={form.diagnosis_code}
              onChange={(e) => setForm({ ...form, diagnosis_code: e.target.value.toUpperCase() })}
              placeholder="E11"
            />
            <DxSelect
              label="Type"
              value={form.diagnosis_type}
              onChange={(e) => setForm({ ...form, diagnosis_type: e.target.value })}
              options={DIAGNOSIS_TYPES.map((t) => ({ value: t, label: humanize(t) }))}
            />
            <DxTextarea
              label="Clinical note"
              fieldClassName="dx-col-span-full"
              rows={4}
              value={form.diagnosis_note}
              onChange={(e) => setForm({ ...form, diagnosis_note: e.target.value })}
              placeholder="Reasoning, supporting evidence, severity, onset…"
            />
          </DxForm>
        </div>
      </DxPopup>
    </DxPanel>
  );
}
