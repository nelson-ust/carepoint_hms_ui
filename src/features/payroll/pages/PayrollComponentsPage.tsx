import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layers, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SuiteEyebrow } from "@/components/layout/SuiteEyebrow";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import { PayrollTabs } from "../components/PayrollTabs";
import { listStaffRecords } from "@/features/hr/api/staff-records.api";
import {
  applyComponentTemplate,
  createComponentTemplate,
  createPayrollComponent,
  listComponentTemplates,
  listPayrollComponents,
  replaceTemplateItems,
  updateComponentTemplate,
  updatePayrollComponent,
  type PayrollComponent,
  type PayrollComponentPayload,
  type PayrollComponentTemplate,
  type PayrollComponentType,
  type TemplateItemPayload,
} from "../api/payroll.api";

const TYPE_LABEL: Record<PayrollComponentType, string> = {
  EARNING: "Earning",
  DEDUCTION: "Deduction",
  STATUTORY: "Statutory",
  EMPLOYER_CONTRIBUTION: "Employer contribution",
};

const TYPE_VARIANT: Record<PayrollComponentType, BadgeProps["variant"]> = {
  EARNING: "soft-success",
  DEDUCTION: "soft-danger",
  STATUTORY: "soft-info",
  EMPLOYER_CONTRIBUTION: "soft-warning",
};

const money = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

function defaultValueLabel(c: PayrollComponent): string {
  if (c.default_percent != null && c.default_percent !== "")
    return `${Number(c.default_percent)}% of base`;
  if (c.default_amount != null && c.default_amount !== "")
    return money.format(Number(c.default_amount));
  return "—";
}

// =====================================================================
// Component create/edit modal
// =====================================================================

type CompForm = {
  code: string; name: string; component_type: PayrollComponentType;
  default_amount: string; default_percent: string;
  is_taxable: boolean; is_tax_relief: boolean; is_active: boolean;
  description: string;
};

function toCompForm(c?: PayrollComponent | null): CompForm {
  return {
    code: c?.code ?? "",
    name: c?.name ?? "",
    component_type: c?.component_type ?? "EARNING",
    default_amount: c?.default_amount != null ? String(c.default_amount) : "",
    default_percent: c?.default_percent != null ? String(c.default_percent) : "",
    is_taxable: c?.is_taxable ?? true,
    is_tax_relief: c?.is_tax_relief ?? false,
    is_active: c?.is_active ?? true,
    description: c?.description ?? "",
  };
}

function CheckRow({ label, hint, checked, onChange }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-secondary-300 accent-primary-600"
      />
      <span>
        <span className="block text-sm font-semibold text-secondary-800 dark:text-secondary-100">{label}</span>
        {hint && <span className="block text-[11px] text-secondary-400">{hint}</span>}
      </span>
    </label>
  );
}

