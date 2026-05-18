import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  FileText,
  Hash,
  Plus,
  RefreshCw,
  Save,
  Stethoscope,
  Tag,
  X,
} from "lucide-react";
import {
  createDiagnosis,
  DIAGNOSIS_TYPES,
  listDiagnosesForVisit,
  updateDiagnosis,
} from "../api/diagnoses.api";
import type { Diagnosis } from "../api/diagnoses.api";

type DiagnosesPanelProps = {
  visitId: number;
  /** Required for *adding* a new diagnosis — historical diagnoses (other consultations)
   *  will still render even when this is null, but the Add button will be disabled. */
  consultationId?: number | null;
  /** Read-only mode (e.g. when the active consultation is finalized/cancelled). */
  disabled?: boolean;
};

const typeStyles: Record<string, string> = {
  PRIMARY: "bg-rose-50 text-rose-600 border-rose-100",
  SECONDARY: "bg-amber-50 text-amber-600 border-amber-100",
  PROVISIONAL: "bg-secondary-100 text-secondary-600 border-secondary-200",
  DIFFERENTIAL: "bg-secondary-100 text-secondary-600 border-secondary-200",
  CONFIRMED: "bg-emerald-50 text-emerald-600 border-emerald-100",
  FINAL: "bg-emerald-50 text-emerald-600 border-emerald-100",
  RULED_OUT: "bg-slate-100 text-slate-500 border-slate-200 line-through",
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

export function DiagnosesPanel({ visitId, consultationId, disabled }: DiagnosesPanelProps) {
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Diagnosis | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await listDiagnosesForVisit(visitId);
      const items = Array.isArray(response.items) ? response.items : [];
      setDiagnoses(
        [...items].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
      );
    } catch (err: any) {
      console.error("Failed to load diagnoses", err);
      setError(err?.response?.data?.message || "Unable to load diagnoses for this visit.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (Number.isFinite(visitId)) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitId]);

  const grouped = useMemo(() => {
    const map = new Map<number, Diagnosis[]>();
    for (const d of diagnoses) {
      const key = d.consultation_id ?? 0;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return Array.from(map.entries());
  }, [diagnoses]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setSaveError(null);
    setModalOpen(true);
  };

  const openEdit = (d: Diagnosis) => {
    setEditing(d);
    setForm(formStateFrom(d));
    setSaveError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.diagnosis_name.trim()) {
      setSaveError("Diagnosis name is required.");
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      if (editing) {
        const result = await updateDiagnosis(editing.id, {
          diagnosis_name: form.diagnosis_name.trim(),
          diagnosis_code: form.diagnosis_code.trim() || undefined,
          diagnosis_type: form.diagnosis_type || undefined,
          diagnosis_note: form.diagnosis_note.trim() || undefined,
        });
        setDiagnoses((prev) => {
          const others = prev.filter((d) => d.id !== result.diagnosis.id);
          return [result.diagnosis, ...others].sort(
            (a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          );
        });
      } else {
        if (!consultationId) {
          setSaveError("A consultation is required to create a diagnosis.");
          return;
        }
        const result = await createDiagnosis({
          visit_id: visitId,
          consultation_id: consultationId,
          diagnosis_name: form.diagnosis_name.trim(),
          diagnosis_code: form.diagnosis_code.trim() || undefined,
          diagnosis_type: form.diagnosis_type || undefined,
          diagnosis_note: form.diagnosis_note.trim() || undefined,
        });
        setDiagnoses((prev) => [result.diagnosis, ...prev]);
      }
      setModalOpen(false);
    } catch (err: any) {
      setSaveError(err?.response?.data?.message || "Failed to save diagnosis.");
    } finally {
      setIsSaving(false);
    }
  };

  const canAdd = !disabled && !!consultationId;

  return (
    <div className="glass-card rounded p-10 md:p-12 space-y-6">
      <div className="flex items-center justify-between border-b border-secondary-400 pb-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-md shadow-rose-500/20">
            <Stethoscope className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-black font-display tracking-tight">Diagnoses</h3>
            <p className="text-secondary-400 font-bold text-[10px] uppercase tracking-[0.25em] mt-0.5">
              Working And Final Clinical Impressions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2.5 rounded-xl hover:bg-secondary-100 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 text-secondary-500 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          {canAdd && (
            <button
              onClick={openCreate}
              className="btn-primary gap-2 px-5 py-2.5 text-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Add Diagnosis</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm font-bold flex-1">{error}</span>
          <button onClick={load} className="text-xs font-bold underline">
            Retry
          </button>
        </div>
      )}

      {isLoading && diagnoses.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-secondary-50 animate-pulse" />
          ))}
        </div>
      ) : diagnoses.length === 0 && !error ? (
        <div className="py-10 text-center">
          <div className="h-14 w-14 mx-auto bg-rose-50 rounded-3xl flex items-center justify-center mb-3">
            <Stethoscope className="h-7 w-7 text-rose-300" />
          </div>
          <p className="text-sm text-secondary-500 font-bold">No diagnoses recorded yet.</p>
          {canAdd ? (
            <button onClick={openCreate} className="btn-primary mt-5 gap-2 px-5 py-2 text-xs">
              <Plus className="h-3.5 w-3.5" />
              <span>Add First Diagnosis</span>
            </button>
          ) : !consultationId ? (
            <p className="text-[11px] text-secondary-400 mt-3">
              Start a consultation to capture diagnoses.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([groupKey, items]) => {
            const isThisConsultation = consultationId != null && groupKey === consultationId;
            return (
              <div key={groupKey} className="space-y-3">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.25em] text-secondary-400 flex items-center gap-2">
                  <Tag className="h-3 w-3" />
                  {isThisConsultation
                    ? "This Consultation"
                    : groupKey === 0
                      ? "Unlinked"
                      : `Consultation #${groupKey}`}
                </h4>
                <div className="space-y-3">
                  {items.map((d) => {
                    const typeKey = (d.diagnosis_type || "").toUpperCase();
                    const typeClass = typeStyles[typeKey] ?? typeStyles.PROVISIONAL;
                    const canEdit = !disabled && (consultationId == null || d.consultation_id === consultationId);
                    return (
                      <div
                        key={d.id}
                        className="p-5 rounded-2xl bg-white border border-secondary-400 hover:border-rose-200 transition-all"
                      >
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-black text-secondary-900">
                                {d.diagnosis_name}
                              </p>
                              {d.diagnosis_code && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary-100 text-secondary-500 text-[10px] font-mono font-bold">
                                  <Hash className="h-2.5 w-2.5" />
                                  {d.diagnosis_code}
                                </span>
                              )}
                              {typeKey && (
                                <span
                                  className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-widest border ${typeClass}`}
                                >
                                  {typeKey.replace("_", " ")}
                                </span>
                              )}
                            </div>
                            {d.diagnosis_note && (
                              <p className="mt-2 text-xs text-secondary-600 leading-relaxed flex items-start gap-1.5">
                                <FileText className="h-3 w-3 mt-0.5 shrink-0 text-secondary-300" />
                                <span>{d.diagnosis_note}</span>
                              </p>
                            )}
                          </div>
                          {canEdit && (
                            <button
                              onClick={() => openEdit(d)}
                              className="p-2 rounded-xl hover:bg-secondary-100 text-secondary-500"
                              title="Edit diagnosis"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-6 animate-fade-in">
          <div className="bg-white rounded p-10 max-w-xl w-full shadow-2xl relative animate-slide-up max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setModalOpen(false)}
              disabled={isSaving}
              className="absolute top-6 right-6 p-3 hover:bg-secondary-50 rounded-2xl transition-all disabled:opacity-50"
            >
              <X className="h-5 w-5 text-secondary-400" />
            </button>
            <div className="flex items-center gap-5 mb-8">
              <div className="h-14 w-14 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-xl shadow-rose-500/20">
                {editing ? <Edit3 className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
              </div>
              <div>
                <h3 className="text-xl font-black font-display tracking-tight">
                  {editing ? "Edit Diagnosis" : "Add Diagnosis"}
                </h3>
                <p className="text-secondary-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">
                  Capture A Clinical Impression
                </p>
              </div>
            </div>

            {saveError && (
              <div className="mb-5 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3">
                <AlertCircle className="h-5 w-5" />
                <span className="text-sm font-bold">{saveError}</span>
              </div>
            )}

            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                  Diagnosis Name *
                </label>
                <input
                  type="text"
                  value={form.diagnosis_name}
                  onChange={(e) => setForm({ ...form, diagnosis_name: e.target.value })}
                  placeholder="e.g. Type 2 Diabetes Mellitus"
                  className="input-field h-12 bg-secondary-50 border-secondary-400 w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                    Code (e.g. ICD-10)
                  </label>
                  <input
                    type="text"
                    value={form.diagnosis_code}
                    onChange={(e) =>
                      setForm({ ...form, diagnosis_code: e.target.value.toUpperCase() })
                    }
                    placeholder="E11"
                    className="input-field h-12 bg-secondary-50 border-secondary-400 w-full font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                    Type
                  </label>
                  <select
                    value={form.diagnosis_type}
                    onChange={(e) => setForm({ ...form, diagnosis_type: e.target.value })}
                    className="input-field h-12 bg-secondary-50 border-secondary-400 w-full"
                  >
                    {DIAGNOSIS_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                  Clinical Note
                </label>
                <textarea
                  value={form.diagnosis_note}
                  onChange={(e) => setForm({ ...form, diagnosis_note: e.target.value })}
                  placeholder="Reasoning, supporting evidence, severity, onset..."
                  className="input-field h-28 bg-secondary-50 border-secondary-400 w-full resize-none py-3"
                />
              </div>
            </div>

            <div className="pt-6 flex gap-4">
              <button
                onClick={() => setModalOpen(false)}
                disabled={isSaving}
                className="flex-1 btn-secondary py-4 rounded-2xl font-bold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-[2] btn-primary py-4 rounded-2xl font-black tracking-tight bg-rose-500 hover:bg-rose-600 shadow-xl shadow-rose-500/20 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isSaving ? "Saving..." : editing ? "Save Changes" : "Add Diagnosis"}
              </button>
            </div>

            <p className="mt-4 text-[10px] text-secondary-400 text-center flex items-center justify-center gap-1.5">
              <CheckCircle2 className="h-3 w-3" />
              Linked to consultation #{editing?.consultation_id ?? consultationId ?? "—"} on visit
              #{visitId}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
