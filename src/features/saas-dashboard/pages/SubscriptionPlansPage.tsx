import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Crown,
  Hash,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import {
  DxBadge,
  DxButton,
  DxCheckbox,
  DxForm,
  DxInput,
  DxMessage,
  DxPage,
  DxPageHeader,
  DxPanel,
  DxPopup,
  DxProps,
  DxSegmented,
  DxSelect,
  DxTextarea,
  apiErrorMessage,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
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
    interval: String(p.interval).toUpperCase() === "YEARLY" ? "YEARLY" : "MONTHLY",
    max_facilities: p.max_facilities == null ? "" : String(p.max_facilities),
    max_users: p.max_users == null ? "" : String(p.max_users),
    max_patients: p.max_patients == null ? "" : String(p.max_patients),
    is_active: !!p.is_active,
    features: Object.fromEntries(PLAN_FEATURE_FLAGS.map((f) => [f.key, !!(p as any)[f.key]])),
  };
}

export function SubscriptionPlansPage() {
  const toast = useToast();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SubscriptionPlan | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<number | string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setPlans(await listPlansAdmin(true));
    } catch (err) {
      setError(apiErrorMessage(err) || "Unable to load subscription plans.");
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

  // The Trial plan is a full-feature trial: every module is always enabled and
  // cannot be toggled off (the backend enforces this too).
  const isTrialPlan = (editing?.code ?? form.code).trim().toUpperCase() === "TRIAL";

  const handleSubmit = async () => {
    if (!form.name.trim()) return setFormError("Plan name is required.");
    if (!editing && !/^[A-Z0-9_]{2,}$/.test(form.code.trim())) {
      return setFormError("Code must be 2+ uppercase letters, digits or underscores.");
    }
    const priceNum = Number(form.price);
    if (Number.isNaN(priceNum) || priceNum < 0) return setFormError("Enter a valid price.");

    setSaving(true);
    setFormError(null);

    const features = isTrialPlan
      ? (Object.fromEntries(PLAN_FEATURE_FLAGS.map((f) => [f.key, true])) as Record<PlanFeatureKey, boolean>)
      : (form.features as Record<PlanFeatureKey, boolean>);
    const maxPatients = form.max_patients.trim() === "" ? null : Number(form.max_patients);

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
        toast.success(`Plan "${form.name}" updated.`);
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
        toast.success(`Plan "${form.name}" created.`);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(apiErrorMessage(err) || "Failed to save plan.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (plan: SubscriptionPlan) => {
    setTogglingId(plan.id);
    try {
      await setPlanActive(plan.id, !plan.is_active);
      toast.success(`${plan.name} ${plan.is_active ? "deactivated" : "activated"}.`);
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err) || "Failed to update plan.");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "SaaS admin" }, { label: "Subscription plans" }]}
        title="Subscription plans"
        subtitle="Create, price, and manage the platform's subscription tiers."
        actions={
          <>
            <DxButton leftIcon={<RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />} onClick={load}>
              Refresh
            </DxButton>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              New plan
            </DxButton>
          </>
        }
      />

      {error ? (
        <DxMessage tone="danger" action={<DxButton onClick={load}>Retry</DxButton>}>
          {error}
        </DxMessage>
      ) : isLoading ? (
        <DxPanel>
          <p className="py-10 text-center text-[var(--dx-text-muted)]">Loading plans…</p>
        </DxPanel>
      ) : sortedPlans.length === 0 ? (
        <DxPanel>
          <div className="py-12 text-center">
            <Layers className="h-10 w-10 mx-auto text-[var(--dx-text-muted)] mb-3" />
            <p className="text-[var(--dx-text-muted)]">No subscription plans yet. Create your first tier.</p>
          </div>
        </DxPanel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedPlans.map((p) => (
            <DxPanel
              key={p.id}
              className={p.is_active ? "" : "opacity-70"}
              title={
                <span className="inline-flex items-center gap-2">
                  {p.name}
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--dx-text-muted)]">
                    <Hash className="h-2.5 w-2.5" />
                    {p.code}
                  </span>
                </span>
              }
              actions={
                p.is_active ? (
                  <DxBadge tone="success" dot>
                    Active
                  </DxBadge>
                ) : (
                  <DxBadge tone="neutral" dot>
                    Inactive
                  </DxBadge>
                )
              }
              footer={
                <div className="flex items-center gap-2">
                  <DxButton size="sm" className="flex-1" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openEdit(p)}>
                    Edit
                  </DxButton>
                  <DxButton
                    size="sm"
                    className="flex-1"
                    variant={p.is_active ? "outline-danger" : "primary"}
                    leftIcon={p.is_active ? <ToggleLeft className="h-3.5 w-3.5" /> : <ToggleRight className="h-3.5 w-3.5" />}
                    isLoading={togglingId === p.id}
                    onClick={() => handleToggleActive(p)}
                  >
                    {p.is_active ? "Deactivate" : "Activate"}
                  </DxButton>
                </div>
              }
            >
              <p className="text-xl font-semibold text-[var(--dx-text)]">
                {p.currency} {Number(p.price).toLocaleString()}
                <span className="text-[12px] font-normal text-[var(--dx-text-muted)]">
                  {" "}/ {String(p.interval).toLowerCase()}
                </span>
              </p>
              {p.description && (
                <p className="text-[var(--dx-text-muted)] mt-1 leading-relaxed">{p.description}</p>
              )}

              <DxProps
                tight
                className="mt-3"
                items={[
                  { label: "Facilities", value: p.max_facilities ?? "∞" },
                  { label: "Users", value: p.max_users ?? "∞" },
                  { label: "Patients", value: p.max_patients ?? "∞" },
                ]}
              />

              <div className="flex flex-wrap gap-1.5 mt-3">
                {PLAN_FEATURE_FLAGS.filter((f) => (p as any)[f.key]).map((f) => (
                  <DxBadge key={f.key} tone="accent">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    {f.label}
                  </DxBadge>
                ))}
              </div>
            </DxPanel>
          ))}
        </div>
      )}

      {/* Create / edit */}
      <DxPopup
        isOpen={modalOpen}
        onClose={closeModal}
        title={editing ? `Edit plan — ${editing.code}` : "New subscription plan"}
        size="xl"
        footer={
          <>
            <DxButton onClick={closeModal} disabled={saving}>
              Cancel
            </DxButton>
            <DxButton variant="primary" leftIcon={<Crown className="h-4 w-4" />} isLoading={saving} onClick={handleSubmit}>
              {editing ? "Save changes" : "Create plan"}
            </DxButton>
          </>
        }
      >
        {formError && (
          <DxMessage tone="danger" className="mb-4">
            {formError}
          </DxMessage>
        )}

        <DxForm cols={2}>
          <DxInput
            label="Plan name"
            required
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            placeholder="e.g. Professional"
          />
          <DxInput
            label={editing ? "Code (fixed)" : "Code"}
            required={!editing}
            mono
            value={form.code}
            onChange={(e) => setField("code", e.target.value.toUpperCase())}
            disabled={!!editing}
            placeholder="e.g. PRO"
          />
          <DxTextarea
            label="Description"
            fieldClassName="dx-col-span-full"
            value={form.description}
            onChange={(e) => setField("description", e.target.value)}
            placeholder="Short summary shown on the onboarding page."
          />
          <DxInput
            label="Price"
            required
            type="number"
            min="0"
            value={form.price}
            onChange={(e) => setField("price", e.target.value)}
            placeholder="50000"
          />
          <DxSelect
            label={editing ? "Currency (fixed)" : "Currency"}
            value={form.currency}
            onChange={(e) => setField("currency", e.target.value)}
            disabled={!!editing}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))}
          />
          <div>
            <p className="dx-field-label mb-1.5">{editing ? "Billing cycle (fixed)" : "Billing cycle"}</p>
            <DxSegmented
              value={form.interval}
              onChange={(v) => setField("interval", v as "MONTHLY" | "YEARLY")}
              items={[
                { key: "MONTHLY", label: "Monthly", disabled: !!editing },
                { key: "YEARLY", label: "Yearly", disabled: !!editing },
              ]}
            />
          </div>
          <div className="flex items-end">
            <DxCheckbox
              label="Active"
              checked={form.is_active}
              onChange={(e) => setField("is_active", e.target.checked)}
            />
          </div>
          <DxInput
            label="Max facilities"
            type="number"
            min="1"
            value={form.max_facilities}
            onChange={(e) => setField("max_facilities", e.target.value)}
          />
          <DxInput
            label="Max users"
            type="number"
            min="1"
            value={form.max_users}
            onChange={(e) => setField("max_users", e.target.value)}
          />
          <DxInput
            label="Max patients (blank = unlimited)"
            fieldClassName="dx-col-span-full"
            type="number"
            min="0"
            value={form.max_patients}
            onChange={(e) => setField("max_patients", e.target.value)}
            placeholder="Unlimited"
          />
        </DxForm>

        <div className="mt-5">
          <p className="dx-field-label mb-1.5">Capabilities</p>
          {isTrialPlan && (
            <p className="mb-2 text-[12px] font-medium text-[var(--dx-accent)]">
              All modules are always enabled on the Trial plan.
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {PLAN_FEATURE_FLAGS.map((f) => {
              const on = isTrialPlan ? true : form.features[f.key];
              return (
                <DxCheckbox
                  key={f.key}
                  label={f.label}
                  checked={on}
                  disabled={isTrialPlan}
                  onChange={() => !isTrialPlan && toggleFeature(f.key)}
                />
              );
            })}
          </div>
        </div>
      </DxPopup>
    </DxPage>
  );
}