function ComponentModal({ component, isOpen, onClose }: {
  component: PayrollComponent | null; isOpen: boolean; onClose: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CompForm>(() => toCompForm(component));
  const [seededFor, setSeededFor] = useState<number | "new" | null>(null);
  const key = component?.id ?? "new";
  if (isOpen && seededFor !== key) {
    setForm(toCompForm(component));
    setSeededFor(key);
  }
  if (!isOpen && seededFor !== null) setSeededFor(null);

  const save = useMutation({
    mutationFn: async () => {
      const payload: PayrollComponentPayload = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        component_type: form.component_type,
        calc_method: form.default_percent ? "PERCENT_OF_BASE" : "FIXED_AMOUNT",
        default_amount: form.default_amount || null,
        default_percent: form.default_percent || null,
        is_taxable: form.is_taxable,
        is_tax_relief: form.is_tax_relief,
        is_active: form.is_active,
        description: form.description || null,
      };
      return component
        ? updatePayrollComponent(component.id, payload)
        : createPayrollComponent(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll", "components"] });
      toast.success(component ? "Component updated" : "Component created",
        `${form.code.trim().toUpperCase()} saved.`);
      onClose();
    },
    onError: (err) => toast.error("Could not save component", apiErrorMessage(err)),
  });

  const submit = () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("Missing fields", "A code and a name are required.");
      return;
    }
    save.mutate();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md"
      title={component ? `Edit — ${component.code}` : "New Pay Component"}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button size="sm" onClick={submit} isLoading={save.isPending}>
            {component ? "Save changes" : "Create component"}
          </Button>
        </div>
      }>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Code" value={form.code} disabled={!!component?.is_statutory}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            hint="Short unique code, e.g. HOUSING." />
          <Input label="Name" value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Select label="Type" value={form.component_type} disabled={!!component?.is_statutory}
            onChange={(e) => setForm((f) => ({ ...f, component_type: e.target.value as PayrollComponentType }))}
            options={(Object.keys(TYPE_LABEL) as PayrollComponentType[])
              .filter((t) => component?.is_statutory || (t !== "STATUTORY" && t !== "EMPLOYER_CONTRIBUTION"))
              .map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
            hint="Statutory components are system-calculated." />
          <Input label="Default % of base" type="number" min="0" max="100" step="0.001"
            value={form.default_percent}
            onChange={(e) => setForm((f) => ({ ...f, default_percent: e.target.value }))}
            hint="Leave empty for amount-based." />
          <Input label="Default amount" type="number" min="0" step="0.01"
            value={form.default_amount}
            onChange={(e) => setForm((f) => ({ ...f, default_amount: e.target.value }))} />
          <Input label="Description" value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </div>
        <div className="space-y-2.5 rounded-2xl bg-secondary-50/70 p-4 dark:bg-white/5">
          {form.component_type === "EARNING" && (
            <CheckRow label="Taxable" checked={form.is_taxable}
              hint="Included in the PAYE taxable base."
              onChange={(v) => setForm((f) => ({ ...f, is_taxable: v }))} />
          )}
          {form.component_type === "DEDUCTION" && (
            <CheckRow label="Tax relief" checked={form.is_tax_relief}
              hint="Reduces the PAYE taxable base (e.g. NHIS, life insurance premiums)."
              onChange={(v) => setForm((f) => ({ ...f, is_tax_relief: v }))} />
          )}
          <CheckRow label="Active" checked={form.is_active}
            hint="Inactive components stay on history but can't be newly assigned."
            onChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
        </div>
      </div>
    </Modal>
  );
}

// =====================================================================
// Template editor (details + items) and apply modal
// =====================================================================

type ItemRow = { component_id: string; amount: string; percent: string };

