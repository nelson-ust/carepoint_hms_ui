import { PageHeader } from "@/components/layout/PageHeader";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Crown,
  Hash,
  Layers,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Save,
  ToggleLeft,
  ToggleRight,
  X,
} from "lucide-react";
import {
  PLAN_FEATURE_FLAGS,
  createPlan,
  listPlansAdmin,
  setPlanActive,
  updatePlan,
} from "../api/subscription-plans.api";
import type {
  PlanFeatureKey,
  SubscriptionPlan,
  SubscriptionPlanCreatePayload,
} from "../api/subscription-plans.api";

type FormState = {
  name: string;
  code: string;
  description: string;
  price: string;
  currency: string;
  interval: "MONTHLY" | "YEARLY";
  max_facilities: string;
  max_users: string;
  max_patients: string; // blank = unlimited
  is_active: boolean;
  features: Record<string, boolean>;
};

const CURRENCIES = ["NGN", "USD", "GBP", "EUR"];

function emptyForm(): FormState {
  return {
    name: "",
    code: "",
    description: "",
    price: "",
    currency: "NGN",
    interval: "MONTHLY",
    max_facilities: "1",
    max_users: "10",
    max_patients: "",
    is_active: true,
    features: Object.fromEntries(PLAN_FEATURE_FLAGS.map((f) => [f.key, false])),
  };
}

function formFromPlan(p: SubscriptionPlan): FormState {
  return {
    name: p.name ?? "",
    code: p.code ?? "",
    description: p.description ?? "",
    price: String(p.price ?? ""),
    currency: p.currency ?? "NGN",
    interval: (String(p.interval).toUpperCase() === "YEARLY" ? "YEARLY" : "MONTHLY"),
    max_facilities: p.max_facilities == null ? "" : String(p.max_facilities),
    max_users: p.max_users == null ? "" : String(p.max_users),
    max_patients: p.max_patients == null ? "" : String(p.max_patients),
    is_active: !!p.is_active,
    features: Object.fromEntries(
      PLAN_FEATURE_FLAGS.map((f) => [f.key, !!(p as any)[f.key]]),
    ),
  };
}

