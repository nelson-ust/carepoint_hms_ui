import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layers, Pencil, Plus, Send, Trash2 } from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxGrid, DxBadge, DxButton, DxInput, DxSelect, DxCheckbox, DxPopup,
  type DxGridColumn, type DxBadgeTone,
} from "@/components/dx";
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

const TYPE_TONE: Record<PayrollComponentType, DxBadgeTone> = {
  EARNING: "success",
  DEDUCTION: "danger",
  STATUTORY: "info",
  EMPLOYER_CONTRIBUTION: "warning",
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
    <DxPopup
      isOpen={isOpen} onClose={onClose} size="md"
      title={component ? `Edit — ${component.code}` : "New Pay Component"}
      locked={save.isPending}
      footer={
        <>
          <DxButton onClick={onClose} disabled={save.isPending}>Cancel</DxButton>
          <DxButton variant="primary" onClick={submit} isLoading={save.isPending}>{component ? "Save changes" : "Create component"}</DxButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <DxInput label="Code" value={form.code} disabled={!!component?.is_statutory}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} hint="Short unique code, e.g. HOUSING." />
          <DxInput label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <DxSelect label="Type" value={form.component_type} disabled={!!component?.is_statutory}
            onChange={(e) => setForm((f) => ({ ...f, component_type: e.target.value as PayrollComponentType }))}
            options={(Object.keys(TYPE_LABEL) as PayrollComponentType[])
              .filter((t) => component?.is_statutory || (t !== "STATUTORY" && t !== "EMPLOYER_CONTRIBUTION"))
              .map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
            hint="Statutory components are system-calculated." />
          <DxInput label="Default % of base" type="number" min="0" max="100" step="0.001" value={form.default_percent}
            onChange={(e) => setForm((f) => ({ ...f, default_percent: e.target.value }))} hint="Leave empty for amount-based." />
          <DxInput label="Default amount" type="number" min="0" step="0.01" value={form.default_amount}
            onChange={(e) => setForm((f) => ({ ...f, default_amount: e.target.value }))} />
          <DxInput label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </div>
        <div className="space-y-2.5 rounded-md bg-[var(--dx-surface-sunken)] p-4">
          {form.component_type === "EARNING" ? (
            <DxCheckbox label="Taxable" description="Included in the PAYE taxable base." checked={form.is_taxable}
              onChange={(e) => setForm((f) => ({ ...f, is_taxable: e.target.checked }))} />
          ) : null}
          {form.component_type === "DEDUCTION" ? (
            <DxCheckbox label="Tax relief" description="Reduces the PAYE taxable base (e.g. NHIS, life insurance premiums)." checked={form.is_tax_relief}
              onChange={(e) => setForm((f) => ({ ...f, is_tax_relief: e.target.checked }))} />
          ) : null}
          <DxCheckbox label="Active" description="Inactive components stay on history but can't be newly assigned." checked={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
        </div>
      </div>
    </DxPopup>
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
    <DxPopup
      isOpen={isOpen} onClose={onClose} size="lg"
      title={template ? `Template — ${template.code}` : "New Pay Structure Template"}
      locked={save.isPending}
      footer={
        <>
          <DxButton onClick={onClose} disabled={save.isPending}>Cancel</DxButton>
          <DxButton variant="primary" onClick={submit} isLoading={save.isPending}>Save template</DxButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {!template ? (
            <DxInput label="Code" value={code} onChange={(e) => setCode(e.target.value)} hint="Unique, e.g. NURSING-G7." />
          ) : null}
          <DxInput label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <DxInput label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="dx-field-label">Components</p>
            <DxButton size="sm" variant="accent-text" leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => setRows((r) => [...r, { component_id: "", amount: "", percent: "" }])}>
              Add component
            </DxButton>
          </div>
          {rows.length === 0 ? (
            <p className="text-[12px] text-[var(--dx-text-muted)]">
              No components yet — add earnings (allowances) and deductions. A 'BASIC' item with a fixed amount sets base pay when the template is applied.
            </p>
          ) : rows.map((r, i) => {
            const comp = r.component_id ? byId.get(Number(r.component_id)) : undefined;
            return (
              <div key={i} className="flex items-center gap-2">
                <select value={r.component_id} onChange={(e) => setRow(i, "component_id", e.target.value)} className="dx-editor flex-1">
                  <option value="">Select component…</option>
                  {assignable.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.name} ({TYPE_LABEL[c.component_type]})</option>
                  ))}
                </select>
                <input type="number" min="0" placeholder="% of base" value={r.percent}
                  onChange={(e) => setRow(i, "percent", e.target.value)} className="dx-editor w-28 text-right" />
                <input type="number" min="0" placeholder="Amount" value={r.amount}
                  onChange={(e) => setRow(i, "amount", e.target.value)}
                  className="dx-editor w-32 text-right font-semibold"
                  style={{ color: comp?.component_type === "DEDUCTION" ? "var(--dx-danger)" : "var(--dx-success)" }} />
                <DxButton icon size="sm" variant="outline-danger" title="Remove" onClick={() => setRows(rows.filter((_, x) => x !== i))}>
                  <Trash2 />
                </DxButton>
              </div>
            );
          })}
          <p className="text-[11px] text-[var(--dx-text-muted)]">
            Percent items are computed on each staff member's base pay at application time; amount items are fixed. Statutory items (PAYE, pension, NHF) are always computed by the payroll engine and cannot be added here.
          </p>
        </div>
      </div>
    </DxPopup>
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
    <DxPopup
      isOpen={isOpen} onClose={onClose} size="md"
      title={template ? `Apply — ${template.name}` : "Apply template"}
      locked={apply.isPending}
      footer={
        <div className="flex w-full items-center justify-between">
          <p className="text-[12px] text-[var(--dx-text-muted)]">{selected.size} staff selected</p>
          <div className="flex gap-2">
            <DxButton onClick={onClose} disabled={apply.isPending}>Cancel</DxButton>
            <DxButton variant="primary" onClick={() => apply.mutate()} isLoading={apply.isPending} disabled={selected.size === 0}>
              Apply to {selected.size || "…"} staff
            </DxButton>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-[12px] text-[var(--dx-text-muted)]">
          Applying writes a fresh, versioned salary structure per selected staff member from this template's components. Each staff member's current base pay is carried forward unless the template includes a fixed BASIC amount.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <DxInput label="Search staff" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or staff no…" />
          <DxInput label="Effective from" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} hint="Defaults to today." />
        </div>
        <div className="max-h-72 divide-y divide-[var(--dx-border)] overflow-y-auto rounded-md border border-[var(--dx-border)]">
          {staffQuery.isLoading ? (
            <div className="space-y-2 p-4"><div className="dx-skeleton h-5 w-full" /><div className="dx-skeleton h-5 w-2/3" /></div>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-[12px] text-[var(--dx-text-muted)]">No staff match.</p>
          ) : filtered.map((s) => (
            <label key={s.staff_profile_id} className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-[var(--dx-surface-sunken)]">
              <input type="checkbox" checked={selected.has(s.staff_profile_id)} onChange={() => toggle(s.staff_profile_id)}
                className="h-4 w-4 rounded" style={{ accentColor: "var(--dx-accent)" }} />
              <span className="flex-1">
                <span className="block text-[13px] font-semibold text-[var(--dx-text)]">{s.staff_name || s.staff_no}</span>
                <span className="block text-[11px] text-[var(--dx-text-muted)]">{s.staff_no}{s.department_name ? ` · ${s.department_name}` : ""}</span>
              </span>
              {s.has_salary && s.base_salary_amount ? (
                <span className="dx-mono text-[12px] text-[var(--dx-text-muted)]">{money.format(Number(s.base_salary_amount))}</span>
              ) : (
                <DxBadge tone="warning">No salary</DxBadge>
              )}
            </label>
          ))}
        </div>
      </div>
    </DxPopup>
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

  const catalogColumns: DxGridColumn<PayrollComponent>[] = [
    { key: "code", header: "Code", render: (c) => <span className="dx-mono text-[12px] font-bold text-[var(--dx-text)]">{c.code}</span> },
    {
      key: "name", header: "Name", render: (c) => (
        <div>
          <span className="text-[13px] text-[var(--dx-text)]">{c.name}</span>
          {c.description ? <span className="block text-[11px] text-[var(--dx-text-muted)]">{c.description}</span> : null}
        </div>
      ),
    },
    { key: "default", header: "Default", align: "right", render: (c) => <span className="dx-mono text-[12px] text-[var(--dx-text)]">{defaultValueLabel(c)}</span> },
    {
      key: "tax", header: "Tax", render: (c) => (
        <>
          {c.component_type === "EARNING" ? <DxBadge tone={c.is_taxable ? "warning" : "neutral"}>{c.is_taxable ? "Taxable" : "Tax-free"}</DxBadge> : null}
          {c.component_type === "DEDUCTION" && c.is_tax_relief ? <DxBadge tone="info">Tax relief</DxBadge> : null}
        </>
      ),
    },
    {
      key: "status", header: "Status", render: (c) => (
        <span className="flex flex-wrap items-center gap-1">
          <DxBadge tone={c.is_active ? "success" : "neutral"}>{c.is_active ? "ACTIVE" : "INACTIVE"}</DxBadge>
          {c.is_statutory ? <DxBadge tone="neutral">System</DxBadge> : null}
        </span>
      ),
    },
    {
      key: "action", header: "", align: "right",
      render: (c) => <DxButton icon size="sm" variant="text" title="Edit component" onClick={() => { setEditComponent(c); setComponentModalOpen(true); }}><Pencil /></DxButton>,
    },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "HR & Payroll" }, { label: "Pay Components" }]}
        title="Pay Components"
        subtitle="The pay element catalog and reusable pay-structure templates."
        actions={
          <>
            <DxButton leftIcon={<Layers className="h-4 w-4" />} onClick={() => { setEditTemplate(null); setTemplateModalOpen(true); }}>New template</DxButton>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setEditComponent(null); setComponentModalOpen(true); }}>New component</DxButton>
          </>
        }
      />
      <PayrollTabs />

      {/* Templates */}
      <DxPanel title="Pay structure templates" icon={<Layers className="h-4 w-4" />}>
        {templatesQuery.isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="dx-skeleton h-28 w-full" />)}</div>
        ) : templates.length === 0 ? (
          <p className="text-[13px] text-[var(--dx-text-muted)]">No templates yet — create one to apply a standard pay structure to many staff at once.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {templates.map((t) => (
              <div key={t.id} className="space-y-2 rounded-lg border border-[var(--dx-border)] bg-[var(--dx-surface)] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-[var(--dx-text)]">{t.name}</p>
                    <p className="dx-mono text-[10px] text-[var(--dx-text-muted)]">{t.code}</p>
                  </div>
                  <DxBadge tone={t.is_active ? "success" : "neutral"}>{t.is_active ? "ACTIVE" : "INACTIVE"}</DxBadge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {t.items.map((i) => (
                    <span key={i.id} className="rounded-md bg-[var(--dx-surface-sunken)] px-2 py-0.5 text-[10px] font-semibold text-[var(--dx-text-muted)]">
                      {i.code}{i.percent ? ` ${Number(i.percent)}%` : i.amount ? ` ${money.format(Number(i.amount))}` : ""}
                    </span>
                  ))}
                  {t.items.length === 0 ? <span className="text-[11px] text-[var(--dx-text-muted)]">No components yet.</span> : null}
                </div>
                <div className="flex gap-2 pt-1">
                  <DxButton size="sm" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => { setEditTemplate(t); setTemplateModalOpen(true); }}>Edit</DxButton>
                  <DxButton size="sm" variant="primary" leftIcon={<Send className="h-3.5 w-3.5" />} disabled={t.items.length === 0} onClick={() => setApplyTemplate(t)}>Apply to staff</DxButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </DxPanel>

      {/* Component catalog */}
      <DxPanel title="Component catalog" icon={<Plus className="h-4 w-4" />}>
        {componentsQuery.isLoading ? (
          <div className="space-y-2"><div className="dx-skeleton h-10 w-full" /><div className="dx-skeleton h-10 w-full" /><div className="dx-skeleton h-10 w-2/3" /></div>
        ) : grouped.length === 0 ? (
          <p className="text-[13px] text-[var(--dx-text-muted)]">No components found — restart the backend so the catalog seeds, or create components manually.</p>
        ) : (
          <div className="space-y-5">
            {grouped.map((g) => (
              <div key={g.type} className="space-y-2">
                <DxBadge tone={TYPE_TONE[g.type]}>{TYPE_LABEL[g.type]}s</DxBadge>
                <div className="overflow-hidden rounded-md border border-[var(--dx-border)]">
                  <DxGrid<PayrollComponent> columns={catalogColumns} data={g.items} rowKey={(c) => c.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </DxPanel>

      <ComponentModal component={editComponent} isOpen={componentModalOpen} onClose={() => setComponentModalOpen(false)} />
      <TemplateModal template={editTemplate} isOpen={templateModalOpen} onClose={() => setTemplateModalOpen(false)} components={components} />
      <ApplyModal template={applyTemplate} isOpen={applyTemplate !== null} onClose={() => setApplyTemplate(null)} />
    </DxPage>
  );
}