function TemplateModal({ template, isOpen, onClose, components }: {
  template: PayrollComponentTemplate | null; isOpen: boolean; onClose: () => void;
  components: PayrollComponent[];
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [seededFor, setSeededFor] = useState<number | "new" | null>(null);
  const key = template?.id ?? "new";
  if (isOpen && seededFor !== key) {
    setCode(template?.code ?? "");
    setName(template?.name ?? "");
    setDescription(template?.description ?? "");
    setRows((template?.items ?? []).map((i) => ({
      component_id: String(i.component_id),
      amount: i.amount != null ? String(i.amount) : "",
      percent: i.percent != null ? String(i.percent) : "",
    })));
    setSeededFor(key);
  }
  if (!isOpen && seededFor !== null) setSeededFor(null);

  const assignable = useMemo(
    () => components.filter((c) =>
      c.is_active && !c.is_statutory &&
      (c.component_type === "EARNING" || c.component_type === "DEDUCTION")),
    [components],
  );
  const byId = useMemo(
    () => new Map(components.map((c) => [c.id, c])),
    [components],
  );

  const save = useMutation({
    mutationFn: async () => {
      let tpl = template;
      if (!tpl) {
        tpl = await createComponentTemplate({
          code: code.trim().toUpperCase(), name: name.trim(),
          description: description || null,
        });
      } else {
        tpl = await updateComponentTemplate(tpl.id, {
          name: name.trim(), description: description || null,
        });
      }
      const items: TemplateItemPayload[] = rows
        .filter((r) => r.component_id)
        .map((r) => ({
          component_id: Number(r.component_id),
          amount: r.amount || null,
          percent: r.percent || null,
        }));
      return replaceTemplateItems(tpl.id, items);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll", "component-templates"] });
      toast.success("Template saved", `${(template?.code ?? code).toUpperCase()} and its components were saved.`);
      onClose();
    },
    onError: (err) => toast.error("Could not save template", apiErrorMessage(err)),
  });

  const submit = () => {
    if (!template && !code.trim()) { toast.error("Missing code", "A template code is required."); return; }
    if (!name.trim()) { toast.error("Missing name", "A template name is required."); return; }
    for (const r of rows) {
      if (r.component_id && !r.amount && !r.percent) {
        toast.error("Incomplete item",
          `Give '${byId.get(Number(r.component_id))?.name ?? "component"}' an amount or a percent.`);
        return;
      }
    }
    save.mutate();
  };

  const setRow = (i: number, k: keyof ItemRow, v: string) => {
    setRows((prev) => prev.map((r, x) => (x === i ? { ...r, [k]: v } : r)));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg"
      title={template ? `Template — ${template.code}` : "New Pay Structure Template"}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button size="sm" onClick={submit} isLoading={save.isPending}>Save template</Button>
        </div>
      }>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          {!template && (
            <Input label="Code" value={code} onChange={(e) => setCode(e.target.value)}
              hint="Unique, e.g. NURSING-G7." />
          )}
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Description" value={description}
            onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-widest text-secondary-500">Components</p>
            <Button size="sm" variant="ghost" leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => setRows((r) => [...r, { component_id: "", amount: "", percent: "" }])}>
              Add component
            </Button>
          </div>
          {rows.length === 0 ? (
            <p className="text-xs text-secondary-400">
              No components yet — add earnings (allowances) and deductions. A 'BASIC'
              item with a fixed amount sets base pay when the template is applied.
            </p>
          ) : rows.map((r, i) => {
            const comp = r.component_id ? byId.get(Number(r.component_id)) : undefined;
            return (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={r.component_id}
                  onChange={(e) => setRow(i, "component_id", e.target.value)}
                  className="input-field flex-1"
                >
                  <option value="">Select component…</option>
                  {assignable.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name} ({TYPE_LABEL[c.component_type]})
                    </option>
                  ))}
                </select>
                <input type="number" min="0" placeholder="% of base" value={r.percent}
                  onChange={(e) => setRow(i, "percent", e.target.value)}
                  className="input-field w-28 text-right" />
                <input type="number" min="0" placeholder="Amount" value={r.amount}
                  onChange={(e) => setRow(i, "amount", e.target.value)}
                  className={`input-field w-32 text-right font-semibold ${comp?.component_type === "DEDUCTION" ? "text-rose-500" : "text-emerald-600"}`} />
                <button type="button" onClick={() => setRows(rows.filter((_, x) => x !== i))}
                  className="rounded-xl p-2 hover:bg-rose-50" title="Remove">
                  <Trash2 className="h-4 w-4 text-rose-400" />
                </button>
              </div>
            );
          })}
          <p className="text-[11px] text-secondary-400">
            Percent items are computed on each staff member's base pay at application
            time; amount items are fixed. Statutory items (PAYE, pension, NHF) are
            always computed by the payroll engine and cannot be added here.
          </p>
        </div>
      </div>
    </Modal>
  );
}

