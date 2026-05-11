import { PageHeader } from "@/components/layout/PageHeader";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Beaker,
  CheckCircle2,
  DollarSign,
  Edit3,
  FileText,
  FlaskConical,
  Hash,
  Layers,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sigma,
  TestTube2,
  Trash2,
  X,
} from "lucide-react";
import {
  createLabTest,
  deleteLabTest,
  listLabTests,
  SAMPLE_TYPES,
  updateLabTest,
} from "../api/lab-tests.api";
import type {
  CreateLabTestPayload,
  LabTest,
  UpdateLabTestPayload,
} from "../api/lab-tests.api";

type FormState = {
  code: string;
  name: string;
  sample_type: string;
  unit_of_measure: string;
  reference_range: string;
  default_price: string;
  description: string;
};

const emptyForm: FormState = {
  code: "",
  name: "",
  sample_type: SAMPLE_TYPES[0],
  unit_of_measure: "",
  reference_range: "",
  default_price: "",
  description: "",
};

function formStateFrom(t: LabTest): FormState {
  return {
    code: t.code ?? "",
    name: t.name ?? "",
    sample_type: t.sample_type ?? SAMPLE_TYPES[0],
    unit_of_measure: t.unit_of_measure ?? "",
    reference_range: t.reference_range ?? "",
    default_price: t.default_price != null ? String(t.default_price) : "",
    description: t.description ?? "",
  };
}

function priceFmt(value?: number) {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(value);
}