export function SubscriptionPlansPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<
    { tone: "success" | "error"; message: string } | null
  >(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SubscriptionPlan | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<number | string | null>(null);

  const showFeedback = (tone: "success" | "error", message: string) => {
    setFeedback({ tone, message });
    window.setTimeout(() => setFeedback(null), 3500);
  };

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setPlans(await listPlansAdmin(true));
    } catch (err: any) {
      setError(err?.response?.data?.message || "Unable to load subscription plans.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => Number(a.price) - Number(b.price)),
    [plans],
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (plan: SubscriptionPlan) => {
    setEditing(plan);
    setForm(formFromPlan(plan));
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleFeature = (key: string) =>
    setForm((f) => ({ ...f, features: { ...f.features, [key]: !f.features[key] } }));

  const handleSubmit = async () => {
    // Validation
    if (!form.name.trim()) return setFormError("Plan name is required.");
    if (!editing && !/^[A-Z0-9_]{2,}$/.test(form.code.trim())) {
      return setFormError("Code must be 2+ uppercase letters, digits or underscores.");
    }
    const priceNum = Number(form.price);
    if (Number.isNaN(priceNum) || priceNum < 0) return setFormError("Enter a valid price.");

    setSaving(true);
    setFormError(null);

    const features = form.features as Record<PlanFeatureKey, boolean>;
    const maxPatients =
      form.max_patients.trim() === "" ? null : Number(form.max_patients);

    try {
      if (editing) {
        await updatePlan(editing.id, {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          price: priceNum,
          max_facilities: Number(form.max_facilities) || 1,
          max_users: Number(form.max_users) || 1,
          max_patients: maxPatients,
          is_active: form.is_active,
          ...features,
        });
        showFeedback("success", `Plan "${form.name}" updated.`);
      } else {
        const payload: SubscriptionPlanCreatePayload = {
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
          description: form.description.trim() || undefined,
          price: priceNum,
          currency: form.currency,
          interval: form.interval,
          max_facilities: Number(form.max_facilities) || 1,
          max_users: Number(form.max_users) || 1,
          max_patients: maxPatients,
          is_active: form.is_active,
          ...features,
        };
        await createPlan(payload);
        showFeedback("success", `Plan "${form.name}" created.`);
      }
      setModalOpen(false);
      await load();
    } catch (err: any) {
      setFormError(err?.response?.data?.message || "Failed to save plan.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (plan: SubscriptionPlan) => {
    setTogglingId(plan.id);
    try {
      await setPlanActive(plan.id, !plan.is_active);
      showFeedback(
        "success",
        `${plan.name} ${plan.is_active ? "deactivated" : "activated"}.`,
      );
      await load();
    } catch (err: any) {
      showFeedback("error", err?.response?.data?.message || "Failed to update plan.");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Subscription Plans"
          description="Create, price, and manage the platform's subscription tiers."
        />
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-400"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={openCreate}
            className="btn-primary gap-2 px-6 py-3 rounded-2xl bg-primary-600 hover:bg-primary-700 shadow-lg shadow-primary-500/20"
          >
            <Plus className="h-4 w-4" />
            <span className="text-sm font-bold">New Plan</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`px-6 py-4 rounded-2xl border flex items-center gap-3 shadow-lg animate-fade-in ${feedback.tone === "success"
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

      {error ? (
        <div className="p-6 rounded-2xl border border-rose-100 bg-rose-50 text-rose-600 flex items-center gap-3">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm font-bold">{error}</span>
        </div>
      ) : isLoading ? (
        <div className="py-20 text-center text-sm font-black text-secondary-400 uppercase tracking-[0.3em] animate-pulse">
          Loading Plans...
        </div>
      ) : sortedPlans.length === 0 ? (
        <div className="py-20 text-center">
          <Layers className="h-12 w-12 mx-auto text-secondary-200 mb-4" />
          <p className="text-sm font-bold text-secondary-500">
            No subscription plans yet. Create your first tier.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {sortedPlans.map((p) => (
            <div
              key={p.id}
              className={`glass-card rounded-[2rem] p-7 bg-white/70 border-2 transition-all flex flex-col ${p.is_active ? "border-secondary-400" : "border-dashed border-secondary-300 opacity-70"
                }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-black text-secondary-900">{p.name}</h3>
                  <span className="inline-flex items-center gap-1 mt-1 bg-secondary-100 text-secondary-500 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-widest">
                    <Hash className="h-2.5 w-2.5" />
                    {p.code}
                  </span>
                </div>
                <span
                  className={`inline-flex px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-widest ${p.is_active
                      ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                      : "bg-secondary-100 text-secondary-500 border-secondary-200"
                    }`}
                >
                  {p.is_active ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="mb-4">
                <p className="text-2xl font-black text-secondary-900">
                  {p.currency} {Number(p.price).toLocaleString()}
                  <span className="text-xs font-bold text-secondary-400">
                    {" "}/ {String(p.interval).toLowerCase()}
                  </span>
                </p>
                {p.description && (
                  <p className="text-xs text-secondary-500 mt-1 leading-relaxed">{p.description}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                <Quota label="Facilities" value={p.max_facilities} />
                <Quota label="Users" value={p.max_users} />
                <Quota label="Patients" value={p.max_patients ?? null} />
              </div>

              <div className="flex flex-wrap gap-1.5 mb-5 flex-1 content-start">
                {PLAN_FEATURE_FLAGS.filter((f) => (p as any)[f.key]).map((f) => (
                  <span
                    key={f.key}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary-50 text-primary-600 text-[10px] font-bold"
                  >
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    {f.label}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-secondary-100">
                <button
                  onClick={() => openEdit(p)}
                  className="btn-secondary flex-1 gap-2 py-2.5 rounded-xl text-xs font-bold"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  onClick={() => handleToggleActive(p)}
                  disabled={togglingId === p.id}
                  className={`flex-1 gap-2 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center border-2 transition-all disabled:opacity-50 ${p.is_active
                      ? "border-rose-200 text-rose-600 hover:bg-rose-50"
                      : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                    }`}
                >
                  {p.is_active ? (
                    <><ToggleLeft className="h-3.5 w-3.5" /> Deactivate</>
                  ) : (
                    <><ToggleRight className="h-3.5 w-3.5" /> Activate</>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-6 animate-fade-in">
          <div className="bg-white rounded-[2.5rem] p-8 md:p-10 max-w-2xl w-full shadow-2xl relative animate-slide-up max-h-[90vh] overflow-y-auto">
            <button
              onClick={closeModal}
              className="absolute top-6 right-6 p-3 hover:bg-secondary-50 rounded-2xl transition-all"
            >
              <X className="h-5 w-5 text-secondary-400" />
            </button>
            <div className="flex items-center gap-5 mb-8">
              <div className="h-14 w-14 rounded-2xl bg-primary-600 text-white flex items-center justify-center shadow-xl shadow-primary-500/20">
                <Crown className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-black font-display tracking-tight">
                  {editing ? "Edit Plan" : "New Subscription Plan"}
                </h3>
                <p className="text-secondary-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">
                  {editing ? `Editing ${editing.code}` : "Define A New Tier"}
                </p>
              </div>
            </div>

            {formError && (
              <div className="mb-5 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3">
                <AlertCircle className="h-5 w-5" />
                <span className="text-sm font-bold">{formError}</span>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Plan Name *">
                <input
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  className="input-field"
                  placeholder="e.g. Professional"
                />
              </Field>
              <Field label={editing ? "Code (fixed)" : "Code *"}>
                <input
                  value={form.code}
                  onChange={(e) => setField("code", e.target.value.toUpperCase())}
                  disabled={!!editing}
                  className="input-field font-mono disabled:opacity-60"
                  placeholder="e.g. PRO"
                />
              </Field>

              <Field label="Description" full>
                <textarea
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  className="input-field h-20 resize-none"
                  placeholder="Short summary shown on the onboarding page."
                />
              </Field>

              <Field label="Price *">
                <input
                  type="number"
                  min="0"
                  value={form.price}
                  onChange={(e) => setField("price", e.target.value)}
                  className="input-field"
                  placeholder="50000"
                />
              </Field>
              <Field label={editing ? "Currency (fixed)" : "Currency"}>
                <select
                  value={form.currency}
                  onChange={(e) => setField("currency", e.target.value)}
                  disabled={!!editing}
                  className="input-field disabled:opacity-60"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>

              <Field label={editing ? "Billing Cycle (fixed)" : "Billing Cycle"}>
                <div className="grid grid-cols-2 gap-2">
                  {(["MONTHLY", "YEARLY"] as const).map((iv) => (
                    <button
                      key={iv}
                      type="button"
                      disabled={!!editing}
                      onClick={() => setField("interval", iv)}
                      className={`p-2.5 rounded-xl border-2 text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-60 ${form.interval === iv
                          ? "bg-primary-500 text-white border-primary-500"
                          : "bg-white border-secondary-400 text-secondary-600 hover:border-primary-300"
                        }`}
                    >
                      {iv}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Status">
                <button
                  type="button"
                  onClick={() => setField("is_active", !form.is_active)}
                  className={`w-full p-2.5 rounded-xl border-2 text-xs font-bold flex items-center justify-center gap-2 transition-all ${form.is_active
                      ? "border-emerald-200 text-emerald-600 bg-emerald-50"
                      : "border-secondary-300 text-secondary-500 bg-secondary-50"
                    }`}
                >
                  <Power className="h-3.5 w-3.5" />
                  {form.is_active ? "Active" : "Inactive"}
                </button>
              </Field>

              <Field label="Max Facilities">
                <input
                  type="number"
                  min="1"
                  value={form.max_facilities}
                  onChange={(e) => setField("max_facilities", e.target.value)}
                  className="input-field"
                />
              </Field>
              <Field label="Max Users">
                <input
                  type="number"
                  min="1"
                  value={form.max_users}
                  onChange={(e) => setField("max_users", e.target.value)}
                  className="input-field"
                />
              </Field>
              <Field label="Max Patients (blank = unlimited)" full>
                <input
                  type="number"
                  min="0"
                  value={form.max_patients}
                  onChange={(e) => setField("max_patients", e.target.value)}
                  className="input-field"
                  placeholder="Unlimited"
                />
              </Field>
            </div>

            <div className="mt-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-secondary-500 mb-3">
                Capabilities
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PLAN_FEATURE_FLAGS.map((f) => {
                  const on = form.features[f.key];
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => toggleFeature(f.key)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-[11px] font-bold transition-all ${on
                          ? "bg-primary-50 border-primary-400 text-primary-700"
                          : "bg-white border-secondary-300 text-secondary-500 hover:border-primary-200"
                        }`}
                    >
                      <CheckCircle2
                        className={`h-3.5 w-3.5 ${on ? "text-primary-500" : "text-secondary-300"}`}
                      />
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-8 flex gap-4">
              <button
                onClick={closeModal}
                disabled={saving}
                className="flex-1 btn-secondary py-4 rounded-2xl font-bold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex-[2] py-4 rounded-2xl text-white font-black tracking-tight shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 bg-primary-600 hover:bg-primary-700 shadow-primary-500/20"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : editing ? "Save Changes" : "Create Plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={`space-y-1.5 ${full ? "md:col-span-2" : ""}`}>
      <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function Quota({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="px-2.5 py-1.5 rounded-lg bg-secondary-50 border border-secondary-200 flex flex-col items-center min-w-[64px]">
      <span className="text-[8px] font-black text-secondary-400 uppercase tracking-tighter">
        {label}
      </span>
      <span className="text-[11px] font-black text-secondary-900">
        {value === null ? "∞" : value}
      </span>
    </div>
  );
}