function ApplyModal({ template, isOpen, onClose }: {
  template: PayrollComponentTemplate | null; isOpen: boolean; onClose: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");

  const staffQuery = useQuery({
    queryKey: ["hr", "staff-records", "all"],
    staleTime: 5 * 60_000,
    queryFn: () => listStaffRecords(),
    enabled: isOpen,
  });
  const staff = staffQuery.data ?? [];
  const filtered = staff.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${s.staff_name ?? ""} ${s.staff_no}`.toLowerCase().includes(q);
  });

  const apply = useMutation({
    mutationFn: () => applyComponentTemplate(template!.id, {
      staff_profile_ids: Array.from(selected),
      ...(effectiveFrom ? { effective_from: effectiveFrom } : {}),
    }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["hr", "staff-records"] });
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      const skippedNote = res.skipped.length
        ? ` ${res.skipped.length} skipped (${res.skipped.map((x) => x.reason)[0]}…).`
        : "";
      toast.success("Template applied",
        `${res.applied.length} staff updated with a new salary structure.${skippedNote}`);
      setSelected(new Set());
      onClose();
    },
    onError: (err) => toast.error("Could not apply template", apiErrorMessage(err)),
  });

  const toggle = (id: number) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md"
      title={template ? `Apply — ${template.name}` : "Apply template"}
      footer={
        <div className="flex w-full items-center justify-between">
          <p className="text-xs text-secondary-400">{selected.size} staff selected</p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={apply.isPending}>Cancel</Button>
            <Button size="sm" onClick={() => apply.mutate()} isLoading={apply.isPending}
              disabled={selected.size === 0}>
              Apply to {selected.size || "…"} staff
            </Button>
          </div>
        </div>
      }>
      <div className="space-y-3">
        <p className="text-xs text-secondary-500">
          Applying writes a fresh, versioned salary structure per selected staff
          member from this template's components. Each staff member's current base
          pay is carried forward unless the template includes a fixed BASIC amount.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Search staff" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or staff no…" />
          <Input label="Effective from" type="date" value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)} hint="Defaults to today." />
        </div>
        <div className="max-h-72 overflow-y-auto rounded-2xl border border-secondary-100 dark:border-white/5 divide-y divide-secondary-100 dark:divide-white/5">
          {staffQuery.isLoading ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-2/3" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-xs text-secondary-400">No staff match.</p>
          ) : filtered.map((s) => (
            <label key={s.staff_profile_id}
              className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-secondary-50/60 dark:hover:bg-white/5">
              <input type="checkbox" checked={selected.has(s.staff_profile_id)}
                onChange={() => toggle(s.staff_profile_id)}
                className="h-4 w-4 rounded accent-primary-600" />
              <span className="flex-1">
                <span className="block text-sm font-semibold text-secondary-800 dark:text-secondary-100">
                  {s.staff_name || s.staff_no}
                </span>
                <span className="block text-[11px] text-secondary-400">
                  {s.staff_no}{s.department_name ? ` · ${s.department_name}` : ""}
                </span>
              </span>
              {s.has_salary && s.base_salary_amount ? (
                <span className="data-mono text-xs text-secondary-500">
                  {money.format(Number(s.base_salary_amount))}
                </span>
              ) : (
                <Badge variant="soft-warning">No salary</Badge>
              )}
            </label>
          ))}
        </div>
      </div>
    </Modal>
  );
}

// =====================================================================
// Page
// =====================================================================

export function PayrollComponentsPage() {
  const [editComponent, setEditComponent] = useState<PayrollComponent | null>(null);
  const [componentModalOpen, setComponentModalOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<PayrollComponentTemplate | null>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [applyTemplate, setApplyTemplate] = useState<PayrollComponentTemplate | null>(null);

  const componentsQuery = useQuery({
    queryKey: ["payroll", "components"],
    queryFn: listPayrollComponents,
  });
  const templatesQuery = useQuery({
    queryKey: ["payroll", "component-templates"],
    queryFn: listComponentTemplates,
  });
  const components = componentsQuery.data ?? [];
  const templates = templatesQuery.data ?? [];

  const grouped = useMemo(() => {
    const order: PayrollComponentType[] = [
      "EARNING", "DEDUCTION", "STATUTORY", "EMPLOYER_CONTRIBUTION",
    ];
    return order
      .map((t) => ({ type: t, items: components.filter((c) => c.component_type === t) }))
      .filter((g) => g.items.length > 0);
  }, [components]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pay Components"
        eyebrow={<SuiteEyebrow label="HR & Payroll Suite" />}
        description="The pay element catalog and reusable pay-structure templates."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" leftIcon={<Layers className="h-3.5 w-3.5" />}
              onClick={() => { setEditTemplate(null); setTemplateModalOpen(true); }}>
              New Template
            </Button>
            <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => { setEditComponent(null); setComponentModalOpen(true); }}>
              New Component
            </Button>
          </div>
        }
      />
      <PayrollTabs />

      {/* Templates */}
      <Card className="p-6 space-y-4">
        <p className="text-[11px] font-black uppercase tracking-widest text-secondary-500">
          Pay structure templates
        </p>
        {templatesQuery.isLoading ? (
          <div className="space-y-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
        ) : templates.length === 0 ? (
          <p className="text-sm text-secondary-400">
            No templates yet — create one to apply a standard pay structure to many staff at once.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {templates.map((t) => (
              <div key={t.id}
                className="rounded-2xl border border-secondary-100 p-4 space-y-2 dark:border-white/5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-secondary-900 dark:text-white">{t.name}</p>
                    <p className="data-mono text-[10px] text-secondary-400">{t.code}</p>
                  </div>
                  <Badge variant={t.is_active ? "soft-success" : "secondary"}>
                    {t.is_active ? "ACTIVE" : "INACTIVE"}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {t.items.map((i) => (
                    <span key={i.id}
                      className="rounded-lg bg-secondary-50 px-2 py-0.5 text-[10px] font-semibold text-secondary-600 dark:bg-white/10 dark:text-secondary-300">
                      {i.code}{i.percent ? ` ${Number(i.percent)}%` : i.amount ? ` ${money.format(Number(i.amount))}` : ""}
                    </span>
                  ))}
                  {t.items.length === 0 && (
                    <span className="text-[11px] text-secondary-400">No components yet.</span>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="secondary" leftIcon={<Pencil className="h-3.5 w-3.5" />}
                    onClick={() => { setEditTemplate(t); setTemplateModalOpen(true); }}>
                    Edit
                  </Button>
                  <Button size="sm" leftIcon={<Send className="h-3.5 w-3.5" />}
                    disabled={t.items.length === 0}
                    onClick={() => setApplyTemplate(t)}>
                    Apply to staff
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Component catalog */}
      <Card className="p-6 space-y-5">
        <p className="text-[11px] font-black uppercase tracking-widest text-secondary-500">
          Component catalog
        </p>
        {componentsQuery.isLoading ? (
          <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-2/3" /></div>
        ) : grouped.length === 0 ? (
          <p className="text-sm text-secondary-400">
            No components found — restart the backend so the catalog seeds, or create components manually.
          </p>
        ) : grouped.map((g) => (
          <div key={g.type} className="space-y-2">
            <Badge variant={TYPE_VARIANT[g.type]}>{TYPE_LABEL[g.type]}s</Badge>
            <div className="overflow-x-auto rounded-2xl border border-secondary-100 dark:border-white/5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-black uppercase tracking-widest text-secondary-400">
                    <th className="px-4 py-2.5">Code</th>
                    <th className="px-4 py-2.5">Name</th>
                    <th className="px-4 py-2.5 text-right">Default</th>
                    <th className="px-4 py-2.5">Tax</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary-100 dark:divide-white/5">
                  {g.items.map((c) => (
                    <tr key={c.id} className="hover:bg-secondary-50/60 dark:hover:bg-white/5">
                      <td className="data-mono px-4 py-2.5 text-xs font-bold">{c.code}</td>
                      <td className="px-4 py-2.5">
                        {c.name}
                        {c.description && (
                          <span className="block text-[11px] text-secondary-400">{c.description}</span>
                        )}
                      </td>
                      <td className="data-mono px-4 py-2.5 text-right text-xs">{defaultValueLabel(c)}</td>
                      <td className="px-4 py-2.5">
                        {c.component_type === "EARNING" && (
                          <Badge variant={c.is_taxable ? "soft-warning" : "secondary"}>
                            {c.is_taxable ? "Taxable" : "Tax-free"}
                          </Badge>
                        )}
                        {c.component_type === "DEDUCTION" && c.is_tax_relief && (
                          <Badge variant="soft-info">Tax relief</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={c.is_active ? "soft-success" : "secondary"}>
                          {c.is_active ? "ACTIVE" : "INACTIVE"}
                        </Badge>
                        {c.is_statutory && <Badge variant="outline">System</Badge>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button type="button" title="Edit component"
                          onClick={() => { setEditComponent(c); setComponentModalOpen(true); }}
                          className="rounded-lg p-2 text-secondary-400 hover:bg-primary-500/10 hover:text-primary-600">
                          <Pencil className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </Card>

      <ComponentModal component={editComponent} isOpen={componentModalOpen}
        onClose={() => setComponentModalOpen(false)} />
      <TemplateModal template={editTemplate} isOpen={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)} components={components} />
      <ApplyModal template={applyTemplate} isOpen={applyTemplate !== null}
        onClose={() => setApplyTemplate(null)} />
    </div>
  );
}