export function LabTestsPage() {
  const [tests, setTests] = useState<LabTest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<
    { tone: "success" | "error"; message: string } | null
  >(null);

  const [search, setSearch] = useState("");
  const [sampleFilter, setSampleFilter] = useState("");

  const [isModalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LabTest | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<LabTest | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const showFeedback = (tone: "success" | "error", message: string) => {
    setFeedback({ tone, message });
    window.setTimeout(() => setFeedback(null), 3500);
  };

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await listLabTests({ skip: 0, limit: 500 });
      setTests(response.items ?? []);
    } catch (err: any) {
      console.error("Failed to load lab tests", err);
      setError(err?.response?.data?.message || "Unable to load lab tests catalogue.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const sampleTypeOptions = useMemo(() => {
    const set = new Set<string>();
    tests.forEach((t) => t.sample_type && set.add(t.sample_type));
    return Array.from(set).sort();
  }, [tests]);

  const filteredTests = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tests.filter((t) => {
      if (sampleFilter && t.sample_type !== sampleFilter) return false;
      if (!query) return true;
      return (
        t.code?.toLowerCase().includes(query) ||
        t.name?.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.sample_type?.toLowerCase().includes(query)
      );
    });
  }, [tests, search, sampleFilter]);

  const stats = useMemo(() => {
    const total = tests.length;
    const active = tests.filter((t) => t.is_active).length;
    const sampleTypes = new Set(
      tests.map((t) => t.sample_type).filter((v): v is string => !!v),
    ).size;
    const priced = tests.filter(
      (t) => t.default_price != null && t.default_price > 0,
    ).length;
    return { total, active, sampleTypes, priced };
  }, [tests]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setSaveError(null);
    setModalOpen(true);
  };

  const openEdit = (t: LabTest) => {
    setEditing(t);
    setForm(formStateFrom(t));
    setSaveError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      setSaveError("Test code and name are required.");
      return;
    }
    const priceNum =
      form.default_price.trim() === "" ? undefined : Number(form.default_price);
    if (priceNum != null && Number.isNaN(priceNum)) {
      setSaveError("Default price must be a number.");
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      if (editing) {
        const payload: UpdateLabTestPayload = {
          name: form.name.trim(),
          sample_type: form.sample_type || undefined,
          unit_of_measure: form.unit_of_measure.trim() || undefined,
          reference_range: form.reference_range.trim() || undefined,
          default_price: priceNum,
          description: form.description.trim() || undefined,
        };
        const result = await updateLabTest(editing.id, payload);
        setTests((prev) => {
          const others = prev.filter((t) => t.id !== result.lab_test.id);
          return [result.lab_test, ...others].sort((a, b) =>
            a.name.localeCompare(b.name),
          );
        });
        showFeedback("success", result.message || "Test updated.");
      } else {
        const payload: CreateLabTestPayload = {
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          sample_type: form.sample_type || undefined,
          unit_of_measure: form.unit_of_measure.trim() || undefined,
          reference_range: form.reference_range.trim() || undefined,
          default_price: priceNum,
          description: form.description.trim() || undefined,
        };
        const result = await createLabTest(payload);
        setTests((prev) =>
          [result.lab_test, ...prev].sort((a, b) => a.name.localeCompare(b.name)),
        );
        showFeedback("success", result.message || "Test added to the catalogue.");
      }
      setModalOpen(false);
    } catch (err: any) {
      setSaveError(err?.response?.data?.message || "Failed to save lab test.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setIsDeleting(true);
    try {
      await deleteLabTest(confirmDelete.id);
      setTests((prev) => prev.filter((t) => t.id !== confirmDelete.id));
      showFeedback("success", "Test removed from catalogue.");
      setConfirmDelete(null);
    } catch (err: any) {
      showFeedback("error", err?.response?.data?.message || "Failed to delete test.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Laboratory Catalogue"
          description="Master list of every diagnostic test offered, with sample requirements, reference ranges and pricing."
        />
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-100 hover:rotate-180 transition-transform duration-500"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={openCreate}
            className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20"
          >
            <Plus className="h-5 w-5" />
            <span className="font-bold">New Test</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`px-6 py-4 rounded-2xl border flex items-center gap-3 shadow-lg animate-fade-in ${
            feedback.tone === "success"
              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
              : "bg-rose-50 text-rose-700 border-rose-100"
          }`}
        >
          {feedback.tone === "success" ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          <span className="text-sm font-bold">{feedback.message}</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={FlaskConical} label="Total Tests" value={stats.total} tone="primary" />
        <StatCard icon={CheckCircle2} label="Active" value={stats.active} tone="emerald" />
        <StatCard icon={Layers} label="Sample Types" value={stats.sampleTypes} tone="amber" />
        <StatCard icon={DollarSign} label="Priced" value={stats.priced} tone="rose" />
      </div>

      {/* Filter Bar */}
      <div className="glass-card rounded-[2rem] p-4 flex flex-col md:flex-row gap-4 items-stretch md:items-center bg-white/40 backdrop-blur-md">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code, name, sample, or description..."
            className="w-full bg-white/50 border-none rounded-2xl pl-14 pr-6 py-4 text-sm focus:ring-2 focus:ring-primary-500/50 transition-all font-medium"
          />
        </div>
        <div className="relative">
          <TestTube2 className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400 pointer-events-none" />
          <select
            value={sampleFilter}
            onChange={(e) => setSampleFilter(e.target.value)}
            className="appearance-none bg-white/80 border border-secondary-100 rounded-2xl pl-11 pr-8 py-4 text-xs font-bold uppercase tracking-widest text-secondary-700 focus:ring-2 focus:ring-primary-500/40"
          >
            <option value="">All Samples</option>
            {sampleTypeOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-[2.5rem] overflow-hidden border border-secondary-100/50 shadow-premium bg-white/40">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-secondary-900/5">
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">
                  Test
                </th>
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">
                  Sample
                </th>
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">
                  Reference
                </th>
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">
                  Price
                </th>
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">
                  Status
                </th>
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100/50">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-8 py-8">
                      <div className="h-14 bg-secondary-100/30 rounded-2xl w-full" />
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="max-w-xs mx-auto space-y-4">
                      <AlertCircle className="h-12 w-12 mx-auto text-rose-500/50" />
                      <p className="text-secondary-600 font-bold">{error}</p>
                      <button onClick={load} className="btn-primary w-full py-3">
                        Try Again
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filteredTests.length > 0 ? (
                filteredTests.map((t) => (
                  <tr key={t.id} className="hover:bg-primary-50/30 transition-all group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-md">
                          <FlaskConical className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-secondary-900">{t.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center gap-1 bg-secondary-900/5 border border-secondary-900/10 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold text-secondary-600">
                              <Hash className="h-2.5 w-2.5" />
                              {t.code}
                            </span>
                            {t.description && (
                              <span className="text-[10px] text-secondary-400 truncate max-w-[200px]">
                                {t.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      {t.sample_type ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 text-[10px] font-bold uppercase tracking-widest">
                          <TestTube2 className="h-3 w-3" />
                          {t.sample_type}
                        </span>
                      ) : (
                        <span className="text-secondary-400 text-[11px] font-bold uppercase tracking-widest">—</span>
                      )}
                    </td>
                    <td className="px-8 py-6">
                      <div className="space-y-1">
                        {t.reference_range ? (
                          <p className="text-[11px] font-mono text-secondary-700 font-bold">
                            {t.reference_range}
                          </p>
                        ) : (
                          <p className="text-[11px] text-secondary-400">No range</p>
                        )}
                        {t.unit_of_measure && (
                          <p className="text-[10px] text-secondary-400 uppercase tracking-widest font-bold flex items-center gap-1">
                            <Sigma className="h-2.5 w-2.5" />
                            {t.unit_of_measure}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-sm font-black text-secondary-900">
                        {priceFmt(t.default_price)}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <span
                        className={`inline-flex px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest ${
                          t.is_active
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                            : "bg-secondary-100 text-secondary-500 border-secondary-200"
                        }`}
                      >
                        {t.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(t)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-primary-700 transition-all shadow-md shadow-primary-500/10"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => setConfirmDelete(t)}
                          className="p-2.5 hover:bg-rose-50 text-rose-500 rounded-xl transition-all"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-8 py-32 text-center">
                    <div className="max-w-sm mx-auto space-y-6">
                      <div className="h-20 w-20 bg-secondary-50 rounded-3xl flex items-center justify-center mx-auto">
                        <FlaskConical className="h-10 w-10 text-secondary-200" />
                      </div>
                      <h4 className="text-xl font-bold text-secondary-900">
                        No Tests in Catalogue
                      </h4>
                      <p className="text-sm text-secondary-500">
                        {tests.length === 0
                          ? "Add your first lab test to get started."
                          : "No tests match your filters. Adjust them or add a new test."}
                      </p>
                      <button onClick={openCreate} className="btn-primary inline-flex items-center gap-2 px-8 py-3">
                        <Plus className="h-4 w-4" />
                        <span>Add Test</span>
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-6 animate-fade-in">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-2xl w-full shadow-2xl relative animate-slide-up max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setModalOpen(false)}
              disabled={isSaving}
              className="absolute top-6 right-6 p-3 hover:bg-secondary-50 rounded-2xl transition-all disabled:opacity-50"
            >
              <X className="h-5 w-5 text-secondary-400" />
            </button>
            <div className="flex items-center gap-5 mb-8">
              <div className="h-14 w-14 rounded-2xl bg-primary-600 text-white flex items-center justify-center shadow-xl shadow-primary-500/20">
                {editing ? <Edit3 className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
              </div>
              <div>
                <h3 className="text-xl font-black font-display tracking-tight">
                  {editing ? "Edit Lab Test" : "New Lab Test"}
                </h3>
                <p className="text-secondary-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">
                  Configure A Diagnostic Test
                </p>
              </div>
            </div>

            {saveError && (
              <div className="mb-5 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3">
                <AlertCircle className="h-5 w-5" />
                <span className="text-sm font-bold">{saveError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field
                label="Code *"
                value={form.code}
                onChange={(v) => setForm({ ...form, code: v.toUpperCase() })}
                placeholder="FBC, MAL, HBA1C..."
                disabled={!!editing}
                mono
              />
              <Field
                label="Name *"
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
                placeholder="Full Blood Count"
              />
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                  Sample Type
                </label>
                <select
                  value={form.sample_type}
                  onChange={(e) => setForm({ ...form, sample_type: e.target.value })}
                  className="input-field h-12 bg-secondary-50 border-secondary-100 w-full"
                >
                  {SAMPLE_TYPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <Field
                label="Unit of Measure"
                value={form.unit_of_measure}
                onChange={(v) => setForm({ ...form, unit_of_measure: v })}
                placeholder="g/dL, mmol/L, %, ng/mL"
              />
              <Field
                label="Reference Range"
                value={form.reference_range}
                onChange={(v) => setForm({ ...form, reference_range: v })}
                placeholder="e.g. 12-16 g/dL"
              />
              <Field
                label="Default Price (NGN)"
                value={form.default_price}
                onChange={(v) => setForm({ ...form, default_price: v })}
                placeholder="2500"
                type="number"
              />
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Notes for clinicians and lab staff..."
                  className="input-field h-24 bg-secondary-50 border-secondary-100 w-full resize-none py-3"
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
                className="flex-[2] btn-primary py-4 rounded-2xl font-black tracking-tight shadow-xl shadow-primary-500/20 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Saving..." : editing ? "Save Changes" : "Add Test"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-6 animate-fade-in">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl animate-slide-up">
            <div className="flex items-center gap-5 mb-6">
              <div className="h-14 w-14 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-xl shadow-rose-500/20">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-black font-display tracking-tight">Delete Test</h3>
                <p className="text-secondary-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">
                  This Cannot Be Undone
                </p>
              </div>
            </div>
            <p className="text-sm text-secondary-600 leading-relaxed mb-6">
              Are you sure you want to delete{" "}
              <strong className="text-secondary-900">{confirmDelete.name}</strong>{" "}
              <span className="font-mono text-secondary-500">({confirmDelete.code})</span>{" "}
              from the catalogue? Existing orders and historical results will not be affected.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={isDeleting}
                className="flex-1 btn-secondary py-4 rounded-2xl font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-[2] py-4 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-black tracking-tight shadow-xl shadow-rose-500/20 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {isDeleting ? "Deleting..." : "Delete Test"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Reusable subcomponents ----------

type StatTone = "primary" | "emerald" | "amber" | "rose";

const statToneStyles: Record<StatTone, string> = {
  primary: "bg-primary-50 text-primary-600 border-primary-100",
  emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
  amber: "bg-amber-50 text-amber-600 border-amber-100",
  rose: "bg-rose-50 text-rose-600 border-rose-100",
};

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Beaker;
  label: string;
  value: number;
  tone: StatTone;
}) {
  return (
    <div
      className={`glass-card rounded-[2rem] p-6 border ${statToneStyles[tone]} bg-white/60 backdrop-blur-md`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{label}</span>
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-3xl font-black tracking-tight">{value}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  mono,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`input-field h-12 bg-secondary-50 border-secondary-100 w-full ${
          mono ? "font-mono" : ""
        } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
      />
      {disabled && (
        <p className="text-[9px] font-bold uppercase tracking-widest text-secondary-400 flex items-center gap-1">
          <FileText className="h-3 w-3" />
          Code is immutable once created
        </p>
      )}
    </div>
  );
}
